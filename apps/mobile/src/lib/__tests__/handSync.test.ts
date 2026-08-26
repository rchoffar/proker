import { describe, expect, it } from 'vitest';
import type { HandHistory } from '../../types/hand';
import { reconcile, sortHandsNewestFirst } from '../handSync';

describe('reconcile', () => {
  it('fetches server hands that are missing locally', () => {
    const r = reconcile(['a'], [], [], ['a', 'b', 'c']);
    expect(r.toFetch).toEqual(['b', 'c']);
    expect(r.toDrop).toEqual([]);
  });

  it('never re-fetches a hand whose delete is still pending', () => {
    const r = reconcile([], [], ['b'], ['b']);
    expect(r.toFetch).toEqual([]);
  });

  it('drops local hands the server no longer has', () => {
    const r = reconcile(['a', 'gone'], [], [], ['a']);
    expect(r.toDrop).toEqual(['gone']);
  });

  it('keeps a local hand that is pending upload even if the server does not know it yet', () => {
    const r = reconcile(['offline-hand'], ['offline-hand'], [], []);
    expect(r.toDrop).toEqual([]);
    expect(r.toFetch).toEqual([]);
  });

  it('does not fetch hands already cached locally', () => {
    const r = reconcile(['a', 'b'], [], [], ['a', 'b']);
    expect(r.toFetch).toEqual([]);
    expect(r.toDrop).toEqual([]);
  });
});

describe('sortHandsNewestFirst', () => {
  const hand = (id: string, createdAt: string): HandHistory => ({
    id,
    createdAt,
    gameType: 'NLH',
    players: [],
    board: {},
    actions: [],
    pots: [],
  });

  it('orders by createdAt descending without mutating the input', () => {
    const input = [hand('old', '2026-01-01T00:00:00.000Z'), hand('new', '2026-08-25T00:00:00.000Z')];
    const sorted = sortHandsNewestFirst(input);
    expect(sorted.map((h) => h.id)).toEqual(['new', 'old']);
    expect(input.map((h) => h.id)).toEqual(['old', 'new']);
  });
});
