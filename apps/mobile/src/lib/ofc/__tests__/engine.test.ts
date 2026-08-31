import { describe, expect, it } from 'vitest';
import { cardKey } from '../../../types/hand';
import { mulberry32 } from '../../rng';
import type { OfcAction, OfcState } from '../engine';
import {
  createHandDeal,
  gridSize,
  initGame,
  isHandComplete,
  placementOrder,
  reduce,
  validateAction,
} from '../engine';
import {
  P1_DRAWS,
  P1_INITIAL,
  P1_PINEAPPLE_DISCARDS,
  P2_INITIAL,
  P2_PINEAPPLE_DISCARDS,
  SCRIPTED_PLAYERS,
  c,
  cards,
  playScriptedHand,
  playScriptedPineappleHand,
  scriptedActions,
  scriptedDeck,
  scriptedPineappleActions,
} from './fixtures';

function allCardsOf(state: OfcState): string[] {
  const keys: string[] = state.deck.map(cardKey);
  if (state.pending) keys.push(...state.pending.cards.map(cardKey));
  for (const p of state.players) {
    keys.push(...p.hand.map(cardKey), ...p.discards.map(cardKey));
    keys.push(...p.grid.top.map(cardKey), ...p.grid.middle.map(cardKey), ...p.grid.bottom.map(cardKey));
  }
  return keys;
}

describe('initGame', () => {
  it('rejects invalid player counts and stacks', () => {
    expect(() => initGame([SCRIPTED_PLAYERS[0]], 100)).toThrow();
    expect(() =>
      initGame(
        [
          { id: 'a', name: 'A' },
          { id: 'b', name: 'B' },
          { id: 'c', name: 'C' },
          { id: 'd', name: 'D' },
        ],
        100,
      ),
    ).toThrow();
    expect(() => initGame(SCRIPTED_PLAYERS, 0)).toThrow();
    expect(() => initGame(SCRIPTED_PLAYERS, 10.5)).toThrow();
  });

  it('starts every player on the configured stack with a random button', () => {
    const state = initGame(SCRIPTED_PLAYERS, 150, 'classic', mulberry32(7));
    expect(state.phase).toBe('dealing');
    expect(state.players.map((p) => p.chips)).toEqual([150, 150]);
    expect(state.players.map((p) => p.id)).toContain(state.buttonId);
  });
});

describe('dealing and rotation', () => {
  it('deals 5 cards each, button places last', () => {
    const states = playScriptedHand();
    const afterDeal = states[1];
    expect(afterDeal.phase).toBe('placing');
    expect(afterDeal.placeRound).toBe(0);
    expect(afterDeal.players.every((p) => p.hand.length === 5)).toBe(true);
    // Button is p2 → p1 acts first, p2 (button) last.
    expect(afterDeal.buttonId).toBe('p2');
    expect(afterDeal.turnId).toBe('p1');
    expect(placementOrder(afterDeal).map((p) => p.id)).toEqual(['p1', 'p2']);
  });

  it('rejects a bad deck', () => {
    const state = initGame(SCRIPTED_PLAYERS, 100, 'classic', () => 0.9);
    const deck = scriptedDeck();
    expect(validateAction(state, { type: 'deal', playerId: 'p2', deck: deck.slice(1) })).toMatchObject({
      ok: false,
      code: 'badDeck',
    });
    expect(
      validateAction(state, { type: 'deal', playerId: 'p2', deck: [deck[0], ...deck.slice(0, 51)] }),
    ).toMatchObject({ ok: false, code: 'badDeck' });
  });

  it('conserves all 52 unique cards at every step of a hand', () => {
    for (const state of playScriptedHand()) {
      if (state.phase === 'dealing') continue; // pre-deal: no cards in play yet
      const keys = allCardsOf(state);
      expect(keys.length).toBe(52);
      expect(new Set(keys).size).toBe(52);
    }
  });

  it('bumps version on every reduce', () => {
    const states = playScriptedHand();
    for (let i = 1; i < states.length; i++) {
      expect(states[i].version).toBe(states[i - 1].version + 1);
    }
  });

  it('alternates the pending draw through 8 rounds, button last each round', () => {
    const states = playScriptedHand();
    // states[3] = after both initial placements → round 1, p1 to draw.
    const roundOne = states[3];
    expect(roundOne.placeRound).toBe(1);
    expect(roundOne.pending?.playerId).toBe('p1');
    expect(roundOne.pending?.cards).toEqual([P1_DRAWS[0]]);
    const afterP1 = states[4];
    expect(afterP1.pending?.playerId).toBe('p2');
    expect(afterP1.turnId).toBe('p2');
  });
});

describe('placement validation', () => {
  it('enforces turn order, hand ownership and row capacity', () => {
    const states = playScriptedHand();
    const afterDeal = states[1];

    // p2 (button) may not place before p1:
    expect(
      validateAction(afterDeal, {
        type: 'placeInitial',
        playerId: 'p2',
        placements: P2_INITIAL.map((card) => ({ card, row: 'bottom' as const })),
      }),
    ).toMatchObject({ ok: false, code: 'notYourTurn' });

    // Wrong count:
    expect(
      validateAction(afterDeal, {
        type: 'placeInitial',
        playerId: 'p1',
        placements: P1_INITIAL.slice(0, 4).map((card) => ({ card, row: 'bottom' as const })),
      }),
    ).toMatchObject({ ok: false, code: 'wrongPlacementCount', params: { expected: 5 } });

    // Cards not dealt to p1:
    expect(
      validateAction(afterDeal, {
        type: 'placeInitial',
        playerId: 'p1',
        placements: P2_INITIAL.map((card) => ({ card, row: 'bottom' as const })),
      }),
    ).toMatchObject({ ok: false, code: 'cardNotInHand' });

    // Same card twice:
    expect(
      validateAction(afterDeal, {
        type: 'placeInitial',
        playerId: 'p1',
        placements: [P1_INITIAL[0], P1_INITIAL[0], ...P1_INITIAL.slice(1, 4)].map((card) => ({
          card,
          row: 'bottom' as const,
        })),
      }),
    ).toMatchObject({ ok: false, code: 'duplicatePlacement' });

    // 4 cards on the 3-slot top row:
    expect(
      validateAction(afterDeal, {
        type: 'placeInitial',
        playerId: 'p1',
        placements: P1_INITIAL.map((card, i) => ({ card, row: i < 4 ? ('top' as const) : ('bottom' as const) })),
      }),
    ).toMatchObject({ ok: false, code: 'rowOverCapacity', params: { cap: 3 } });

    // A full row rejects a draw (p1's top is full from round 1 on):
    const midHand = states[5]; // p1 drew 2c to top in round 1, p2 placed → round 2, p1's turn
    expect(midHand.pending?.playerId).toBe('p1');
    expect(midHand.players.find((p) => p.id === 'p1')!.grid.top.length).toBe(3);
    const drawCard = midHand.pending!.cards[0];
    expect(
      validateAction(midHand, {
        type: 'placeDraw',
        playerId: 'p1',
        placements: [{ card: drawCard, row: 'top' }],
      }),
    ).toMatchObject({ ok: false, code: 'rowOverCapacity', params: { cap: 3 } });

    // placeDraw out of turn:
    expect(
      validateAction(midHand, {
        type: 'placeDraw',
        playerId: 'p2',
        placements: [{ card: drawCard, row: 'bottom' }],
      }),
    ).toMatchObject({ ok: false, code: 'notYourTurn' });

    // Unknown player / phase guards:
    expect(
      validateAction(midHand, {
        type: 'placeDraw',
        playerId: 'ghost',
        placements: [{ card: drawCard, row: 'top' }],
      }),
    ).toMatchObject({ ok: false, code: 'unknownPlayer' });
    expect(validateAction(midHand, { type: 'nextHand', playerId: 'p1' })).toMatchObject({
      ok: false,
      code: 'handNotScored',
    });
  });
});

describe('scoring and next hand', () => {
  it('completes into a frozen hand result with settled chips', () => {
    const states = playScriptedHand(100);
    const scored = states[states.length - 1];
    expect(scored.phase).toBe('scoring');
    expect(isHandComplete(scored)).toBe(true);
    // p1: QQ top (royalty 7) + scoop → +13.
    expect(scored.handResult?.pairs[0].points).toBe(13);
    expect(scored.players.map((p) => p.chips)).toEqual([113, 87]);
    expect(scored.handResult?.perPlayer.p1.fantasyNext).toBe(true);
    expect(scored.handResult?.perPlayer.p2.fantasyNext).toBe(false);
  });

  it('freezes the button for the Fantasy Land hand and carries Fantasy Land forward', () => {
    const scored = playScriptedHand(100).at(-1)!;
    const nextHand = reduce(scored, { type: 'nextHand', playerId: 'p1' });
    expect(nextHand.phase).toBe('dealing');
    expect(nextHand.handNumber).toBe(2);
    expect(nextHand.buttonId).toBe('p2'); // frozen: a Fantasy Land hand is coming
    expect(nextHand.players.find((p) => p.id === 'p1')?.inFantasyLand).toBe(true);
    expect(nextHand.players.every((p) => gridSize(p.grid) === 0 && p.hand.length === 0)).toBe(true);

    // The Fantasy Land player receives all 13 cards and is outside the rotation:
    const dealt = reduce(nextHand, createHandDeal(nextHand, mulberry32(42)));
    expect(dealt.players.find((p) => p.id === 'p1')?.hand.length).toBe(13);
    expect(dealt.players.find((p) => p.id === 'p2')?.hand.length).toBe(5);
    expect(placementOrder(dealt).map((p) => p.id)).toEqual(['p2']);
    expect(dealt.turnId).toBe('p2');
  });

  it('rotates the button normally when no Fantasy Land hand is coming', () => {
    const scored = playScriptedHand(100).at(-1)!;
    // Same scored hand with the Fantasy Land qualification stripped — the post-fantasy
    // (or plain) path: rotation resumes.
    const noFantasy: OfcState = {
      ...scored,
      handResult: {
        ...scored.handResult!,
        perPlayer: Object.fromEntries(
          Object.entries(scored.handResult!.perPlayer).map(([id, r]) => [
            id,
            { ...r, fantasyNext: false, fantasyCards: 0 },
          ]),
        ),
      },
    };
    const next = reduce(noFantasy, { type: 'nextHand', playerId: 'p1' });
    expect(next.buttonId).toBe('p1'); // rotated left from p2
    expect(next.players.every((p) => !p.inFantasyLand && p.fantasyCardCount === 0)).toBe(true);
  });

  it('plays a Fantasy Land hand: parallel commit, completion on the last placement', () => {
    const scored = playScriptedHand(100).at(-1)!;
    let state = reduce(scored, { type: 'nextHand', playerId: 'p1' });
    state = reduce(state, createHandDeal(state, mulberry32(42)));

    const p1 = state.players.find((p) => p.id === 'p1')!;
    // Fantasy commit must be exactly 13 cards in a 3/5/5 shape:
    expect(
      validateAction(state, {
        type: 'placeFantasy',
        playerId: 'p1',
        placements: p1.hand.slice(0, 12).map((card) => ({ card, row: 'bottom' as const })),
      }),
    ).toMatchObject({ ok: false, code: 'wrongPlacementCount', params: { expected: 13 } });
    expect(
      validateAction(state, {
        type: 'placeFantasy',
        playerId: 'p1',
        placements: p1.hand.map((card) => ({ card, row: 'bottom' as const })),
      }),
    ).toMatchObject({ ok: false, code: 'fantasyRowMismatch' });
    expect(
      validateAction(state, { type: 'placeFantasy', playerId: 'p2', placements: [] }),
    ).toMatchObject({ ok: false, code: 'notInFantasyLand' });

    // p1 commits Fantasy Land immediately (parallel to p2's normal play):
    const fantasyPlacements = p1.hand.map((card, i) => ({
      card,
      row: i < 3 ? ('top' as const) : i < 8 ? ('middle' as const) : ('bottom' as const),
    }));
    state = reduce(state, { type: 'placeFantasy', playerId: 'p1', placements: fantasyPlacements });
    expect(state.phase).toBe('placing'); // p2 still has 13 cards to set
    expect(state.players.find((p) => p.id === 'p1')?.fantasyPlaced).toBe(true);
    expect(
      validateAction(state, { type: 'placeFantasy', playerId: 'p1', placements: fantasyPlacements }),
    ).toMatchObject({ ok: false, code: 'alreadyPlacedFantasy' });

    // p2 plays out a normal solo rotation: initial 5 then 8 draws.
    const p2 = state.players.find((p) => p.id === 'p2')!;
    state = reduce(state, {
      type: 'placeInitial',
      playerId: 'p2',
      placements: p2.hand.map((card, i) => ({
        card,
        row: i < 2 ? ('top' as const) : i < 4 ? ('middle' as const) : ('bottom' as const),
      })),
    });
    for (let round = 1; round <= 8; round++) {
      expect(state.placeRound).toBe(round);
      expect(state.pending?.playerId).toBe('p2');
      const grid = state.players.find((p) => p.id === 'p2')!.grid;
      const row = grid.top.length < 3 ? 'top' : grid.middle.length < 5 ? 'middle' : 'bottom';
      state = reduce(state, {
        type: 'placeDraw',
        playerId: 'p2',
        placements: [{ card: state.pending!.cards[0], row }],
      });
    }
    expect(state.phase).toBe('scoring');
    expect(state.handResult).not.toBeNull();
  });

  it('ends the game when one player takes every chip', () => {
    // p2 starts with exactly the 13 points they lose → busts on hand 1.
    const scored = playScriptedHand(13).at(-1)!;
    expect(scored.players.find((p) => p.id === 'p2')?.chips).toBe(0);
    expect(scored.players.find((p) => p.id === 'p2')?.eliminated).toBe(true);
    const over = reduce(scored, { type: 'nextHand', playerId: 'p1' });
    expect(over.phase).toBe('gameOver');
    expect(over.winnerId).toBe('p1');
  });

  it('supports an all-Fantasy-Land hand with no rotation', () => {
    const base = playScriptedHand(100).at(-1)!;
    let state = reduce(base, { type: 'nextHand', playerId: 'p1' });
    // Force both players into Fantasy Land (engine state is a plain object):
    state = {
      ...state,
      players: state.players.map((p) => ({ ...p, inFantasyLand: true })),
    };
    state = reduce(state, createHandDeal(state, mulberry32(9)));
    expect(state.turnId).toBeNull();
    expect(state.pending).toBeNull();
    expect(state.players.every((p) => p.hand.length === 13)).toBe(true);

    for (const id of ['p1', 'p2']) {
      const hand = state.players.find((p) => p.id === id)!.hand;
      state = reduce(state, {
        type: 'placeFantasy',
        playerId: id,
        placements: hand.map((card, i) => ({
          card,
          row: i < 3 ? ('top' as const) : i < 8 ? ('middle' as const) : ('bottom' as const),
        })),
      });
    }
    expect(state.phase).toBe('scoring');
  });

  it('deals only to alive players after an elimination in a 3-player game', () => {
    // Direct state surgery: 3 players, one eliminated → order and deal skip them.
    const three = initGame(
      [
        { id: 'a', name: 'A' },
        { id: 'b', name: 'B' },
        { id: 'c', name: 'C' },
      ],
      100,
      'classic',
      () => 0, // button = a
    );
    const withDead: OfcState = {
      ...three,
      players: three.players.map((p) => (p.id === 'b' ? { ...p, eliminated: true, chips: 0 } : p)),
    };
    const dealt = reduce(withDead, createHandDeal(withDead, mulberry32(3)));
    expect(dealt.players.find((p) => p.id === 'b')?.hand.length).toBe(0);
    expect(placementOrder(dealt).map((p) => p.id)).toEqual(['c', 'a']);
    expect(
      validateAction(dealt, { type: 'placeDraw', playerId: 'b', placements: [] }),
    ).toMatchObject({ ok: false, code: 'eliminated' });
  });

  // `deal` and `nextHand` advance the shared hand, so they must survive their caller being
  // eliminated: online they carry the HOST's id, and a busted host used to freeze the table
  // for everyone with no way out (Mathieu, 30/08).
  it('lets an eliminated caller still deal and advance the hand', () => {
    const three = initGame(
      [
        { id: 'a', name: 'A' },
        { id: 'b', name: 'B' },
        { id: 'c', name: 'C' },
      ],
      100,
      'classic',
      () => 0,
    );
    const withDead: OfcState = {
      ...three,
      players: three.players.map((p) => (p.id === 'b' ? { ...p, eliminated: true, chips: 0 } : p)),
    };
    const deal = createHandDeal(withDead, mulberry32(3));
    expect(validateAction(withDead, { ...deal, playerId: 'b' }).ok).toBe(true);

    const scoring: OfcState = { ...withDead, phase: 'scoring' };
    expect(validateAction(scoring, { type: 'nextHand', playerId: 'b' }).ok).toBe(true);
  });

  it('ends the game when only one player is left, even from an eliminated caller', () => {
    const two = initGame([{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }], 100, 'classic', () => 0);
    const busted: OfcState = {
      ...two,
      phase: 'scoring',
      players: two.players.map((p) => (p.id === 'b' ? { ...p, eliminated: true, chips: 0 } : p)),
    };
    const over = reduce(busted, { type: 'nextHand', playerId: 'b' });
    expect(over.phase).toBe('gameOver');
    expect(over.winnerId).toBe('a');
  });
});

describe('scripted fixture sanity', () => {
  it('uses the intended deterministic deal', () => {
    const afterDeal = playScriptedHand()[1];
    expect(afterDeal.players.find((p) => p.id === 'p1')?.hand).toEqual(P1_INITIAL);
    expect(afterDeal.players.find((p) => p.id === 'p2')?.hand).toEqual(P2_INITIAL);
    expect(scriptedActions().length).toBe(1 + 2 + 16);
    expect(cards('As Kh').length).toBe(2);
  });
});

describe('pineapple variant', () => {
  it('deals 3 private cards per turn across 4 rounds, button last each round', () => {
    const states = playScriptedPineappleHand();
    // states[3] = after both initial placements → round 1, p1 to draw.
    const roundOne = states[3];
    expect(roundOne.placeRound).toBe(1);
    expect(roundOne.pending?.playerId).toBe('p1');
    expect(roundOne.pending?.cards).toEqual([P1_DRAWS[0], P1_DRAWS[1], P1_PINEAPPLE_DISCARDS[0]]);
    const afterP1 = states[4];
    expect(afterP1.pending?.playerId).toBe('p2');
    expect(afterP1.pending?.cards).toHaveLength(3);
    // 1 deal + 2 initial commits + 4 rounds × 2 players:
    expect(scriptedPineappleActions().length).toBe(1 + 2 + 8);
    const scored = states.at(-1)!;
    expect(scored.phase).toBe('scoring');
    expect(scored.placeRound).toBe(4);
  });

  it('reaches the same final grids and score as the classic script', () => {
    const scored = playScriptedPineappleHand(100).at(-1)!;
    expect(scored.handResult?.pairs[0].points).toBe(13);
    expect(scored.players.map((p) => p.chips)).toEqual([113, 87]);
    expect(scored.handResult?.perPlayer.p1.fantasyNext).toBe(true);
    expect(scored.handResult?.perPlayer.p1.fantasyCards).toBe(14); // QQ entry
    expect(scored.handResult?.perPlayer.p2.fantasyNext).toBe(false);
  });

  it('conserves all 52 unique cards at every step, discards included', () => {
    for (const state of playScriptedPineappleHand()) {
      if (state.phase === 'dealing') continue;
      const keys = allCardsOf(state);
      expect(keys.length).toBe(52);
      expect(new Set(keys).size).toBe(52);
    }
  });

  it('tracks the inferred discard, which never re-enters play', () => {
    const scored = playScriptedPineappleHand().at(-1)!;
    const p1 = scored.players.find((p) => p.id === 'p1')!;
    const p2 = scored.players.find((p) => p.id === 'p2')!;
    expect(p1.discards).toEqual(P1_PINEAPPLE_DISCARDS);
    expect(p2.discards).toEqual(P2_PINEAPPLE_DISCARDS);
    const gridKeys = new Set(
      scored.players.flatMap((p) =>
        [...p.grid.top, ...p.grid.middle, ...p.grid.bottom].map(cardKey),
      ),
    );
    for (const thrown of [...p1.discards, ...p2.discards]) {
      expect(gridKeys.has(cardKey(thrown))).toBe(false);
    }
  });

  it('validates placeDraw: exactly 2 distinct cards from the dealt 3, capacity respected', () => {
    const roundOne = playScriptedPineappleHand()[3];
    const [first, second] = roundOne.pending!.cards;

    // Wrong counts (1 or 3 placements):
    expect(
      validateAction(roundOne, {
        type: 'placeDraw',
        playerId: 'p1',
        placements: [{ card: first, row: 'middle' }],
      }),
    ).toMatchObject({ ok: false, code: 'wrongPlacementCount', params: { expected: 2 } });
    expect(
      validateAction(roundOne, {
        type: 'placeDraw',
        playerId: 'p1',
        placements: roundOne.pending!.cards.map((card) => ({ card, row: 'middle' as const })),
      }),
    ).toMatchObject({ ok: false, code: 'wrongPlacementCount', params: { expected: 2 } });

    // A card that was not dealt this turn:
    expect(
      validateAction(roundOne, {
        type: 'placeDraw',
        playerId: 'p1',
        placements: [
          { card: first, row: 'middle' },
          { card: c('Ad'), row: 'middle' },
        ],
      }),
    ).toMatchObject({ ok: false, code: 'cardNotInHand' });

    // The same card twice:
    expect(
      validateAction(roundOne, {
        type: 'placeDraw',
        playerId: 'p1',
        placements: [
          { card: first, row: 'middle' },
          { card: first, row: 'bottom' },
        ],
      }),
    ).toMatchObject({ ok: false, code: 'duplicatePlacement' });

    // Legacy pre-Pineapple `{ row }` payload from an outdated guest build:
    const legacy = { type: 'placeDraw', playerId: 'p1', row: 'top' } as unknown as OfcAction;
    expect(validateAction(roundOne, legacy)).toMatchObject({
      ok: false,
      code: 'wrongPlacementCount',
    });

    // Both cards into the top row, which only has one slot left (QQ committed):
    expect(roundOne.players.find((p) => p.id === 'p1')!.grid.top).toHaveLength(2);
    expect(
      validateAction(roundOne, {
        type: 'placeDraw',
        playerId: 'p1',
        placements: [
          { card: first, row: 'top' },
          { card: second, row: 'top' },
        ],
      }),
    ).toMatchObject({ ok: false, code: 'rowOverCapacity', params: { cap: 3 } });
  });

  it('deals 14 to Fantasy Land on a QQ entry, places 13 and discards the leftover', () => {
    const scored = playScriptedPineappleHand(100).at(-1)!;
    let state = reduce(scored, { type: 'nextHand', playerId: 'p1' });
    state = reduce(state, createHandDeal(state, mulberry32(42)));

    const p1 = state.players.find((p) => p.id === 'p1')!;
    expect(p1.hand).toHaveLength(14);
    expect(placementOrder(state).map((p) => p.id)).toEqual(['p2']);

    // All 14 is one too many — exactly 13 must be placed:
    expect(
      validateAction(state, {
        type: 'placeFantasy',
        playerId: 'p1',
        placements: p1.hand.map((card) => ({ card, row: 'bottom' as const })),
      }),
    ).toMatchObject({ ok: false, code: 'wrongPlacementCount', params: { expected: 13 } });

    const placements = p1.hand.slice(0, 13).map((card, i) => ({
      card,
      row: i < 3 ? ('top' as const) : i < 8 ? ('middle' as const) : ('bottom' as const),
    }));
    state = reduce(state, { type: 'placeFantasy', playerId: 'p1', placements });
    const after = state.players.find((p) => p.id === 'p1')!;
    expect(after.fantasyPlaced).toBe(true);
    expect(after.discards).toEqual([p1.hand[13]]);
  });

  it('deals the progressive Fantasy Land size decided at scoring (KK→15, AA/re-fantasy→16)', () => {
    const scored = playScriptedPineappleHand(100).at(-1)!;
    for (const size of [15, 16]) {
      const tweaked: OfcState = {
        ...scored,
        handResult: {
          ...scored.handResult!,
          perPlayer: {
            ...scored.handResult!.perPlayer,
            p1: { ...scored.handResult!.perPlayer.p1, fantasyCards: size },
          },
        },
      };
      let state = reduce(tweaked, { type: 'nextHand', playerId: 'p1' });
      expect(state.players.find((p) => p.id === 'p1')?.fantasyCardCount).toBe(size);
      state = reduce(state, createHandDeal(state, mulberry32(42)));

      const p1 = state.players.find((p) => p.id === 'p1')!;
      expect(p1.hand).toHaveLength(size);

      // Still exactly 13 placed — everything beyond becomes the hidden discard:
      const placements = p1.hand.slice(0, 13).map((card, i) => ({
        card,
        row: i < 3 ? ('top' as const) : i < 8 ? ('middle' as const) : ('bottom' as const),
      }));
      state = reduce(state, { type: 'placeFantasy', playerId: 'p1', placements });
      expect(state.players.find((p) => p.id === 'p1')!.discards).toHaveLength(size - 13);
    }
  });

  it('a full 3-player pineapple hand consumes 51 of 52 cards', () => {
    let state = initGame(
      [
        { id: 'a', name: 'A' },
        { id: 'b', name: 'B' },
        { id: 'c', name: 'C' },
      ],
      100,
      'pineapple',
      () => 0,
    );
    state = reduce(state, createHandDeal(state, mulberry32(5)));
    while (state.phase === 'placing') {
      const actor = state.players.find((p) => p.id === state.turnId)!;
      if (state.placeRound === 0) {
        state = reduce(state, {
          type: 'placeInitial',
          playerId: actor.id,
          placements: actor.hand.map((card, i) => ({
            card,
            row: i < 2 ? ('top' as const) : i < 4 ? ('middle' as const) : ('bottom' as const),
          })),
        });
      } else {
        const remaining = {
          top: 3 - actor.grid.top.length,
          middle: 5 - actor.grid.middle.length,
          bottom: 5 - actor.grid.bottom.length,
        };
        const placements = state.pending!.cards.slice(0, 2).map((card) => {
          const row = (['bottom', 'middle', 'top'] as const).find((r) => remaining[r] > 0)!;
          remaining[row] -= 1;
          return { card, row };
        });
        state = reduce(state, { type: 'placeDraw', playerId: actor.id, placements });
      }
    }
    expect(state.phase).toBe('scoring');
    expect(state.deck).toHaveLength(1);
    expect(state.players.every((p) => p.discards.length === 4)).toBe(true);
  });

  it('is deterministic when replayed', () => {
    expect(playScriptedPineappleHand()).toEqual(playScriptedPineappleHand());
  });
});
