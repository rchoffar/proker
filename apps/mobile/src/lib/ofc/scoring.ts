import type { OfcGrid, RowId, RowScores } from './evaluator';
import {
  RE_FANTASY_SIZE,
  ROW_IDS,
  bottomRoyalty,
  compareRows,
  evaluateGrid,
  fantasyEntrySize,
  isFouled,
  middleRoyalty,
  qualifiesFantasy,
  staysFantasy,
  topRoyalty,
} from './evaluator';

// Hand resolution: pairwise 1-6 scoring with royalties netting, then chip settlement.
// Zero-sum by construction — every point that leaves one stack lands in another.

export const FOUL_PENALTY = 6;
export const SCOOP_BONUS = 3;

export interface OfcRoyalties {
  top: number;
  middle: number;
  bottom: number;
  total: number;
}

export interface OfcPlayerHandResult {
  playerId: string;
  fouled: boolean;
  rows: RowScores;
  royalties: OfcRoyalties; // zeroed when fouled
  fantasyNext: boolean; // qualifies for (or stays in) Fantasy Land next hand
  // Progressive pineapple deal earned for next hand: entry QQ→14, KK→15, AA/trips→16,
  // re-fantasy always 16. Zero when fantasyNext is false; ignored by the classic variant.
  fantasyCards: number;
}

export interface OfcPairResult {
  aId: string;
  bId: string;
  // +1 = a won the row, -1 = b won, 0 = tie. All zeros when either side fouled.
  lineWins: Record<RowId, number>;
  scoopBy: string | null;
  points: number; // signed net from a's perspective, before stack capping
  chips: number; // actual signed transfer applied, after capping
  capped: boolean;
}

export interface OfcHandResult {
  perPlayer: Record<string, OfcPlayerHandResult>;
  pairs: OfcPairResult[]; // settlement order = array order
  chipDelta: Record<string, number>;
  eliminatedIds: string[];
}

export interface ScoringInput {
  id: string;
  grid: OfcGrid;
  inFantasyLand: boolean;
  chips: number;
}

function playerResult(player: ScoringInput): OfcPlayerHandResult {
  const rows = evaluateGrid(player.grid);
  const fouled = isFouled(rows);
  const royalties = fouled
    ? { top: 0, middle: 0, bottom: 0, total: 0 }
    : (() => {
        const top = topRoyalty(rows.top);
        const middle = middleRoyalty(rows.middle);
        const bottom = bottomRoyalty(rows.bottom);
        return { top, middle, bottom, total: top + middle + bottom };
      })();
  const fantasyNext = player.inFantasyLand ? staysFantasy(rows) : qualifiesFantasy(rows);
  return {
    playerId: player.id,
    fouled,
    rows,
    royalties,
    fantasyNext,
    fantasyCards: fantasyNext ? (player.inFantasyLand ? RE_FANTASY_SIZE : fantasyEntrySize(rows)) : 0,
  };
}

function pairPoints(a: OfcPlayerHandResult, b: OfcPlayerHandResult): Omit<OfcPairResult, 'chips' | 'capped'> {
  const base = { aId: a.playerId, bId: b.playerId };
  const zeroLines: Record<RowId, number> = { top: 0, middle: 0, bottom: 0 };

  if (a.fouled && b.fouled) return { ...base, lineWins: zeroLines, scoopBy: null, points: 0 };
  // A foul scoops itself: 6 points plus the standing player's royalties.
  if (a.fouled) return { ...base, lineWins: zeroLines, scoopBy: null, points: -(FOUL_PENALTY + b.royalties.total) };
  if (b.fouled) return { ...base, lineWins: zeroLines, scoopBy: null, points: FOUL_PENALTY + a.royalties.total };

  const lineWins = { top: 0, middle: 0, bottom: 0 } as Record<RowId, number>;
  for (const row of ROW_IDS) lineWins[row] = Math.sign(compareRows(a.rows[row], b.rows[row]));
  const lineSum = lineWins.top + lineWins.middle + lineWins.bottom;
  // Scoop = all three rows won strictly; any tied row kills it.
  const scoopBy = lineSum === 3 ? a.playerId : lineSum === -3 ? b.playerId : null;
  const scoop = lineSum === 3 ? SCOOP_BONUS : lineSum === -3 ? -SCOOP_BONUS : 0;
  const points = lineSum + scoop + (a.royalties.total - b.royalties.total);
  return { ...base, lineWins, scoopBy, points };
}

/**
 * Scores a completed hand between 2-3 players and settles chips.
 *
 * Settlement is sequential in seat order — (0,1), (0,2), (1,2) — and each transfer is
 * capped at the payer's chips at that moment, so wins collected earlier can fund later
 * losses, no stack goes negative, and the total chip count is conserved. Earlier pairs
 * are favored when a stack busts mid-settlement; deterministic on every device.
 */
export function scoreHand(players: ScoringInput[]): OfcHandResult {
  const perPlayer: Record<string, OfcPlayerHandResult> = {};
  for (const p of players) perPlayer[p.id] = playerResult(p);

  const balances = new Map(players.map((p) => [p.id, p.chips]));
  const pairs: OfcPairResult[] = [];
  for (let i = 0; i < players.length; i++) {
    for (let j = i + 1; j < players.length; j++) {
      const pair = pairPoints(perPlayer[players[i].id], perPlayer[players[j].id]);
      const payerId = pair.points >= 0 ? pair.bId : pair.aId;
      const transfer = Math.min(Math.abs(pair.points), balances.get(payerId)!);
      const chips = pair.points >= 0 ? transfer : -transfer;
      balances.set(pair.aId, balances.get(pair.aId)! + chips);
      balances.set(pair.bId, balances.get(pair.bId)! - chips);
      pairs.push({ ...pair, chips, capped: transfer < Math.abs(pair.points) });
    }
  }

  const chipDelta: Record<string, number> = {};
  for (const p of players) chipDelta[p.id] = balances.get(p.id)! - p.chips;
  const eliminatedIds = players.filter((p) => balances.get(p.id) === 0).map((p) => p.id);

  return { perPlayer, pairs, chipDelta, eliminatedIds };
}
