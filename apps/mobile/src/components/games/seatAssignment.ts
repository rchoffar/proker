import type { Player } from '../../types';

// Tapping a "+" picks a SEAT, not just a player, and a roster array cannot hold that: its
// indices ARE the seats on the boards that render it, so appending puts a player wherever the
// count happens to land and filtering slides everyone else over. Both are what the setup
// screens showed — "il prend une place différente que le + où j'ai cliqué", and removing one
// player moved the rest.
//
// So the seats are kept beside the roster, as one player id per seat. Neither is enough alone:
// the ids go stale (the roster belongs to the screen, which replaces it wholesale — coming back
// to a setup screen restores the last game's players with no seats to go with them), and the
// roster cannot hold a gap. Where they agree the seats win; any player the seats do not know
// about takes the lowest free one, which is the old dense behaviour and the right default.

/** The players by seat, `null` where the seat is free. Length is always `seatCount`. */
export function assignSeats(
  roster: Player[],
  seatIds: (string | null)[],
  seatCount: number,
): (Player | null)[] {
  const seats: (Player | null)[] = Array.from({ length: seatCount }, (_, k) => {
    const id = seatIds[k];
    return (id ? roster.find((p) => p.id === id) : undefined) ?? null;
  });
  const seated = new Set(seats.filter((p): p is Player => p !== null).map((p) => p.id));
  for (const player of roster) {
    if (seated.has(player.id)) continue;
    const free = seats.indexOf(null);
    if (free === -1) break; // more players than seats: the extras are not rendered anyway
    seats[free] = player;
    seated.add(player.id);
  }
  return seats;
}

/**
 * The roster a game plays with: seat order, gaps closed. Emitted on every change so the
 * turn order follows the ring — a player seated in a gap plays from that gap's place, not
 * from the end of the list.
 */
export function rosterFromSeats(seats: (Player | null)[]): Player[] {
  return seats.filter((p): p is Player => p !== null);
}
