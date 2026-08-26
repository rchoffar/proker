import type { Card } from '../../types/hand';
import type { HandCategory, HandScore } from '../pokerHandEvaluator';
import { RANK_VALUE, evaluateFiveCardHand } from '../pokerHandEvaluator';

// OFC row evaluation on top of the shared 5-card evaluator. The 3-card top row shares
// the same 0-8 category scale so cross-row comparisons (foul check) work: a middle
// straight (4) naturally beats top trips (3).

export type RowId = 'top' | 'middle' | 'bottom';

export const ROW_CAPACITY: Record<RowId, number> = { top: 3, middle: 5, bottom: 5 };
export const ROW_IDS: RowId[] = ['top', 'middle', 'bottom'];

export interface OfcGrid {
  top: Card[];
  middle: Card[];
  bottom: Card[];
}

export interface RowScores {
  top: HandScore;
  middle: HandScore;
  bottom: HandScore;
}

/**
 * Evaluates exactly 3 cards: trips, pair or high card only — straights and flushes do
 * not exist on the OFC top row.
 */
export function evaluateTopHand(cards: Card[]): HandScore {
  if (cards.length !== 3) throw new Error('evaluateTopHand requires exactly 3 cards');
  const values = cards.map((c) => RANK_VALUE[c.rank]).sort((a, b) => b - a);

  let category: HandCategory;
  let tiebreakers: number[];
  if (values[0] === values[2]) {
    category = 3;
    tiebreakers = [values[0]];
  } else if (values[0] === values[1] || values[1] === values[2]) {
    const pairValue = values[1]; // middle value always belongs to the pair
    const kicker = values[0] === values[1] ? values[2] : values[0];
    category = 1;
    tiebreakers = [pairValue, kicker];
  } else {
    category = 0;
    tiebreakers = values;
  }

  const categoryId = category === 3 ? 'trips' : category === 1 ? 'pair' : 'highCard';
  return { category, tiebreakers, categoryId, cards };
}

/**
 * Row-safe comparison. `compareHandScores` iterates the LEFT side's tiebreakers and
 * yields NaN when a 3-card score meets a 5-card score (shorter array on the right), so
 * cross-row comparisons must go through this instead: compare over the common prefix,
 * an exhausted side ties.
 */
export function compareRows(a: HandScore, b: HandScore): number {
  if (a.category !== b.category) return a.category - b.category;
  const n = Math.min(a.tiebreakers.length, b.tiebreakers.length);
  for (let i = 0; i < n; i++) {
    const diff = a.tiebreakers[i] - b.tiebreakers[i];
    if (diff !== 0) return diff;
  }
  return 0;
}

/** Evaluates a complete 3/5/5 grid. Throws if any row is not full. */
export function evaluateGrid(grid: OfcGrid): RowScores {
  return {
    top: evaluateTopHand(grid.top),
    middle: evaluateFiveCardHand(grid.middle),
    bottom: evaluateFiveCardHand(grid.bottom),
  };
}

/** Foul = the golden rule bottom ≥ middle ≥ top is broken. Equal rows are legal. */
export function isFouled(rows: RowScores): boolean {
  return compareRows(rows.bottom, rows.middle) < 0 || compareRows(rows.middle, rows.top) < 0;
}

// ── Royalties (spec tables, points independent of winning the row) ──────────────

/** Top: pair of 6s..As = 1..9; trips 2s..As = 10..22. Smaller pairs earn nothing. */
export function topRoyalty(top: HandScore): number {
  if (top.categoryId === 'trips') return top.tiebreakers[0] + 8;
  if (top.categoryId === 'pair' && top.tiebreakers[0] >= 6) return top.tiebreakers[0] - 5;
  return 0;
}

const MIDDLE_ROYALTIES: Partial<Record<HandScore['categoryId'], number>> = {
  trips: 2,
  straight: 4,
  flush: 8,
  fullHouse: 12,
  quads: 20,
  straightFlush: 30,
  royalFlush: 50,
};

const BOTTOM_ROYALTIES: Partial<Record<HandScore['categoryId'], number>> = {
  straight: 2,
  flush: 4,
  fullHouse: 6,
  quads: 10,
  straightFlush: 15,
  royalFlush: 25,
};

export function middleRoyalty(score: HandScore): number {
  return MIDDLE_ROYALTIES[score.categoryId] ?? 0;
}

export function bottomRoyalty(score: HandScore): number {
  return BOTTOM_ROYALTIES[score.categoryId] ?? 0;
}

// ── Fantasy Land ────────────────────────────────────────────────────────────────

export const FANTASY_MIN_PAIR = RANK_VALUE.Q;

/** Enter Fantasy Land: QQ or better on top (pair ≥ QQ, or trips) without fouling. */
export function qualifiesFantasy(rows: RowScores): boolean {
  if (isFouled(rows)) return false;
  if (rows.top.categoryId === 'trips') return true;
  return rows.top.categoryId === 'pair' && rows.top.tiebreakers[0] >= FANTASY_MIN_PAIR;
}

/** Stay in Fantasy Land: trips on top, or a straight flush+ on the bottom. */
export function staysFantasy(rows: RowScores): boolean {
  if (isFouled(rows)) return false;
  return rows.top.categoryId === 'trips' || rows.bottom.category >= 8;
}

/** A re-fantasy (staying) always deals 16 cards, whatever hand earned it. */
export const RE_FANTASY_SIZE = 16;

/**
 * Progressive Fantasy Land deal (pineapple): the qualifying top decides the size —
 * QQ → 14, KK → 15, AA or trips → 16. Only meaningful when qualifiesFantasy is true.
 */
export function fantasyEntrySize(rows: RowScores): number {
  if (rows.top.categoryId === 'trips') return 16;
  return 14 + (rows.top.tiebreakers[0] - FANTASY_MIN_PAIR);
}
