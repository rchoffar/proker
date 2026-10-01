import { randomBytes, randomUUID } from 'node:crypto';
import { databasePool, transaction } from './postgres.js';
import type { MemberInfo } from './protocol.js';

export interface Member {
  playerId: string;
  name: string;
  socketId: string | null;
  sessionToken: string;
  leaseUntil: number;
}
export interface Room {
  code: string;
  hostPlayerId: string;
  members: Record<string, Member>;
  createdAt: number;
  lastActivity: number;
  hostGraceUntil: number | null;
  started: boolean;
  closed?: 'host_left' | 'expired';
}
export const MAX_MEMBERS = 6;
export const ROOM_IDLE_TTL_MS = 30 * 60 * 1000;
export const HOST_GRACE_MS = 60 * 1000;
export const PRESENCE_LEASE_MS = 45 * 1000;

export function newMember(name: string, socketId: string, now = Date.now()): Member {
  return { playerId: randomUUID(), name, socketId, sessionToken: randomBytes(16).toString('hex'), leaseUntil: now + PRESENCE_LEASE_MS };
}

/** Dead instances cannot run disconnect handlers, so presence expires in PostgreSQL. */
export function expirePresence(room: Room, now = Date.now()): void {
  for (const member of Object.values(room.members)) {
    if (member.socketId && member.leaseUntil <= now) {
      if (member.playerId === room.hostPlayerId) room.hostGraceUntil = member.leaseUntil + HOST_GRACE_MS;
      member.socketId = null;
    }
  }
  if (now - room.lastActivity >= ROOM_IDLE_TTL_MS) room.closed = 'expired';
  else if (room.hostGraceUntil !== null && room.hostGraceUntil <= now) room.closed = 'host_left';
}

export async function createRoom(name: string, socketId: string): Promise<{ room: Room; host: Member } | null> {
  for (let attempt = 0; attempt < 10; attempt++) {
    const code = String(Math.floor(Math.random() * 10_000)).padStart(4, '0');
    const host = newMember(name, socketId);
    const room: Room = { code, hostPlayerId: host.playerId, members: { [host.playerId]: host }, createdAt: Date.now(),
      lastActivity: Date.now(), hostGraceUntil: null, started: false };
    const result = await databasePool().query('INSERT INTO rooms (code, state) VALUES ($1, $2) ON CONFLICT (code) DO NOTHING', [code, JSON.stringify(room)]);
    if (result.rowCount) return { room, host };
  }
  return null;
}

export interface RoomUpdate<T> {
  room: Room | null;
  value: T | undefined;
  closed?: 'host_left' | 'expired';
  presenceChanged: boolean;
}

/** The row lock makes room membership, rejoin, lock and leave atomic across instances. */
export async function updateRoom<T>(code: string, action: (room: Room) => T, localSockets?: ReadonlySet<string>): Promise<RoomUpdate<T>> {
  return transaction(async (client) => {
    const result = await client.query<{ state: Room }>('SELECT state FROM rooms WHERE code = $1 FOR UPDATE', [code]);
    const room = result.rows[0]?.state;
    if (!room) return { room: null, value: undefined, presenceChanged: false };
    for (const member of Object.values(room.members)) {
      if (member.socketId && localSockets?.has(member.socketId)) member.leaseUntil = Date.now() + PRESENCE_LEASE_MS;
    }
    const before = Object.values(room.members).filter((m) => m.socketId).length;
    expirePresence(room);
    const presenceChanged = before !== Object.values(room.members).filter((m) => m.socketId).length;
    const value = room.closed ? undefined : action(room);
    if (room.closed) {
      await client.query('DELETE FROM rooms WHERE code = $1', [code]);
      return { room: null, value, closed: room.closed, presenceChanged };
    }
    await client.query('UPDATE rooms SET state = $2 WHERE code = $1', [code, JSON.stringify(room)]);
    return { room, value, presenceChanged };
  });
}

export function memberList(room: Room): MemberInfo[] {
  return Object.values(room.members).map((m) => ({ playerId: m.playerId, name: m.name, connected: m.socketId !== null }));
}
export function currentMember(room: Room, playerId: string | null, socketId: string): Member | undefined {
  if (!playerId || !Object.hasOwn(room.members, playerId)) return undefined;
  const member = room.members[playerId];
  return member?.socketId === socketId ? member : undefined;
}
export function touch(room: Room): void { room.lastActivity = Date.now(); }

export async function roomCodes(): Promise<string[]> {
  return (await databasePool().query<{ code: string }>('SELECT code FROM rooms')).rows.map((row) => row.code);
}
export async function roomCount(): Promise<number> {
  return Number((await databasePool().query('SELECT COUNT(*) AS count FROM rooms')).rows[0].count);
}
