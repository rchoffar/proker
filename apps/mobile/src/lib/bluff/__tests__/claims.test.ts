import { describe, expect, it } from 'vitest';
import type { Claim, ClaimCategory } from '../claims';
import {
  CATEGORY_ORDER,
  allowedPrimaryRanks,
  allowedSecondaryRanks,
  categoryHasHigherClaim,
  claimStrength,
  compareClaims,
  enumerateAllClaims,
  isStrictlyHigher,
} from '../claims';

// One representative claim per category, weakest params on purpose.
const WEAKEST: Record<ClaimCategory, Claim> = {
  pair: { category: 'pair', rank: '2' },
  twoPair: { category: 'twoPair', high: '3', low: '2' },
  straight: { category: 'straight', high: '5' },
  trips: { category: 'trips', rank: '2' },
  flush: { category: 'flush', high: '6' },
  fullHouse: { category: 'fullHouse', trips: '2', pair: '3' },
  quads: { category: 'quads', rank: '2' },
  straightFlush: { category: 'straightFlush', high: '5' },
  royalFlush: { category: 'royalFlush' },
};

const STRONGEST: Record<ClaimCategory, Claim> = {
  pair: { category: 'pair', rank: 'A' },
  twoPair: { category: 'twoPair', high: 'A', low: 'K' },
  straight: { category: 'straight', high: 'A' },
  trips: { category: 'trips', rank: 'A' },
  flush: { category: 'flush', high: 'A' },
  fullHouse: { category: 'fullHouse', trips: 'A', pair: 'K' },
  quads: { category: 'quads', rank: 'A' },
  straightFlush: { category: 'straightFlush', high: 'K' },
  royalFlush: { category: 'royalFlush' },
};

describe('claim ordering', () => {
  it('every category beats even the strongest claim of all lower categories', () => {
    for (let i = 1; i < CATEGORY_ORDER.length; i++) {
      for (let j = 0; j < i; j++) {
        expect(
          compareClaims(WEAKEST[CATEGORY_ORDER[i]], STRONGEST[CATEGORY_ORDER[j]]),
          `${CATEGORY_ORDER[i]} should beat ${CATEGORY_ORDER[j]}`,
        ).toBeGreaterThan(0);
      }
    }
  });

  it('places brelan strictly above quinte (Bluff-specific)', () => {
    expect(compareClaims({ category: 'trips', rank: '2' }, { category: 'straight', high: 'A' })).toBeGreaterThan(0);
  });

  it('places couleur between brelan and full', () => {
    expect(compareClaims({ category: 'flush', high: '6' }, { category: 'trips', rank: 'A' })).toBeGreaterThan(0);
    expect(compareClaims({ category: 'fullHouse', trips: '2', pair: '3' }, { category: 'flush', high: 'A' })).toBeGreaterThan(0);
  });

  it('orders two pairs by high pair then low pair', () => {
    const sixSeven: Claim = { category: 'twoPair', high: '7', low: '6' };
    const sixTen: Claim = { category: 'twoPair', high: 'T', low: '6' };
    const twoKing: Claim = { category: 'twoPair', high: 'K', low: '2' };
    expect(compareClaims(sixTen, sixSeven)).toBeGreaterThan(0);
    expect(compareClaims(twoKing, sixTen)).toBeGreaterThan(0);
    expect(
      compareClaims({ category: 'twoPair', high: 'T', low: '7' }, { category: 'twoPair', high: 'T', low: '6' }),
    ).toBeGreaterThan(0);
  });

  it('orders fulls by trips rank then pair rank', () => {
    const eightsByFours: Claim = { category: 'fullHouse', trips: '8', pair: '4' };
    const eightsByThrees: Claim = { category: 'fullHouse', trips: '8', pair: '3' };
    const ninesByTwos: Claim = { category: 'fullHouse', trips: '9', pair: '2' };
    expect(compareClaims(eightsByFours, eightsByThrees)).toBeGreaterThan(0);
    expect(compareClaims(ninesByTwos, eightsByFours)).toBeGreaterThan(0);
  });

  it('treats the wheel as the lowest straight', () => {
    expect(compareClaims({ category: 'straight', high: '6' }, { category: 'straight', high: '5' })).toBeGreaterThan(0);
  });

  it('accepts any claim when there is no current claim', () => {
    expect(isStrictlyHigher({ category: 'pair', rank: '2' }, null)).toBe(true);
  });

  it('rejects equal claims', () => {
    expect(isStrictlyHigher({ category: 'pair', rank: 'K' }, { category: 'pair', rank: 'K' })).toBe(false);
  });
});

describe('categoryHasHigherClaim', () => {
  it('enables all categories with no current claim', () => {
    for (const cat of CATEGORY_ORDER) expect(categoryHasHigherClaim(cat, null)).toBe(true);
  });

  it('disables lower categories and exhausted same-category tops', () => {
    const current: Claim = { category: 'trips', rank: 'A' };
    expect(categoryHasHigherClaim('pair', current)).toBe(false);
    expect(categoryHasHigherClaim('straight', current)).toBe(false);
    expect(categoryHasHigherClaim('trips', current)).toBe(false); // A is the top trips
    expect(categoryHasHigherClaim('flush', current)).toBe(true);
  });

  it('nothing outbids the royal flush', () => {
    for (const cat of CATEGORY_ORDER) {
      expect(categoryHasHigherClaim(cat, { category: 'royalFlush' })).toBe(false);
    }
  });
});

describe('allowedPrimaryRanks', () => {
  it('restricts same-category pair picks to strictly higher ranks', () => {
    const allowed = allowedPrimaryRanks('pair', { category: 'pair', rank: 'Q' });
    expect(allowed.has('K')).toBe(true);
    expect(allowed.has('A')).toBe(true);
    expect(allowed.has('Q')).toBe(false);
    expect(allowed.has('J')).toBe(false);
  });

  it('keeps the same twoPair high only when a higher low still fits', () => {
    const roomLeft = allowedPrimaryRanks('twoPair', { category: 'twoPair', high: 'T', low: '6' });
    expect(roomLeft.has('T')).toBe(true); // low 7/8/9 still available
    const noRoom = allowedPrimaryRanks('twoPair', { category: 'twoPair', high: 'T', low: '9' });
    expect(noRoom.has('T')).toBe(false); // no low between 9 and T
    expect(noRoom.has('J')).toBe(true);
  });

  it('excludes 2 as a twoPair high (no possible low)', () => {
    expect(allowedPrimaryRanks('twoPair', null).has('2')).toBe(false);
  });

  it('restricts straight highs to the legal domain above the current one', () => {
    const allowed = allowedPrimaryRanks('straight', { category: 'straight', high: 'Q' });
    expect([...allowed].sort()).toEqual(['A', 'K']);
  });

  it('keeps same fullHouse trips only when a higher pair exists', () => {
    const room = allowedPrimaryRanks('fullHouse', { category: 'fullHouse', trips: '8', pair: 'Q' });
    expect(room.has('8')).toBe(true); // pair K or A still beat Q
    const noRoom = allowedPrimaryRanks('fullHouse', { category: 'fullHouse', trips: 'A', pair: 'K' });
    expect(noRoom.has('A')).toBe(false);
    expect(noRoom.size).toBe(0);
  });

  it('returns the full domain when moving up a category', () => {
    const allowed = allowedPrimaryRanks('quads', { category: 'flush', high: 'A' });
    expect(allowed.size).toBe(13);
  });
});

describe('allowedSecondaryRanks', () => {
  it('twoPair lows sit strictly below the chosen high', () => {
    const allowed = allowedSecondaryRanks('twoPair', '5', null);
    expect([...allowed].sort()).toEqual(['2', '3', '4']);
  });

  it('twoPair with the same high must raise the low', () => {
    const allowed = allowedSecondaryRanks('twoPair', 'T', { category: 'twoPair', high: 'T', low: '6' });
    expect(allowed.has('6')).toBe(false);
    expect(allowed.has('7')).toBe(true);
    expect(allowed.has('9')).toBe(true);
    expect(allowed.has('J')).toBe(false); // still must stay below the high
  });

  it('fullHouse pair excludes the trips rank', () => {
    const allowed = allowedSecondaryRanks('fullHouse', 'K', null);
    expect(allowed.has('K')).toBe(false);
    expect(allowed.has('A')).toBe(true);
    expect(allowed.size).toBe(12);
  });

  it('fullHouse with same trips must raise the pair', () => {
    const allowed = allowedSecondaryRanks('fullHouse', '8', { category: 'fullHouse', trips: '8', pair: 'J' });
    expect(allowed.has('J')).toBe(false);
    expect(allowed.has('Q')).toBe(true);
  });
});

describe('enumerateAllClaims', () => {
  it('covers the full claim space, sorted strictly ascending', () => {
    const all = enumerateAllClaims();
    // 13 pairs + 78 two pairs + 10 straights + 13 trips + 9 flushes
    // + 156 full houses + 13 quads + 9 straight flushes + 1 royal.
    expect(all).toHaveLength(302);
    for (let i = 1; i < all.length; i++) {
      expect(claimStrength(all[i])).toBeGreaterThan(claimStrength(all[i - 1]));
    }
    expect(all[0]).toEqual({ category: 'pair', rank: '2' });
    expect(all[all.length - 1]).toEqual({ category: 'royalFlush' });
  });
});
