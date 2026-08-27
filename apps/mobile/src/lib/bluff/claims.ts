import type { Rank } from '../../types/hand';
import { RANKS } from '../../types/hand';

// Bluff-specific ladder: brelan (trips) sits ABOVE quinte (straight), and couleur (flush)
// between brelan and full — this intentionally differs from standard poker rankings.
export type ClaimCategory =
  | 'pair'
  | 'twoPair'
  | 'straight'
  | 'trips'
  | 'flush'
  | 'fullHouse'
  | 'quads'
  | 'straightFlush'
  | 'royalFlush';

export const CATEGORY_ORDER: ClaimCategory[] = [
  'pair',
  'twoPair',
  'straight',
  'trips',
  'flush',
  'fullHouse',
  'quads',
  'straightFlush',
  'royalFlush',
];

// '5' is the wheel (A-2-3-4-5).
export type StraightHigh = '5' | '6' | '7' | '8' | '9' | 'T' | 'J' | 'Q' | 'K' | 'A';
// A 5-card flush's highest card can never be below 6 (5 distinct ranks of one suit).
export type FlushHigh = '6' | '7' | '8' | '9' | 'T' | 'J' | 'Q' | 'K' | 'A';
// An ace-high straight flush is the royal — announced as its own category.
export type SFHigh = Exclude<StraightHigh, 'A'>;

export type Claim =
  | { category: 'pair'; rank: Rank }
  | { category: 'twoPair'; high: Rank; low: Rank } // invariant: high > low
  | { category: 'straight'; high: StraightHigh }
  | { category: 'trips'; rank: Rank }
  | { category: 'flush'; high: FlushHigh }
  | { category: 'fullHouse'; trips: Rank; pair: Rank } // invariant: trips !== pair
  | { category: 'quads'; rank: Rank }
  | { category: 'straightFlush'; high: SFHigh }
  | { category: 'royalFlush' };

export const RANK_VALUE: Record<Rank, number> = {
  '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9,
  T: 10, J: 11, Q: 12, K: 13, A: 14,
};

export const STRAIGHT_HIGHS: StraightHigh[] = ['5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K', 'A'];
export const FLUSH_HIGHS: FlushHigh[] = ['6', '7', '8', '9', 'T', 'J', 'Q', 'K', 'A'];
export const SF_HIGHS: SFHigh[] = ['5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K'];

function categoryIndex(category: ClaimCategory): number {
  return CATEGORY_ORDER.indexOf(category);
}

// Within-category tiebreak, guaranteed < 100_000.
function tiebreak(claim: Claim): number {
  switch (claim.category) {
    case 'pair':
    case 'trips':
    case 'quads':
      return RANK_VALUE[claim.rank];
    case 'twoPair':
      return RANK_VALUE[claim.high] * 15 + RANK_VALUE[claim.low];
    case 'fullHouse':
      // Trips rank dominates, pair rank breaks ties (full aux 9 par les 2 > full aux 8 par les 4).
      return RANK_VALUE[claim.trips] * 15 + RANK_VALUE[claim.pair];
    case 'straight':
    case 'flush':
    case 'straightFlush':
      return RANK_VALUE[claim.high];
    case 'royalFlush':
      return 0;
  }
}

export function claimStrength(claim: Claim): number {
  return categoryIndex(claim.category) * 100_000 + tiebreak(claim);
}

export function compareClaims(a: Claim, b: Claim): number {
  return claimStrength(a) - claimStrength(b);
}

export function isStrictlyHigher(candidate: Claim, current: Claim | null): boolean {
  if (!current) return true;
  return compareClaims(candidate, current) > 0;
}

function maxTiebreak(category: ClaimCategory): number {
  switch (category) {
    case 'pair':
    case 'trips':
    case 'quads':
      return RANK_VALUE.A;
    case 'twoPair':
      return RANK_VALUE.A * 15 + RANK_VALUE.K; // as et rois
    case 'fullHouse':
      return RANK_VALUE.A * 15 + RANK_VALUE.K; // full aux as par les rois
    case 'straight':
    case 'flush':
      return RANK_VALUE.A;
    case 'straightFlush':
      return RANK_VALUE.K;
    case 'royalFlush':
      return 0;
  }
}

function buildAllClaims(): Claim[] {
  const claims: Claim[] = [];
  for (const rank of RANKS) claims.push({ category: 'pair', rank });
  for (const high of RANKS) {
    for (const low of RANKS) {
      if (RANK_VALUE[high] > RANK_VALUE[low]) claims.push({ category: 'twoPair', high, low });
    }
  }
  for (const high of STRAIGHT_HIGHS) claims.push({ category: 'straight', high });
  for (const rank of RANKS) claims.push({ category: 'trips', rank });
  for (const high of FLUSH_HIGHS) claims.push({ category: 'flush', high });
  for (const trips of RANKS) {
    for (const pair of RANKS) {
      if (trips !== pair) claims.push({ category: 'fullHouse', trips, pair });
    }
  }
  for (const rank of RANKS) claims.push({ category: 'quads', rank });
  for (const high of SF_HIGHS) claims.push({ category: 'straightFlush', high });
  claims.push({ category: 'royalFlush' });
  return claims.sort(compareClaims);
}

const ALL_CLAIMS: readonly Claim[] = buildAllClaims();

/** The full announceable claim space (302 claims), sorted ascending by strength. */
export function enumerateAllClaims(): readonly Claim[] {
  return ALL_CLAIMS;
}

/** Can any claim of this category outbid the current claim? Drives category-chip enabling. */
export function categoryHasHigherClaim(category: ClaimCategory, current: Claim | null): boolean {
  if (!current) return true;
  const catDiff = categoryIndex(category) - categoryIndex(current.category);
  if (catDiff > 0) return true;
  if (catDiff < 0) return false;
  return maxTiebreak(category) > tiebreak(current);
}

const ALL_RANK_VALUES = RANKS.map((r) => RANK_VALUE[r]);

function ranksWithValue(predicate: (value: number) => boolean): Set<Rank> {
  return new Set(RANKS.filter((r) => predicate(RANK_VALUE[r])));
}

/**
 * Legal ranks for a category's primary parameter, given the claim to beat:
 * pair/trips/quads rank, twoPair LOW pair (picked first — table convention),
 * fullHouse trips, straight/flush/SF high card.
 */
export function allowedPrimaryRanks(category: ClaimCategory, current: Claim | null): Set<Rank> {
  const domain = ((): Set<Rank> => {
    switch (category) {
      case 'pair':
      case 'trips':
      case 'quads':
        return new Set(RANKS);
      case 'twoPair':
        // The low pair needs a strictly higher high pair to exist.
        return ranksWithValue((v) => v <= 13);
      case 'fullHouse':
        return new Set(RANKS);
      case 'straight':
        return new Set<Rank>(STRAIGHT_HIGHS);
      case 'flush':
        return new Set<Rank>(FLUSH_HIGHS);
      case 'straightFlush':
        return new Set<Rank>(SF_HIGHS);
      case 'royalFlush':
        return new Set();
    }
  })();

  if (!current || categoryIndex(category) > categoryIndex(current.category)) return domain;
  if (categoryIndex(category) < categoryIndex(current.category)) return new Set();

  // Same category: restrict to primaries that can still produce a strictly higher claim.
  const filtered = new Set<Rank>();
  for (const rank of domain) {
    const v = RANK_VALUE[rank];
    switch (current.category) {
      case 'pair':
      case 'trips':
      case 'quads':
        if (v > RANK_VALUE[current.rank]) filtered.add(rank);
        break;
      case 'twoPair': {
        // Candidate is the LOW pair: it works if a high above current.high can still be
        // picked (always, unless the current high is already the ace), or by keeping the
        // ace high and strictly raising the low.
        if (RANK_VALUE[current.high] < 14) filtered.add(rank);
        else if (v > RANK_VALUE[current.low]) filtered.add(rank);
        break;
      }
      case 'fullHouse': {
        if (v > RANK_VALUE[current.trips]) filtered.add(rank);
        else if (v === RANK_VALUE[current.trips]) {
          // Same trips: need a pair rank above current.pair that isn't the trips rank itself.
          const hasHigherPair = ALL_RANK_VALUES.some((p) => p > RANK_VALUE[current.pair] && p !== v);
          if (hasHigherPair) filtered.add(rank);
        }
        break;
      }
      case 'straight':
      case 'flush':
      case 'straightFlush':
        if (v > RANK_VALUE[current.high]) filtered.add(rank);
        break;
      case 'royalFlush':
        break;
    }
  }
  return filtered;
}

/**
 * Legal ranks for the secondary parameter (twoPair HIGH pair — the low was picked first —
 * / fullHouse pair), given the chosen primary and the claim to beat.
 */
export function allowedSecondaryRanks(
  category: 'twoPair' | 'fullHouse',
  primary: Rank,
  current: Claim | null,
): Set<Rank> {
  const primaryValue = RANK_VALUE[primary];
  const base =
    category === 'twoPair'
      ? ranksWithValue((v) => v > primaryValue)
      : ranksWithValue((v) => v !== primaryValue);

  if (!current || current.category !== category) return base;

  if (category === 'twoPair' && current.category === 'twoPair') {
    // The high pair must beat the current high outright, or match it with a raised low.
    return new Set(
      [...base].filter(
        (r) =>
          RANK_VALUE[r] > RANK_VALUE[current.high] ||
          (RANK_VALUE[r] === RANK_VALUE[current.high] && primaryValue > RANK_VALUE[current.low]),
      ),
    );
  }
  if (category === 'fullHouse' && current.category === 'fullHouse') {
    if (primaryValue > RANK_VALUE[current.trips]) return base;
    // Same trips: the pair must strictly beat the current pair.
    return new Set([...base].filter((r) => RANK_VALUE[r] > RANK_VALUE[current.pair]));
  }
  return base;
}
