import { RANKS, SUITS } from '../types/hand';
import type { Card, Rank } from '../types/hand';

export type HandCategory = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

// Stable ids matching the bluff ClaimCategory union (plus 'highCard') — translated at
// render via t(`poker:handCategories.${categoryId}`). This lib stays translation-free.
export type HandCategoryId =
  | 'highCard'
  | 'pair'
  | 'twoPair'
  | 'trips'
  | 'straight'
  | 'flush'
  | 'fullHouse'
  | 'quads'
  | 'straightFlush'
  | 'royalFlush';

export interface HandScore {
  category: HandCategory;
  tiebreakers: number[];
  categoryId: HandCategoryId;
  cards: Card[];
}

export type FlipGameType = 'holdem' | 'omaha';

export const RANK_VALUE: Record<Rank, number> = {
  '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9,
  T: 10, J: 11, Q: 12, K: 13, A: 14,
};

const CATEGORY_IDS: Record<HandCategory, HandCategoryId> = {
  0: 'highCard',
  1: 'pair',
  2: 'twoPair',
  3: 'trips',
  4: 'straight',
  5: 'flush',
  6: 'fullHouse',
  7: 'quads',
  8: 'straightFlush',
};

function getCategoryId(category: HandCategory, tiebreakers: number[]): HandCategoryId {
  if (category === 8 && tiebreakers[0] === 14) return 'royalFlush';
  return CATEGORY_IDS[category];
}

export function combinations<T>(items: T[], k: number): T[][] {
  if (k === 0) return [[]];
  if (k > items.length) return [];

  const result: T[][] = [];
  const combo: T[] = [];

  function backtrack(start: number) {
    if (combo.length === k) {
      result.push([...combo]);
      return;
    }
    for (let i = start; i < items.length; i++) {
      combo.push(items[i]);
      backtrack(i + 1);
      combo.pop();
    }
  }

  backtrack(0);
  return result;
}

export function createDeck(): Card[] {
  return RANKS.flatMap((rank) => SUITS.map((suit) => ({ rank, suit })));
}

function detectStraightHigh(uniqueDescValues: number[]): number | null {
  const valueSet = new Set(uniqueDescValues);
  if (valueSet.has(14) && valueSet.has(2) && valueSet.has(3) && valueSet.has(4) && valueSet.has(5)) {
    // Wheel (A-2-3-4-5) is checked independently of the consecutive-run check below,
    // since Ace(14) and 2-5 are not numerically consecutive.
    if (uniqueDescValues.length === 5 && uniqueDescValues[0] === 14 && uniqueDescValues[4] === 2) {
      return 5;
    }
  }
  if (uniqueDescValues.length === 5 && uniqueDescValues[0] - uniqueDescValues[4] === 4) {
    return uniqueDescValues[0];
  }
  return null;
}

/** Evaluates exactly 5 cards into a comparable HandScore. */
export function evaluateFiveCardHand(cards: Card[]): HandScore {
  const values = cards.map((c) => RANK_VALUE[c.rank]);
  const suitCounts = new Map<string, number>();
  for (const c of cards) suitCounts.set(c.suit, (suitCounts.get(c.suit) ?? 0) + 1);
  const isFlush = [...suitCounts.values()].some((count) => count === 5);

  const uniqueDesc = [...new Set(values)].sort((a, b) => b - a);
  const straightHigh = detectStraightHigh(uniqueDesc);

  const rankCounts = new Map<number, number>();
  for (const v of values) rankCounts.set(v, (rankCounts.get(v) ?? 0) + 1);
  const countsSortedDesc = [...rankCounts.entries()].sort((a, b) => (b[1] - a[1]) || (b[0] - a[0]));
  const countsPattern = countsSortedDesc.map(([, count]) => count);
  const valuesDesc = [...values].sort((a, b) => b - a);

  let category: HandCategory;
  let tiebreakers: number[];

  if (isFlush && straightHigh !== null) {
    category = 8;
    tiebreakers = [straightHigh];
  } else if (countsPattern[0] === 4) {
    category = 7;
    tiebreakers = [countsSortedDesc[0][0], countsSortedDesc[1][0]];
  } else if (countsPattern[0] === 3 && countsPattern[1] === 2) {
    category = 6;
    tiebreakers = [countsSortedDesc[0][0], countsSortedDesc[1][0]];
  } else if (isFlush) {
    category = 5;
    tiebreakers = valuesDesc;
  } else if (straightHigh !== null) {
    category = 4;
    tiebreakers = [straightHigh];
  } else if (countsPattern[0] === 3) {
    category = 3;
    tiebreakers = [countsSortedDesc[0][0], countsSortedDesc[1][0], countsSortedDesc[2][0]];
  } else if (countsPattern[0] === 2 && countsPattern[1] === 2) {
    const [pairA, pairB] = [countsSortedDesc[0][0], countsSortedDesc[1][0]].sort((a, b) => b - a);
    category = 2;
    tiebreakers = [pairA, pairB, countsSortedDesc[2][0]];
  } else if (countsPattern[0] === 2) {
    category = 1;
    tiebreakers = [countsSortedDesc[0][0], countsSortedDesc[1][0], countsSortedDesc[2][0], countsSortedDesc[3][0]];
  } else {
    category = 0;
    tiebreakers = valuesDesc;
  }

  return { category, tiebreakers, categoryId: getCategoryId(category, tiebreakers), cards };
}

export function compareHandScores(a: HandScore, b: HandScore): number {
  if (a.category !== b.category) return a.category - b.category;
  for (let i = 0; i < a.tiebreakers.length; i++) {
    const diff = a.tiebreakers[i] - b.tiebreakers[i];
    if (diff !== 0) return diff;
  }
  return 0;
}

function bestOf(candidates: Card[][]): HandScore {
  let best: HandScore | null = null;
  for (const candidate of candidates) {
    const score = evaluateFiveCardHand(candidate);
    if (!best || compareHandScores(score, best) > 0) best = score;
  }
  if (!best) throw new Error('No candidate hands to evaluate');
  return best;
}

export function evaluateBestHandHoldem(holeCards: [Card, Card], board: Card[]): HandScore {
  if (board.length !== 5) throw new Error('evaluateBestHandHoldem requires a full 5-card board');
  return bestOf(combinations([...holeCards, ...board], 5));
}

export function evaluateBestHandOmaha(holeCards: [Card, Card, Card, Card], board: Card[]): HandScore {
  if (board.length !== 5) throw new Error('evaluateBestHandOmaha requires a full 5-card board');
  const holePairs = combinations(holeCards, 2);
  const boardTriples = combinations(board, 3);
  const candidates = holePairs.flatMap((pair) => boardTriples.map((triple) => [...pair, ...triple]));
  return bestOf(candidates);
}

export function evaluateBestHand(gameType: FlipGameType, holeCards: Card[], board: Card[]): HandScore {
  if (gameType === 'holdem') return evaluateBestHandHoldem(holeCards as [Card, Card], board);
  return evaluateBestHandOmaha(holeCards as [Card, Card, Card, Card], board);
}

export function findWorstHands(scores: { playerId: string; score: HandScore }[]): string[] {
  if (scores.length === 0) return [];
  let worst = scores[0].score;
  for (const { score } of scores) {
    if (compareHandScores(score, worst) < 0) worst = score;
  }
  return scores.filter(({ score }) => compareHandScores(score, worst) === 0).map(({ playerId }) => playerId);
}

export function findBestHands(scores: { playerId: string; score: HandScore }[]): string[] {
  if (scores.length === 0) return [];
  let best = scores[0].score;
  for (const { score } of scores) {
    if (compareHandScores(score, best) > 0) best = score;
  }
  return scores.filter(({ score }) => compareHandScores(score, best) === 0).map(({ playerId }) => playerId);
}
