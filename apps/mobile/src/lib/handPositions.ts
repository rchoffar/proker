import { POSITIONS_POSTFLOP_ORDER, POSITIONS_PREFLOP_ORDER, Position, Street } from '../types/hand';

// Default positions handed out as players are created: hero gets the button, then the
// blinds — so a 2-player hand is a valid BTN-vs-BB heads-up by construction — then the
// remaining seats from latest position backwards.
export const DEFAULT_ASSIGN_ORDER: Position[] = ['BTN', 'BB', 'SB', 'CO', 'HJ', 'LJ', 'MP', 'UTG+1', 'UTG'];

export function nextFreePosition(taken: Set<Position>): Position | undefined {
  return DEFAULT_ASSIGN_ORDER.find((pos) => !taken.has(pos));
}

// Unassigned players sort last so the list stays stable while positions are being picked.
export function positionSortIndex(pos: Position | undefined, order: Position[]): number {
  if (!pos) return Number.MAX_SAFE_INTEGER;
  const idx = order.indexOf(pos);
  return idx === -1 ? Number.MAX_SAFE_INTEGER : idx;
}

export function sortByPreflopOrder<T extends { position?: Position }>(players: T[]): T[] {
  return [...players].sort(
    (a, b) => positionSortIndex(a.position, POSITIONS_PREFLOP_ORDER) - positionSortIndex(b.position, POSITIONS_PREFLOP_ORDER)
  );
}

export function orderForStreet<T extends { position?: Position }>(players: T[], street: Street): T[] {
  const order = street === 'preflop' ? POSITIONS_PREFLOP_ORDER : POSITIONS_POSTFLOP_ORDER;
  return [...players].sort((a, b) => positionSortIndex(a.position, order) - positionSortIndex(b.position, order));
}

export interface BlindPosting {
  sbPosterId?: string;
  bbPosterId?: string;
  // Blinds owed by SB/BB seats that exist at the real table but weren't entered in the
  // hand — dead money that still belongs in the pot.
  deadBlinds: number;
}

// In a true heads-up hand the button posts the small blind. Whether a two-player roster IS
// heads-up cannot be inferred — "BTN vs BB" is far more often two players out of a full
// table, where the small blind was posted by somebody not entered in the hand and counts as
// dead money. So the caller answers, and only a `headsUp: true` roster of exactly two gets
// the convention.
//
// `undefined` keeps the old guess, for hands recorded before the question was asked: they
// have no stored answer, and changing how they replay after the fact would be worse than
// keeping their original reading.
export function computeBlindPosting(
  players: { id: string; position?: Position }[],
  sbValue: number,
  bbValue: number,
  headsUp?: boolean
): BlindPosting {
  const byPosition = new Map(players.filter((p) => p.position).map((p) => [p.position!, p.id]));
  const twoHanded = players.length === 2 && byPosition.has('BTN') && byPosition.has('BB');
  const headsUpButton = twoHanded && (headsUp ?? true);
  const sbPosterId = headsUpButton ? byPosition.get('BTN') : byPosition.get('SB');
  const bbPosterId = byPosition.get('BB');
  let deadBlinds = 0;
  if (!sbPosterId) deadBlinds += sbValue;
  if (!bbPosterId) deadBlinds += bbValue;
  return { sbPosterId, bbPosterId, deadBlinds };
}
