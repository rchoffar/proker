import type { Card } from '../../types/hand';
import { cardKey } from '../../types/hand';
import type { Player } from '../../types';
import { createDeck } from '../pokerHandEvaluator';
import type { Claim } from './claims';
import { isStrictlyHigher } from './claims';
import { claimHolds, findClaimWitness } from './validator';
import { shuffleWithRng } from '../rng';

// Pure, UI-free game engine: Pass & Play drives it through local state, the online host
// applies remote players' actions through the exact same validateAction/reduce pair.
// All randomness lives in initGame/createRoundDeal — reduce itself is deterministic.
//
// Round lifecycle: 'dealing' (controller auto-dispatches a `deal` action so players hold
// their cards BEFORE the starter sizes the board) → 'chooseBoard' → 'bidding' → 'reveal'
// → 'roundEnd' → back to 'dealing' (or 'gameOver').

export type BluffPhase = 'dealing' | 'chooseBoard' | 'bidding' | 'reveal' | 'roundEnd' | 'gameOver';

export interface BluffPlayerState {
  id: string;
  name: string;
  cardCount: number; // 2..5 — penalty level ("zone rouge" at 5)
  hand: Card[]; // full knowledge — must be redacted before leaving the host device
  eliminated: boolean;
}

export interface RevealResult {
  catcherId: string;
  claimerId: string;
  claim: Claim;
  holds: boolean;
  loserId: string;
  pool: Card[]; // alive hands + board at resolution time
  witness: Card[] | null; // cards proving the claim, when it holds
  eliminatesLoser: boolean; // loser was already at 5 cards
}

export interface RoundDeal {
  hands: Record<string, Card[]>;
  // 5 face-down candidates for the middle: chooseBoard reveals the first N, the rest
  // leave the game (they are NOT part of the resolution pool).
  boardStock: Card[];
}

export interface BluffState {
  phase: BluffPhase;
  round: number; // 1-based
  players: BluffPlayerState[]; // seat order, fixed for the whole game
  starterId: string; // sizes the board and opens the bidding
  turnId: string; // whose turn during bidding
  boardStock: Card[]; // pre-dealt middle candidates — hidden from ALL players until chosen
  board: Card[];
  currentClaim: Claim | null;
  claimHistory: { playerId: string; claim: Claim }[];
  reveal: RevealResult | null; // set from 'reveal' until the next deal
  winnerId: string | null;
  version: number; // bumped by every reduce — lets online clients drop stale states
}

export type BluffAction =
  | { type: 'deal'; playerId: string; deal: RoundDeal }
  | { type: 'chooseBoard'; playerId: string; boardCount: number }
  | { type: 'claim'; playerId: string; claim: Claim }
  | { type: 'catch'; playerId: string }
  | { type: 'confirmReveal'; playerId: string }
  | { type: 'nextRound'; playerId: string };

export const MIN_BLUFF_PLAYERS = 2;
export const MAX_BLUFF_PLAYERS = 6;
export const MAX_BOARD_CARDS = 5;
export const ELIMINATION_CARD_COUNT = 5;

export function aliveInOrder(state: BluffState): BluffPlayerState[] {
  return state.players.filter((p) => !p.eliminated);
}

export function nextAliveAfter(state: BluffState, id: string): string {
  const idx = state.players.findIndex((p) => p.id === id);
  if (idx === -1) throw new Error(`Unknown player ${id}`);
  for (let step = 1; step <= state.players.length; step++) {
    const candidate = state.players[(idx + step) % state.players.length];
    if (!candidate.eliminated) return candidate.id;
  }
  throw new Error('No alive player found');
}

export function initGame(players: Player[], rng: () => number = Math.random): BluffState {
  if (players.length < MIN_BLUFF_PLAYERS || players.length > MAX_BLUFF_PLAYERS) {
    throw new Error(`Bluff requires ${MIN_BLUFF_PLAYERS}-${MAX_BLUFF_PLAYERS} players`);
  }
  const starter = players[Math.floor(rng() * players.length)];
  return {
    phase: 'dealing',
    round: 1,
    players: players.map((p) => ({ id: p.id, name: p.name, cardCount: 2, hand: [], eliminated: false })),
    starterId: starter.id,
    turnId: starter.id,
    boardStock: [],
    board: [],
    currentClaim: null,
    claimHistory: [],
    reveal: null,
    winnerId: null,
    version: 0,
  };
}

/**
 * Deals a fresh shuffled deck for the round: `cardCount` cards per alive player plus 5
 * middle candidates. Max need is 6×5 + 5 = 35 ≤ 52, so a single deck always suffices.
 */
export function createRoundDeal(
  state: BluffState,
  rng: () => number = Math.random,
): Extract<BluffAction, { type: 'deal' }> {
  const deck = shuffleWithRng(createDeck(), rng);
  let cursor = 0;
  const hands: Record<string, Card[]> = {};
  for (const player of aliveInOrder(state)) {
    hands[player.id] = deck.slice(cursor, cursor + player.cardCount);
    cursor += player.cardCount;
  }
  const boardStock = deck.slice(cursor, cursor + MAX_BOARD_CARDS);
  return { type: 'deal', playerId: state.starterId, deal: { hands, boardStock } };
}

// Stable, language-neutral error codes: the engine stays i18n-free, rendering sites
// translate via `bluff:errors.<code>` (and the online protocol relays code + params,
// never pre-rendered text).
export type BluffErrorCode =
  | 'unknownPlayer'
  | 'eliminated'
  | 'notDealPhase'
  | 'inconsistentDeal'
  | 'duplicateCard'
  | 'dealCardCountMismatch'
  | 'notChooseBoardPhase'
  | 'onlyStarterChoosesBoard'
  | 'boardCountOutOfRange'
  | 'notBiddingPhase'
  | 'notYourTurn'
  | 'royalFlushUnbeatable'
  | 'claimNotHigher'
  | 'firstPlayerMustClaim'
  | 'nothingToConfirm'
  | 'roundNotOver';

export interface BluffValidationError {
  code: BluffErrorCode;
  // Interpolation values for the error message (e.g. { max: MAX_BOARD_CARDS }).
  params?: Record<string, number>;
}

export type BluffValidationResult = { ok: true } | ({ ok: false } & BluffValidationError);

export function validateAction(state: BluffState, action: BluffAction): BluffValidationResult {
  const player = state.players.find((p) => p.id === action.playerId);
  if (!player) return { ok: false, code: 'unknownPlayer' };
  if (player.eliminated) return { ok: false, code: 'eliminated' };

  switch (action.type) {
    case 'deal': {
      if (state.phase !== 'dealing') return { ok: false, code: 'notDealPhase' };
      if (action.deal.boardStock.length !== MAX_BOARD_CARDS) return { ok: false, code: 'inconsistentDeal' };
      const seen = new Set<string>();
      for (const card of [...action.deal.boardStock, ...Object.values(action.deal.hands).flat()]) {
        const key = cardKey(card);
        if (seen.has(key)) return { ok: false, code: 'duplicateCard' };
        seen.add(key);
      }
      for (const p of aliveInOrder(state)) {
        if ((action.deal.hands[p.id]?.length ?? 0) !== p.cardCount) {
          return { ok: false, code: 'dealCardCountMismatch' };
        }
      }
      return { ok: true };
    }
    case 'chooseBoard': {
      if (state.phase !== 'chooseBoard') return { ok: false, code: 'notChooseBoardPhase' };
      if (action.playerId !== state.starterId) return { ok: false, code: 'onlyStarterChoosesBoard' };
      if (action.boardCount < 0 || action.boardCount > MAX_BOARD_CARDS) {
        return { ok: false, code: 'boardCountOutOfRange', params: { max: MAX_BOARD_CARDS } };
      }
      return { ok: true };
    }
    case 'claim': {
      if (state.phase !== 'bidding') return { ok: false, code: 'notBiddingPhase' };
      if (action.playerId !== state.turnId) return { ok: false, code: 'notYourTurn' };
      if (state.currentClaim?.category === 'royalFlush') {
        return { ok: false, code: 'royalFlushUnbeatable' };
      }
      if (!isStrictlyHigher(action.claim, state.currentClaim)) {
        return { ok: false, code: 'claimNotHigher' };
      }
      return { ok: true };
    }
    case 'catch': {
      if (state.phase !== 'bidding') return { ok: false, code: 'notBiddingPhase' };
      if (action.playerId !== state.turnId) return { ok: false, code: 'notYourTurn' };
      if (state.claimHistory.length === 0) {
        return { ok: false, code: 'firstPlayerMustClaim' };
      }
      return { ok: true };
    }
    case 'confirmReveal':
      if (state.phase !== 'reveal') return { ok: false, code: 'nothingToConfirm' };
      return { ok: true };
    case 'nextRound':
      if (state.phase !== 'roundEnd') return { ok: false, code: 'roundNotOver' };
      return { ok: true };
  }
}

/** Pure transition. Throws on invalid actions — callers gate through validateAction first. */
export function reduce(state: BluffState, action: BluffAction): BluffState {
  const valid = validateAction(state, action);
  if (!valid.ok) throw new Error(`Invalid bluff action: ${valid.code}`);

  switch (action.type) {
    case 'deal': {
      return {
        ...state,
        phase: 'chooseBoard',
        players: state.players.map((p) =>
          p.eliminated ? p : { ...p, hand: action.deal.hands[p.id] },
        ),
        boardStock: action.deal.boardStock,
        board: [],
        turnId: state.starterId,
        currentClaim: null,
        claimHistory: [],
        reveal: null,
        version: state.version + 1,
      };
    }
    case 'chooseBoard': {
      return {
        ...state,
        phase: 'bidding',
        board: state.boardStock.slice(0, action.boardCount),
        boardStock: [],
        turnId: state.starterId,
        version: state.version + 1,
      };
    }
    case 'claim': {
      return {
        ...state,
        currentClaim: action.claim,
        claimHistory: [...state.claimHistory, { playerId: action.playerId, claim: action.claim }],
        turnId: nextAliveAfter(state, action.playerId),
        version: state.version + 1,
      };
    }
    case 'catch': {
      const lastClaim = state.claimHistory[state.claimHistory.length - 1];
      const pool = [...aliveInOrder(state).flatMap((p) => p.hand), ...state.board];
      const holds = claimHolds(lastClaim.claim, pool);
      const loserId = holds ? action.playerId : lastClaim.playerId;
      const loser = state.players.find((p) => p.id === loserId)!;
      return {
        ...state,
        phase: 'reveal',
        reveal: {
          catcherId: action.playerId,
          claimerId: lastClaim.playerId,
          claim: lastClaim.claim,
          holds,
          loserId,
          pool,
          witness: holds ? findClaimWitness(lastClaim.claim, pool) : null,
          eliminatesLoser: loser.cardCount === ELIMINATION_CARD_COUNT,
        },
        version: state.version + 1,
      };
    }
    case 'confirmReveal': {
      return { ...state, phase: 'roundEnd', version: state.version + 1 };
    }
    case 'nextRound': {
      const reveal = state.reveal!;
      const players = state.players.map((p) => {
        if (p.id !== reveal.loserId) return { ...p, hand: [] };
        return reveal.eliminatesLoser
          ? { ...p, hand: [], eliminated: true }
          : { ...p, hand: [], cardCount: p.cardCount + 1 };
      });
      const alive = players.filter((p) => !p.eliminated);
      if (alive.length === 1) {
        return {
          ...state,
          phase: 'gameOver',
          players,
          winnerId: alive[0].id,
          boardStock: [],
          currentClaim: null,
          claimHistory: [],
          version: state.version + 1,
        };
      }
      // The round's loser starts the next round; if they just got eliminated, the next
      // alive player clockwise takes over (rule decision — spec doesn't cover this case).
      const nextStarter = players.find((p) => p.id === reveal.loserId && !p.eliminated)
        ? reveal.loserId
        : nextAliveAfter({ ...state, players }, reveal.loserId);
      return {
        ...state,
        phase: 'dealing',
        round: state.round + 1,
        players,
        starterId: nextStarter,
        turnId: nextStarter,
        boardStock: [],
        board: [],
        currentClaim: null,
        claimHistory: [],
        reveal: null,
        version: state.version + 1,
      };
    }
  }
}
