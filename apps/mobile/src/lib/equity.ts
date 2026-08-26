import { compareHandScores, createDeck, evaluateBestHand } from './pokerHandEvaluator';
import type { FlipGameType, HandScore } from './pokerHandEvaluator';
import { cardKey } from '../types/hand';
import type { Card } from '../types/hand';

export interface EquityContender {
  id: string;
  /** null = unknown hand, dealt randomly on every simulated run-out. */
  holeCards: Card[] | null;
}

/** How many simulated run-outs estimateEquity averages over (fewer for Omaha, whose per-run evaluation is ~3× dearer). */
const TRIALS: Record<FlipGameType, number> = { holdem: 300, omaha: 150 };

/**
 * Deterministic PRNG (mulberry32) — replay beats reuse the same seed so revisiting a
 * street shows the same estimate instead of jittering a few points on every visit.
 */
export function seededRng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** FNV-1a of a string, for deriving a seededRng seed from ids/keys. */
export function hashSeed(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/**
 * Chance (0–100, rounded) of each contender winning the pot given the board so far.
 * Exact when the board is complete and every hand is known; otherwise a Monte-Carlo
 * average over random run-outs (unknown hands are dealt randomly each run). Ties split
 * the win, so a guaranteed chop reads 100/n rather than 100 for everyone.
 */
export function estimateEquity(
  contenders: EquityContender[],
  board: Card[],
  gameType: FlipGameType = 'holdem',
  rng: () => number = Math.random
): Map<string, number> {
  const result = new Map<string, number>();
  if (contenders.length === 0) return result;
  if (contenders.length === 1) {
    result.set(contenders[0].id, 100);
    return result;
  }

  const holeCount = gameType === 'omaha' ? 4 : 2;
  const missingBoard = 5 - board.length;
  const unknownCount = contenders.filter((c) => !c.holeCards).length;

  if (missingBoard === 0 && unknownCount === 0) {
    const scores = contenders.map((c) => ({ id: c.id, score: evaluateBestHand(gameType, c.holeCards!, board) }));
    let best = scores[0].score;
    for (const { score } of scores) if (compareHandScores(score, best) > 0) best = score;
    const winners = scores.filter(({ score }) => compareHandScores(score, best) === 0);
    for (const c of contenders) result.set(c.id, 0);
    for (const { id } of winners) result.set(id, Math.round(100 / winners.length));
    return result;
  }

  const used = new Set(board.map(cardKey));
  for (const c of contenders) c.holeCards?.forEach((card) => used.add(cardKey(card)));
  const deck = createDeck().filter((card) => !used.has(cardKey(card)));

  const need = missingBoard + unknownCount * holeCount;
  const trials = TRIALS[gameType];
  const wins = new Map(contenders.map((c) => [c.id, 0]));

  for (let trial = 0; trial < trials; trial++) {
    // Partial Fisher-Yates: only the first `need` slots have to be random.
    for (let i = 0; i < need; i++) {
      const j = i + Math.floor(rng() * (deck.length - i));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    const fullBoard = missingBoard > 0 ? [...board, ...deck.slice(0, missingBoard)] : board;
    let cursor = missingBoard;
    let best: HandScore | null = null;
    let winners: string[] = [];
    for (const c of contenders) {
      let holes = c.holeCards;
      if (!holes) {
        holes = deck.slice(cursor, cursor + holeCount);
        cursor += holeCount;
      }
      const score = evaluateBestHand(gameType, holes, fullBoard);
      const cmp = best ? compareHandScores(score, best) : 1;
      if (cmp > 0) {
        best = score;
        winners = [c.id];
      } else if (cmp === 0) {
        winners.push(c.id);
      }
    }
    for (const id of winners) wins.set(id, wins.get(id)! + 1 / winners.length);
  }

  for (const c of contenders) result.set(c.id, Math.round((wins.get(c.id)! / trials) * 100));
  return result;
}
