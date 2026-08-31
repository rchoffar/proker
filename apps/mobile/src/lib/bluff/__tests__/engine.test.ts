import { describe, expect, it } from 'vitest';
import type { Player } from '../../../types';
import type { Card, Rank, Suit } from '../../../types/hand';
import { cardKey } from '../../../types/hand';
import type { BluffConfig, BluffState } from '../engine';
import {
  VARIANT_RULES,
  aliveInOrder,
  createRoundDeal,
  eliminationCardCount,
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

function freshGame(seed = 1, config?: BluffConfig): BluffState {
  return initGame(PLAYERS, mulberry32(seed), config);
}

/** Advance a game into the bidding phase with a seeded deal. */
function inBidding(seed = 1, faceUpCount = 2, faceDownCount = 0): BluffState {
  let state = freshGame(seed);
  state = reduce(state, createRoundDeal(state, mulberry32(seed + 100)));
  return reduce(state, { type: 'chooseBoard', playerId: state.starterId, faceUpCount, faceDownCount });
}

const card = (rank: Rank, suit: Suit): Card => ({ rank, suit });

/**
 * Bidding state from a hand-crafted deal (2 cards per player, 5 stock) — full control
 * over the resolution pool for deterministic jeu max / hidden-board assertions.
 */
function craftedBidding(opts: {
  hands: Record<string, Card[]>;
  stock: Card[];
  faceUpCount?: number;
  faceDownCount?: number;
  jeuMax?: boolean;
}): BluffState {
  let state = initGame(PLAYERS, mulberry32(1), { jeuMax: opts.jeuMax ?? true, variant: 'standard' });
  state = reduce(state, {
    type: 'deal',
    playerId: state.starterId,
    deal: { hands: opts.hands, boardStock: opts.stock },
  });
  return reduce(state, {
    type: 'chooseBoard',
    playerId: state.starterId,
    faceUpCount: opts.faceUpCount ?? 0,
    faceDownCount: opts.faceDownCount ?? 0,
  });
}

// Pool (with no board): A♠A♥ / K♠Q♥ / 2♠3♥ — pair of aces holds, nothing beats it.
const MAX_HANDS: Record<string, Card[]> = {
  a: [card('A', 'spades'), card('A', 'hearts')],
  b: [card('K', 'spades'), card('Q', 'hearts')],
  c: [card('2', 'spades'), card('3', 'hearts')],
};
const NEUTRAL_STOCK: Card[] = [
  card('9', 'clubs'),
  card('7', 'diamonds'),
  card('5', 'clubs'),
  card('J', 'diamonds'),
  card('8', 'clubs'),
];

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

describe('variants', () => {
  it('quick variant deals 1 card per player at init', () => {
    const state = freshGame(1, { jeuMax: false, variant: 'quick' });
    for (const p of state.players) expect(p.cardCount).toBe(1);
    const dealt = reduce(state, createRoundDeal(state, mulberry32(3)));
    for (const p of aliveInOrder(dealt)) expect(p.hand).toHaveLength(1);
  });

  it('elimination threshold follows the variant — 4 in quick, 5 in standard', () => {
    expect(eliminationCardCount({ jeuMax: false, variant: 'quick' })).toBe(4);
    expect(eliminationCardCount({ jeuMax: false, variant: 'standard' })).toBe(5);
    expect(VARIANT_RULES.quick).toEqual({ startCards: 1, eliminationAt: 4 });
    expect(VARIANT_RULES.standard).toEqual({ startCards: 2, eliminationAt: 5 });
  });

  it('a caught bluff at the quick threshold (4 cards) eliminates the loser', () => {
    // Crafted bidding in quick variant with the claimer already at 4 cards.
    let state = initGame(PLAYERS, mulberry32(1), { jeuMax: false, variant: 'quick' });
    const claimerId = state.starterId;
    state = {
      ...state,
      players: state.players.map((p) => (p.id === claimerId ? { ...p, cardCount: 4 } : p)),
    };
    const hands: Record<string, Card[]> = {
      a: [card('3', 'spades')],
      b: [card('5', 'spades')],
      c: [card('7', 'spades')],
      [claimerId]: [card('A', 'spades'), card('K', 'hearts'), card('Q', 'diamonds'), card('J', 'clubs')],
    };
    state = reduce(state, {
      type: 'deal',
      playerId: state.starterId,
      deal: { hands, boardStock: NEUTRAL_STOCK },
    });
    state = reduce(state, { type: 'chooseBoard', playerId: state.starterId, faceUpCount: 0, faceDownCount: 0 });
    // The starter claims something the pool can't hold, the next player catches.
    state = reduce(state, { type: 'claim', playerId: claimerId, claim: { category: 'quads', rank: '2' } });
    state = reduce(state, { type: 'catch', playerId: state.turnId });
    expect(state.reveal!.holds).toBe(false);
    expect(state.reveal!.loserId).toBe(claimerId);
    expect(state.reveal!.eliminatesLoser).toBe(true);
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

  it('chooseBoard splits the stock into face-up and face-down and discards the rest', () => {
    let state = freshGame();
    state = reduce(state, createRoundDeal(state, mulberry32(7)));
    const stock = state.boardStock;
    const next = reduce(state, { type: 'chooseBoard', playerId: state.starterId, faceUpCount: 2, faceDownCount: 2 });
    expect(next.phase).toBe('bidding');
    expect(next.board).toEqual(stock.slice(0, 2));
    expect(next.hiddenBoard).toEqual(stock.slice(2, 4));
    expect(next.boardStock).toEqual([]);
  });

  it('only the starter may choose the board, within 0-5 cards in total', () => {
    let state = freshGame();
    state = reduce(state, createRoundDeal(state, mulberry32(7)));
    const notStarter = state.players.find((p) => p.id !== state.starterId)!;
    expect(
      validateAction(state, { type: 'chooseBoard', playerId: notStarter.id, faceUpCount: 2, faceDownCount: 0 }),
    ).toEqual({
      ok: false,
      code: 'onlyStarterChoosesBoard',
    });
    expect(
      validateAction(state, { type: 'chooseBoard', playerId: state.starterId, faceUpCount: 3, faceDownCount: 3 }),
    ).toEqual({
      ok: false,
      code: 'boardSplitOutOfRange',
      params: { max: 5 },
    });
    expect(
      validateAction(state, { type: 'chooseBoard', playerId: state.starterId, faceUpCount: 0, faceDownCount: -1 }),
    ).toEqual({
      ok: false,
      code: 'boardSplitOutOfRange',
      params: { max: 5 },
    });
    expect(
      validateAction(state, { type: 'chooseBoard', playerId: state.starterId, faceUpCount: 0, faceDownCount: 0 }).ok,
    ).toBe(true);
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

  it('rejects a claim dominated by the face-up middle, but never by hidden cards', () => {
    // A face-up pair of 9s: announcing any pair is dishonest (a pair of 9s is vacuous,
    // any other pair plus the visible 9-9 always makes two pair).
    const PAIRED_STOCK: Card[] = [
      card('9', 'clubs'),
      card('9', 'diamonds'),
      card('5', 'clubs'),
      card('J', 'diamonds'),
      card('8', 'clubs'),
    ];
    const faceUp = craftedBidding({ hands: MAX_HANDS, stock: PAIRED_STOCK, faceUpCount: 2 });
    expect(faceUp.board).toEqual([card('9', 'clubs'), card('9', 'diamonds')]);
    expect(
      validateAction(faceUp, { type: 'claim', playerId: faceUp.turnId, claim: { category: 'pair', rank: '5' } }),
    ).toEqual({ ok: false, code: 'claimDominatedByBoard' });
    expect(
      validateAction(faceUp, {
        type: 'claim',
        playerId: faceUp.turnId,
        claim: { category: 'twoPair', high: '9', low: '5' },
      }).ok,
    ).toBe(true);

    // The same 9-9 face DOWN restricts nothing — nobody knows it.
    const faceDown = craftedBidding({ hands: MAX_HANDS, stock: PAIRED_STOCK, faceDownCount: 2 });
    expect(faceDown.board).toEqual([]);
    expect(
      validateAction(faceDown, { type: 'claim', playerId: faceDown.turnId, claim: { category: 'pair', rank: '5' } }).ok,
    ).toBe(true);
  });

  it('a royal flush announcement is always accepted, whatever the board shows', () => {
    const state = craftedBidding({ hands: MAX_HANDS, stock: NEUTRAL_STOCK, faceUpCount: 5 });
    expect(
      validateAction(state, { type: 'claim', playerId: state.turnId, claim: { category: 'royalFlush' } }).ok,
    ).toBe(true);
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
      s = reduce(s, { type: 'chooseBoard', playerId: s.starterId, faceUpCount: 1, faceDownCount: 0 });
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
      s = reduce(s, { type: 'chooseBoard', playerId: s.starterId, faceUpCount: 0, faceDownCount: 0 });
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

describe('jeu max', () => {
  const claimPairAces = (state: BluffState) =>
    reduce(state, { type: 'claim', playerId: state.turnId, claim: { category: 'pair', rank: 'A' } });

  it('is rejected when the config disables it', () => {
    let state = craftedBidding({ hands: MAX_HANDS, stock: NEUTRAL_STOCK, jeuMax: false });
    state = claimPairAces(state);
    expect(validateAction(state, { type: 'jeuMax', playerId: state.turnId })).toEqual({
      ok: false,
      code: 'jeuMaxDisabled',
    });
  });

  it('cannot open the bidding', () => {
    const state = craftedBidding({ hands: MAX_HANDS, stock: NEUTRAL_STOCK });
    expect(validateAction(state, { type: 'jeuMax', playerId: state.turnId })).toEqual({
      ok: false,
      code: 'firstPlayerMustClaim',
    });
  });

  it('succeeds when the claim holds and nothing higher exists — the caller sheds a card and opens next round', () => {
    let state = craftedBidding({ hands: MAX_HANDS, stock: NEUTRAL_STOCK });
    state = claimPairAces(state);
    const caller = state.turnId;
    state = reduce(state, { type: 'jeuMax', playerId: caller });
    expect(state.phase).toBe('reveal');
    const reveal = state.reveal!;
    expect(reveal.kind).toBe('jeuMax');
    expect(reveal.jeuMaxSuccess).toBe(true);
    expect(reveal.holds).toBe(true);
    expect(reveal.loserId).toBeNull();
    expect(reveal.higherClaim).toBeNull();
    expect(reveal.jeuMaxShedsLast).toBe(false);
    const callerAfterReveal = state.players.find((p) => p.id === caller)!;
    expect(callerAfterReveal.jeuMaxAttempts).toBe(1);
    expect(callerAfterReveal.jeuMaxSuccesses).toBe(1);

    state = reduce(state, { type: 'confirmReveal', playerId: caller });
    state = reduce(state, { type: 'nextRound', playerId: caller });
    expect(state.phase).toBe('dealing');
    expect(state.players.find((p) => p.id === caller)!.cardCount).toBe(1);
    expect(state.starterId).toBe(caller);
    expect(state.hiddenBoard).toEqual([]);
  });

  it('fails with the smallest higher combination as proof — the caller takes a card', () => {
    const hands = {
      a: [card('A', 'spades'), card('A', 'hearts')],
      b: [card('K', 'spades'), card('K', 'hearts')],
      c: [card('2', 'spades'), card('3', 'hearts')],
    };
    let state = craftedBidding({ hands, stock: NEUTRAL_STOCK });
    state = claimPairAces(state);
    const caller = state.turnId;
    state = reduce(state, { type: 'jeuMax', playerId: caller });
    const reveal = state.reveal!;
    expect(reveal.jeuMaxSuccess).toBe(false);
    expect(reveal.holds).toBe(true);
    expect(reveal.loserId).toBe(caller);
    expect(reveal.higherClaim).toEqual({ category: 'twoPair', high: 'A', low: 'K' });
    expect(reveal.higherWitness).toHaveLength(4);
    const callerAfterReveal = state.players.find((p) => p.id === caller)!;
    expect(callerAfterReveal.jeuMaxAttempts).toBe(1);
    expect(callerAfterReveal.jeuMaxSuccesses).toBe(0);

    state = reduce(state, { type: 'confirmReveal', playerId: caller });
    state = reduce(state, { type: 'nextRound', playerId: caller });
    expect(state.players.find((p) => p.id === caller)!.cardCount).toBe(3);
    expect(state.starterId).toBe(caller);
  });

  it('fails when the announced claim was itself a bluff', () => {
    let state = craftedBidding({ hands: MAX_HANDS, stock: NEUTRAL_STOCK });
    state = reduce(state, { type: 'claim', playerId: state.turnId, claim: { category: 'quads', rank: 'A' } });
    const caller = state.turnId;
    state = reduce(state, { type: 'jeuMax', playerId: caller });
    const reveal = state.reveal!;
    expect(reveal.jeuMaxSuccess).toBe(false);
    expect(reveal.holds).toBe(false);
    expect(reveal.witness).toBeNull();
    expect(reveal.higherClaim).toBeNull();
    expect(reveal.loserId).toBe(caller);
  });

  it('failing at 5 cards eliminates the caller', () => {
    let state = craftedBidding({ hands: MAX_HANDS, stock: NEUTRAL_STOCK });
    state = reduce(state, { type: 'claim', playerId: state.turnId, claim: { category: 'quads', rank: 'A' } });
    const caller = state.turnId;
    state = { ...state, players: state.players.map((p) => (p.id === caller ? { ...p, cardCount: 5 } : p)) };
    state = reduce(state, { type: 'jeuMax', playerId: caller });
    expect(state.reveal!.eliminatesLoser).toBe(true);
  });

  // Shedding the last card is announced but does NOT win: quick starts everyone at one
  // card, so the old rule ended the game on the very first hand.
  it('succeeding at 1 card sheds it and plays on at 0 cards', () => {
    let state = craftedBidding({ hands: MAX_HANDS, stock: NEUTRAL_STOCK });
    state = claimPairAces(state);
    const caller = state.turnId;
    state = { ...state, players: state.players.map((p) => (p.id === caller ? { ...p, cardCount: 1 } : p)) };
    state = reduce(state, { type: 'jeuMax', playerId: caller });
    expect(state.reveal!.jeuMaxShedsLast).toBe(true);
    state = reduce(state, { type: 'confirmReveal', playerId: caller });
    state = reduce(state, { type: 'nextRound', playerId: caller });
    expect(state.phase).toBe('dealing');
    expect(state.winnerId).toBeNull();
    expect(state.players.find((p) => p.id === caller)!.cardCount).toBe(0);
    expect(state.players.find((p) => p.id === caller)!.eliminated).toBe(false);
  });

  it('deals a 0-card player an empty hand and lets them keep announcing', () => {
    let state = craftedBidding({ hands: MAX_HANDS, stock: NEUTRAL_STOCK });
    state = claimPairAces(state);
    const caller = state.turnId;
    state = { ...state, players: state.players.map((p) => (p.id === caller ? { ...p, cardCount: 1 } : p)) };
    state = reduce(state, { type: 'jeuMax', playerId: caller });
    state = reduce(state, { type: 'confirmReveal', playerId: caller });
    state = reduce(state, { type: 'nextRound', playerId: caller });

    const deal = createRoundDeal(state, mulberry32(7));
    expect(deal.deal.hands[caller]).toEqual([]);
    expect(validateAction(state, deal).ok).toBe(true);
    state = reduce(state, deal);
    state = reduce(state, { type: 'chooseBoard', playerId: state.starterId, faceUpCount: 3, faceDownCount: 0 });
    expect(state.turnId).toBe(caller);
    expect(validateAction(state, { type: 'claim', playerId: caller, claim: { category: 'pair', rank: '2' } }).ok).toBe(true);
  });

  it('a 0-card player cannot shed below zero', () => {
    let state = craftedBidding({ hands: MAX_HANDS, stock: NEUTRAL_STOCK });
    state = claimPairAces(state);
    const caller = state.turnId;
    state = { ...state, players: state.players.map((p) => (p.id === caller ? { ...p, cardCount: 0 } : p)) };
    state = reduce(state, { type: 'jeuMax', playerId: caller });
    state = reduce(state, { type: 'confirmReveal', playerId: caller });
    state = reduce(state, { type: 'nextRound', playerId: caller });
    expect(state.players.find((p) => p.id === caller)!.cardCount).toBe(0);
  });

  it('is legal over a royal flush announcement — liar and jeu max both stay open', () => {
    let state = craftedBidding({ hands: MAX_HANDS, stock: NEUTRAL_STOCK });
    state = reduce(state, { type: 'claim', playerId: state.turnId, claim: { category: 'royalFlush' } });
    expect(validateAction(state, { type: 'jeuMax', playerId: state.turnId }).ok).toBe(true);
    expect(validateAction(state, { type: 'catch', playerId: state.turnId }).ok).toBe(true);
  });

  it('classic catch reveals carry kind "catch"', () => {
    let state = inBidding(3, 0);
    state = reduce(state, { type: 'claim', playerId: state.turnId, claim: { category: 'royalFlush' } });
    state = reduce(state, { type: 'catch', playerId: state.turnId });
    expect(state.reveal!.kind).toBe('catch');
  });
});

describe('hidden board', () => {
  it('face-down middle cards are in the resolution pool for both catch and jeu max', () => {
    // The second ace lives face-down in the middle: pair of aces holds only through it.
    const hands = {
      a: [card('A', 'spades'), card('4', 'hearts')],
      b: [card('K', 'spades'), card('Q', 'hearts')],
      c: [card('2', 'spades'), card('3', 'hearts')],
    };
    const stock = [
      card('A', 'clubs'),
      card('7', 'diamonds'),
      card('5', 'clubs'),
      card('J', 'diamonds'),
      card('8', 'clubs'),
    ];
    let state = craftedBidding({ hands, stock, faceUpCount: 0, faceDownCount: 1 });
    expect(state.board).toEqual([]);
    expect(state.hiddenBoard).toEqual([card('A', 'clubs')]);
    state = reduce(state, { type: 'claim', playerId: state.turnId, claim: { category: 'pair', rank: 'A' } });

    const caught = reduce(state, { type: 'catch', playerId: state.turnId });
    expect(caught.reveal!.holds).toBe(true);
    expect(caught.reveal!.pool).toHaveLength(7); // 3 × 2 hand cards + 1 hidden middle card

    const jeuMaxed = reduce(state, { type: 'jeuMax', playerId: state.turnId });
    expect(jeuMaxed.reveal!.holds).toBe(true);
    expect(jeuMaxed.reveal!.jeuMaxSuccess).toBe(true);
  });
});
