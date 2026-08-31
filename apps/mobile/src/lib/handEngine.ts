import { computeBlindPosting, orderForStreet } from './handPositions';
import { roundAmount } from './format';
import type { ActionType, HandAction, Position, Street } from '../types/hand';

// Pure betting engine for the hand-replayer builder. The actions array (plus roster and
// blind/stack config) is the single source of truth: replayActions() re-derives the entire
// betting state from scratch, which is what lets any past action be edited — truncate the
// array, append the replacement, replay. No react/i18n imports in here.

export interface EnginePlayer {
  id: string;
  position?: Position;
}

export interface EngineConfig {
  smallBlind: number;
  bigBlind: number;
  // Effective stack per player id — the hard cap on what they can put in.
  stacks: Record<string, number>;
  // True heads-up table (the button posts the small blind), as opposed to two players out
  // of a bigger one. Undefined on hands recorded before the question existed — see
  // computeBlindPosting.
  headsUp?: boolean;
}

export interface BettingRoundState {
  street: Street;
  toAct: string[];
  lastAggressorId?: string;
  // The total amount ("bet to") a caller must match this street — 0 while nobody has
  // bet yet. Without this, "Call" had no amount to attach to its action at all.
  currentBet: number;
  // Each player's total contribution this street so far — drives per-player check-vs-call
  // legality (owed = currentBet - contribution), which is what lets the Big Blind "check"
  // when unraised while everyone else who owes money still has to call/raise/fold.
  contributions: Record<string, number>;
}

export interface DerivedState {
  // The earliest street whose betting round is still open; null once the hand is over
  // (fold-out) or the river round has closed (showdown).
  round: BettingRoundState | null;
  foldedOnStreet: Record<string, Street>;
  allInIds: Set<string>;
  // Total committed across all streets (current one included), latest-amount-per-street —
  // the "raise to" convention means a player's later action on a street supersedes their
  // earlier one, never sums with it.
  committed: Record<string, number>;
  completedStreets: Street[];
  // Everyone but one player folded before showdown.
  handOver: boolean;
  foldWinnerId?: string;
}

export const STREETS: Street[] = ['preflop', 'flop', 'turn', 'river'];

const streetIdx = (s: Street) => STREETS.indexOf(s);

// Rotates a full seat list so `anchorId` ends up last — i.e. the seat right after the
// anchor acts first. The players array is expected in preflop action order (the builder's
// invariant), which keeps this rotation street-agnostic.
function seatOrderFrom<T extends { id: string }>(players: T[], anchorId: string): T[] {
  const idx = players.findIndex((p) => p.id === anchorId);
  if (idx === -1) return players;
  return [...players.slice(idx + 1), ...players.slice(0, idx + 1)];
}

// After a bet/raise/allin, action must resume with the player immediately after the
// aggressor's seat (wrapping around), not just "seat order minus the aggressor" — otherwise
// an earlier seat gets asked to act again before a later seat has responded to the raise.
function reopenQueueFrom(players: EnginePlayer[], aggressorId: string, folded: Map<string, Street>, allIn: Set<string>): string[] {
  const eligible = players.filter((p) => !folded.has(p.id) && !allIn.has(p.id));
  return seatOrderFrom(eligible, aggressorId)
    .filter((p) => p.id !== aggressorId)
    .map((p) => p.id);
}

// Replays the stored actions verbatim — they were already resolved at record time (call
// amounts filled in, all-in coercion applied), so no re-coercion happens here. Blind posts
// are consumed from the array, never regenerated: they carry their capped amounts and
// orders, and regenerating them would have to match bit-for-bit or the pot math drifts.
export function replayActions(players: EnginePlayer[], config: EngineConfig, actions: HandAction[]): DerivedState {
  const { bbPosterId } = computeBlindPosting(players, config.smallBlind, config.bigBlind, config.headsUp);
  const folded = new Map<string, Street>();
  const allIn = new Set<string>();
  const committed: Record<string, number> = {};
  const completedStreets: Street[] = [];
  let handOver = false;
  let foldWinnerId: string | undefined;
  let liveRound: BettingRoundState | null = null;

  for (const street of STREETS) {
    const streetActions = actions.filter((a) => a.street === street).sort((a, b) => a.order - b.order);
    const eligible = players.filter((p) => !folded.has(p.id) && !allIn.has(p.id));

    // Betting needs at least two players who can still act on each other. Once everyone
    // else is all-in, the lone remaining player (who may have only just called, not gone
    // all-in themselves) has no one left to respond to a bet — the street runs out with an
    // empty queue. Preflop always starts with 2+ eligible players (nobody's folded or
    // shoved yet), so this never blocks the very first action.
    const round: BettingRoundState =
      eligible.length <= 1
        ? { street, toAct: [], lastAggressorId: undefined, currentBet: 0, contributions: {} }
        : street === 'preflop'
          ? {
              street,
              // The players array is already in preflop action order (UTG first, blinds last).
              toAct: eligible.map((p) => p.id),
              lastAggressorId: undefined,
              // Entering the pot always costs the big blind, even when the BB player was left
              // out of the hand (their post is dead money, not a discount). A real BB post
              // overrides this with its (possibly stack-capped) amount below.
              currentBet: config.bigBlind,
              contributions: {},
            }
          : {
              street,
              // Postflop the SB (or the earliest remaining position) opens and the BTN
              // closes; the button itself may be absent, so sort by position instead of
              // anchoring on a player.
              toAct: orderForStreet(eligible, street).map((p) => p.id),
              lastAggressorId: undefined,
              currentBet: 0,
              contributions: {},
            };

    for (const a of streetActions) {
      if (a.type === 'post') {
        if (a.amount !== undefined) {
          round.contributions[a.playerId] = a.amount;
          if (a.playerId === bbPosterId) round.currentBet = a.amount;
        }
        continue;
      }

      if (a.type === 'fold') {
        folded.set(a.playerId, street);
        const stillActive = players.filter((p) => !folded.has(p.id));
        if (stillActive.length <= 1) {
          handOver = true;
          foldWinnerId = stillActive[0]?.id;
          break;
        }
        round.toAct = round.toAct.filter((id) => id !== a.playerId);
        continue;
      }

      if (a.type === 'allin') allIn.add(a.playerId);
      if (a.amount !== undefined) round.contributions[a.playerId] = a.amount;

      // Only an amount that actually raises the outstanding bet reopens the action — a
      // short-stack all-in below (or matching) the current bet is a call, and forcing
      // players who already matched to act again would be wrong.
      const isAggression =
        (a.type === 'bet' || a.type === 'raise' || a.type === 'allin') && a.amount !== undefined && a.amount > round.currentBet;
      if (isAggression) {
        round.toAct = reopenQueueFrom(players, a.playerId, folded, allIn);
        round.lastAggressorId = a.playerId;
        round.currentBet = a.amount!;
      } else {
        round.toAct = round.toAct.filter((id) => id !== a.playerId);
      }
    }

    // The street's final contributions ARE its latest-amount-per-player — fold them into the
    // cross-street totals (posts included) before deciding whether the round is still open.
    Object.entries(round.contributions).forEach(([id, v]) => {
      committed[id] = roundAmount((committed[id] ?? 0) + v);
    });

    if (handOver) break;

    if (round.toAct.length > 0) {
      liveRound = round;
      break;
    }
    completedStreets.push(street);
  }

  return {
    round: handOver ? null : liveRound,
    foldedOnStreet: Object.fromEntries(folded),
    allInIds: allIn,
    committed,
    completedStreets,
    handOver,
    foldWinnerId,
  };
}

export function remainingStackFor(derived: DerivedState, config: EngineConfig, playerId: string): number {
  return Math.max(0, roundAmount((config.stacks[playerId] ?? 0) - (derived.committed[playerId] ?? 0)));
}

// Largest legal "bet/raise to" this street: what's already in front of the player plus
// everything left behind. Committing exactly this amount IS an all-in.
export function maxToFor(derived: DerivedState, config: EngineConfig, playerId: string): number {
  return roundAmount((derived.round?.contributions[playerId] ?? 0) + remainingStackFor(derived, config, playerId));
}

export function availableActions(derived: DerivedState, config: EngineConfig, playerId: string): ActionType[] {
  const owed = (derived.round?.currentBet ?? 0) - (derived.round?.contributions[playerId] ?? 0);
  if (owed > 0) {
    // Too short to raise above the current bet → calling already means all-in.
    if (maxToFor(derived, config, playerId) <= (derived.round?.currentBet ?? 0)) return ['fold', 'call', 'allin'];
    return ['fold', 'call', 'raise', 'allin'];
  }
  return ['fold', 'check', 'bet', 'allin'];
}

// Resolves what the user tapped/typed into the action that gets stored. A call always
// matches the street's outstanding bet — the caller never types this amount themselves.
// Nobody can put in more than they have; committing everything IS an all-in, whatever
// button produced it (short-stack "call" of a bigger bet included).
export function resolveActionInput(
  derived: DerivedState,
  config: EngineConfig,
  playerId: string,
  type: ActionType,
  amount?: number
): { type: ActionType; amount?: number } {
  const maxTo = maxToFor(derived, config, playerId);
  let resolvedType = type;
  let finalAmount = type === 'call' ? derived.round?.currentBet : amount;
  if (finalAmount !== undefined && (type === 'call' || type === 'bet' || type === 'raise' || type === 'allin')) {
    finalAmount = roundAmount(Math.min(finalAmount, maxTo));
    if (finalAmount >= maxTo) resolvedType = 'allin';
  }
  return { type: resolvedType, amount: finalAmount };
}

// The blind posts to append when preflop begins. Only players actually entered in the hand
// post; absent SB/BB are dead blinds accounted into pots separately. Posts are capped at
// the poster's stack — the setup gate (every stack >= BB) makes a short post unreachable in
// practice, but the cap keeps pot math honest regardless.
export function computeBlindPosts(players: EnginePlayer[], config: EngineConfig): { playerId: string; amount: number }[] {
  const { sbPosterId, bbPosterId } = computeBlindPosting(players, config.smallBlind, config.bigBlind, config.headsUp);
  const posts: { playerId: string; amount: number }[] = [];
  if (sbPosterId) posts.push({ playerId: sbPosterId, amount: roundAmount(Math.min(config.smallBlind, config.stacks[sbPosterId] ?? 0)) });
  if (bbPosterId) posts.push({ playerId: bbPosterId, amount: roundAmount(Math.min(config.bigBlind, config.stacks[bbPosterId] ?? 0)) });
  return posts;
}

// Everything strictly before the given action — earlier streets, or earlier orders on its
// own street. Used both to preview the state an edited action was decided in, and (with a
// replacement appended) as the truncate-on-edit cut. Blind posts always survive: they hold
// the lowest preflop orders, strictly before any editable action.
export function actionsBefore(actions: HandAction[], actionId: string): HandAction[] {
  const target = actions.find((a) => a.id === actionId);
  if (!target) return actions;
  return actions.filter(
    (a) => streetIdx(a.street) < streetIdx(target.street) || (a.street === target.street && a.order < target.order)
  );
}
