import { describe, expect, it } from 'vitest';
import {
  animatedActions,
  buildBeats,
  committedBy,
  contributionsFrom,
  holdMsFor,
  revealedActionsUpTo,
  totalContributed,
} from '../handReplay';
import type { HandAction, HandHistory, HandPlayer, Street } from '../../types';

// Mathieu's 28/08 report on an exported video, three symptoms of one cause: at the flop the
// two players' checks never appeared (the bet that followed replaced them), and both stacks
// and the pot jumped to their end-of-street values before any of the bets that made them.

let order = 0;
const act = (street: Street, playerId: string, type: HandAction['type'], amount?: number): HandAction => ({
  id: `${street}-${playerId}-${++order}`,
  street,
  playerId,
  type,
  amount,
  order,
});

const player = (id: string, isHero: boolean, seat: number): HandPlayer => ({
  id,
  name: id,
  isHero,
  seat,
  startingStack: 100,
  cardsKnown: false,
  isFolded: false,
});

// Heads-up, 0.5/1: hero posts the SB from the button, villain the BB. Flop goes
// check → check → bet 5 → call.
function makeHand(): HandHistory {
  order = 0;
  return {
    id: 'h1',
    createdAt: '2026-08-28T00:00:00.000Z',
    gameType: 'NLH',
    unitMode: 'bb',
    players: [player('hero', true, 0), player('villain', false, 1)],
    board: {
      flop: [
        { rank: 'A', suit: 'hearts' },
        { rank: 'K', suit: 'diamonds' },
        { rank: '2', suit: 'clubs' },
      ],
    },
    actions: [
      act('preflop', 'hero', 'post', 0.5),
      act('preflop', 'villain', 'post', 1),
      act('preflop', 'hero', 'raise', 3),
      act('preflop', 'villain', 'call', 3),
      act('flop', 'villain', 'check'),
      act('flop', 'hero', 'check'),
      act('flop', 'villain', 'bet', 5),
      act('flop', 'hero', 'call', 5),
    ],
    pots: [],
  };
}

const potAt = (hand: HandHistory, beats: ReturnType<typeof buildBeats>, index: number, count: number) =>
  totalContributed(contributionsFrom(revealedActionsUpTo(beats, index, count))) + (hand.ante ?? 0);

describe('replay reveal', () => {
  it('leaves the blinds out of the animated sequence', () => {
    const beats = buildBeats(makeHand());
    const preflop = beats[1];

    expect(animatedActions(preflop).map((a) => a.type)).toEqual(['raise', 'call']);
  });

  it('shows the blinds in the pot before anyone has acted', () => {
    const hand = makeHand();
    const beats = buildBeats(hand);

    // Cursor at 0: the beat has been reached but no action has played yet.
    expect(potAt(hand, beats, 1, 0)).toBe(1.5);
  });

  it('builds the pot one action at a time instead of jumping to the street total', () => {
    const hand = makeHand();
    const beats = buildBeats(hand);
    const flop = 2;

    // The bug: every one of these read 11 (2 blinds + bet 5 + call 5) the instant the flop
    // beat was reached, before a single bubble had animated in.
    expect(potAt(hand, beats, flop, 0)).toBe(6); // raise 3 + call 3
    expect(potAt(hand, beats, flop, 1)).toBe(6); // villain checks
    expect(potAt(hand, beats, flop, 2)).toBe(6); // hero checks
    expect(potAt(hand, beats, flop, 3)).toBe(11); // villain bets 5
    expect(potAt(hand, beats, flop, 4)).toBe(16); // hero calls
  });

  it('keeps a stack whole until the bet that spends it is revealed', () => {
    const hand = makeHand();
    const beats = buildBeats(hand);
    const stackAfter = (count: number) =>
      100 - committedBy(contributionsFrom(revealedActionsUpTo(beats, 2, count)), 'hero');

    expect(stackAfter(0)).toBe(97); // preflop only
    expect(stackAfter(2)).toBe(97); // both checks — nothing spent
    expect(stackAfter(3)).toBe(97); // villain's bet is not hero's money
    expect(stackAfter(4)).toBe(92); // hero calls 5
  });

  it('surfaces both checks, which a per-player map dropped', () => {
    const hand = makeHand();
    const beats = buildBeats(hand);
    const flopActions = animatedActions(beats[2]);

    // Latest revealed action per player, the way the seats render it.
    const bubblesAt = (count: number) => {
      const seats = new Map<string, HandAction>();
      flopActions.slice(0, count).forEach((a) => seats.set(a.playerId, a));
      return Object.fromEntries([...seats].map(([id, a]) => [id, a.type]));
    };

    expect(bubblesAt(1)).toEqual({ villain: 'check' });
    expect(bubblesAt(2)).toEqual({ villain: 'check', hero: 'check' });
    expect(bubblesAt(3)).toEqual({ villain: 'bet', hero: 'check' });
    expect(bubblesAt(4)).toEqual({ villain: 'bet', hero: 'call' });
  });

  it('folds a player only once their fold has been revealed', () => {
    const hand = makeHand();
    hand.actions = [
      act('flop', 'villain', 'bet', 5),
      act('flop', 'hero', 'fold'),
    ].map((a, i) => ({ ...a, order: i }));
    const beats = buildBeats(hand);
    const flop = beats.findIndex((b) => b.kind === 'street' && b.street === 'flop');

    const foldedAt = (count: number) =>
      revealedActionsUpTo(beats, flop, count).filter((a) => a.type === 'fold').length;

    expect(foldedAt(1)).toBe(0);
    expect(foldedAt(2)).toBe(1);
  });

  it('does not linger on the intro before the first action', () => {
    expect(holdMsFor({ kind: 'intro' })).toBeLessThan(holdMsFor({ kind: 'showdown' }));
    expect(holdMsFor({ kind: 'intro' })).toBeLessThanOrEqual(400);
  });
});
