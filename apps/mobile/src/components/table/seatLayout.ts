// Where the seats sit around the felt, and how much room a seat's cards need. Kept free of
// react-native so it can be tested: this is the geometry that decides whether a player's
// hand lands on the board.

/** TableSeat anchors its pod this far above the seat point (the avatar sits on the rail). */
export const POD_ANCHOR_ABOVE_Y = 42;
/** Avatar + name plate, with the plate's second line — the tallest the pod body gets. */
export const POD_INNER_H = 64;
/** `cardsBelow` tucks under the plate by this much. */
export const POD_CARDS_BELOW_OVERLAP = 4;

/**
 * How far a seat's fan reaches back toward the felt centre, from the seat point.
 *
 * Asymmetric on purpose: a bottom-half seat hangs its fan ABOVE the pod, so the pod anchor
 * shift and the fan offset stack up; a top-half seat hangs it BELOW, past the avatar and
 * plate instead. `aboveOffset` and `cardH` come from FAN_GEOMETRY.
 */
export function fanReach(direction: 'up' | 'down', aboveOffset: number, cardH: number): number {
  return direction === 'up'
    ? POD_ANCHOR_ABOVE_Y + aboveOffset
    : POD_INNER_H - POD_ANCHOR_ABOVE_Y - POD_CARDS_BELOW_OVERLAP + cardH;
}

// Seat k = 0 is pinned at the bottom centre (90°) and the others follow clockwise.
//
// Spacing them evenly puts a seat wherever 2πk/n lands, and at 4 and 5 players that is the
// left and right extremes — level with the board on the felt centre, so their fans hang
// straight over the community cards (the 5-player bug). These angles are hand-placed
// instead, and they all sit well away from the horizontal: a seat beside the board has
// nowhere to put its cards, so the ring is pinched toward the top and bottom of the oval
// rather than spread evenly. seatLayout.test.ts pins the clearance that forces this shape.
const SEAT_ANGLES: Record<number, number[]> = {
  2: [90, 270],
  3: [90, 225, 315],
  // Two facing two. Seat 0 gives up the exact bottom centre here: keeping it there forces
  // the fourth player to the top on their own, which reads as three against one.
  4: [115, 245, 295, 65],
  5: [90, 135, 215, 325, 45],
  6: [90, 135, 215, 270, 325, 45],
  7: [90, 135, 212, 240, 300, 328, 45],
  8: [90, 135, 212, 236, 270, 304, 328, 45],
  9: [90, 133, 210, 232, 254, 286, 308, 330, 47],
};

/** The player counts with a hand-placed ring; anything else falls back to an even spread. */
export const SEAT_LAYOUT_COUNTS = Object.keys(SEAT_ANGLES).map(Number);

function seatAngle(k: number, n: number): number {
  const table = SEAT_ANGLES[n];
  if (table) return (table[k] * Math.PI) / 180;
  return Math.PI / 2 + (2 * Math.PI * k) / n;
}

export function seatPoint(k: number, n: number, width: number, height: number): { x: number; y: number } {
  const angle = seatAngle(k, n);
  return {
    x: width / 2 + (width / 2) * Math.cos(angle),
    y: height / 2 + (height / 2) * Math.sin(angle),
  };
}
