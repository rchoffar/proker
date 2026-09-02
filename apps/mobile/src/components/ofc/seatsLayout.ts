import { spacing } from '../../design-system/theme';

// How the OFC seat boards are sized AND arranged to the room the felt has — never to a fixed
// tier, and never to a flag the screen passes down.
//
// Both of those were bugs. A fixed `sm` outside the placing phase meant that at scoring, where
// the felt shrinks to share the page with the scoresheet, two stacked boards measured about
// 320pt inside a felt given far less and spilled over the caption above and the scoresheet
// below. And tying the arrangement to "is the placement board open" got it backwards whenever
// the felt was short: stacked, two boards have to split the height, which at scoring left a
// 13pt slot — unreadable, and past the floor, so it overflowed anyway.
//
// Measuring one column against one row was not enough either. Three boards at scoring: stacked
// they measured 18pt a card and side by side 16, so stacked won — and each board then used
// 100pt of a 300pt felt, because HEIGHT was what had run out and the width sat there empty.
// That is the screenshot where "on ne voit même pas les cartes".
//
// So every column count from one to the number of seats is measured, as a grid of
// `cols × ceil(n / cols)`, and the widest card wins. The two old orientations are just its
// ends, and the middle is where three boards belong. Ties go to the fewest columns, so two
// boards still face each other down the felt.
//
// It lives apart from the component because it is arithmetic against OfcGridView's real
// geometry, and arithmetic that is one constant out is what overflows a felt. seatsLayout.test
// keeps every case inside the room it was given.

/** Vertical, per board: the name/chips line, the gap under it, and the seat's padding+border. */
const HEADER_H = 22;
const SEAT_GAP_Y = 3;
const SEAT_CHROME_Y = spacing.xs * 2 + 2;
/**
 * One line kept free under every grid, always, for whatever hangs there — the FOUL banner at
 * scoring, the Fantasy Land hint while placing. Reserving it only when one of them was actually
 * on screen resized every card from one round to the next, and left two boards in the same
 * round different heights. It costs about 5pt of card and buys a board that holds still.
 */
const UNDER_GRID = 21;
/** Horizontal: OfcGridView's own card gap at xs, the gap between boards, seat padding+border. */
const CARD_GAP = 2;
const GRID_ROW_GAP = CARD_GAP + 1;
const BOARD_GAP = spacing.sm;
const SEAT_CHROME_X = 2 * 2 + 2;
/**
 * A sanity floor, and nothing more: OFC caps at three players (MAX_OFC_PLAYERS), and at three
 * the measurements come out well above it, so it should never bind. It is deliberately low
 * anyway, for the degenerate felt it might one day meet — a small screen with the placement
 * board open. A floor ABOVE what the tightest case needs stops being a floor and becomes an
 * overflow, which is how a floor of 20 once spilled 370pt of boards into 190pt of felt. Small
 * cards on a crowded non-scrolling page are the honest trade; boards over the scoresheet
 * are not.
 */
const SLOT_MIN = 8;
/** PlayingCard's own md width: past it the boards stop growing and the felt keeps the change. */
const SLOT_MAX = 46;

export const SEAT_BOARD_GAP = BOARD_GAP;

/** A card's height at a given slot width — PlayingCard's ratio, rounded the same way. */
export const cardHeight = (slot: number) => Math.round((slot * 64) / 46);
/** A seat's footprint, which is what the fits below invert. */
export const seatBoardWidth = (slot: number) => slot * 5 + CARD_GAP * 4 + SEAT_CHROME_X;
export const seatBoardHeight = (slot: number) =>
  cardHeight(slot) * 3 + GRID_ROW_GAP * 2 + HEADER_H + SEAT_GAP_Y + SEAT_CHROME_Y + UNDER_GRID;

/** Widest slot three rows of it fit into `height`, shared between `rows` stacked boards. */
function slotForHeight(height: number, rows: number): number {
  const perBoard = (height - BOARD_GAP * (rows - 1)) / rows;
  const cards = perBoard - HEADER_H - SEAT_GAP_Y - SEAT_CHROME_Y - UNDER_GRID - GRID_ROW_GAP * 2;
  return (cards / 3) * (46 / 64);
}

/** Widest slot five of them fit into `width`, shared between `cols` boards abreast. */
function slotForWidth(width: number, cols: number): number {
  const perBoard = (width - BOARD_GAP * (cols - 1)) / cols;
  return (perBoard - SEAT_CHROME_X - CARD_GAP * 4) / 5;
}

export interface SeatBoardFit {
  /** Boards per row. The rows follow from it, and the strip is a wrap, not a fixed split. */
  cols: number;
  /** Exact card width to hand OfcGridView. */
  slotWidth: number;
}

export function fitSeatBoards(seatCount: number, inner: { width: number; height: number }): SeatBoardFit {
  let best = { cols: 1, slot: -Infinity };
  for (let cols = 1; cols <= Math.max(1, seatCount); cols++) {
    const rows = Math.ceil(seatCount / cols);
    const slot = Math.min(slotForWidth(inner.width, cols), slotForHeight(inner.height, rows));
    if (slot > best.slot) best = { cols, slot };
  }
  return { cols: best.cols, slotWidth: Math.min(SLOT_MAX, Math.max(SLOT_MIN, Math.floor(best.slot))) };
}
