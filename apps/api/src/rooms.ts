import { randomBytes, randomUUID } from 'node:crypto';
import type { MemberInfo } from './protocol.js';

export interface Member {
  playerId: string;
  name: string;
  socketId: string | null; // null while disconnected (grace window for rejoin)
  sessionToken: string;
}

export interface Room {
  code: string;
  hostPlayerId: string;
  members: Map<string, Member>; // keyed by playerId, includes the host
  createdAt: number;
  lastActivity: number;
  hostGraceTimer: NodeJS.Timeout | null;
  /**
   * Set by the host when it deals the first hand. The relay itself has no idea what a game
   * is — the engine runs on the host's phone — but it has to know this much to stop letting
   * people in afterwards: the host snapshots the member list when it starts, so a late
   * joiner is in the room and not in the game, and their screen had nothing to render.
   */
  started: boolean;
}

export const MAX_MEMBERS = 6;
export const ROOM_IDLE_TTL_MS = 30 * 60 * 1000;
export const HOST_GRACE_MS = 60 * 1000;

const rooms = new Map<string, Room>();

function generateCode(): string | null {
  for (let attempt = 0; attempt < 10; attempt++) {
    const code = String(Math.floor(Math.random() * 10_000)).padStart(4, '0');
    if (!rooms.has(code)) return code;
  }
  return null;
}

export function createRoom(hostName: string, hostSocketId: string): { room: Room; host: Member } | null {
  const code = generateCode();
  if (!code) return null;
  const host: Member = {
    playerId: randomUUID(),
    name: hostName,
    socketId: hostSocketId,
    sessionToken: randomBytes(16).toString('hex'),
  };
  const room: Room = {
    code,
    hostPlayerId: host.playerId,
    members: new Map([[host.playerId, host]]),
    createdAt: Date.now(),
    lastActivity: Date.now(),
    hostGraceTimer: null,
    started: false,
  };
  rooms.set(code, room);
  return { room, host };
}

export function getRoom(code: string): Room | undefined {
  return rooms.get(code);
}

export function addMember(room: Room, name: string, socketId: string): Member | 'full' {
  if (room.members.size >= MAX_MEMBERS) return 'full';
  const member: Member = {
    playerId: randomUUID(),
    name,
    socketId,
    sessionToken: randomBytes(16).toString('hex'),
  };
  room.members.set(member.playerId, member);
  room.lastActivity = Date.now();
  return member;
}

export function deleteRoom(code: string): void {
  const room = rooms.get(code);
  if (room?.hostGraceTimer) clearTimeout(room.hostGraceTimer);
  rooms.delete(code);
}

export function touch(room: Room): void {
  room.lastActivity = Date.now();
}

export function memberList(room: Room): MemberInfo[] {
  return [...room.members.values()].map((m) => ({
    playerId: m.playerId,
    name: m.name,
    connected: m.socketId !== null,
  }));
}

/** Rooms idle past the TTL, or emptied out entirely — swept by the caller. */
export function expiredRooms(now: number): Room[] {
  return [...rooms.values()].filter(
    (room) =>
      now - room.lastActivity > ROOM_IDLE_TTL_MS ||
      [...room.members.values()].every((m) => m.socketId === null),
  );
}

export function roomCount(): number {
  return rooms.size;
}
