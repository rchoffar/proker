import type { HandScore } from './pokerHandEvaluator';
import { cardKey } from '../types/hand';

// Deliberate copies of design-system values — colors.loss, TABLE.gold, colors.accentBright.
// Strength is rendered on the theme-invariant felt (like the TABLE palette), and src/lib
// stays free of react imports, so the hexes live here rather than coming from ThemeProvider.
const LOW_COLOR = '#E5484D';
const MID_COLOR = '#E7C36F';
const HIGH_COLOR = '#17E58A';

function lerpChannel(a: number, b: number, u: number): number {
  return Math.round(a + (b - a) * u);
}

function lerpHex(from: string, to: string, u: number): string {
  const hex = (start: number, s: string) => parseInt(s.slice(start, start + 2), 16);
  const channels = [1, 3, 5].map((i) => lerpChannel(hex(i, from), hex(i, to), u));
  return `#${channels.map((c) => c.toString(16).padStart(2, '0').toUpperCase()).join('')}`;
}

/** Red (weak) → gold (medium) → green (strong) scale for a win-chance percent. */
export function strengthColor(percent: number): string {
  const p = Math.max(0, Math.min(100, percent));
  return p <= 50 ? lerpHex(LOW_COLOR, MID_COLOR, p / 50) : lerpHex(MID_COLOR, HIGH_COLOR, (p - 50) / 50);
}

/**
 * Union of the exact best-5 cards of all (tied) winners, as cardKey strings — on a split
 * pot every winner's used card stays active. HandScore.cards holds combination copies, so
 * membership is by key, never by reference.
 */
export function winningCardKeys(winnerScores: HandScore[]): Set<string> {
  return new Set(winnerScores.flatMap((s) => s.cards.map(cardKey)));
}
