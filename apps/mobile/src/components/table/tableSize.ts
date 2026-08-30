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

// Setup boards draw the seats around the box rather than on it, so they budget SEAT_D of
// horizontal room themselves (see SeatTableBoard) and only the outer margin lives here.
export const SETUP_TABLE = {
  boardWidth: SCREEN_WIDTH - 32,
  heightRatio: 0.52,
  maxAspect: 1.35,
};
