import { evaluateBestHandHoldem, type HandScore } from './pokerHandEvaluator';
import { winningCardKeys } from './handStrength';
import { estimateEquity, hashSeed, seededRng } from './equity';
import type { Beat } from './handReplay';
import type { Card, HandHistory } from '../types';

// The replayer's showdown analysis: who wins, which cards win it, and whether the run-out
// is live. All pure and seeded, so the same hand always produces the same numbers — and so
// it can be tested, which none of it could be while it lived in useMemos inside
// app/hand-replayer/play.tsx.
//
// A `detectBadBeat` used to live here, staging a "he was only at 13%" burst on the river.
// Mathieu asked for it gone: that kind of animation belongs to Flip, not to a hand you are
// narrating. Removed with its overlay rather than left unused (30/08 feedback).

export interface ShowdownEval {
  scores: Map<string, HandScore>;
  /** Null unless EVERY stored winner's hand is computable — winners may be entered
   *  manually with hidden cards, and then nothing should dim. */
  winningKeys: Set<string> | null;
}

export function evaluateShowdown(hand: HandHistory): ShowdownEval | null {
  const { flop, turn, river } = hand.board;
  const board = flop && turn && river ? [...flop, turn, river] : null;
  const scores = new Map<string, HandScore>();
  if (board) {
    for (const p of hand.players) {
      if (p.isFolded || !p.cardsKnown || !p.holeCards) continue;
      scores.set(p.id, evaluateBestHandHoldem(p.holeCards, board));
    }
  }
  const winnerScores = (hand.winnerIds ?? []).map((id) => scores.get(id));
  const winningKeys =
    winnerScores.length > 0 && winnerScores.every(Boolean)
      ? winningCardKeys(winnerScores as HandScore[])
      : null;
  return { scores, winningKeys };
}

/**
 * The beat from which everyone is all-in and cards are tabled, so the win-chance readout
 * can run live with each card. Null when the hand is decided by betting — the stats would
 * only ever read 100/0 at showdown, so none are shown.
 */
export function allInRevealIndex(beats: Beat[]): number | null {
  let lastActions = -1;
  beats.forEach((b, i) => {
    if (b.kind === 'street' && b.actions.length > 0) lastActions = i;
  });
  const runOut = beats.some((b, i) => i > lastActions && b.kind === 'street' && b.revealsCards);
  return runOut ? lastActions + 1 : null;
}

/**
 * A cheap beat-derived cache key — board length plus who has folded — so the Monte-Carlo
 * below re-runs only when its inputs actually change, not on every tap. Null outside an
 * all-in run-out, and computed from the LAGGED cursor so a new card only moves the numbers
 * once its flip has landed.
 */
export function equityCacheKey(
  beats: Beat[],
  statsIndex: number,
  allInFrom: number | null
): string | null {
  if (allInFrom === null || statsIndex < allInFrom) return null;
  const upTo = beats.slice(0, statsIndex + 1);
  let boardLen = 0;
  upTo.forEach((b) => {
    if (b.kind === 'street' && b.revealsCards) boardLen += b.street === 'flop' ? 3 : 1;
  });
  const folded = upTo
    .filter((b): b is Extract<Beat, { kind: 'street' }> => b.kind === 'street')
    .flatMap((b) => b.actions)
    .filter((a) => a.type === 'fold')
    .map((a) => a.playerId)
    .sort();
  return `${boardLen}|${folded.join(',')}`;
}

function fullBoard(hand: HandHistory): Card[] {
  return [
    ...(hand.board.flop ?? []),
    ...(hand.board.turn ? [hand.board.turn] : []),
    ...(hand.board.river ? [hand.board.river] : []),
  ];
}

/**
 * Live chance of taking the pot given the cards revealed so far; unknown villains are
 * dealt randomly. Seeded on the hand id + cache key, so revisiting a street shows the same
 * numbers instead of jittering.
 */
export function equityForKey(hand: HandHistory, key: string): Map<string, number> | null {
  const [boardLenStr, foldedStr] = key.split('|');
  const folded = new Set(foldedStr ? foldedStr.split(',') : []);
  const board = fullBoard(hand).slice(0, Number(boardLenStr));
  const contenders = hand.players
    .filter((p) => !folded.has(p.id))
    .map((p) => ({ id: p.id, holeCards: p.cardsKnown && p.holeCards ? p.holeCards : null }));
  if (contenders.length < 2) return null;
  return estimateEquity(contenders, board, 'holdem', seededRng(hashSeed(`${hand.id}|${key}`)));
}

