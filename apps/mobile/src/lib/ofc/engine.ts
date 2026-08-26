import type { Card } from '../../types/hand';
import { cardKey } from '../../types/hand';
import type { Player } from '../../types';
import { createDeck } from '../pokerHandEvaluator';
import { shuffleWithRng } from '../rng';
import type { OfcGrid, RowId } from './evaluator';
import { ROW_CAPACITY, ROW_IDS } from './evaluator';
import type { OfcHandResult } from './scoring';
import { scoreHand } from './scoring';

// Pure, UI-free OFC engine: Pass & Play drives it through local state, the online host
// applies remote players' actions through the same validateAction/reduce pair. All
// randomness lives in initGame/createHandDeal — reduce itself is deterministic (draws
// are popped from the pre-shuffled state.deck).
//
// Two variants, chosen by the game creator at initGame:
//   classic   — 8 draw rounds, 1 public card per turn, placed immediately, no discard.
//   pineapple — 4 draw rounds, 3 PRIVATE cards per turn: place 2, discard 1 (hidden,
//               out of play). Fantasy Land is progressive: 14-16 dealt (QQ→14, KK→15,
//               AA/trips→16, re-fantasy 16), place 13 + discard the rest.
//
// Hand lifecycle: 'dealing' (controller auto-dispatches `deal`: 5 cards per player,
// fantasyCardCount to Fantasy Land players) → 'placing' (round 0 = sequential initial-5
// commits in button order; rounds 1..drawRounds = dealSize cards to the actor, placeCount
// placed, the rest discarded; Fantasy Land players commit their full grid in parallel,
// outside the rotation) → 'scoring' (frozen OfcHandResult + chip settlement) → back to
// 'dealing', or 'gameOver' once a single player holds every chip.

export type OfcPhase = 'dealing' | 'placing' | 'scoring' | 'gameOver';

export type OfcVariant = 'classic' | 'pineapple';

export interface OfcVariantConfig {
  drawRounds: number;
  dealSize: number; // cards dealt to the actor each draw turn
  placeCount: number; // cards the actor must place; dealSize - placeCount are discarded
  // Fallback Fantasy Land deal (13 placed either way). Classic always uses it; pineapple
  // normally deals the per-player progressive fantasyCardCount instead.
  fantasyHandSize: number;
}

export const VARIANT_CONFIG: Record<OfcVariant, OfcVariantConfig> = {
  classic: { drawRounds: 8, dealSize: 1, placeCount: 1, fantasyHandSize: 13 },
  pineapple: { drawRounds: 4, dealSize: 3, placeCount: 2, fantasyHandSize: 14 },
};

export const OFC_VARIANTS: OfcVariant[] = ['classic', 'pineapple'];

export interface OfcPlayerState {
  id: string;
  name: string;
  chips: number;
  eliminated: boolean;
  grid: OfcGrid; // committed placements — face-up, except Fantasy Land pre-reveal
  hand: Card[]; // PRIVATE unplaced cards (initial 5, or the full FL deal)
  discards: Card[]; // PRIVATE cards thrown this hand — visible to their owner only
  inFantasyLand: boolean;
  fantasyPlaced: boolean;
  // Cards to deal this player's Fantasy Land hand (pineapple progressive: 14-16, decided
  // by the qualifying hand at scoring time). 0 when not in Fantasy Land.
  fantasyCardCount: number;
}

export interface OfcPlacement {
  card: Card;
  row: RowId;
}

export interface OfcState {
  phase: OfcPhase;
  variant: OfcVariant;
  handNumber: number; // 1-based
  players: OfcPlayerState[]; // seat order, fixed for the whole game
  buttonId: string; // random on hand 1, rotates left among alive players
  turnId: string | null; // current non-Fantasy-Land actor; null when none remains
  placeRound: number; // 0 = initial-5 round, 1..drawRounds = draw rounds
  deck: Card[]; // remaining undealt cards — host secret, stripped by redactFor
  // The actor's drawn cards awaiting placement. Public in classic (1 card), PRIVATE to
  // the actor in pineapple (3 cards) — redactFor enforces this.
  pending: { playerId: string; cards: Card[] } | null;
  handResult: OfcHandResult | null; // set on entering 'scoring', cleared by the next deal
  winnerId: string | null;
  version: number; // bumped by every reduce — lets online clients drop stale states
}

export type OfcAction =
  | { type: 'deal'; playerId: string; deck: Card[] }
  | { type: 'placeInitial'; playerId: string; placements: OfcPlacement[] }
  // The discard is never sent: it is the pending card(s) NOT placed, inferred in reduce.
  | { type: 'placeDraw'; playerId: string; placements: OfcPlacement[] }
  | { type: 'placeFantasy'; playerId: string; placements: OfcPlacement[] }
  | { type: 'nextHand'; playerId: string };

export const MIN_OFC_PLAYERS = 2;
export const MAX_OFC_PLAYERS = 3;
export const DEFAULT_STARTING_STACK = 100;
export const INITIAL_SET_SIZE = 5;
export const GRID_SIZE = 13;

export function variantConfig(state: OfcState): OfcVariantConfig {
  return VARIANT_CONFIG[state.variant];
}

export function emptyGrid(): OfcGrid {
  return { top: [], middle: [], bottom: [] };
}

export function gridSize(grid: OfcGrid): number {
  return grid.top.length + grid.middle.length + grid.bottom.length;
}

export function aliveInOrder(state: OfcState): OfcPlayerState[] {
  return state.players.filter((p) => !p.eliminated);
}

export function nextAliveAfter(state: OfcState, id: string): string {
  const idx = state.players.findIndex((p) => p.id === id);
  if (idx === -1) throw new Error(`Unknown player ${id}`);
  for (let step = 1; step <= state.players.length; step++) {
    const candidate = state.players[(idx + step) % state.players.length];
    if (!candidate.eliminated) return candidate.id;
  }
  throw new Error('No alive player found');
}

/**
 * The hand's rotation: alive non-Fantasy-Land players, left of the button first, the
 * button last (maximal information). Fantasy Land players place in parallel and are
 * never part of the rotation.
 */
export function placementOrder(state: OfcState): OfcPlayerState[] {
  const btnIdx = state.players.findIndex((p) => p.id === state.buttonId);
  if (btnIdx === -1) throw new Error(`Unknown button ${state.buttonId}`);
  const order: OfcPlayerState[] = [];
  for (let step = 1; step <= state.players.length; step++) {
    const candidate = state.players[(btnIdx + step) % state.players.length];
    if (!candidate.eliminated && !candidate.inFantasyLand) order.push(candidate);
  }
  return order;
}

export function isHandComplete(state: OfcState): boolean {
  return aliveInOrder(state).every((p) =>
    p.inFantasyLand ? p.fantasyPlaced : gridSize(p.grid) === GRID_SIZE,
  );
}

export function initGame(
  players: Player[],
  startingStack: number = DEFAULT_STARTING_STACK,
  variant: OfcVariant = 'classic',
  rng: () => number = Math.random,
): OfcState {
  if (players.length < MIN_OFC_PLAYERS || players.length > MAX_OFC_PLAYERS) {
    throw new Error(`OFC requires ${MIN_OFC_PLAYERS}-${MAX_OFC_PLAYERS} players`);
  }
  if (!Number.isInteger(startingStack) || startingStack < 1) {
    throw new Error('OFC starting stack must be a positive integer');
  }
  const button = players[Math.floor(rng() * players.length)];
  return {
    phase: 'dealing',
    variant,
    handNumber: 1,
    players: players.map((p) => ({
      id: p.id,
      name: p.name,
      chips: startingStack,
      eliminated: false,
      grid: emptyGrid(),
      hand: [],
      discards: [],
      inFantasyLand: false,
      fantasyPlaced: false,
      fantasyCardCount: 0,
    })),
    buttonId: button.id,
    turnId: null,
    placeRound: 0,
    deck: [],
    pending: null,
    handResult: null,
    winnerId: null,
    version: 0,
  };
}

/**
 * Shuffles a fresh 52-card deck for the hand. The `deal` reducer distributes it
 * deterministically. Never exhausts: classic worst case is 3 Fantasy Land players
 * (39 cards); pineapple worst cases are 3 non-FL players (51), 3 FL players at the
 * 16-card maximum (48), or 2 FL at 16 plus 1 normal (32 + 5 + 4×3 = 49).
 */
export function createHandDeal(
  state: OfcState,
  rng: () => number = Math.random,
): Extract<OfcAction, { type: 'deal' }> {
  return { type: 'deal', playerId: state.buttonId, deck: shuffleWithRng(createDeck(), rng) };
}

// Stable, language-neutral error codes: the engine stays i18n-free, rendering sites
// translate via `ofc:errors.<code>` (the online protocol relays code + params, never
// pre-rendered text).
export type OfcErrorCode =
  | 'unknownPlayer'
  | 'eliminated'
  | 'notDealPhase'
  | 'badDeck'
  | 'notPlacingPhase'
  | 'notYourTurn'
  | 'notInitialRound'
  | 'wrongPlacementCount'
  | 'cardNotInHand'
  | 'duplicatePlacement'
  | 'rowOverCapacity'
  | 'noPendingCard'
  | 'notInFantasyLand'
  | 'alreadyPlacedFantasy'
  | 'fantasyRowMismatch'
  | 'handNotScored';

export interface OfcValidationError {
  code: OfcErrorCode;
  // Interpolation values for the error message (e.g. { expected: 5 }).
  params?: Record<string, number>;
}

export type OfcValidationResult = { ok: true } | ({ ok: false } & OfcValidationError);

function checkPlacementCards(placements: OfcPlacement[], hand: Card[]): OfcValidationResult {
  const handKeys = new Set(hand.map(cardKey));
  const seen = new Set<string>();
  for (const placement of placements) {
    const key = cardKey(placement.card);
    if (seen.has(key)) return { ok: false, code: 'duplicatePlacement' };
    seen.add(key);
    if (!handKeys.has(key)) return { ok: false, code: 'cardNotInHand' };
  }
  return { ok: true };
}

function rowCounts(placements: OfcPlacement[]): Record<RowId, number> {
  const counts: Record<RowId, number> = { top: 0, middle: 0, bottom: 0 };
  for (const placement of placements) counts[placement.row] += 1;
  return counts;
}

function checkRowCapacity(grid: OfcGrid, placements: OfcPlacement[]): OfcValidationResult {
  const counts = rowCounts(placements);
  for (const row of ROW_IDS) {
    if (grid[row].length + counts[row] > ROW_CAPACITY[row]) {
      return { ok: false, code: 'rowOverCapacity', params: { cap: ROW_CAPACITY[row] } };
    }
  }
  return { ok: true };
}

export function validateAction(state: OfcState, action: OfcAction): OfcValidationResult {
  const player = state.players.find((p) => p.id === action.playerId);
  if (!player) return { ok: false, code: 'unknownPlayer' };
  if (player.eliminated) return { ok: false, code: 'eliminated' };

  switch (action.type) {
    case 'deal': {
      if (state.phase !== 'dealing') return { ok: false, code: 'notDealPhase' };
      if (action.deck.length !== 52) return { ok: false, code: 'badDeck' };
      const seen = new Set(action.deck.map(cardKey));
      if (seen.size !== 52) return { ok: false, code: 'badDeck' };
      return { ok: true };
    }
    case 'placeInitial': {
      if (state.phase !== 'placing') return { ok: false, code: 'notPlacingPhase' };
      if (state.placeRound !== 0) return { ok: false, code: 'notInitialRound' };
      if (action.playerId !== state.turnId) return { ok: false, code: 'notYourTurn' };
      if (action.placements.length !== INITIAL_SET_SIZE) {
        return { ok: false, code: 'wrongPlacementCount', params: { expected: INITIAL_SET_SIZE } };
      }
      const cardsOk = checkPlacementCards(action.placements, player.hand);
      if (!cardsOk.ok) return cardsOk;
      return checkRowCapacity(player.grid, action.placements);
    }
    case 'placeDraw': {
      if (state.phase !== 'placing') return { ok: false, code: 'notPlacingPhase' };
      if (!state.pending) return { ok: false, code: 'noPendingCard' };
      if (state.pending.playerId !== action.playerId || state.turnId !== action.playerId) {
        return { ok: false, code: 'notYourTurn' };
      }
      const cfg = variantConfig(state);
      // The Array.isArray guard shields the online host from malformed guest payloads
      // (e.g. the pre-Pineapple `{ row }` action shape from an outdated build).
      if (!Array.isArray(action.placements) || action.placements.length !== cfg.placeCount) {
        return { ok: false, code: 'wrongPlacementCount', params: { expected: cfg.placeCount } };
      }
      const cardsOk = checkPlacementCards(action.placements, state.pending.cards);
      if (!cardsOk.ok) return cardsOk;
      return checkRowCapacity(player.grid, action.placements);
    }
    case 'placeFantasy': {
      if (state.phase !== 'placing') return { ok: false, code: 'notPlacingPhase' };
      if (!player.inFantasyLand) return { ok: false, code: 'notInFantasyLand' };
      if (player.fantasyPlaced) return { ok: false, code: 'alreadyPlacedFantasy' };
      // Always 13 placed — in pineapple the 14th hand card becomes the discard.
      if (action.placements.length !== GRID_SIZE) {
        return { ok: false, code: 'wrongPlacementCount', params: { expected: GRID_SIZE } };
      }
      const cardsOk = checkPlacementCards(action.placements, player.hand);
      if (!cardsOk.ok) return cardsOk;
      const counts = rowCounts(action.placements);
      for (const row of ROW_IDS) {
        if (counts[row] !== ROW_CAPACITY[row]) return { ok: false, code: 'fantasyRowMismatch' };
      }
      return { ok: true };
    }
    case 'nextHand':
      if (state.phase !== 'scoring') return { ok: false, code: 'handNotScored' };
      return { ok: true };
  }
}

function applyPlacements(grid: OfcGrid, placements: OfcPlacement[]): OfcGrid {
  const next: OfcGrid = { top: [...grid.top], middle: [...grid.middle], bottom: [...grid.bottom] };
  for (const placement of placements) next[placement.row].push(placement.card);
  return next;
}

function leftoverCards(dealt: Card[], placements: OfcPlacement[]): Card[] {
  const placed = new Set(placements.map((p) => cardKey(p.card)));
  return dealt.filter((c) => !placed.has(cardKey(c)));
}

/**
 * If every alive player is done placing, freeze the hand result and settle chips.
 * Runs after ALL placement reducers — a Fantasy Land commit arriving after the rotation
 * finished is the normal completion path, not an edge case.
 */
function finalizeIfComplete(state: OfcState): OfcState {
  if (!isHandComplete(state)) return state;
  const result = scoreHand(
    aliveInOrder(state).map((p) => ({
      id: p.id,
      grid: p.grid,
      inFantasyLand: p.inFantasyLand,
      chips: p.chips,
    })),
  );
  return {
    ...state,
    phase: 'scoring',
    turnId: null,
    pending: null,
    handResult: result,
    players: state.players.map((p) => {
      if (p.eliminated) return p;
      const chips = p.chips + (result.chipDelta[p.id] ?? 0);
      return { ...p, chips, eliminated: chips === 0 };
    }),
  };
}

/**
 * Advances the rotation after a non-Fantasy-Land placement: next player in order, or the
 * next draw round (popping the variant's dealSize cards from the deck), or rotation done.
 */
function advanceRotation(state: OfcState, actorId: string): OfcState {
  const cfg = variantConfig(state);
  const order = placementOrder(state);
  const idx = order.findIndex((p) => p.id === actorId);
  const lastOfRound = idx === order.length - 1;

  if (!lastOfRound) {
    const nextId = order[idx + 1].id;
    if (state.placeRound === 0) return { ...state, turnId: nextId };
    return {
      ...state,
      turnId: nextId,
      pending: { playerId: nextId, cards: state.deck.slice(0, cfg.dealSize) },
      deck: state.deck.slice(cfg.dealSize),
    };
  }
  if (state.placeRound < cfg.drawRounds) {
    const firstId = order[0].id;
    return {
      ...state,
      placeRound: state.placeRound + 1,
      turnId: firstId,
      pending: { playerId: firstId, cards: state.deck.slice(0, cfg.dealSize) },
      deck: state.deck.slice(cfg.dealSize),
    };
  }
  return { ...state, turnId: null, pending: null };
}

/** Pure transition. Throws on invalid actions — callers gate through validateAction first. */
export function reduce(state: OfcState, action: OfcAction): OfcState {
  const valid = validateAction(state, action);
  if (!valid.ok) throw new Error(`Invalid OFC action: ${valid.code}`);

  switch (action.type) {
    case 'deal': {
      const cfg = variantConfig(state);
      let cursor = 0;
      const players = state.players.map((p) => {
        if (p.eliminated) return p;
        const take = p.inFantasyLand ? p.fantasyCardCount || cfg.fantasyHandSize : INITIAL_SET_SIZE;
        const hand = action.deck.slice(cursor, cursor + take);
        cursor += take;
        return { ...p, hand, grid: emptyGrid(), discards: [], fantasyPlaced: false };
      });
      const dealt: OfcState = {
        ...state,
        phase: 'placing',
        players,
        placeRound: 0,
        deck: action.deck.slice(cursor),
        pending: null,
        handResult: null,
        version: state.version + 1,
      };
      // All-Fantasy-Land hands have no rotation at all — they complete via placeFantasy.
      const order = placementOrder(dealt);
      return { ...dealt, turnId: order[0]?.id ?? null };
    }
    case 'placeInitial': {
      const placed: OfcState = {
        ...state,
        players: state.players.map((p) =>
          p.id === action.playerId
            ? { ...p, grid: applyPlacements(p.grid, action.placements), hand: [] }
            : p,
        ),
        version: state.version + 1,
      };
      return finalizeIfComplete(advanceRotation(placed, action.playerId));
    }
    case 'placeDraw': {
      // Empty in classic (1 dealt, 1 placed); the hidden discard in pineapple.
      const thrown = leftoverCards(state.pending!.cards, action.placements);
      const placed: OfcState = {
        ...state,
        players: state.players.map((p) =>
          p.id === action.playerId
            ? {
                ...p,
                grid: applyPlacements(p.grid, action.placements),
                discards: [...p.discards, ...thrown],
              }
            : p,
        ),
        pending: null,
        version: state.version + 1,
      };
      return finalizeIfComplete(advanceRotation(placed, action.playerId));
    }
    case 'placeFantasy': {
      const player = state.players.find((p) => p.id === action.playerId)!;
      const thrown = leftoverCards(player.hand, action.placements);
      const placed: OfcState = {
        ...state,
        players: state.players.map((p) =>
          p.id === action.playerId
            ? {
                ...p,
                grid: applyPlacements(emptyGrid(), action.placements),
                hand: [],
                discards: [...p.discards, ...thrown],
                fantasyPlaced: true,
              }
            : p,
        ),
        version: state.version + 1,
      };
      return finalizeIfComplete(placed);
    }
    case 'nextHand': {
      const alive = state.players.filter((p) => !p.eliminated);
      if (alive.length === 1) {
        return {
          ...state,
          phase: 'gameOver',
          winnerId: alive[0].id,
          turnId: null,
          pending: null,
          deck: [],
          version: state.version + 1,
        };
      }
      const fantasyNext = state.handResult!.perPlayer;
      const cfg = variantConfig(state);
      const enters = (p: OfcPlayerState) => !p.eliminated && (fantasyNext[p.id]?.fantasyNext ?? false);
      // Standard Fantasy Land rule: the button freezes for the whole fantasy hand and
      // rotates again on the first normal hand after it.
      const fantasyHandComing = state.players.some(enters);
      return {
        ...state,
        phase: 'dealing',
        handNumber: state.handNumber + 1,
        buttonId: fantasyHandComing ? state.buttonId : nextAliveAfter(state, state.buttonId),
        turnId: null,
        placeRound: 0,
        deck: [],
        pending: null,
        // handResult stays visible through 'dealing' (Bluff pattern) — cleared by `deal`.
        players: state.players.map((p) => ({
          ...p,
          grid: emptyGrid(),
          hand: [],
          discards: [],
          inFantasyLand: enters(p),
          fantasyPlaced: false,
          fantasyCardCount: enters(p)
            ? state.variant === 'pineapple'
              ? (fantasyNext[p.id]?.fantasyCards ?? cfg.fantasyHandSize)
              : cfg.fantasyHandSize
            : 0,
        })),
        version: state.version + 1,
      };
    }
  }
}
