import { DEFAULT_ASSIGN_ORDER, nextFreePosition, sortByPreflopOrder } from './handPositions';
import { roundAmount } from './format';
import type { Card, HandAction, HandPlayer, PotState, Position, Street } from '../types';

// The pure half of the hand builder (app/hand-replayer/index.tsx): roster arithmetic, pot
// accounting and input parsing, with no react and no i18n. Lifted out of the route file so
// it can be tested — the builder is the biggest screen in the app and none of this was
// reachable from vitest while it lived inside a component.
//
// Caller-supplied naming keeps the i18n rule intact: `defaultName` comes in as a function
// so the translated "Player {{index}}" stays at the call site.

/**
 * The invariant everything in the builder depends on: the players array is sorted in
 * preflop action order (UTG first … blinds last) with `seat` re-stamped to the array
 * index. Array order IS action order, which is what keeps the engine's circular rotation
 * (handEngine's seat ordering / reopen queue) street-agnostic.
 */
export function sortAndSeat(players: HandPlayer[]): HandPlayer[] {
  return sortByPreflopOrder(players).map((p, i) => ({ ...p, seat: i }));
}

export function makePlayers(
  count: number,
  heroName: string,
  defaultName: (seatNumber: number) => string
): HandPlayer[] {
  return sortAndSeat(
    Array.from({ length: count }, (_, i) => ({
      id: `p${i}`,
      name: i === 0 ? heroName : defaultName(i + 1),
      isHero: i === 0,
      seat: i,
      cardsKnown: i === 0,
      isFolded: false,
      position: DEFAULT_ASSIGN_ORDER[i],
    }))
  );
}

export function resizePlayers(
  prev: HandPlayer[],
  newCount: number,
  defaultName: (seatNumber: number) => string
): HandPlayer[] {
  const next = [...prev];
  while (next.length > newCount) {
    // Remove the most recently added non-hero player (highest numeric id) — the hero can sit
    // anywhere in the array now that it's sorted by position, so slicing would be wrong.
    let removeIdx = -1;
    let highest = -1;
    next.forEach((p, i) => {
      if (p.isHero) return;
      const num = Number(p.id.slice(1));
      if (num > highest) {
        highest = num;
        removeIdx = i;
      }
    });
    if (removeIdx === -1) break;
    next.splice(removeIdx, 1);
  }
  while (next.length < newCount) {
    const taken = new Set(next.map((p) => p.position).filter(Boolean) as Position[]);
    const usedIds = new Set(next.map((p) => p.id));
    let idx = next.length;
    while (usedIds.has(`p${idx}`)) idx += 1;
    next.push({
      id: `p${idx}`,
      name: defaultName(idx + 1),
      isHero: false,
      seat: idx,
      cardsKnown: false,
      isFolded: false,
      position: nextFreePosition(taken),
    });
  }
  return sortAndSeat(next);
}

/** Running pot after each street that saw action, including any dead blinds/antes. */
export function computePots(actions: HandAction[], deadBlinds = 0): PotState[] {
  const streets: Street[] = ['preflop', 'flop', 'turn', 'river'];
  let running = deadBlinds;
  const pots: PotState[] = [];
  streets.forEach((street) => {
    const streetActions = actions.filter((a) => a.street === street).sort((a, b) => a.order - b.order);
    if (streetActions.length === 0) return;
    // Each bet/raise/call amount is the player's TOTAL contribution this street (a "raise
    // to", not a "raise by"), so a player who calls a bet and later calls a re-raise appears
    // twice — take their latest amount per street, not the sum of every action they took.
    const contribution: Record<string, number> = {};
    streetActions.forEach((a) => {
      if (a.amount !== undefined) contribution[a.playerId] = a.amount;
    });
    running = roundAmount(running + Object.values(contribution).reduce((sum, v) => sum + v, 0));
    pots.push({ street, amount: running });
  });
  return pots;
}

export function cardsEqual(a: Card, b: Card): boolean {
  return a.rank === b.rank && a.suit === b.suit;
}

/** Lenient comma-aware positive-number parse for user-typed amounts ("12,5" → 12.5, junk → 0). */
export function parsePositiveAmount(raw: string): number {
  const value = parseFloat(raw.replace(',', '.'));
  return Number.isFinite(value) && value > 0 ? value : 0;
}

/**
 * Heads-up puts the button in the small blind; the badge says so rather than just "BTN".
 * Positions are do-not-translate glossary terms, so this returns display text directly.
 */
export function positionLabel(
  player: { id: string; position?: string },
  posting: { sbPosterId?: string }
): string {
  if (player.position === 'BTN' && player.id === posting.sbPosterId) return 'BTN/SB';
  return player.position ?? '';
}
