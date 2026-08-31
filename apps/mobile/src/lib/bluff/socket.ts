import { io, type Socket } from 'socket.io-client';
import { BLUFF_SERVER_URL } from './config';
import type { ClientToServerEvents, ServerToClientEvents } from './protocol';

export type BluffSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

let socket: BluffSocket | null = null;

/**
 * Lazily created singleton. Websocket transport only — long-polling is flaky in RN and
 * would require sticky sessions server-side. Callers own connect()/disconnect().
 */
export function getBluffSocket(): BluffSocket {
  if (!socket) {
    socket = io(BLUFF_SERVER_URL, {
      transports: ['websocket'],
      autoConnect: false,
      reconnection: true,
      reconnectionDelay: 500,
      reconnectionDelayMax: 4000,
    });
  }
  return socket;
}

/** How long to wait for the server to acknowledge a leave before dropping the socket. */
const LEAVE_ACK_TIMEOUT_MS = 1000;

/**
 * Leave the room, then drop the socket — in that order, and only once the server has
 * acknowledged. `disconnect()` fired immediately after an `emit` can tear the transport
 * down with the leave still in flight, which leaves the room open with a ghost member (or,
 * for a host, closes it a beat later than the guests were told). The timeout is the offline
 * case: no ack is ever coming, and we still have to let go of the socket.
 */
export function leaveRoomAndDisconnect(socket: BluffSocket): void {
  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    socket.disconnect();
  };
  socket.emit('room:leave', close);
  setTimeout(close, LEAVE_ACK_TIMEOUT_MS);
}
