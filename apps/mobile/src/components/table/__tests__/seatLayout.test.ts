import { describe, expect, it } from 'vitest';
import { fanReach, seatPoint, SEAT_LAYOUT_COUNTS } from '../seatLayout';
import { FAN_GEOMETRY, fanSizeFor } from '../fanGeometry';

// The bug this file exists to prevent: at 4 and 5 players the even ellipse spread put seats
// level with the felt centre, and SeatedTable then hung their card fans back over the
// community cards (Mathieu's 5-player Flip screenshot, 28/08). Widening the table does not
// fix that; only the seat angles do, and only while every count keeps its clearance.

// The felt centre holds the board plus the wordmark under it, as one centred stack.
const BOARD_HALF_H = FAN_GEOMETRY.md.cardH / 2 + 13;

// The shortest table any device gets (PLAY_TABLE clamps the height here). Every taller
// table only adds clearance, so pinning the floor pins them all.
const SHORTEST_TABLE_H = 420;

function fanEdgeTowardBoard(k: number, n: number, height: number, cardsPerHand: number) {
  const { y } = seatPoint(k, n, 320, height);
  const size = fanSizeFor(cardsPerHand, n);
  const g = FAN_GEOMETRY[size];
  // Fans point toward the felt: below the pod for top-half seats, above it for the rest —
  // the rule SeatedTable applies via `cardsBelowPod`.
  return y < height / 2 ? y + fanReach('down', g.aboveOffset, g.cardH) : y - fanReach('up', g.aboveOffset, g.cardH);
}

describe('seat layout', () => {
  // Hold'em deals 2 cards a seat, Omaha 4 — the two fan widths that reach the felt.
  for (const cardsPerHand of [2, 4]) {
    it(`keeps every fan clear of the board with ${cardsPerHand} cards per hand`, () => {
      for (const n of SEAT_LAYOUT_COUNTS) {
        for (let k = 0; k < n; k++) {
          const edge = fanEdgeTowardBoard(k, n, SHORTEST_TABLE_H, cardsPerHand);
          const gap = Math.abs(edge - SHORTEST_TABLE_H / 2) - BOARD_HALF_H;

          expect(gap, `seat ${k} of ${n} overlaps the board by ${Math.round(-gap)}pt`).toBeGreaterThanOrEqual(0);
        }
      }
    });
  }

  it('seats the hero along the bottom for every supported count', () => {
    for (const n of SEAT_LAYOUT_COUNTS) {
      const { y } = seatPoint(0, n, 320, 480);
      // Seat 0 is the local player, who always faces the table from the near side.
      expect(y, `seat 0 of ${n}`).toBeGreaterThan(400);
    }
  });

  it('splits four players two facing two rather than three against one', () => {
    const lower = Array.from({ length: 4 }, (_, k) => seatPoint(k, 4, 320, 480)).filter((p) => p.y > 240);
    expect(lower).toHaveLength(2);
  });

  it('gives every seat a distinct place', () => {
    for (const n of SEAT_LAYOUT_COUNTS) {
      const points = Array.from({ length: n }, (_, k) => {
        const { x, y } = seatPoint(k, n, 320, 480);
        return `${Math.round(x)},${Math.round(y)}`;
      });
      expect(new Set(points).size, `duplicate seat position at ${n} players`).toBe(n);
    }
  });

  it('falls back to an even spread beyond the tuned counts', () => {
    const { x, y } = seatPoint(0, 12, 300, 400);
    expect(x).toBeCloseTo(150, 5);
    expect(y).toBeCloseTo(400, 5);
  });
});
