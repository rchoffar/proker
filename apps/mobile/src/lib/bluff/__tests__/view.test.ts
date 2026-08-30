import { describe, expect, it } from 'vitest';
import type { Player } from '../../../types';
import type { BluffState } from '../engine';
import { createRoundDeal, initGame, reduce } from '../engine';
import { redactFor } from '../protocol';
import { bluffPlayView, bluffSeatData } from '../view';
import { mulberry32 } from '../../rng';

const PLAYERS: Player[] = [
  { id: 'a', name: 'Alice' },
  { id: 'b', name: 'Bob' },
  { id: 'c', name: 'Carla' },
];

function inBidding(seed = 1): BluffState {
  let state = initGame(PLAYERS, mulberry32(seed));
  state = reduce(state, createRoundDeal(state, mulberry32(seed + 100)));
  return reduce(state, { type: 'chooseBoard', playerId: state.starterId, faceUpCount: 2, faceDownCount: 0 });
}

/** How Pass & Play will render: the viewer IS whoever is to act. */
function localSeats(state: BluffState) {
  const view = redactFor(state, state.turnId);
  return bluffSeatData(
    bluffPlayView(view, { viewerId: state.turnId, rotateToViewer: false, addressViewerAsYou: false })
  );
}

describe('bluffSeatData — what the shared felt may show', () => {
  it('never shows a hand while the bidding is still open, not even the viewer’s own', () => {
    // The trap this whole module exists for: redactFor hands the viewer their own cards in
    // every phase (the device needs them for the private zone), so a seat mapping that
    // forwards p.hand puts the acting player's hand face-up on the shared phone.
    const state = inBidding();
    const seats = localSeats(state);

    expect(seats).toHaveLength(3);
    for (const seat of seats) expect(seat.hand).toBeUndefined();
  });

  it('still hides hands during chooseBoard', () => {
    let state = initGame(PLAYERS, mulberry32(2));
    state = reduce(state, createRoundDeal(state, mulberry32(202)));
    expect(state.phase).toBe('chooseBoard');
    for (const seat of localSeats(state)) expect(seat.hand).toBeUndefined();
  });

  it('shows every surviving hand once the round is called', () => {
    let state = inBidding(3);
    state = reduce(state, { type: 'claim', playerId: state.turnId, claim: { category: 'quads', rank: 'A' } });
    state = reduce(state, { type: 'catch', playerId: state.turnId });
    expect(state.phase).toBe('reveal');

    const seats = localSeats(state);
    const alive = state.players.filter((p) => !p.eliminated);
    expect(seats.filter((s) => s.hand !== undefined)).toHaveLength(alive.length);
  });

  it('keeps the seat count and order of the redacted state when not rotating', () => {
    const state = inBidding(4);
    expect(localSeats(state).map((s) => s.id)).toEqual(state.players.map((p) => p.id));
  });

  it('rotates the viewer to the first seat when asked, without dropping anyone', () => {
    const state = inBidding(5);
    const viewerId = state.players[2].id;
    const v = bluffPlayView(redactFor(state, viewerId), {
      viewerId,
      rotateToViewer: true,
      addressViewerAsYou: true,
    });
    expect(v.orderedPlayers[0].id).toBe(viewerId);
    expect(v.orderedPlayers.map((p) => p.id).sort()).toEqual(state.players.map((p) => p.id).sort());
  });

  it('applies the caller’s name labelling', () => {
    const state = inBidding(6);
    const view = redactFor(state, state.turnId);
    const v = bluffPlayView(view, { viewerId: state.turnId, rotateToViewer: false, addressViewerAsYou: true });
    const seats = bluffSeatData(v, (p) => (p.id === state.turnId ? `${p.name} (you)` : p.name));
    expect(seats.find((s) => s.id === state.turnId)!.name).toMatch(/\(you\)$/);
  });
});

describe('bluffPlayView — legal actions and captions', () => {
  it('cannot call liar before anything has been claimed', () => {
    const state = inBidding(7);
    const v = bluffPlayView(redactFor(state, state.turnId), {
      viewerId: state.turnId,
      rotateToViewer: false,
      addressViewerAsYou: false,
    });
    expect(v.canCatch).toBe(false);
  });

  it('allows liar once a claim stands', () => {
    let state = inBidding(8);
    state = reduce(state, { type: 'claim', playerId: state.turnId, claim: { category: 'quads', rank: 'A' } });
    const v = bluffPlayView(redactFor(state, state.turnId), {
      viewerId: state.turnId,
      rotateToViewer: false,
      addressViewerAsYou: false,
    });
    expect(v.canCatch).toBe(true);
  });

  it('forces the call on a royal flush', () => {
    let state = inBidding(9);
    state = reduce(state, {
      type: 'claim',
      playerId: state.turnId,
      claim: { category: 'royalFlush' },
    });
    const v = bluffPlayView(redactFor(state, state.turnId), {
      viewerId: state.turnId,
      rotateToViewer: false,
      addressViewerAsYou: false,
    });
    expect(v.mustCatch).toBe(true);
  });

  it('names the player on a shared phone and says "you" online', () => {
    // Still in chooseBoard: that is the phase whose caption has both a second-person and a
    // named variant.
    let state = initGame(PLAYERS, mulberry32(10));
    state = reduce(state, createRoundDeal(state, mulberry32(110)));
    expect(state.phase).toBe('chooseBoard');

    const shared = bluffPlayView(redactFor(state, state.starterId), {
      viewerId: state.starterId,
      rotateToViewer: false,
      addressViewerAsYou: false,
    });
    expect(shared.caption).toEqual({
      kind: 'text',
      key: 'game.chooseBoardOther',
      name: state.players.find((p) => p.id === state.starterId)!.name,
    });

    const online = bluffPlayView(redactFor(state, state.starterId), {
      viewerId: state.starterId,
      rotateToViewer: true,
      addressViewerAsYou: true,
    });
    expect(online.caption).toEqual({ kind: 'text', key: 'game.chooseBoardYou' });
  });

  it('shows the standing claim instead of a turn prompt', () => {
    let state = inBidding(11);
    const claim = { category: 'quads', rank: 'A' } as const;
    state = reduce(state, { type: 'claim', playerId: state.turnId, claim });
    const v = bluffPlayView(redactFor(state, state.turnId), {
      viewerId: state.turnId,
      rotateToViewer: false,
      addressViewerAsYou: false,
    });
    expect(v.caption).toEqual({ kind: 'claim', claim });
  });
});
