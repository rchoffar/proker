import { describe, it, expect } from 'vitest';
import { assignSeats, rosterFromSeats } from '../seatAssignment';
import type { Player } from '../../../types';

const p = (id: string): Player => ({ id, name: id.toUpperCase() });
const a = p('a');
const b = p('b');
const c = p('c');

const ids = (seats: (Player | null)[]) => seats.map((s) => s?.id ?? null);

describe('assignSeats', () => {
  it('seats a roster with no seat map densely, from the first seat', () => {
    expect(ids(assignSeats([a, b], [], 6))).toEqual(['a', 'b', null, null, null, null]);
  });

  it('keeps a player in the seat they were put in, however few are seated', () => {
    // The bug: "il prend une place différente que le + où j'ai cliqué".
    const seats = assignSeats([a, b], [null, null, null, null, 'a', 'b'], 6);
    expect(ids(seats)).toEqual([null, null, null, null, 'a', 'b']);
  });

  it('leaves the gap a removal made, and nobody moves up', () => {
    const seats = assignSeats([a, c], ['a', null, 'c'], 6);
    expect(ids(seats)).toEqual(['a', null, 'c', null, null, null]);
  });

  it('drops seats whose player is gone from the roster', () => {
    expect(ids(assignSeats([a], ['a', 'b'], 3))).toEqual(['a', null, null]);
  });

  it('gives the lowest free seat to a player the seat map does not know', () => {
    // How a roster restored from the store (last game's players, no seats) lands, and how a
    // player added by anything other than a seat tap — an online member joining — lands too.
    expect(ids(assignSeats([a, b, c], [null, 'b'], 4))).toEqual(['a', 'b', 'c', null]);
  });

  it('never seats the same player twice', () => {
    expect(ids(assignSeats([a, b], ['b', null, null], 3))).toEqual(['b', 'a', null]);
  });

  it('stops when the seats run out instead of overflowing them', () => {
    expect(ids(assignSeats([a, b, c], [], 2))).toEqual(['a', 'b']);
  });
});

describe('rosterFromSeats', () => {
  it('closes the gaps but keeps the ring order — the turn order follows the table', () => {
    expect(rosterFromSeats([null, c, null, a, b]).map((x) => x.id)).toEqual(['c', 'a', 'b']);
  });
});
