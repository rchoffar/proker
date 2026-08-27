import { describe, expect, it } from 'vitest';
import type { Card, Rank, Suit } from '../../../types/hand';
import type { Claim } from '../claims';
import {
  CATEGORY_ORDER,
  allowedPrimaryRanks,
  allowedSecondaryRanks,
  claimStrength,
  enumerateAllClaims,
} from '../claims';
import {
  allowedClaimsOnBoard,
  allowedPrimaryRanksOnBoard,
  allowedSecondaryRanksOnBoard,
  categoryHasAllowedClaim,
  isClaimForbiddenByBoard,
} from '../domination';

const card = (rank: Rank, suit: Suit): Card => ({ rank, suit });

describe('isClaimForbiddenByBoard — Mathieu examples', () => {
  it('forbids quinte au 7 when an 8 is face up, keeps quinte au 8 legal', () => {
    // 4-5-6-7 (needed for straight-to-7) + the visible 8 always make straight-to-8.
    const board = [card('8', 'hearts')];
    expect(isClaimForbiddenByBoard({ category: 'straight', high: '7' }, board)).toBe(true);
    expect(isClaimForbiddenByBoard({ category: 'straight', high: '8' }, board)).toBe(false);
    expect(isClaimForbiddenByBoard({ category: 'straight', high: '6' }, board)).toBe(false);
  });

  it('board 2-2-2 forbids everything up to and including brelan de 2', () => {
    const board = [card('2', 'spades'), card('2', 'hearts'), card('2', 'clubs')];
    const trips2: Claim = { category: 'trips', rank: '2' };
    // Every pair, two pair and straight sits below trips in this ladder — all forbidden.
    for (const claim of enumerateAllClaims()) {
      if (claimStrength(claim) <= claimStrength(trips2)) {
        expect(isClaimForbiddenByBoard(claim, board), JSON.stringify(claim)).toBe(true);
      }
    }
    // Same logic as the quinte-au-7 example, one level up: any OTHER trips (3-3-3) plus
    // the visible 2-2-2 always makes a full house — so trips announcements are dominated
    // too, and the first honest rungs are flush and full house.
    expect(isClaimForbiddenByBoard({ category: 'trips', rank: '3' }, board)).toBe(true);
    expect(isClaimForbiddenByBoard({ category: 'flush', high: '9' }, board)).toBe(false);
    expect(isClaimForbiddenByBoard({ category: 'fullHouse', trips: '2', pair: '7' }, board)).toBe(false);
  });

  it('a visible pair of 5 forbids every pair announcement', () => {
    const board = [card('5', 'spades'), card('5', 'hearts'), card('2', 'clubs')];
    for (const rank of ['2', '3', '5', '8', 'A'] as Rank[]) {
      // 8-8 + the visible 5-5 always make two pair — the minimum call is two pair.
      expect(isClaimForbiddenByBoard({ category: 'pair', rank }, board), rank).toBe(true);
    }
  });

  it('two pair over a visible pair of 5 is legal only when consistent with the 5s', () => {
    const board = [card('5', 'spades'), card('5', 'hearts'), card('2', 'clubs')];
    // Includes the visible 5s → nothing extra is implied.
    expect(isClaimForbiddenByBoard({ category: 'twoPair', high: '8', low: '5' }, board)).toBe(false);
    expect(isClaimForbiddenByBoard({ category: 'twoPair', high: 'A', low: '5' }, board)).toBe(false);
    // Both pairs below... any two pair not using the 5s: 4-4 + 3-3 + visible 5-5 makes a
    // better two pair (5&4) — dominated.
    expect(isClaimForbiddenByBoard({ category: 'twoPair', high: '4', low: '3' }, board)).toBe(true);
    // Two pair above the 5s without them (8-8 + 7-7) is fine: 5-5 only makes a third pair,
    // which is NOT a stronger claim in this ladder (no "three pair" category).
    expect(isClaimForbiddenByBoard({ category: 'twoPair', high: '8', low: '7' }, board)).toBe(false);
    // ...but a two pair whose low sits below the visible 5s is dominated (swap low for 5s).
    expect(isClaimForbiddenByBoard({ category: 'twoPair', high: '8', low: '3' }, board)).toBe(true);
  });
});

describe('isClaimForbiddenByBoard — edges', () => {
  it('an empty board forbids none of the 302 claims', () => {
    for (const claim of enumerateAllClaims()) {
      expect(isClaimForbiddenByBoard(claim, []), JSON.stringify(claim)).toBe(false);
    }
  });

  it('vacuous announcements (the board alone proves them) are forbidden', () => {
    const board = [card('9', 'spades'), card('9', 'hearts')];
    expect(isClaimForbiddenByBoard({ category: 'pair', rank: '9' }, board)).toBe(true);
  });

  it('a flush is forbidden when every suit shows a face-up card above the announced high', () => {
    const board = [card('K', 'spades'), card('K', 'hearts'), card('A', 'clubs'), card('Q', 'diamonds')];
    // Any 5-card flush to J must live in some suit, and that suit's visible higher card
    // joins it into a higher flush.
    expect(isClaimForbiddenByBoard({ category: 'flush', high: 'J' }, board)).toBe(true);
    // Flush to A stays legal (spades/hearts/diamonds have no card above A... A♣ is in clubs;
    // in the other suits the top IS the announced ace).
    expect(isClaimForbiddenByBoard({ category: 'flush', high: 'A' }, board)).toBe(false);
  });

  it('royal flush is never forbidden, so the ladder above any claim is never emptied', () => {
    const heavyBoard = [
      card('A', 'spades'),
      card('K', 'spades'),
      card('Q', 'spades'),
      card('J', 'spades'),
      card('T', 'spades'),
    ];
    expect(isClaimForbiddenByBoard({ category: 'royalFlush' }, heavyBoard)).toBe(false);
    for (const current of [null, { category: 'quads', rank: 'A' } as Claim]) {
      expect(allowedClaimsOnBoard(current, heavyBoard).length).toBeGreaterThanOrEqual(1);
    }
  });

  it('the hidden middle never feeds the rule — only face-up cards do (caller contract)', () => {
    // The module only ever receives state.board; passing the face-up part alone must
    // keep quinte au 7 legal even if an 8 hides face down elsewhere.
    const faceUp = [card('2', 'clubs')];
    expect(isClaimForbiddenByBoard({ category: 'straight', high: '7' }, faceUp)).toBe(false);
  });
});

describe('board-aware picker helpers', () => {
  it('equal the pure claims.ts helpers on an empty board', () => {
    const currents: (Claim | null)[] = [null, { category: 'pair', rank: 'Q' }, { category: 'twoPair', high: 'T', low: '6' }];
    for (const current of currents) {
      for (const category of CATEGORY_ORDER) {
        expect(
          [...allowedPrimaryRanksOnBoard(category, current, [])].sort(),
          `${category} vs ${JSON.stringify(current)}`,
        ).toEqual([...allowedPrimaryRanks(category, current)].sort());
      }
      for (const category of ['twoPair', 'fullHouse'] as const) {
        for (const primary of ['5', 'T'] as Rank[]) {
          expect([...allowedSecondaryRanksOnBoard(category, primary, current, [])].sort()).toEqual(
            [...allowedSecondaryRanks(category, primary, current)].sort(),
          );
        }
      }
    }
  });

  it('disables the pair category chip on a paired board', () => {
    const board = [card('5', 'spades'), card('5', 'hearts')];
    expect(categoryHasAllowedClaim('pair', null, board)).toBe(false);
    expect(categoryHasAllowedClaim('twoPair', null, board)).toBe(true);
  });

  it('filters straight highs on a board with an 8', () => {
    const board = [card('8', 'hearts')];
    const highs = allowedPrimaryRanksOnBoard('straight', null, board);
    expect(highs.has('7')).toBe(false);
    expect(highs.has('8')).toBe(true);
    expect(highs.has('6')).toBe(true);
  });
});
