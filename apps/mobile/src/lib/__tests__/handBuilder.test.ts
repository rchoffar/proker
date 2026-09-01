import { describe, expect, it } from 'vitest';
import {
  cardsEqual,
  computePots,
  makePlayers,
  parsePositiveAmount,
  positionLabel,
  resizePlayers,
  sortAndSeat,
} from '../handBuilder';
import { computeBlindPosting } from '../handPositions';
import type { HandAction, HandPlayer } from '../../types';

const name = (n: number) => `Player ${n}`;

describe('makePlayers / sortAndSeat', () => {
  it('seats everyone in preflop action order with seat = array index', () => {
    const players = makePlayers(6, 'Hero', name);
    expect(players).toHaveLength(6);
    expect(players.map((p) => p.seat)).toEqual([0, 1, 2, 3, 4, 5]);
    // The invariant the whole builder rests on: blinds act last preflop.
    expect(players[players.length - 1].position).toBe('BB');
    expect(players[players.length - 2].position).toBe('SB');
  });

  it('marks exactly one hero, and only the hero has known cards', () => {
    const players = makePlayers(5, 'Hero', name);
    const heroes = players.filter((p) => p.isHero);
    expect(heroes).toHaveLength(1);
    expect(heroes[0].name).toBe('Hero');
    expect(players.filter((p) => p.cardsKnown)).toEqual(heroes);
  });

  it('re-stamps seats after a re-sort', () => {
    const shuffled = [...makePlayers(4, 'Hero', name)].reverse();
    expect(sortAndSeat(shuffled).map((p) => p.seat)).toEqual([0, 1, 2, 3]);
  });

  it('gives everyone a distinct position and id', () => {
    const players = makePlayers(9, 'Hero', name);
    expect(new Set(players.map((p) => p.position)).size).toBe(9);
    expect(new Set(players.map((p) => p.id)).size).toBe(9);
  });
});

describe('resizePlayers', () => {
  it('keeps the hero when shrinking, however the array is ordered', () => {
    const six = makePlayers(6, 'Hero', name);
    const two = resizePlayers(six, 2, name);
    expect(two).toHaveLength(2);
    expect(two.some((p) => p.isHero)).toBe(true);
  });

  it('never assigns a duplicate position or id when growing', () => {
    let players = makePlayers(2, 'Hero', name);
    players = resizePlayers(players, 6, name);
    expect(players).toHaveLength(6);
    expect(new Set(players.map((p) => p.position)).size).toBe(6);
    expect(new Set(players.map((p) => p.id)).size).toBe(6);
  });

  it('survives a grow/shrink round trip without losing the invariant', () => {
    let players = makePlayers(3, 'Hero', name);
    players = resizePlayers(players, 8, name);
    players = resizePlayers(players, 4, name);
    expect(players).toHaveLength(4);
    expect(players.map((p) => p.seat)).toEqual([0, 1, 2, 3]);
    expect(new Set(players.map((p) => p.id)).size).toBe(4);
    expect(players.filter((p) => p.isHero)).toHaveLength(1);
  });

  it('is a no-op at the same count', () => {
    const players = makePlayers(4, 'Hero', name);
    expect(resizePlayers(players, 4, name).map((p) => p.id)).toEqual(players.map((p) => p.id));
  });

  it('refuses to drop below the hero alone', () => {
    const players: HandPlayer[] = makePlayers(2, 'Hero', name);
    // Asking for zero cannot remove the hero — the loop has no non-hero left to take.
    expect(resizePlayers(players, 0, name).filter((p) => p.isHero)).toHaveLength(1);
  });
});

describe('computePots', () => {
  const act = (street: HandAction['street'], playerId: string, order: number, amount?: number): HandAction =>
    ({ street, playerId, order, type: amount === undefined ? 'check' : 'bet', amount }) as HandAction;

  it('is empty when nothing happened', () => {
    expect(computePots([])).toEqual([]);
  });

  it('carries dead blinds into the first street with action', () => {
    const pots = computePots([act('preflop', 'a', 1, 2)], 3);
    expect(pots).toEqual([{ street: 'preflop', amount: 5 }]);
  });

  it('treats amounts as street totals, not increments', () => {
    // 'a' bets 2, 'b' raises to 6, 'a' calls 6 — the pot is 12, not 14.
    const pots = computePots([act('preflop', 'a', 1, 2), act('preflop', 'b', 2, 6), act('preflop', 'a', 3, 6)]);
    expect(pots).toEqual([{ street: 'preflop', amount: 12 }]);
  });

  it('accumulates across streets and skips streets with no action', () => {
    const pots = computePots([act('preflop', 'a', 1, 4), act('river', 'a', 2, 10)]);
    expect(pots).toEqual([
      { street: 'preflop', amount: 4 },
      { street: 'river', amount: 14 },
    ]);
  });

  it('ignores amountless actions like checks', () => {
    const pots = computePots([act('flop', 'a', 1), act('flop', 'b', 2)]);
    expect(pots).toEqual([{ street: 'flop', amount: 0 }]);
  });
});

describe('parsePositiveAmount', () => {
  it.each([
    ['12', 12],
    ['12.5', 12.5],
    ['12,5', 12.5], // French keyboards produce a comma
    ['0', 0],
    ['-3', 0],
    ['', 0],
    ['abc', 0],
  ])('parses %j as %j', (raw, expected) => {
    expect(parsePositiveAmount(raw)).toBe(expected);
  });
});

describe('positionLabel', () => {
  it('spells out BTN/SB when the button posts the small blind (heads-up)', () => {
    expect(positionLabel({ id: 'p0', position: 'BTN' }, { sbPosterId: 'p0' })).toBe('BTN/SB');
  });

  it('leaves the button alone when someone else posts the small blind', () => {
    expect(positionLabel({ id: 'p0', position: 'BTN' }, { sbPosterId: 'p1' })).toBe('BTN');
  });

  it('is empty for a player with no position yet', () => {
    expect(positionLabel({ id: 'p0' }, {})).toBe('');
  });
});

// The badge and the dead money are two readings of ONE stored answer, so they can never
// disagree — and they did: the builder collapsed "heads-up: no" into `undefined`, which the
// reader takes to mean "hand recorded before the question existed, guess heads-up". The felt
// then badged the button BTN/SB while the same hand counted the small blind as dead money.
describe('the stored heads-up answer, as the felt reads it back', () => {
  const roster = [
    { id: 'p0', position: 'BTN' as const },
    { id: 'p1', position: 'BB' as const },
  ];
  const readBack = (stored: boolean | undefined) => {
    const posting = computeBlindPosting(roster, 0.5, 1, stored);
    return { label: positionLabel(roster[0], posting), deadBlinds: posting.deadBlinds };
  };

  it('true — a real heads-up table: the button posts, nothing is dead', () => {
    expect(readBack(true)).toEqual({ label: 'BTN/SB', deadBlinds: 0 });
  });

  it('false — two of a bigger table: the button is just the button, the SB is dead money', () => {
    expect(readBack(false)).toEqual({ label: 'BTN', deadBlinds: 0.5 });
  });

  it('undefined — recorded before the question existed, so the old guess stands', () => {
    expect(readBack(undefined)).toEqual({ label: 'BTN/SB', deadBlinds: 0 });
  });

  it('never badges BTN/SB while charging the small blind as dead money', () => {
    for (const stored of [true, false, undefined]) {
      const { label, deadBlinds } = readBack(stored);
      expect(label === 'BTN/SB').toBe(deadBlinds === 0);
    }
  });
});

describe('cardsEqual', () => {
  it('compares rank and suit', () => {
    expect(cardsEqual({ rank: 'A', suit: 'spades' }, { rank: 'A', suit: 'spades' })).toBe(true);
    expect(cardsEqual({ rank: 'A', suit: 'spades' }, { rank: 'A', suit: 'hearts' })).toBe(false);
    expect(cardsEqual({ rank: 'A', suit: 'spades' }, { rank: 'K', suit: 'spades' })).toBe(false);
  });
});
