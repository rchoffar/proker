import { describe, expect, it } from 'vitest';
import { evaluateFiveCardHand } from '../pokerHandEvaluator';
import { strengthColor, winningCardKeys } from '../handStrength';
import type { Card, Rank, Suit } from '../../types/hand';

function c(rank: Rank, suit: Suit): Card {
  return { rank, suit };
}

const ROYAL_FLUSH = [c('A', 'spades'), c('K', 'spades'), c('Q', 'spades'), c('J', 'spades'), c('T', 'spades')];

describe('strengthColor', () => {
  it('hits the exact scale stops at 0, 50 and 100', () => {
    expect(strengthColor(0)).toBe('#E5484D');
    expect(strengthColor(50)).toBe('#E7C36F');
    expect(strengthColor(100)).toBe('#17E58A');
  });

  it('produces valid hex colors between the stops', () => {
    for (const pct of [10, 25, 42, 63, 88]) {
      expect(strengthColor(pct)).toMatch(/^#[0-9A-F]{6}$/);
    }
  });

  it('clamps out-of-range percents', () => {
    expect(strengthColor(-5)).toBe('#E5484D');
    expect(strengthColor(140)).toBe('#17E58A');
  });
});

describe('winningCardKeys', () => {
  it('returns the 5 keys of a single winner', () => {
    const keys = winningCardKeys([evaluateFiveCardHand(ROYAL_FLUSH)]);
    expect(keys.size).toBe(5);
    expect(keys.has('As')).toBe(true);
    expect(keys.has('Ts')).toBe(true);
  });

  it('unions the best-5s of tied winners with different suits', () => {
    const straightA = [c('9', 'spades'), c('8', 'hearts'), c('7', 'clubs'), c('6', 'diamonds'), c('5', 'spades')];
    const straightB = [c('9', 'clubs'), c('8', 'diamonds'), c('7', 'hearts'), c('6', 'spades'), c('5', 'hearts')];
    const keys = winningCardKeys([evaluateFiveCardHand(straightA), evaluateFiveCardHand(straightB)]);
    expect(keys.size).toBe(10);
  });
});
