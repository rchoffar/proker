import { describe, it, expect } from 'vitest';
import { SEAT_BOARD_GAP, fitSeatBoards, seatBoardHeight, seatBoardWidth } from '../seatsLayout';
import { MAX_OFC_PLAYERS, MIN_OFC_PLAYERS } from '../../../lib/ofc';

// The felts this actually meets, on a 393pt-wide screen: PLAY_TABLE.width - RAIL across, and
// down, whatever the page has left over. Scoring is the tight one (the scoresheet takes the
// bottom half), placing tighter still (the placement board is below the felt), out of turn the
// roomy one (the felt has the page to itself).
const FELTS = {
  scoring: { width: 329, height: 336 },
  placing: { width: 329, height: 200 },
  outOfTurn: { width: 329, height: 536 },
} as const;

const counts = Array.from(
  { length: MAX_OFC_PLAYERS - MIN_OFC_PLAYERS + 1 },
  (_, i) => MIN_OFC_PLAYERS + i,
);

describe('fitSeatBoards — the boards stay inside the felt', () => {
  for (const [name, inner] of Object.entries(FELTS)) {
    for (const n of counts) {
      it(`${name} felt, ${n} players`, () => {
        const { cols, slotWidth } = fitSeatBoards(n, inner);
        const rows = Math.ceil(n / cols);
        const usedWidth = seatBoardWidth(slotWidth) * cols + SEAT_BOARD_GAP * (cols - 1);
        const usedHeight = seatBoardHeight(slotWidth) * rows + SEAT_BOARD_GAP * (rows - 1);
        expect(usedWidth).toBeLessThanOrEqual(inner.width);
        expect(usedHeight).toBeLessThanOrEqual(inner.height);
      });
    }
  }
});

describe('fitSeatBoards — it spends the axis that is not full', () => {
  it('puts three boards in a grid at scoring, not in a column', () => {
    // The bug behind "on ne voit même pas les cartes, il y a tellement de place": a column of
    // three measured one point wider per card than a row of three, won, and then left two
    // thirds of the felt's width empty. A 2 × 2 grid beats both.
    const { cols, slotWidth } = fitSeatBoards(3, FELTS.scoring);
    expect(cols).toBe(2);
    expect(slotWidth).toBeGreaterThan(18); // what the column of three used to give
  });

  it('leaves two boards facing each other when the felt has the height for it', () => {
    // Ties and the roomy felt both go to one column: "your board / my board" across a table is
    // how the game is read, and it is only given up for bigger cards.
    expect(fitSeatBoards(2, FELTS.outOfTurn).cols).toBe(1);
  });

  it('goes side by side when the height, not the width, is what ran out', () => {
    expect(fitSeatBoards(3, FELTS.placing).cols).toBe(3);
  });
});
