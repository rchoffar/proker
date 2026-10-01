import { createServer } from 'node:http';
import { Server, type Socket } from 'socket.io';
import { createAdapter } from '@socket.io/postgres-adapter';
import { waitUntil } from '@vercel/functions';
import { databasePool, onDatabaseInterruption } from './postgres.js';
import { handleHttp } from './http.js';
import type { ClientToServerEvents, ServerToClientEvents } from './protocol.js';
import { createRoom, currentMember, memberList, newMember, roomCodes, roomCount, updateRoom, touch,
  HOST_GRACE_MS, MAX_MEMBERS, PRESENCE_LEASE_MS, type Room, type RoomUpdate } from './rooms.js';

interface SocketData { code: string | null; playerId: string | null }
type BluffSocket = Socket<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>;

export async function createRelay() {
  const httpServer = createServer((req, res) => {
    const handle = async () => {
      if ((req.url ?? '').split('?')[0] === '/health') {
        await databasePool().query('SELECT 1');
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ ok: true, rooms: await roomCount() }));
      } else if (!(await handleHttp(req, res))) {
        res.writeHead(404);
        res.end();
      }
    };
    void handle().catch(() => {
      if (!res.headersSent) res.writeHead(503, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: 'internal' }));
    });
  });
  const io = new Server<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>(httpServer, {
    cors: { origin: '*' }, transports: ['websocket'],
  });
  const adapter = createAdapter(databasePool(true), {
    channelPrefix: process.env.SOCKET_IO_CHANNEL_PREFIX ?? 'proker',
    errorHandler: (error) => {
      // Error class/code and stack location help diagnose failures without
      // logging PostgreSQL credentials, SQL parameters or game payloads.
      console.error('[relay] distributed delivery interrupted', error.name,
        (error as NodeJS.ErrnoException).code ?? '', error.stack?.split('\n')[1] ?? '');
      for (const socket of io.sockets.sockets.values()) socket.conn.close();
    },
  });
  io.adapter(adapter);
  const stopListening = onDatabaseInterruption(() => {
    for (const socket of io.sockets.sockets.values()) socket.conn.close();
  });

  function broadcastMembers(room: Room): void {
    io.to(room.code).emit('room:members', { members: memberList(room), hostPlayerId: room.hostPlayerId });
  }
  function notifyUpdate<T>(code: string, result: RoomUpdate<T>): void {
    if (result.closed) {
      io.to(code).emit('room:closed', { reason: result.closed });
      io.in(code).socketsLeave(code);
    } else if (result.room && result.presenceChanged) broadcastMembers(result.room);
  }
  async function change<T>(code: string, action: (room: Room) => T): Promise<RoomUpdate<T>> {
    const result = await updateRoom(code, action, new Set(io.sockets.sockets.keys()));
    notifyUpdate(code, result);
    return result;
  }
  async function leave(socket: BluffSocket, explicit: boolean): Promise<void> {
    const { code, playerId } = socket.data;
    socket.data.code = null;
    socket.data.playerId = null;
    if (!code || !playerId) return;
    const result = await change(code, (room) => {
      const member = currentMember(room, playerId, socket.id);
      if (!member) return;
      if (explicit) {
        delete room.members[playerId];
        if (playerId === room.hostPlayerId) room.closed = 'host_left';
      } else {
        member.socketId = null;
        if (playerId === room.hostPlayerId) room.hostGraceUntil = Date.now() + HOST_GRACE_MS;
      }
    });
    await socket.leave(code);
    if (result.room) broadcastMembers(result.room);
  }

  io.on('connection', (socket: BluffSocket) => {
    socket.data.code = null;
    socket.data.playerId = null;
    // Preserve receive order when asynchronous database operations overlap.
    let pending = Promise.resolve();
    const queue = (action: () => Promise<void>) => {
      pending = pending.then(action).catch(() => {
        console.error('[relay] operation failed; client must reconnect');
        // A transport close triggers the existing application-level rejoin/state sync.
        socket.conn.close();
      });
      // Vercel may suspend an invocation as soon as its WebSocket closes.
      // Keep queued writes alive through disconnect and commit/rollback.
      waitUntil(pending);
    };
    socket.on('room:create', (payload, ack) => queue(async () => {
      if (socket.data.code) await leave(socket, true);
      const created = await createRoom(String(payload?.name ?? '').slice(0, 20), socket.id);
      if (!created) { ack({ ok: false, reason: 'unavailable' }); return; }
      const { room, host } = created;
      socket.data.code = room.code;
      socket.data.playerId = host.playerId;
      await socket.join(room.code);
      ack({ ok: true, code: room.code, playerId: host.playerId, sessionToken: host.sessionToken });
      broadcastMembers(room);
    }));
    socket.on('room:join', (payload, ack) => queue(async () => {
      if (socket.data.code) await leave(socket, true);
      const code = String(payload?.code ?? '');
      const result = await change(code, (room) => {
        if (room.started) return 'started' as const;
        if (Object.keys(room.members).length >= MAX_MEMBERS) return 'full' as const;
        const member = newMember(String(payload?.name ?? '').slice(0, 20), socket.id);
        room.members[member.playerId] = member;
        touch(room);
        return member;
      });
      if (!result.room || !result.value) { ack({ ok: false, reason: 'not_found' }); return; }
      if (typeof result.value === 'string') { ack({ ok: false, reason: result.value }); return; }
      const member = result.value;
      socket.data.code = code;
      socket.data.playerId = member.playerId;
      await socket.join(code);
      ack({ ok: true, playerId: member.playerId, sessionToken: member.sessionToken,
        members: memberList(result.room), hostPlayerId: result.room.hostPlayerId });
      broadcastMembers(result.room);
    }));
    socket.on('room:rejoin', (payload, ack) => queue(async () => {
      const code = String(payload?.code ?? '');
      const playerId = String(payload?.playerId ?? '');
      const result = await change(code, (room) => {
        const member = Object.hasOwn(room.members, playerId) ? room.members[playerId] : undefined;
        if (!member) return 'not_found' as const;
        if (typeof payload?.sessionToken !== 'string' || member.sessionToken !== payload.sessionToken) return 'bad_token' as const;
        const oldSocketId = member.socketId;
        member.socketId = socket.id;
        member.leaseUntil = Date.now() + PRESENCE_LEASE_MS;
        if (playerId === room.hostPlayerId) room.hostGraceUntil = null;
        touch(room);
        return { oldSocketId };
      });
      if (!result.room || !result.value) { ack({ ok: false, reason: 'not_found' }); return; }
      if (typeof result.value === 'string') { ack({ ok: false, reason: result.value }); return; }
      if (result.value.oldSocketId && result.value.oldSocketId !== socket.id) io.in(result.value.oldSocketId).socketsLeave(code);
      socket.data.code = code;
      socket.data.playerId = playerId;
      await socket.join(code);
      ack({ ok: true });
      broadcastMembers(result.room);
    }));
    socket.on('room:lock', () => queue(async () => {
      if (!socket.data.code) return;
      await change(socket.data.code, (room) => {
        if (!currentMember(room, socket.data.playerId, socket.id) || socket.data.playerId !== room.hostPlayerId) return;
        room.started = true;
        touch(room);
      });
    }));
    socket.on('room:leave', (ack) => queue(async () => { await leave(socket, true); ack?.(); }));
    socket.on('game:toHost', (message) => queue(async () => {
      if (!socket.data.code) return;
      const result = await change(socket.data.code, (room) => {
        if (!currentMember(room, socket.data.playerId, socket.id)) return;
        touch(room);
        return room.members[room.hostPlayerId]?.socketId;
      });
      if (result.value) io.to(result.value).emit('game:fromPlayer', { fromPlayerId: socket.data.playerId!, payload: message?.payload });
    }));
    socket.on('game:toPlayer', (message) => queue(async () => {
      if (!socket.data.code) return;
      const result = await change(socket.data.code, (room) => {
        if (!currentMember(room, socket.data.playerId, socket.id) || socket.data.playerId !== room.hostPlayerId) return;
        touch(room);
        return room.members[String(message?.playerId ?? '')]?.socketId;
      });
      if (result.value) io.to(result.value).emit('game:fromHost', { payload: message?.payload });
    }));
    socket.on('game:broadcast', (message) => queue(async () => {
      if (!socket.data.code) return;
      const code = socket.data.code;
      const result = await change(code, (room) => {
        if (!currentMember(room, socket.data.playerId, socket.id) || socket.data.playerId !== room.hostPlayerId) return false;
        touch(room);
        return true;
      });
      if (result.value) socket.to(code).emit('game:fromHost', { payload: message?.payload });
    }));
    socket.on('disconnect', () => queue(async () => { await leave(socket, false); }));
  });

  let maintenanceRunning = false;
  const timer = setInterval(() => {
    if (maintenanceRunning || io.engine.clientsCount === 0) return;
    maintenanceRunning = true;
    const maintenance = (async () => {
      // Renew local sockets under the same row lock as joins and disconnects.
      const local = new Set(io.sockets.sockets.keys());
      for (const code of await roomCodes()) {
        await change(code, (room) => {
          for (const member of Object.values(room.members)) {
            if (member.socketId && local.has(member.socketId)) member.leaseUntil = Date.now() + PRESENCE_LEASE_MS;
          }
        });
      }
    })().catch(() => {
      console.error('[relay] presence maintenance interrupted');
      for (const socket of io.sockets.sockets.values()) socket.conn.close();
    }).finally(() => { maintenanceRunning = false; });
    waitUntil(maintenance);
  }, 10_000);
  timer.unref();
  return { httpServer, io, close: async () => {
    stopListening();
    clearInterval(timer);
    await new Promise<void>((resolve) => io.close(() => resolve()));
  } };
}
