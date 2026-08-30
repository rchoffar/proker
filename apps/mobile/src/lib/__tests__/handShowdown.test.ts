import { describe, expect, it } from 'vitest';
import { allInRevealIndex, detectBadBeat, equityCacheKey, equityForKey, evaluateShowdown } from '../handShowdown';
import { buildBeats } from '../handReplay';
import type { Card, HandAction, HandHistory, HandPlayer, Street } from '../../types';

// None of this was reachable from a test while it lived in useMemos inside
// app/hand-replayer/play.tsx — including detectBadBeat, which runs its own Monte-Carlo and
// decides whether the river gets a staged celebration.

let order = 0;
const act = (street: Street, playerId: string, type: HandAction['type'], amount?: number): HandAction => ({
  id: `${street}-${playerId}-${++order}`,
  street,
  playerId,
  type,
  amount,
  order,
});

const c = (rank: Card['rank'], suit: Card['suit']): Card => ({ rank, suit });

function player(id: string, opts: Partial<HandPlayer> = {}): HandPlayer {
  return {
    id,
    name: id,
    isHero: id === 'hero',
    seat: 0,
    startingStack: 100,
    cardsKnown: false,
    isFolded: false,
    ...opts,
  };
}

/**
 * Hero holds a set of deuces on the turn; villain rivers a flush. Hero is the recorded
 * winner, which makes this a bad beat only if we lie about who won — which is exactly what
 * we want to control per-test, so the winner is a parameter.
 */
function riverHand(opts: {
  winnerIds?: string[];
  heroCards?: [Card, Card];
  villainCards?: [Card, Card];
  heroKnown?: boolean;
  villainKnown?: boolean;
  extraActions?: HandAction[];
}): HandHistory {
  order = 0;
  return {
    id: 'bb-hand',
    createdAt: '2026-08-30T00:00:00.000Z',
    gameType: 'NLH',
    unitMode: 'bb',
    players: [
      player('hero', {
        seat: 0,
        cardsKnown: opts.heroKnown ?? true,
        holeCards: opts.heroCards ?? [c('2', 'clubs'), c('2', 'diamonds')],
      }),
      player('villain', {
        seat: 1,
        cardsKnown: opts.villainKnown ?? true,
        holeCards: opts.villainCards ?? [c('J', 'hearts'), c('9', 'hearts')],
      }),
    ],
    board: {
      flop: [c('2', 'spades'), c('A', 'hearts'), c('K', 'hearts')],
      turn: c('7', 'clubs'),
      river: c('3', 'hearts'),
    },
    actions: opts.extraActions ?? [
      act('preflop', 'hero', 'post', 0.5),
      act('preflop', 'villain', 'post', 1),
      act('preflop', 'hero', 'raise', 3),
      act('preflop', 'villain', 'call', 3),
    ],
    winnerIds: opts.winnerIds ?? ['villain'],
    pots: [],
  };
}

describe('evaluateShowdown', () => {
  it('dims nothing when a winner’s cards are unknown', () => {
    const hand = riverHand({ winnerIds: ['villain'], villainKnown: false });
    expect(evaluateShowdown(hand)!.winningKeys).toBeNull();
  });

  it('dims nothing on an unfinished board', () => {
    const hand = riverHand({});
    const partial: HandHistory = { ...hand, board: { flop: hand.board.flop } };
    expect(evaluateShowdown(partial)!.winningKeys).toBeNull();
  });

  it('produces winning cards when every winner is computable', () => {
    const result = evaluateShowdown(riverHand({ winnerIds: ['villain'] }))!;
    expect(result.winningKeys).not.toBeNull();
    expect(result.winningKeys!.size).toBe(5);
    expect(result.scores.has('villain')).toBe(true);
  });

  it('skips folded players when scoring', () => {
    const hand = riverHand({});
    hand.players[1] = { ...hand.players[1], isFolded: true };
    expect(evaluateShowdown(hand)!.scores.has('villain')).toBe(false);
  });
});

describe('detectBadBeat', () => {
  it('flags a heavy underdog who rivered the winning hand', () => {
    // Villain is drawing to a heart flush on the turn — well under the 30% threshold.
    const bad = detectBadBeat(riverHand({ winnerIds: ['villain'] }));
    expect(bad).not.toBeNull();
    expect(bad!.name).toBe('villain');
    expect(bad!.percent).toBeGreaterThanOrEqual(1);
    expect(bad!.percent).toBeLessThanOrEqual(30);
  });

  it('is deterministic for a given hand id', () => {
    const hand = riverHand({ winnerIds: ['villain'] });
    expect(detectBadBeat(hand)).toEqual(detectBadBeat(hand));
  });

  it('is not a bad beat when the favourite held up', () => {
    // Hero had the set on the turn and is recorded as the winner.
    expect(detectBadBeat(riverHand({ winnerIds: ['hero'] }))).toBeNull();
  });

  it('needs a single winner — a split pot is not a bad beat', () => {
    expect(detectBadBeat(riverHand({ winnerIds: ['hero', 'villain'] }))).toBeNull();
  });

  it('needs the winner’s cards to be known', () => {
    expect(detectBadBeat(riverHand({ winnerIds: ['villain'], villainKnown: false }))).toBeNull();
  });

  it('needs a completed board', () => {
    const hand = riverHand({ winnerIds: ['villain'] });
    expect(detectBadBeat({ ...hand, board: { flop: hand.board.flop, turn: hand.board.turn } })).toBeNull();
  });

  it('ignores a "winner" who folded before the river', () => {
    const hand = riverHand({
      winnerIds: ['villain'],
      extraActions: [act('turn', 'villain', 'fold')],
    });
    expect(detectBadBeat(hand)).toBeNull();
  });

  it('respects a custom threshold', () => {
    const hand = riverHand({ winnerIds: ['villain'] });
    expect(detectBadBeat(hand, 0)).toBeNull(); // nothing is ever below 0%
    expect(detectBadBeat(hand, 100)).not.toBeNull();
  });
});

describe('allInRevealIndex', () => {
  it('is null when the hand is decided by betting on the last street', () => {
    const hand = riverHand({
      extraActions: [
        act('preflop', 'hero', 'raise', 3),
        act('preflop', 'villain', 'call', 3),
        act('river', 'hero', 'bet', 10),
        act('river', 'villain', 'fold'),
      ],
    });
    expect(allInRevealIndex(buildBeats(hand))).toBeNull();
  });

  it('points just past the last betting beat when cards still have to come', () => {
    const hand = riverHand({
      extraActions: [act('preflop', 'hero', 'bet', 100), act('preflop', 'villain', 'call', 100)],
    });
    const beats = buildBeats(hand);
    const idx = allInRevealIndex(beats);
    expect(idx).not.toBeNull();
    // Everything from here on reveals cards rather than actions.
    for (const b of beats.slice(idx!)) {
      if (b.kind === 'street') expect(b.actions).toHaveLength(0);
    }
  });
});

describe('equityCacheKey / equityForKey', () => {
  const hand = riverHand({
    extraActions: [act('preflop', 'hero', 'bet', 100), act('preflop', 'villain', 'call', 100)],
  });
  const beats = buildBeats(hand);
  const allInFrom = allInRevealIndex(beats);

  it('is null before the run-out starts', () => {
    expect(equityCacheKey(beats, 0, allInFrom)).toBeNull();
    expect(equityCacheKey(beats, 0, null)).toBeNull();
  });

  it('grows the board length as streets are walked', () => {
    const keys = beats
      .map((_, i) => equityCacheKey(beats, i, allInFrom))
      .filter((k): k is string => k !== null)
      .map((k) => Number(k.split('|')[0]));
    expect(keys.length).toBeGreaterThan(0);
    for (let i = 1; i < keys.length; i++) expect(keys[i]).toBeGreaterThanOrEqual(keys[i - 1]);
  });

  it('returns stable percentages that sum to about 100', () => {
    const key = equityCacheKey(beats, beats.length - 1, allInFrom)!;
    const first = equityForKey(hand, key)!;
    expect(equityForKey(hand, key)).toEqual(first);
    const total = [...first.values()].reduce((a, b) => a + b, 0);
    expect(total).toBeGreaterThan(95);
    expect(total).toBeLessThan(105);
  });

  it('is null when fewer than two players remain', () => {
    const soloKey = '3|villain';
    expect(equityForKey(hand, soloKey)).toBeNull();
  });
});
