import { useState } from 'react';
import { assignSeats, rosterFromSeats } from './seatAssignment';
import type { Player } from '../../types';

/**
 * The seating for a setup board: which player is in which seat, and the two moves a board
 * offers. The screen keeps owning the roster (`roster` in, `onChange` out, both dense and in
 * seat order) — the seats themselves are the board's own business, so no screen and no store
 * has to learn about them. See `seatAssignment.ts` for why they are held separately.
 */
export function useSeatedRoster(
  roster: Player[],
  seatCount: number,
  onChange: (roster: Player[]) => void,
) {
  const [seatIds, setSeatIds] = useState<(string | null)[]>([]);
  const seats = assignSeats(roster, seatIds, seatCount);

  // Every change writes back ALL the seats, implicit placements included — that is what makes
  // a seat stick once its player has been rendered in it.
  const commit = (next: (Player | null)[]) => {
    setSeatIds(next.map((p) => p?.id ?? null));
    onChange(rosterFromSeats(next));
  };

  return {
    seats,
    sitAt: (index: number, player: Player) => {
      if (seats[index] || seats.some((p) => p?.id === player.id)) return;
      const next = [...seats];
      next[index] = player;
      commit(next);
    },
    /** Leaves the seat empty: the other players do not move up. */
    standUp: (playerId: string) => commit(seats.map((p) => (p?.id === playerId ? null : p))),
  };
}
