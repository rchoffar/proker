import type { Card } from '../../types/hand';
import type { BluffAction, BluffState, BluffValidationError } from './engine';

// ── Relay envelope ─────────────────────────────────────────────────────────────
// Mirror of apps/api/src/protocol.ts — keep both files in sync by hand (the
// packages are deliberately independent: no npm workspaces in this repo).

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
  | { ok: false; reason: 'not_found' | 'full' };

export type RejoinAck = { ok: true } | { ok: false; reason: 'not_found' | 'bad_token' };

export interface ClientToServerEvents {
  'room:create': (payload: { name: string }, ack: (res: CreateAck) => void) => void;
  'room:join': (payload: { code: string; name: string }, ack: (res: JoinAck) => void) => void;
  'room:rejoin': (
    payload: { code: string; playerId: string; sessionToken: string },
    ack: (res: RejoinAck) => void,
  ) => void;
  'room:leave': () => void;
  'game:toHost': (payload: { payload: unknown }) => void;
  'game:toPlayer': (payload: { playerId: string; payload: unknown }) => void;
  'game:broadcast': (payload: { payload: unknown }) => void;
}

export interface ServerToClientEvents {
  'room:members': (event: RoomMembersEvent) => void;
  'room:closed': (event: RoomClosedEvent) => void;
  'game:fromPlayer': (event: { fromPlayerId: string; payload: unknown }) => void;
  'game:fromHost': (event: { payload: unknown }) => void;
}

// ── Game payloads (host ↔ guests, opaque to the relay) ─────────────────────────

export type GuestToHost =
  | { kind: 'action'; action: BluffAction }
  | { kind: 'requestState' };

export type HostToGuest =
  | { kind: 'state'; state: RedactedState }
  // Language-neutral code + interpolation params — each client translates locally.
  | { kind: 'error'; error: BluffValidationError }
  | { kind: 'gameEnded'; reason: 'hostQuit' };

export interface RedactedPlayer {
  id: string;
  name: string;
  cardCount: number;
  eliminated: boolean;
  connected: boolean;
  jeuMaxAttempts: number;
  jeuMaxSuccesses: number;
  hand?: Card[]; // only the viewer's own hand — everyone's once the round is revealed
}

// What leaves the host device: no boardStock (future middle cards), no foreign hands
// and no face-down middle cards outside the reveal window.
export interface RedactedState extends Omit<BluffState, 'players' | 'boardStock' | 'hiddenBoard'> {
  players: RedactedPlayer[];
  hiddenBoardCount: number; // always present — clients render that many card backs
  hiddenBoard?: Card[]; // only once the round is revealed
}

const PUBLIC_HAND_PHASES = new Set<BluffState['phase']>(['reveal', 'roundEnd', 'gameOver']);

/**
 * The single choke point deciding what a given viewer may see. The host's own UI must
 * render through this too, so a redaction bug is immediately visible at the host's table.
 */
export function redactFor(
  state: BluffState,
  viewerId: string,
  connectedById?: Map<string, boolean>,
): RedactedState {
  const handsPublic = PUBLIC_HAND_PHASES.has(state.phase);
  const { boardStock: _boardStock, hiddenBoard, players, ...rest } = state;
  return {
    ...rest,
    hiddenBoardCount: hiddenBoard.length,
    ...(handsPublic ? { hiddenBoard } : {}),
    players: players.map((p) => ({
      id: p.id,
      name: p.name,
      cardCount: p.cardCount,
      eliminated: p.eliminated,
      connected: connectedById?.get(p.id) ?? true,
      jeuMaxAttempts: p.jeuMaxAttempts,
      jeuMaxSuccesses: p.jeuMaxSuccesses,
      ...(p.id === viewerId || (handsPublic && !p.eliminated) ? { hand: p.hand } : {}),
    })),
  };
}
