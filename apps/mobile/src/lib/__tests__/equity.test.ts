import { describe, expect, it } from 'vitest';
import { estimateEquity, hashSeed, seededRng } from '../equity';
import type { Card, Rank, Suit } from '../../types/hand';

function c(rank: Rank, suit: Suit): Card {
  return { rank, suit };
}

const AA: Card[] = [c('A', 'spades'), c('A', 'hearts')];
const KK: Card[] = [c('K', 'spades'), c('K', 'hearts')];
const TREY_DEUCE: Card[] = [c('3', 'clubs'), c('2', 'diamonds')];
const DRY_BOARD: Card[] = [c('Q', 'clubs'), c('J', 'diamonds'), c('7', 'spades'), c('4', 'hearts'), c('2', 'clubs')];

describe('estimateEquity', () => {
  it('is exact on a complete board with all hands known', () => {
    const eq = estimateEquity(
      [
        { id: 'a', holeCards: AA },
        { id: 'b', holeCards: KK },
      ],
      DRY_BOARD
    );
    expect(eq.get('a')).toBe(100);
    expect(eq.get('b')).toBe(0);
  });

  it('splits a guaranteed chop', () => {
    // Board plays for both: broadway straight on the board.
    const board = [c('A', 'clubs'), c('K', 'diamonds'), c('Q', 'spades'), c('J', 'hearts'), c('T', 'clubs')];
    const eq = estimateEquity(
      [
        { id: 'a', holeCards: [c('2', 'clubs'), c('3', 'hearts')] },
        { id: 'b', holeCards: [c('4', 'diamonds'), c('5', 'spades')] },
      ],
      board
    );
    expect(eq.get('a')).toBe(50);
    expect(eq.get('b')).toBe(50);
  });

  it('gives a lone contender 100%', () => {
    expect(estimateEquity([{ id: 'a', holeCards: AA }], []).get('a')).toBe(100);
  });

  it('is deterministic for a given seed and rates AA far above 32o preflop', () => {
    const run = () =>
      estimateEquity(
        [
          { id: 'aces', holeCards: AA },
          { id: 'trash', holeCards: TREY_DEUCE },
        ],
        [],
        'holdem',
        seededRng(hashSeed('test-hand'))
      );
    const first = run();
    expect(run()).toEqual(first);
    expect(first.get('aces')!).toBeGreaterThan(75);
    const total = first.get('aces')! + first.get('trash')!;
    expect(Math.abs(total - 100)).toBeLessThanOrEqual(1); // rounding only
  });

  it('handles unknown hands by dealing them randomly', () => {
    const eq = estimateEquity(
      [
        { id: 'hero', holeCards: AA },
        { id: 'villain', holeCards: null },
      ],
      [],
      'holdem',
      seededRng(1)
    );
    expect(eq.get('hero')!).toBeGreaterThan(70);
    expect(eq.get('villain')!).toBeLessThan(30);
  });
});
