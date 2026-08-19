import { describe, expect, it } from 'vitest';
import type { Card, Rank, Suit } from '../../../types/hand';
import { claimHolds, findClaimWitness, straightRanks } from '../validator';

function c(rank: Rank, suit: Suit = 'spades'): Card {
  return { rank, suit };
}

describe('straightRanks', () => {
  it('handles the wheel', () => {
    expect(straightRanks('5')).toEqual(['A', '2', '3', '4', '5']);
  });
  it('handles a standard run', () => {
    expect(straightRanks('T')).toEqual(['6', '7', '8', '9', 'T']);
  });
});

describe('claimHolds — spec scenarios', () => {
  it('scénario 1: KK22 announced, pool has quad 2s + KK → claim holds (catcher loses)', () => {
    const pool = [c('2', 'spades'), c('2', 'hearts'), c('2', 'clubs'), c('2', 'diamonds'), c('K', 'spades'), c('K', 'hearts')];
    expect(claimHolds({ category: 'twoPair', high: 'K', low: '2' }, pool)).toBe(true);
  });

  it('scénario 2: KK22 announced, pool = KK 33 JJ 66 (no pair of 2) → claim fails', () => {
    const pool = [
      c('K', 'spades'), c('K', 'hearts'),
      c('3', 'spades'), c('3', 'hearts'),
      c('J', 'spades'), c('J', 'hearts'),
      c('6', 'spades'), c('6', 'hearts'),
    ];
    expect(claimHolds({ category: 'twoPair', high: 'K', low: '2' }, pool)).toBe(false);
  });
});

describe('claimHolds — per category', () => {
  it('pair', () => {
    expect(claimHolds({ category: 'pair', rank: '7' }, [c('7'), c('7', 'hearts'), c('A')])).toBe(true);
    expect(claimHolds({ category: 'pair', rank: '7' }, [c('7'), c('8'), c('A')])).toBe(false);
  });

  it('trips is satisfied by quads (better cards never penalize)', () => {
    const pool = [c('9', 'spades'), c('9', 'hearts'), c('9', 'clubs'), c('9', 'diamonds')];
    expect(claimHolds({ category: 'trips', rank: '9' }, pool)).toBe(true);
  });

  it('straight requires all five run ranks, suits irrelevant', () => {
    const pool = [c('6', 'spades'), c('7', 'hearts'), c('8', 'clubs'), c('9', 'diamonds'), c('T', 'spades')];
    expect(claimHolds({ category: 'straight', high: 'T' }, pool)).toBe(true);
    expect(claimHolds({ category: 'straight', high: 'J' }, pool)).toBe(false);
  });

  it('wheel straight uses the ace low', () => {
    const pool = [c('A'), c('2', 'hearts'), c('3', 'clubs'), c('4', 'diamonds'), c('5', 'hearts')];
    expect(claimHolds({ category: 'straight', high: '5' }, pool)).toBe(true);
  });

  it('flush needs ≥5 of one suit with max rank ≥ announced high', () => {
    const hearts = [c('2', 'hearts'), c('5', 'hearts'), c('7', 'hearts'), c('9', 'hearts'), c('Q', 'hearts')];
    expect(claimHolds({ category: 'flush', high: 'Q' }, hearts)).toBe(true);
    expect(claimHolds({ category: 'flush', high: 'J' }, hearts)).toBe(true); // Q-high beats J-high
    expect(claimHolds({ category: 'flush', high: 'K' }, hearts)).toBe(false);
    // 5 cards spread over two suits: no flush.
    const mixed = [c('2', 'hearts'), c('5', 'hearts'), c('7', 'hearts'), c('9', 'hearts'), c('Q', 'spades')];
    expect(claimHolds({ category: 'flush', high: '6' }, mixed)).toBe(false);
  });

  it('full house', () => {
    const pool = [c('8', 'spades'), c('8', 'hearts'), c('8', 'clubs'), c('3', 'spades'), c('3', 'hearts')];
    expect(claimHolds({ category: 'fullHouse', trips: '8', pair: '3' }, pool)).toBe(true);
    expect(claimHolds({ category: 'fullHouse', trips: '3', pair: '8' }, pool)).toBe(false);
  });

  it('straight flush requires the run within a single suit', () => {
    const oneSuit = [c('6', 'clubs'), c('7', 'clubs'), c('8', 'clubs'), c('9', 'clubs'), c('T', 'clubs')];
    expect(claimHolds({ category: 'straightFlush', high: 'T' }, oneSuit)).toBe(true);
    const split = [c('6', 'clubs'), c('7', 'hearts'), c('8', 'clubs'), c('9', 'clubs'), c('T', 'clubs')];
    expect(claimHolds({ category: 'straightFlush', high: 'T' }, split)).toBe(false);
  });

  it('royal flush = ace-high straight flush', () => {
    const royal = [c('T', 'diamonds'), c('J', 'diamonds'), c('Q', 'diamonds'), c('K', 'diamonds'), c('A', 'diamonds')];
    expect(claimHolds({ category: 'royalFlush' }, royal)).toBe(true);
    const kingHigh = [c('9', 'diamonds'), c('T', 'diamonds'), c('J', 'diamonds'), c('Q', 'diamonds'), c('K', 'diamonds')];
    expect(claimHolds({ category: 'royalFlush' }, kingHigh)).toBe(false);
  });
});

describe('findClaimWitness', () => {
  it('returns exactly the cards proving the claim', () => {
    const pool = [c('K', 'spades'), c('K', 'hearts'), c('2', 'clubs'), c('2', 'diamonds'), c('9', 'spades')];
    const witness = findClaimWitness({ category: 'twoPair', high: 'K', low: '2' }, pool);
    expect(witness).toHaveLength(4);
    expect(witness!.filter((card) => card.rank === 'K')).toHaveLength(2);
    expect(witness!.filter((card) => card.rank === '2')).toHaveLength(2);
  });

  it('returns null when the claim fails', () => {
    expect(findClaimWitness({ category: 'quads', rank: 'A' }, [c('A'), c('A', 'hearts')])).toBeNull();
  });

  it('flush witness comes from a single suit and includes a card ≥ high', () => {
    const pool = [
      c('2', 'hearts'), c('5', 'hearts'), c('7', 'hearts'), c('9', 'hearts'), c('Q', 'hearts'), c('K', 'spades'),
    ];
    const witness = findClaimWitness({ category: 'flush', high: 'T' }, pool)!;
    expect(witness).toHaveLength(5);
    expect(new Set(witness.map((card) => card.suit)).size).toBe(1);
    expect(witness.some((card) => card.rank === 'Q')).toBe(true);
  });
});
