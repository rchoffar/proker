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
