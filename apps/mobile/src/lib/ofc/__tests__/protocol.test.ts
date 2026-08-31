import { describe, expect, it } from 'vitest';
import { cardKey } from '../../../types/hand';
import { mulberry32 } from '../../rng';
import type { OfcState } from '../engine';
import { createHandDeal, reduce } from '../engine';
import type { RedactedOfcState } from '../protocol';
import { gridVisibleTo, redactFor } from '../protocol';
import { playScriptedHand, playScriptedPineappleHand } from './fixtures';

// "The leak test": whatever the phase, a viewer must never receive the deck, another
// player's unplaced hand, a foreign pineapple draw or discard, or a Fantasy Land grid
// before the scoring reveal.

function visibleCardKeys(redacted: RedactedOfcState): Set<string> {
  const keys = new Set<string>();
  for (const card of redacted.pending?.cards ?? []) keys.add(cardKey(card));
  for (const p of redacted.players) {
    for (const card of [...(p.hand ?? []), ...(p.discards ?? [])]) keys.add(cardKey(card));
    for (const card of [...(p.grid?.top ?? []), ...(p.grid?.middle ?? []), ...(p.grid?.bottom ?? [])]) {
      keys.add(cardKey(card));
    }
  }
  return keys;
}

function allowedCardKeys(state: OfcState, viewerId: string): Set<string> {
  const keys = new Set<string>();
  // The pending draw is public in classic, the actor's secret in pineapple.
  if (state.pending && (state.variant === 'classic' || state.pending.playerId === viewerId)) {
    for (const card of state.pending.cards) keys.add(cardKey(card));
  }
  for (const p of state.players) {
    if (p.id === viewerId) {
      for (const card of [...p.hand, ...p.discards]) keys.add(cardKey(card));
    }
    if (gridVisibleTo(p, state.players.find((v) => v.id === viewerId), state.phase)) {
      for (const card of [...p.grid.top, ...p.grid.middle, ...p.grid.bottom]) keys.add(cardKey(card));
    }
  }
  return keys;
}

function assertNoLeaks(states: OfcState[]) {
  for (const state of states) {
    for (const viewerId of ['p1', 'p2']) {
      const redacted = redactFor(state, viewerId);
      expect('deck' in redacted).toBe(false);
      const allowed = allowedCardKeys(state, viewerId);
      for (const key of visibleCardKeys(redacted)) {
        expect(allowed.has(key), `${key} leaked to ${viewerId} in phase ${state.phase}`).toBe(true);
      }
      // Foreign unplaced hands and discards stay hidden but the hand size is public:
      for (const p of redacted.players) {
        if (p.id !== viewerId) {
          expect(p.hand).toBeUndefined();
          expect(p.discards).toBeUndefined();
        }
        expect(p.handCount).toBe(state.players.find((sp) => sp.id === p.id)!.hand.length);
      }
    }
  }
}

describe('redactFor', () => {
  it('never leaks the deck or foreign hands at any step of a classic hand', () => {
    assertNoLeaks(playScriptedHand());
  });

  it('never leaks foreign draws or discards at any step of a pineapple hand', () => {
    assertNoLeaks(playScriptedPineappleHand());
  });

  it('keeps the classic pending card public but redacts the pineapple draw to a count', () => {
    const classicRound = playScriptedHand()[3]; // p1 holds the pending draw
    expect(redactFor(classicRound, 'p2').pending).toEqual({
      playerId: 'p1',
      count: 1,
      cards: classicRound.pending!.cards,
    });

    const pineappleRound = playScriptedPineappleHand()[3];
    const forOpponent = redactFor(pineappleRound, 'p2').pending!;
    expect(forOpponent).toEqual({ playerId: 'p1', count: 3 });
    expect('cards' in forOpponent).toBe(false);
    expect(redactFor(pineappleRound, 'p1').pending).toEqual({
      playerId: 'p1',
      count: 3,
      cards: pineappleRound.pending!.cards,
    });
  });

  it('shows discards to their owner only', () => {
    // states[4] = after p1's first pineapple placeDraw → p1 has 1 discard.
    const state = playScriptedPineappleHand()[4];
    expect(state.players.find((p) => p.id === 'p1')!.discards).toHaveLength(1);
    expect(redactFor(state, 'p1').players.find((p) => p.id === 'p1')!.discards).toHaveLength(1);
    expect(redactFor(state, 'p2').players.find((p) => p.id === 'p1')!.discards).toBeUndefined();
  });

  it('hides a Fantasy Land grid from opponents until scoring, then reveals it', () => {
    // Hand 2 of the scripted game: p1 is in Fantasy Land.
    const scored = playScriptedHand(100).at(-1)!;
    let state = reduce(scored, { type: 'nextHand', playerId: 'p1' });
    state = reduce(state, createHandDeal(state, mulberry32(42)));

    const p1Hand = state.players.find((p) => p.id === 'p1')!.hand;
    state = reduce(state, {
      type: 'placeFantasy',
      playerId: 'p1',
      placements: p1Hand.map((card, i) => ({
        card,
        row: i < 3 ? ('top' as const) : i < 8 ? ('middle' as const) : ('bottom' as const),
      })),
    });

    // Committed but pre-reveal: opponent sees only counts, owner sees the grid.
    const forP2 = redactFor(state, 'p2');
    const p1ForP2 = forP2.players.find((p) => p.id === 'p1')!;
    expect(p1ForP2.grid).toBeUndefined();
    expect(p1ForP2.fantasyPlaced).toBe(true);
    expect(p1ForP2.gridCounts).toEqual({ top: 3, middle: 5, bottom: 5 });
    const p1ForP1 = redactFor(state, 'p1').players.find((p) => p.id === 'p1')!;
    expect(p1ForP1.grid).toBeDefined();

    // Play p2 out to scoring → the Fantasy Land grid becomes public.
    const p2 = state.players.find((p) => p.id === 'p2')!;
    state = reduce(state, {
      type: 'placeInitial',
      playerId: 'p2',
      placements: p2.hand.map((card, i) => ({
        card,
        row: i < 2 ? ('top' as const) : i < 4 ? ('middle' as const) : ('bottom' as const),
      })),
    });
    while (state.phase === 'placing') {
      const grid = state.players.find((p) => p.id === 'p2')!.grid;
      const row = grid.top.length < 3 ? 'top' : grid.middle.length < 5 ? 'middle' : 'bottom';
      state = reduce(state, {
        type: 'placeDraw',
        playerId: 'p2',
        placements: [{ card: state.pending!.cards[0], row }],
      });
    }
    expect(state.phase).toBe('scoring');
    expect(redactFor(state, 'p2').players.find((p) => p.id === 'p1')!.grid).toBeDefined();
  });

  // The other direction, which is what Mathieu actually caught: the Fantasy Land player sets
  // all thirteen cards in one move, so being able to watch the opponent's board fill up
  // first would hand them the hand.
  it('hides opponents from the Fantasy Land player until they have placed', () => {
    const scored = playScriptedHand(100).at(-1)!;
    let state = reduce(scored, { type: 'nextHand', playerId: 'p1' });
    state = reduce(state, createHandDeal(state, mulberry32(42)));

    // p2 puts their opening five down in the open while p1 still holds a whole FL hand.
    const p2Hand = state.players.find((p) => p.id === 'p2')!.hand;
    state = reduce(state, {
      type: 'placeInitial',
      playerId: 'p2',
      placements: p2Hand.map((card, i) => ({
        card,
        row: i < 2 ? ('top' as const) : i < 4 ? ('middle' as const) : ('bottom' as const),
      })),
    });

    const p1 = state.players.find((p) => p.id === 'p1')!;
    expect(p1.inFantasyLand).toBe(true);
    expect(p1.fantasyPlaced).toBe(false);
    const p2ForP1 = redactFor(state, 'p1').players.find((p) => p.id === 'p2')!;
    expect(p2ForP1.grid).toBeUndefined();
    // Counts stay public — knowing how many cards are down is not knowing which.
    expect(p2ForP1.gridCounts).toEqual({ top: 2, middle: 2, bottom: 1 });
    // And p1 still gets their own cards, which is the whole point of the redaction.
    expect(redactFor(state, 'p1').players.find((p) => p.id === 'p1')!.hand).toEqual(p1.hand);

    // Once p1 has committed, the opponent's open board is theirs to see again.
    const p1Hand = state.players.find((p) => p.id === 'p1')!.hand;
    state = reduce(state, {
      type: 'placeFantasy',
      playerId: 'p1',
      placements: p1Hand.slice(0, 13).map((card, i) => ({
        card,
        row: i < 3 ? ('top' as const) : i < 8 ? ('middle' as const) : ('bottom' as const),
      })),
    });
    expect(redactFor(state, 'p1').players.find((p) => p.id === 'p2')!.grid).toBeDefined();
  });

  it('marks disconnected players', () => {
    const state = playScriptedHand()[1];
    const redacted = redactFor(state, 'p1', new Map([['p2', false]]));
    expect(redacted.players.find((p) => p.id === 'p2')?.connected).toBe(false);
    expect(redacted.players.find((p) => p.id === 'p1')?.connected).toBe(true);
  });
});
