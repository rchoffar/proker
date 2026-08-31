import { describe, expect, it } from 'vitest';
import type { Position } from '../../types/hand';
import {
  DEFAULT_ASSIGN_ORDER,
  computeBlindPosting,
  nextFreePosition,
  orderForStreet,
  sortByPreflopOrder,
} from '../handPositions';

function roster(positions: (Position | undefined)[]): { id: string; position?: Position }[] {
  return positions.map((position, i) => ({ id: `p${i}`, position }));
}

describe('sortByPreflopOrder', () => {
  it('orders a full ring UTG first, BB last', () => {
    const players = roster(['BB', 'BTN', 'UTG', 'SB', 'CO', 'HJ']);
    expect(sortByPreflopOrder(players).map((p) => p.position)).toEqual(['UTG', 'HJ', 'CO', 'BTN', 'SB', 'BB']);
  });

  it('orders a table subset the same way (absent positions just skipped)', () => {
    const players = roster(['BB', 'HJ', 'UTG']);
    expect(sortByPreflopOrder(players).map((p) => p.position)).toEqual(['UTG', 'HJ', 'BB']);
  });

  it('sorts unassigned players last without disturbing assigned ones', () => {
    const players = roster(['BB', undefined, 'UTG']);
    expect(sortByPreflopOrder(players).map((p) => p.position)).toEqual(['UTG', 'BB', undefined]);
  });
});

describe('orderForStreet', () => {
  const players = roster(['BB', 'BTN', 'UTG', 'SB']);

  it('preflop: UTG first, blinds last', () => {
    expect(orderForStreet(players, 'preflop').map((p) => p.position)).toEqual(['UTG', 'BTN', 'SB', 'BB']);
  });

  it('postflop: SB first, BTN last', () => {
    expect(orderForStreet(players, 'flop').map((p) => p.position)).toEqual(['SB', 'BB', 'UTG', 'BTN']);
  });

  it('heads-up BTN vs BB: BTN first preflop, BB first postflop', () => {
    const hu = roster(['BB', 'BTN']);
    expect(orderForStreet(hu, 'preflop').map((p) => p.position)).toEqual(['BTN', 'BB']);
    expect(orderForStreet(hu, 'river').map((p) => p.position)).toEqual(['BB', 'BTN']);
  });
});

describe('computeBlindPosting', () => {
  it('both blinds present: both post, no dead money', () => {
    const players = roster(['SB', 'BB', 'BTN']);
    expect(computeBlindPosting(players, 0.5, 1)).toEqual({ sbPosterId: 'p0', bbPosterId: 'p1', deadBlinds: 0 });
  });

  it('heads-up BTN + BB: the button posts the small blind', () => {
    const players = roster(['BB', 'BTN']);
    expect(computeBlindPosting(players, 0.5, 1, true)).toEqual({ sbPosterId: 'p1', bbPosterId: 'p0', deadBlinds: 0 });
  });

  // The reading Mathieu asked for: "BTN vs BB" is usually two players out of a full table,
  // where the small blind belongs to somebody who is not in the hand.
  it('BTN + BB that is NOT heads-up leaves the small blind dead', () => {
    const players = roster(['BB', 'BTN']);
    expect(computeBlindPosting(players, 0.5, 1, false)).toEqual({
      sbPosterId: undefined,
      bbPosterId: 'p0',
      deadBlinds: 0.5,
    });
  });

  it('keeps the old guess when the hand never stored an answer', () => {
    const players = roster(['BB', 'BTN']);
    expect(computeBlindPosting(players, 0.5, 1)).toEqual(computeBlindPosting(players, 0.5, 1, true));
  });

  // The divergence the felt used to have: its own copy of the rule dropped the BB check, so
  // this roster was tagged BTN/SB while the engine posted the small blind as dead money.
  it('never gives the button the small blind without a BB, even asked for heads-up', () => {
    const players = roster(['BTN', 'CO']);
    expect(computeBlindPosting(players, 0.5, 1, true)).toEqual({
      sbPosterId: undefined,
      bbPosterId: undefined,
      deadBlinds: 1.5,
    });
  });

  it('two players in positions that cannot be a heads-up table leave absent blinds dead', () => {
    const players = roster(['BTN', 'CO']);
    expect(computeBlindPosting(players, 0.5, 1)).toEqual({ sbPosterId: undefined, bbPosterId: undefined, deadBlinds: 1.5 });
  });

  it('absent SB only becomes dead money', () => {
    const players = roster(['UTG', 'HJ', 'BB']);
    expect(computeBlindPosting(players, 0.5, 1)).toEqual({ sbPosterId: undefined, bbPosterId: 'p2', deadBlinds: 0.5 });
  });

  it('absent BB only becomes dead money at the BB value', () => {
    const players = roster(['SB', 'CO', 'BTN']);
    expect(computeBlindPosting(players, 1, 2)).toEqual({ sbPosterId: 'p0', bbPosterId: undefined, deadBlinds: 2 });
  });
});

describe('default position assignment', () => {
  it('hands out BTN then the blinds first, so 2 players form a valid heads-up', () => {
    expect(DEFAULT_ASSIGN_ORDER.slice(0, 2)).toEqual(['BTN', 'BB']);
  });

  it('nextFreePosition skips taken positions and returns undefined when full', () => {
    expect(nextFreePosition(new Set(['BTN', 'BB']))).toBe('SB');
    expect(nextFreePosition(new Set(DEFAULT_ASSIGN_ORDER))).toBeUndefined();
  });
});
