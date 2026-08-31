import { createServer } from 'node:http';
import { Server, type Socket } from 'socket.io';
import { closeDb } from './db.js';
import { handleHttp } from './http.js';
import type { ClientToServerEvents, ServerToClientEvents } from './protocol.js';
import {
  HOST_GRACE_MS,
  addMember,
  createRoom,
  deleteRoom,
  expiredRooms,
  getRoom,
  memberList,
  roomCount,
  touch,
  type Room,
} from './rooms.js';

interface SocketData {
  code: string | null;
  playerId: string | null;
}

type BluffSocket = Socket<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>;

const PORT = Number(process.env.PORT ?? 3001);

const httpServer = createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ ok: true, rooms: roomCount() }));
    return;
  }
  handleHttp(req, res)
    .then((matched) => {
      if (!matched) {
        res.writeHead(404);
        res.end();
      }
    })
    .catch(() => {
      if (!res.headersSent) res.writeHead(500, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: 'internal' }));
    });
});

const io = new Server<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>(httpServer, {
  cors: { origin: '*' },
});

function broadcastMembers(room: Room): void {
  io.to(room.code).emit('room:members', { members: memberList(room), hostPlayerId: room.hostPlayerId });
}

function closeRoom(room: Room, reason: 'host_left' | 'expired'): void {
  io.to(room.code).emit('room:closed', { reason });
  io.in(room.code).socketsLeave(room.code);
  deleteRoom(room.code);
}

function hostSocket(room: Room): BluffSocket | undefined {
  const host = room.members.get(room.hostPlayerId);
  if (!host?.socketId) return undefined;
  return io.sockets.sockets.get(host.socketId) as BluffSocket | undefined;
}

io.on('connection', (socket: BluffSocket) => {
  socket.data.code = null;
  socket.data.playerId = null;

  socket.on('room:create', ({ name }, ack) => {
    const created = createRoom(String(name).slice(0, 20), socket.id);
    if (!created) {
      ack({ ok: false, reason: 'unavailable' });
      return;
    }
    const { room, host } = created;
    socket.data.code = room.code;
    socket.data.playerId = host.playerId;
    socket.join(room.code);
    ack({ ok: true, code: room.code, playerId: host.playerId, sessionToken: host.sessionToken });
    broadcastMembers(room);
  });

  socket.on('room:join', ({ code, name }, ack) => {
    const room = getRoom(String(code));
    if (!room) {
      ack({ ok: false, reason: 'not_found' });
      return;
    }
    const member = addMember(room, String(name).slice(0, 20), socket.id);
    if (member === 'full') {
      ack({ ok: false, reason: 'full' });
      return;
    }
    socket.data.code = room.code;
    socket.data.playerId = member.playerId;
    socket.join(room.code);
    ack({
      ok: true,
      playerId: member.playerId,
      sessionToken: member.sessionToken,
      members: memberList(room),
      hostPlayerId: room.hostPlayerId,
    });
    broadcastMembers(room);
  });

  socket.on('room:rejoin', ({ code, playerId, sessionToken }, ack) => {
    const room = getRoom(String(code));
    const member = room?.members.get(String(playerId));
    if (!room || !member) {
      ack({ ok: false, reason: 'not_found' });
      return;
    }
    if (member.sessionToken !== sessionToken) {
      ack({ ok: false, reason: 'bad_token' });
      return;
    }
    member.socketId = socket.id;
    socket.data.code = room.code;
    socket.data.playerId = member.playerId;
    socket.join(room.code);
    touch(room);
    if (member.playerId === room.hostPlayerId && room.hostGraceTimer) {
      clearTimeout(room.hostGraceTimer);
      room.hostGraceTimer = null;
    }
    ack({ ok: true });
    broadcastMembers(room);
  });

  // Acked: the client disconnects right after leaving, and a socket.disconnect() racing
  // an in-flight emit can drop it — so the client waits for this callback.
  socket.on('room:leave', (ack) => {
    leaveCurrentRoom(socket, true);
    ack?.();
  });

  // Guest action → host. The server stamps the sender identity: the host must NEVER
  // trust a playerId embedded in the payload itself.
  socket.on('game:toHost', ({ payload }) => {
    const room = socket.data.code ? getRoom(socket.data.code) : undefined;
    if (!room || !socket.data.playerId) return;
    touch(room);
    hostSocket(room)?.emit('game:fromPlayer', { fromPlayerId: socket.data.playerId, payload });
  });

  socket.on('game:toPlayer', ({ playerId, payload }) => {
    const room = socket.data.code ? getRoom(socket.data.code) : undefined;
    if (!room || socket.data.playerId !== room.hostPlayerId) return; // host only
    touch(room);
    const target = room.members.get(String(playerId));
    if (!target?.socketId) return;
    io.sockets.sockets.get(target.socketId)?.emit('game:fromHost', { payload });
  });

  socket.on('game:broadcast', ({ payload }) => {
    const room = socket.data.code ? getRoom(socket.data.code) : undefined;
    if (!room || socket.data.playerId !== room.hostPlayerId) return; // host only
    touch(room);
    socket.to(room.code).emit('game:fromHost', { payload });
  });

  socket.on('disconnect', () => {
    leaveCurrentRoom(socket, false);
  });
});

function leaveCurrentRoom(socket: BluffSocket, explicit: boolean): void {
  const { code, playerId } = socket.data;
  if (!code || !playerId) return;
  const room = getRoom(code);
  socket.data.code = null;
  socket.data.playerId = null;
  socket.leave(code);
  if (!room) return;
  const member = room.members.get(playerId);
  if (!member) return;

  if (explicit) {
    room.members.delete(playerId);
    if (playerId === room.hostPlayerId) {
      closeRoom(room, 'host_left');
      return;
    }
    broadcastMembers(room);
    return;
  }

  // Unexpected drop: keep the seat, allow rejoin. The host gets a grace window before
  // the whole table is torn down.
  member.socketId = null;
  if (playerId === room.hostPlayerId) {
    room.hostGraceTimer = setTimeout(() => {
      const current = getRoom(code);
      if (current && current.members.get(current.hostPlayerId)?.socketId === null) {
        closeRoom(current, 'host_left');
      }
    }, HOST_GRACE_MS);
  }
  broadcastMembers(room);
}

setInterval(() => {
  for (const room of expiredRooms(Date.now())) closeRoom(room, 'expired');
}, 60_000).unref();

httpServer.listen(PORT, () => {
  console.log(`[bluff-relay] listening on :${PORT}`);
});

// Fly's autostop sends SIGINT when the machine idles out — exit cleanly instead of
// being killed by the signal. Rooms are in-memory and disposable; the SQLite handle
// is closed so the WAL checkpoints onto the volume.
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    console.log(`[bluff-relay] ${signal} received, shutting down`);
    closeDb();
    io.close(() => process.exit(0));
    // Belt and braces if a lingering connection stalls the close.
    setTimeout(() => process.exit(0), 3000).unref();
  });
}
