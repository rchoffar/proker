import type { Card } from '../../../../packages/ofc/cards';
export type { Card, Rank, Suit } from '../../../../packages/ofc/cards';
export { RANKS, SUITS, cardKey } from '../../../../packages/ofc/cards';

export type Street = 'preflop' | 'flop' | 'turn' | 'river';

// Unit the whole hand's amounts are expressed in: big blinds (SB=0.5/BB=1, decimals allowed)
// or raw chip counts. Chosen once at setup — never mixed within a hand.
export type UnitMode = 'bb' | 'chips';

export type ActionType = 'fold' | 'check' | 'call' | 'bet' | 'raise' | 'allin' | 'post';

// Standard table positions. Positions are on the do-not-translate glossary — rendered raw.
export type Position = 'UTG' | 'UTG+1' | 'MP' | 'LJ' | 'HJ' | 'CO' | 'BTN' | 'SB' | 'BB';

// Preflop action order (UTG acts first, BB last). Also the canonical sort order for the
// builder's player list — postflop order is the same circle cut at SB, so keeping players
// sorted this way makes both streets' rotations trivial.
export const POSITIONS_PREFLOP_ORDER: Position[] = ['UTG', 'UTG+1', 'MP', 'LJ', 'HJ', 'CO', 'BTN', 'SB', 'BB'];

// Postflop action order (SB acts first, BTN last).
export const POSITIONS_POSTFLOP_ORDER: Position[] = ['SB', 'BB', 'UTG', 'UTG+1', 'MP', 'LJ', 'HJ', 'CO', 'BTN'];

export interface HandAction {
  id: string;
  street: Street;
  playerId: string;
  type: ActionType;
  amount?: number;
  order: number;
}

export interface HandPlayer {
  id: string;
  name: string;
  isHero: boolean;
  seat: number;
  startingStack?: number;
  holeCards?: [Card, Card];
  cardsKnown: boolean;
  isFolded: boolean;
  foldedOnStreet?: Street;
  result?: 'won' | 'lost' | 'folded' | 'unknown';
  // Table position, assigned per player in setup. A hand may only contain a subset of the
  // real table (uninteresting instant-folders are omitted), so any position — including
  // BTN/SB/BB — may be absent from the roster.
  position?: Position;
}

export interface PotState {
  street: Street;
  amount: number;
}

export interface HandHistory {
  id: string;
  createdAt: string;
  title?: string;
  gameType: 'NLH';
  stakes?: string;
  players: HandPlayer[];
  board: {
    flop?: [Card, Card, Card];
    turn?: Card;
    river?: Card;
  };
  actions: HandAction[];
  pots: PotState[];
  // Multiple ids = split pot (chopped between them).
  winnerIds?: string[];
  winningHandDescription?: string;
  // True heads-up: only two players at the table, so the button posts the small blind.
  // Absent on hands recorded before the builder asked — those keep the old guess, which
  // read any BTN-vs-BB pair as heads-up.
  headsUp?: boolean;
  // Blinds posted by SB/BB players who exist at the real table but weren't entered in the
  // hand (they folded pre-entry) — dead money already counted into pots.
  deadBlinds?: number;
  // Total antes posted before the deal, entered as one global amount (posters may include
  // players not in the hand) — dead money already counted into pots.
  ante?: number;
  heroNet?: number;
  // Absent on hands recorded before unit modes existed — treat as 'chips'.
  unitMode?: UnitMode;
}
