// Relay envelope — the ONLY vocabulary this server understands. Game payloads are opaque
// (the host phone runs the authoritative Bluff engine).
// Mirror of apps/mobile/src/lib/bluff/protocol.ts — keep both files in sync by hand
// (the packages are deliberately independent: no npm workspaces in this repo).

export interface MemberInfo {
  playerId: string;
  name: string;
  connected: boolean;
}

export interface RoomMembersEvent {
  members: MemberInfo[];
  hostPlayerId: string;
}

export interface RoomClosedEvent {
  reason: 'host_left' | 'expired';
}

export type CreateAck =
  | { ok: true; code: string; playerId: string; sessionToken: string }
  | { ok: false; reason: 'unavailable' };

export type JoinAck =
  | { ok: true; playerId: string; sessionToken: string; members: MemberInfo[]; hostPlayerId: string }
  | { ok: false; reason: 'not_found' | 'full' | 'started' };

export type RejoinAck = { ok: true } | { ok: false; reason: 'not_found' | 'bad_token' };

// client → server
export interface ClientToServerEvents {
  'room:create': (payload: { name: string }, ack: (res: CreateAck) => void) => void;
  'room:join': (payload: { code: string; name: string }, ack: (res: JoinAck) => void) => void;
  'room:rejoin': (
    payload: { code: string; playerId: string; sessionToken: string },
    ack: (res: RejoinAck) => void,
  ) => void;
  // Host-only: the game has been dealt, stop admitting newcomers. Idempotent.
  'room:lock': () => void;
  'room:leave': (ack?: () => void) => void;
  'game:toHost': (payload: { payload: unknown }) => void;
  'game:toPlayer': (payload: { playerId: string; payload: unknown }) => void;
  'game:broadcast': (payload: { payload: unknown }) => void;
}

// server → client
export interface ServerToClientEvents {
  'room:members': (event: RoomMembersEvent) => void;
  'room:closed': (event: RoomClosedEvent) => void;
  'game:fromPlayer': (event: { fromPlayerId: string; payload: unknown }) => void;
  'game:fromHost': (event: { payload: unknown }) => void;
}
