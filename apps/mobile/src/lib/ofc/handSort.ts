import type { Card, Suit } from '../../types/hand';
import { SUITS } from '../../types/hand';
import { RANK_VALUE } from '../pokerHandEvaluator';

// Display-only ordering for the Fantasy Land tray (14-16 cards are unreadable in deal
// order). Pure and engine-free: placements always reference the cards themselves, so
// sorting the tray never changes what gets committed.

export type HandSortMode = 'pairs' | 'suit' | 'rank';

export const HAND_SORT_MODES: HandSortMode[] = ['pairs', 'suit', 'rank'];

function suitIndex(suit: Suit): number {
  return SUITS.indexOf(suit);
}

function byRankDesc(a: Card, b: Card): number {
  return RANK_VALUE[b.rank] - RANK_VALUE[a.rank] || suitIndex(a.suit) - suitIndex(b.suit);
}

/** Returns a new array — never mutates the dealt hand. */
export function sortHand(cards: Card[], mode: HandSortMode): Card[] {
  const sorted = [...cards];
  switch (mode) {
    case 'rank':
      return sorted.sort(byRankDesc);
    case 'suit':
      return sorted.sort((a, b) => suitIndex(a.suit) - suitIndex(b.suit) || byRankDesc(a, b));
    case 'pairs': {
      // Groups first (quads > trips > pairs, highest rank first), then singles by rank.
      const counts = new Map<string, number>();
      for (const card of cards) counts.set(card.rank, (counts.get(card.rank) ?? 0) + 1);
      return sorted.sort(
        (a, b) => counts.get(b.rank)! - counts.get(a.rank)! || byRankDesc(a, b),
      );
    }
  }
}
