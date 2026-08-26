import { describe, expect, it } from 'vitest';
import { sortHand } from '../handSort';
import { cards } from './fixtures';

const key = (hand: ReturnType<typeof cards>) => hand.map((c) => `${c.rank}${c.suit[0]}`);

describe('sortHand', () => {
  const dealt = cards('2c Ah 7s 7d Kc 2s 7h Qd');

  it('rank: descending, suit as tiebreak, input untouched', () => {
    const sorted = sortHand(dealt, 'rank');
    expect(key(sorted)).toEqual(['Ah', 'Kc', 'Qd', '7s', '7h', '7d', '2s', '2c']);
    expect(key(dealt)).toEqual(['2c', 'Ah', '7s', '7d', 'Kc', '2s', '7h', 'Qd']);
  });

  it('suit: grouped by suit, descending rank within each', () => {
    const sorted = sortHand(dealt, 'suit');
    expect(key(sorted)).toEqual(['7s', '2s', 'Ah', '7h', 'Kc', '2c', 'Qd', '7d']);
  });

  it('pairs: biggest groups first, then descending rank, singles last', () => {
    const sorted = sortHand(dealt, 'pairs');
    expect(key(sorted)).toEqual(['7s', '7h', '7d', '2s', '2c', 'Ah', 'Kc', 'Qd']);
  });

  it('pairs: quads outrank trips regardless of rank', () => {
    const sorted = sortHand(cards('As Ah Ac 3s 3h 3d 3c'), 'pairs');
    expect(key(sorted)).toEqual(['3s', '3h', '3c', '3d', 'As', 'Ah', 'Ac']);
  });
});
