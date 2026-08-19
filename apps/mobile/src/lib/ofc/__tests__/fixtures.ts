import type { Card, Rank, Suit } from '../../../types/hand';
import { cardKey } from '../../../types/hand';
import { createDeck } from '../../pokerHandEvaluator';
import type { OfcAction, OfcState } from '../engine';
import { initGame, reduce } from '../engine';
import type { RowId } from '../evaluator';

const SUIT_BY_LETTER: Record<string, Suit> = {
  s: 'spades',
  h: 'hearts',
  c: 'clubs',
  d: 'diamonds',
};

/** Parses 'As' / 'Th' / '2c' into a Card. */
export function c(code: string): Card {
  const rank = code[0] as Rank;
  const suit = SUIT_BY_LETTER[code[1]];
  if (!suit) throw new Error(`Bad card code ${code}`);
  return { rank, suit };
}

/** Parses a space-separated list of card codes. */
export function cards(codes: string): Card[] {
  return codes.split(/\s+/).filter(Boolean).map(c);
}

/** Full 52-card deck starting with `front`, remaining cards after. Throws on duplicates. */
export function buildDeck(front: Card[]): Card[] {
  const frontKeys = new Set(front.map(cardKey));
  if (frontKeys.size !== front.length) throw new Error('buildDeck: duplicate front cards');
  const rest = createDeck().filter((card) => !frontKeys.has(cardKey(card)));
  const deck = [...front, ...rest];
  if (deck.length !== 52) throw new Error('buildDeck: not 52 cards');
  return deck;
}

// ── Scripted deterministic 2-player hand ──────────────────────────────────────
// Button p2 → rotation [p1, p2]. p1 ends with QQx top / KK middle / AA bottom
// (valid, QQ top ⇒ Fantasy Land next, top royalty 7, scoop ⇒ +13 points from p2).
// p2 ends with 9-high top / pair 5 middle / pair 6 bottom (valid, no royalties).

export const P1_INITIAL = cards('Qs Qh Kh Kc Ah');
export const P2_INITIAL = cards('2d 3s 5d 5c 6h');
export const P1_DRAWS = cards('2c 3d 5s 7h Ac 4d 6s 8h');
export const P2_DRAWS = cards('9c 8s Tc Jd 6c 7d Ts Jc');
const P1_INITIAL_ROWS: RowId[] = ['top', 'top', 'middle', 'middle', 'bottom'];
const P2_INITIAL_ROWS: RowId[] = ['top', 'top', 'middle', 'middle', 'bottom'];
const P1_DRAW_ROWS: RowId[] = ['top', 'middle', 'middle', 'middle', 'bottom', 'bottom', 'bottom', 'bottom'];
const P2_DRAW_ROWS: RowId[] = ['top', 'middle', 'middle', 'middle', 'bottom', 'bottom', 'bottom', 'bottom'];

export function scriptedDeck(): Card[] {
  const draws: Card[] = [];
  for (let i = 0; i < 8; i++) draws.push(P1_DRAWS[i], P2_DRAWS[i]);
  return buildDeck([...P1_INITIAL, ...P2_INITIAL, ...draws]);
}

export const SCRIPTED_PLAYERS = [
  { id: 'p1', name: 'Alice' },
  { id: 'p2', name: 'Bob' },
];

function initialActions(deck: Card[]): OfcAction[] {
  return [
    { type: 'deal', playerId: 'p2', deck },
    {
      type: 'placeInitial',
      playerId: 'p1',
      placements: P1_INITIAL.map((card, i) => ({ card, row: P1_INITIAL_ROWS[i] })),
    },
    {
      type: 'placeInitial',
      playerId: 'p2',
      placements: P2_INITIAL.map((card, i) => ({ card, row: P2_INITIAL_ROWS[i] })),
    },
  ];
}

export function scriptedActions(): OfcAction[] {
  const actions = initialActions(scriptedDeck());
  for (let i = 0; i < 8; i++) {
    actions.push({
      type: 'placeDraw',
      playerId: 'p1',
      placements: [{ card: P1_DRAWS[i], row: P1_DRAW_ROWS[i] }],
    });
    actions.push({
      type: 'placeDraw',
      playerId: 'p2',
      placements: [{ card: P2_DRAWS[i], row: P2_DRAW_ROWS[i] }],
    });
  }
  return actions;
}

/** Plays the scripted hand, returning every intermediate state (states[0] = post-init). */
export function playScriptedHand(startingStack = 100): OfcState[] {
  // rng 0.9 → button = players[1] = p2, so p1 (left of button) acts first.
  let state = initGame(SCRIPTED_PLAYERS, startingStack, 'classic', () => 0.9);
  const states: OfcState[] = [state];
  for (const action of scriptedActions()) {
    state = reduce(state, action);
    states.push(state);
  }
  return states;
}

// ── Scripted deterministic 2-player PINEAPPLE hand ────────────────────────────
// Same players, button and FINAL GRIDS as the classic script (so the scoring
// expectations carry over verbatim): the 8 classic draws become the placed pairs of
// 4 three-card rounds, plus one fresh discard per round — cards untouched elsewhere.

export const P1_PINEAPPLE_DISCARDS = cards('2h 3h 4h 5h');
export const P2_PINEAPPLE_DISCARDS = cards('2s 4s 7s 9s');

function pineappleRound(draws: Card[], discards: Card[], round: number): Card[] {
  return [draws[2 * round], draws[2 * round + 1], discards[round]];
}

export function scriptedPineappleDeck(): Card[] {
  const rounds: Card[] = [];
  for (let i = 0; i < 4; i++) {
    rounds.push(...pineappleRound(P1_DRAWS, P1_PINEAPPLE_DISCARDS, i));
    rounds.push(...pineappleRound(P2_DRAWS, P2_PINEAPPLE_DISCARDS, i));
  }
  return buildDeck([...P1_INITIAL, ...P2_INITIAL, ...rounds]);
}

export function scriptedPineappleActions(): OfcAction[] {
  const actions = initialActions(scriptedPineappleDeck());
  for (let i = 0; i < 4; i++) {
    actions.push({
      type: 'placeDraw',
      playerId: 'p1',
      placements: [
        { card: P1_DRAWS[2 * i], row: P1_DRAW_ROWS[2 * i] },
        { card: P1_DRAWS[2 * i + 1], row: P1_DRAW_ROWS[2 * i + 1] },
      ],
    });
    actions.push({
      type: 'placeDraw',
      playerId: 'p2',
      placements: [
        { card: P2_DRAWS[2 * i], row: P2_DRAW_ROWS[2 * i] },
        { card: P2_DRAWS[2 * i + 1], row: P2_DRAW_ROWS[2 * i + 1] },
      ],
    });
  }
  return actions;
}

/** Plays the scripted pineapple hand, returning every intermediate state. */
export function playScriptedPineappleHand(startingStack = 100): OfcState[] {
  let state = initGame(SCRIPTED_PLAYERS, startingStack, 'pineapple', () => 0.9);
  const states: OfcState[] = [state];
  for (const action of scriptedPineappleActions()) {
    state = reduce(state, action);
    states.push(state);
  }
  return states;
}
