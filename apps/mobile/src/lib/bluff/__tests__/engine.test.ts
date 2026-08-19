import { describe, expect, it } from 'vitest';
import type { Player } from '../../../types';
import { cardKey } from '../../../types/hand';
import type { BluffState } from '../engine';
import {
  aliveInOrder,
  createRoundDeal,
  initGame,
  nextAliveAfter,
  reduce,
  validateAction,
} from '../engine';
import { mulberry32 } from '../../rng';

const PLAYERS: Player[] = [
  { id: 'a', name: 'Alice' },
  { id: 'b', name: 'Bob' },
  { id: 'c', name: 'Carla' },
];

function freshGame(seed = 1): BluffState {
  return initGame(PLAYERS, mulberry32(seed));
}

/** Advance a game into the bidding phase with a seeded deal. */
function inBidding(seed = 1, boardCount = 2): BluffState {
  let state = freshGame(seed);
  state = reduce(state, createRoundDeal(state, mulberry32(seed + 100)));
  return reduce(state, { type: 'chooseBoard', playerId: state.starterId, boardCount });
}

describe('initGame', () => {
  it('sets up 2-card hands, a random starter, and the dealing phase', () => {
    const state = freshGame();
    expect(state.phase).toBe('dealing');
    expect(state.players).toHaveLength(3);
    for (const p of state.players) {
      expect(p.cardCount).toBe(2);
      expect(p.hand).toEqual([]);
      expect(p.eliminated).toBe(false);
    }
    expect(state.players.some((p) => p.id === state.starterId)).toBe(true);
    expect(state.turnId).toBe(state.starterId);
  });

  it('rejects invalid player counts', () => {
    expect(() => initGame([PLAYERS[0]])).toThrow();
    expect(() => initGame(Array.from({ length: 7 }, (_, i) => ({ id: `p${i}`, name: `P${i}` })))).toThrow();
  });
});

describe('deal / chooseBoard', () => {
  it('deals unique cards matching each player cardCount plus 5 middle candidates', () => {
    const state = freshGame();
    const action = createRoundDeal(state, mulberry32(7));
    expect(action.deal.boardStock).toHaveLength(5);
    const all = [...action.deal.boardStock, ...Object.values(action.deal.hands).flat()];
    expect(new Set(all.map(cardKey)).size).toBe(all.length);
    expect(validateAction(state, action)).toEqual({ ok: true });

    const dealt = reduce(state, action);
    expect(dealt.phase).toBe('chooseBoard');
    expect(dealt.turnId).toBe(state.starterId);
    for (const p of aliveInOrder(dealt)) expect(p.hand).toHaveLength(p.cardCount);
    // Players hold their cards BEFORE the starter sizes the board.
    expect(dealt.board).toEqual([]);
    expect(dealt.boardStock).toHaveLength(5);
  });

  it('chooseBoard reveals the first N stock cards and discards the rest', () => {
    let state = freshGame();
    state = reduce(state, createRoundDeal(state, mulberry32(7)));
    const stock = state.boardStock;
    const next = reduce(state, { type: 'chooseBoard', playerId: state.starterId, boardCount: 3 });
    expect(next.phase).toBe('bidding');
    expect(next.board).toEqual(stock.slice(0, 3));
    expect(next.boardStock).toEqual([]);
  });

  it('only the starter may choose the board, within 0-5 cards', () => {
    let state = freshGame();
    state = reduce(state, createRoundDeal(state, mulberry32(7)));
    const notStarter = state.players.find((p) => p.id !== state.starterId)!;
    expect(validateAction(state, { type: 'chooseBoard', playerId: notStarter.id, boardCount: 2 })).toEqual({
      ok: false,
      code: 'onlyStarterChoosesBoard',
    });
    expect(validateAction(state, { type: 'chooseBoard', playerId: state.starterId, boardCount: 6 })).toEqual({
      ok: false,
      code: 'boardCountOutOfRange',
      params: { max: 5 },
    });
    expect(validateAction(state, { type: 'chooseBoard', playerId: state.starterId, boardCount: 0 }).ok).toBe(true);
  });
});

describe('bidding', () => {
  it('a claim advances the turn clockwise among alive players', () => {
    const state = inBidding();
    const next = reduce(state, { type: 'claim', playerId: state.turnId, claim: { category: 'pair', rank: '5' } });
    expect(next.currentClaim).toEqual({ category: 'pair', rank: '5' });
    expect(next.turnId).toBe(nextAliveAfter(state, state.turnId));
  });

  it('rejects a claim that is not strictly higher', () => {
    let state = inBidding();
    state = reduce(state, { type: 'claim', playerId: state.turnId, claim: { category: 'trips', rank: '9' } });
    expect(validateAction(state, { type: 'claim', playerId: state.turnId, claim: { category: 'trips', rank: '9' } })).toEqual({
      ok: false,
      code: 'claimNotHigher',
    });
    expect(validateAction(state, { type: 'claim', playerId: state.turnId, claim: { category: 'straight', high: 'A' } })).toEqual({
      ok: false,
      code: 'claimNotHigher',
    });
    expect(validateAction(state, { type: 'claim', playerId: state.turnId, claim: { category: 'trips', rank: 'T' } }).ok).toBe(true);
  });

  it('rejects actions from the wrong player', () => {
    const state = inBidding();
    const notTurn = state.players.find((p) => p.id !== state.turnId)!;
    expect(validateAction(state, { type: 'claim', playerId: notTurn.id, claim: { category: 'pair', rank: '5' } })).toEqual({
      ok: false,
      code: 'notYourTurn',
    });
  });

  it('the opener cannot catch', () => {
    const state = inBidding();
    expect(validateAction(state, { type: 'catch', playerId: state.turnId })).toEqual({
      ok: false,
      code: 'firstPlayerMustClaim',
    });
  });

  it('a royal flush claim cannot be outbid — only catch remains', () => {
    let state = inBidding();
    state = reduce(state, { type: 'claim', playerId: state.turnId, claim: { category: 'royalFlush' } });
    expect(validateAction(state, { type: 'claim', playerId: state.turnId, claim: { category: 'royalFlush' } })).toEqual({
      ok: false,
      code: 'royalFlushUnbeatable',
    });
    expect(validateAction(state, { type: 'catch', playerId: state.turnId }).ok).toBe(true);
  });
});

describe('catch resolution', () => {
  it('sets loser to catcher when the claim holds, claimer otherwise', () => {
    let state = inBidding(3, 0);
    const claimer = state.turnId;
    state = reduce(state, { type: 'claim', playerId: claimer, claim: { category: 'royalFlush' } });
    const catcher = state.turnId;
    state = reduce(state, { type: 'catch', playerId: catcher });
    expect(state.phase).toBe('reveal');
    const reveal = state.reveal!;
    expect(reveal.claimerId).toBe(claimer);
    expect(reveal.catcherId).toBe(catcher);
    expect(reveal.loserId).toBe(reveal.holds ? catcher : claimer);
    // 6 cards can never contain a 5-card royal here (deterministic with this seed).
    expect(reveal.holds).toBe(false);
    expect(reveal.witness).toBeNull();
    expect(reveal.pool).toHaveLength(6); // 3 players × 2 cards + empty board
  });

  it('the pool includes the chosen board but not the discarded stock', () => {
    const state = inBidding(5, 3);
    let s = reduce(state, { type: 'claim', playerId: state.turnId, claim: { category: 'pair', rank: '2' } });
    s = reduce(s, { type: 'catch', playerId: s.turnId });
    expect(s.reveal!.pool).toHaveLength(3 * 2 + 3);
  });
});

describe('round transitions and elimination', () => {
  function resolveRound(state: BluffState): BluffState {
    let s = reduce(state, { type: 'claim', playerId: state.turnId, claim: { category: 'royalFlush' } });
    s = reduce(s, { type: 'catch', playerId: s.turnId });
    s = reduce(s, { type: 'confirmReveal', playerId: s.turnId });
    return reduce(s, { type: 'nextRound', playerId: s.turnId });
  }

  it('the loser gains a card and starts the next round', () => {
    const state = inBidding();
    const loserId = state.turnId; // royal claim always fails → claimer loses
    const next = resolveRound(state);
    expect(next.phase).toBe('dealing');
    expect(next.round).toBe(2);
    expect(next.starterId).toBe(loserId);
    expect(next.players.find((p) => p.id === loserId)!.cardCount).toBe(3);
    for (const p of next.players) expect(p.hand).toEqual([]);
    expect(next.currentClaim).toBeNull();
    expect(next.reveal).toBeNull();
  });

  it('losing at 5 cards eliminates the player; last alive wins', () => {
    // Two players: the starter always claims royal and always loses: 2→3→4→5→out.
    let state = initGame(PLAYERS.slice(0, 2), mulberry32(2));
    const doomed = state.starterId;
    const survivor = state.players.find((p) => p.id !== doomed)!.id;
    for (let round = 0; round < 4; round++) {
      let s = reduce(state, createRoundDeal(state, mulberry32(50 + round)));
      s = reduce(s, { type: 'chooseBoard', playerId: s.starterId, boardCount: 1 });
      let r = reduce(s, { type: 'claim', playerId: s.turnId, claim: { category: 'royalFlush' } });
      r = reduce(r, { type: 'catch', playerId: r.turnId });
      expect(r.reveal!.holds).toBe(false);
      expect(r.reveal!.loserId).toBe(doomed);
      if (round === 3) expect(r.reveal!.eliminatesLoser).toBe(true);
      r = reduce(r, { type: 'confirmReveal', playerId: r.turnId });
      state = reduce(r, { type: 'nextRound', playerId: r.turnId });
    }
    expect(state.phase).toBe('gameOver');
    expect(state.winnerId).toBe(survivor);
    expect(state.players.find((p) => p.id === doomed)!.eliminated).toBe(true);
  });

  it('when the loser is eliminated mid-game, the next alive player starts', () => {
    let state = initGame(PLAYERS, mulberry32(4));
    const doomed = state.starterId;
    for (let round = 0; round < 4; round++) {
      let s = reduce(state, createRoundDeal(state, mulberry32(80 + round)));
      s = reduce(s, { type: 'chooseBoard', playerId: s.starterId, boardCount: 0 });
      let r = reduce(s, { type: 'claim', playerId: s.turnId, claim: { category: 'royalFlush' } });
      r = reduce(r, { type: 'catch', playerId: r.turnId });
      r = reduce(r, { type: 'confirmReveal', playerId: r.turnId });
      state = reduce(r, { type: 'nextRound', playerId: r.turnId });
    }
    expect(state.phase).toBe('dealing'); // two players remain
    expect(state.players.find((p) => p.id === doomed)!.eliminated).toBe(true);
    expect(state.starterId).toBe(nextAliveAfter(state, doomed));
    // The eliminated player gets no cards in the next deal.
    const deal = createRoundDeal(state, mulberry32(99));
    expect(deal.deal.hands[doomed]).toBeUndefined();
  });

  it('bumps version on every transition', () => {
    const state = inBidding();
    const next = reduce(state, { type: 'claim', playerId: state.turnId, claim: { category: 'pair', rank: '5' } });
    expect(next.version).toBe(state.version + 1);
  });
});
