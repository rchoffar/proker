import type { Card, Rank, Suit } from '../../types/hand';
import { RANKS, SUITS } from '../../types/hand';
import type { Claim, StraightHigh } from './claims';
import { RANK_VALUE } from './claims';

const VALUE_TO_RANK: Record<number, Rank> = Object.fromEntries(
  RANKS.map((r) => [RANK_VALUE[r], r]),
) as Record<number, Rank>;

/** The 5 ranks composing a straight to `high` ('5' = wheel A-2-3-4-5). */
export function straightRanks(high: StraightHigh): Rank[] {
  if (high === '5') return ['A', '2', '3', '4', '5'];
  const top = RANK_VALUE[high];
  const ranks: Rank[] = [];
  for (let v = top - 4; v <= top; v++) ranks.push(VALUE_TO_RANK[v]);
  return ranks;
}

function rankCounts(pool: Card[]): Map<Rank, number> {
  const counts = new Map<Rank, number>();
  for (const card of pool) counts.set(card.rank, (counts.get(card.rank) ?? 0) + 1);
  return counts;
}

function bySuit(pool: Card[]): Map<Suit, Card[]> {
  const map = new Map<Suit, Card[]>();
  for (const suit of SUITS) map.set(suit, []);
  for (const card of pool) map.get(card.suit)!.push(card);
  return map;
}

function takeOfRank(pool: Card[], rank: Rank, n: number): Card[] {
  return pool.filter((c) => c.rank === rank).slice(0, n);
}

/**
 * Whether the pool (all alive players' hands + board) contains AT LEAST the announced
 * combination. Extra or better cards never invalidate an announcement — only the exact
 * announced combination must be formable.
 */
export function claimHolds(claim: Claim, pool: Card[]): boolean {
  return findClaimWitness(claim, pool) !== null;
}

/**
 * The concrete cards proving the claim (for reveal highlighting), or null when the
 * claim does not hold.
 */
export function findClaimWitness(claim: Claim, pool: Card[]): Card[] | null {
  const counts = rankCounts(pool);

  switch (claim.category) {
    case 'pair': {
      if ((counts.get(claim.rank) ?? 0) < 2) return null;
      return takeOfRank(pool, claim.rank, 2);
    }
    case 'twoPair': {
      if ((counts.get(claim.high) ?? 0) < 2 || (counts.get(claim.low) ?? 0) < 2) return null;
      return [...takeOfRank(pool, claim.high, 2), ...takeOfRank(pool, claim.low, 2)];
    }
    case 'trips': {
      if ((counts.get(claim.rank) ?? 0) < 3) return null;
      return takeOfRank(pool, claim.rank, 3);
    }
    case 'quads': {
      if ((counts.get(claim.rank) ?? 0) < 4) return null;
      return takeOfRank(pool, claim.rank, 4);
    }
    case 'fullHouse': {
      if ((counts.get(claim.trips) ?? 0) < 3 || (counts.get(claim.pair) ?? 0) < 2) return null;
      return [...takeOfRank(pool, claim.trips, 3), ...takeOfRank(pool, claim.pair, 2)];
    }
    case 'straight': {
      const witness: Card[] = [];
      for (const rank of straightRanks(claim.high)) {
        const card = pool.find((c) => c.rank === rank);
        if (!card) return null;
        witness.push(card);
      }
      return witness;
    }
    case 'flush': {
      // A flush to H holds when one suit has ≥5 cards whose highest is ≥ H: pick the
      // top card (≥ H by construction) plus any 4 others of that suit.
      const target = RANK_VALUE[claim.high];
      for (const [, cards] of bySuit(pool)) {
        if (cards.length < 5) continue;
        const sorted = [...cards].sort((a, b) => RANK_VALUE[b.rank] - RANK_VALUE[a.rank]);
        if (RANK_VALUE[sorted[0].rank] >= target) return sorted.slice(0, 5);
      }
      return null;
    }
    case 'straightFlush':
    case 'royalFlush': {
      const high: StraightHigh = claim.category === 'royalFlush' ? 'A' : claim.high;
      const needed = straightRanks(high);
      for (const [, cards] of bySuit(pool)) {
        const witness: Card[] = [];
        for (const rank of needed) {
          const card = cards.find((c) => c.rank === rank);
          if (!card) break;
          witness.push(card);
        }
        if (witness.length === 5) return witness;
      }
      return null;
    }
  }
}
