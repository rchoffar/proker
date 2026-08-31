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
 * Whether the viewer may see this player's committed grid. The single rule both modes go
 * through, and Fantasy Land secrecy runs BOTH ways during a fantasy hand:
 *
 * - a Fantasy Land grid stays face-down to everyone else until the scoring reveal;
 * - and the Fantasy Land player is equally blind to the others until they have set their
 *   own board. They receive all thirteen cards at once and place them in a single move,
 *   after the others have been placing in the open — letting them watch those boards fill
 *   up first would hand them the whole hand. Mathieu, who plays this for real, flagged it
 *   as a rule violation rather than a display choice (30/08).
 *
 * Everything is revealed at scoring, so the asymmetry only lasts while it matters.
 *
 * The second rule deliberately does NOT apply on a shared phone: `TABLE_VIEWER` is not a
 * player, so `viewer` is undefined and the strip keeps showing every open grid. That is
 * correct — one phone means one table, where the others' boards are open information to
 * everybody in the room, exactly as they are face-up on a real table. It also keeps
 * ADR-014's invariant intact: the strip is drawn from the TABLE redaction precisely so it
 * can never show more than the room may see, and reaching for the actor's own redaction to
 * draw seats is the mistake that puts their hand on the table.
 */
export function gridVisibleTo(
  player: Pick<OfcPlayerState, 'id' | 'inFantasyLand'>,
  viewer: Pick<OfcPlayerState, 'id' | 'inFantasyLand' | 'fantasyPlaced'> | undefined,
  phase: OfcPhase,
): boolean {
  if (player.id === viewer?.id) return true;
  if (REVEAL_PHASES.has(phase)) return true;
  if (player.inFantasyLand) return false;
  return !(viewer?.inFantasyLand && !viewer.fantasyPlaced);
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
  const viewer = players.find((p) => p.id === viewerId);
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
      ...(gridVisibleTo(p, viewer, state.phase) ? { grid: p.grid } : {}),
    })),
  };
}
