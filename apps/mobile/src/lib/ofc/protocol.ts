import type { Card } from '../../types/hand';
import type { OfcAction, OfcPhase, OfcPlayerState, OfcState, OfcValidationError } from './engine';
import type { OfcGrid } from './evaluator';

// The relay envelope (rooms, acks, socket events) is game-agnostic and lives in
// lib/bluff/protocol.ts (hand-mirrored with apps/api/src/protocol.ts) — OFC reuses it
// as-is, the relay never inspects game payloads. This file only defines what those
// opaque payloads contain for OFC, and the single redaction choke point.

// ── Game payloads (host ↔ guests, opaque to the relay) ─────────────────────────

export type OfcGuestToHost =
  | { kind: 'action'; action: OfcAction }
  | { kind: 'requestState' };

export type OfcHostToGuest =
  | { kind: 'state'; state: RedactedOfcState }
  // Language-neutral code + interpolation params — each client translates locally.
  | { kind: 'error'; error: OfcValidationError }
  | { kind: 'gameEnded'; reason: 'hostQuit' };

export interface RedactedOfcPlayer {
  id: string;
  name: string;
  chips: number;
  eliminated: boolean;
  connected: boolean;
  inFantasyLand: boolean;
  fantasyPlaced: boolean;
  handCount: number; // others see "arranging N cards" without the cards
  gridCounts: { top: number; middle: number; bottom: number }; // render card backs
  hand?: Card[]; // only the viewer's own unplaced cards
  discards?: Card[]; // only the viewer's own thrown cards (pineapple)
  grid?: OfcGrid; // absent for a Fantasy Land grid before the scoring reveal
}

// What leaves the host device: no deck (future draws), no foreign unplaced hands, no
// foreign pineapple draws or discards, no Fantasy Land grids before the reveal.
export interface RedactedOfcState extends Omit<OfcState, 'players' | 'deck' | 'pending'> {
  players: RedactedOfcPlayer[];
  // Classic: the single drawn card is public — `cards` present for everyone.
  // Pineapple: the 3 drawn cards are the actor's secret — `cards` present only for them,
  // others get the count.
  pending: { playerId: string; count: number; cards?: Card[] } | null;
}

const REVEAL_PHASES = new Set<OfcPhase>(['scoring', 'gameOver']);

/**
 * Whether `viewerId` may see this player's committed grid. Shared by redactFor AND the
 * Pass & Play screen so both modes agree on Fantasy Land secrecy: non-FL placements are
 * open information, an FL grid stays face-down until the scoring reveal.
 */
export function gridVisibleTo(
  player: Pick<OfcPlayerState, 'id' | 'inFantasyLand'>,
  viewerId: string,
  phase: OfcPhase,
): boolean {
  return player.id === viewerId || !player.inFantasyLand || REVEAL_PHASES.has(phase);
}

/**
 * The single choke point deciding what a given viewer may see. The host's own UI must
 * render through this too, so a redaction bug is immediately visible at the host's table.
 */
export function redactFor(
  state: OfcState,
  viewerId: string,
  connectedById?: Map<string, boolean>,
): RedactedOfcState {
  const { deck: _deck, players, pending, ...rest } = state;
  const pendingVisible =
    pending !== null && (state.variant === 'classic' || pending.playerId === viewerId);
  return {
    ...rest,
    pending: pending && {
      playerId: pending.playerId,
      count: pending.cards.length,
      ...(pendingVisible ? { cards: pending.cards } : {}),
    },
    players: players.map((p) => ({
      id: p.id,
      name: p.name,
      chips: p.chips,
      eliminated: p.eliminated,
      connected: connectedById?.get(p.id) ?? true,
      inFantasyLand: p.inFantasyLand,
      fantasyPlaced: p.fantasyPlaced,
      handCount: p.hand.length,
      gridCounts: { top: p.grid.top.length, middle: p.grid.middle.length, bottom: p.grid.bottom.length },
      ...(p.id === viewerId ? { hand: p.hand, discards: p.discards } : {}),
      ...(gridVisibleTo(p, viewerId, state.phase) ? { grid: p.grid } : {}),
    })),
  };
}
