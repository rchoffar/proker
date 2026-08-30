import { Dimensions } from 'react-native';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// One table size for every game. Flip, bluff (solo and online) and the replayer each used to
// carry their own `SCREEN_WIDTH - 96` plus a hand-rolled height clamp, which left the felt
// narrower than its own board: five md cards are 246pt inside a 297pt table, so the community
// row spilled past the betting line even heads-up.
//
// The horizontal margin is spent on the seat pods, which straddle the rail: a pod's overhang
// past the table box is `seatWidth / 2 - (1 - squeezeX) * width`, so the 84pt pods clear a
// PLAY_TABLE with SeatedTable's squeezeX at 0.86 by roughly 3pt. Widen the table further and
// the pods go off-screen; that pair of constants moves together or not at all.

const clamp = (min: number, value: number, max: number) => Math.min(max, Math.max(min, value));

// The height floor is not cosmetic: seat pods and card fans are fixed-size, so below roughly
// 420pt a full ring has nowhere to put its cards that is not the board. seatLayout.test.ts
// pins that floor — lower it and the 5-player fans land back on the community cards.
export const PLAY_TABLE = {
  width: SCREEN_WIDTH - 40,
  height: clamp(420, Math.round(SCREEN_HEIGHT * 0.56), 560),
};

// Setup boards straddle their seats on the rail, so the outer box is wider and taller than
// the felt by half a seat on each side.
const SEAT_D = 58;

export const SETUP_TABLE = {
  /** Outer box: the felt plus the seats hanging off it. */
  boardWidth: SCREEN_WIDTH - 32,
  seatDiameter: SEAT_D,
  // Used until the board has measured the room it was given, and whenever it is not filling.
  heightRatio: 0.52,
  maxAspect: 1.35,
  // Filling: how tall the felt may get relative to its width before it stops reading as a
  // table, and the floor below which the lower-side seats start covering the options on the
  // felt (bluff's is the tallest panel — name, wordmark and two option rows).
  fillMaxAspect: 1.55,
  minHeight: 360,
};

/**
 * Seats on a setup board straddle the rail like the play table's pods do, so they get the
 * same inward squeeze — without it a felt this wide pushes them off the screen. Slightly
 * tighter than SeatedTable's because these seats are circles with a name plate under them,
 * not a pod whose plate is already centred.
 */
export const SETUP_SQUEEZE_X = 0.84;

/**
 * The felt every setup screen draws — the SAME width the game itself will use, so walking
 * from setup into the hand does not resize the table under you. It used to be a seat
 * narrower than the play felt, and the roulette a whole seat wider than both.
 *
 * `availableH` is the room left for the FELT, with whatever the caller's seats hang past it
 * already taken off; null before the first layout pass, or when the board is not filling.
 */
export function setupTableSize(availableH: number | null): { width: number; height: number } {
  const width = PLAY_TABLE.width;
  const height = availableH
    ? clamp(SETUP_TABLE.minHeight, availableH, Math.round(width * SETUP_TABLE.fillMaxAspect))
    : Math.min(Math.round(width * SETUP_TABLE.maxAspect), Math.round(SCREEN_HEIGHT * SETUP_TABLE.heightRatio));
  return { width, height };
}
