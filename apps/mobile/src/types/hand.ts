export type Suit = 'clubs' | 'diamonds' | 'hearts' | 'spades';
export type Rank = 'A' | 'K' | 'Q' | 'J' | 'T' | '9' | '8' | '7' | '6' | '5' | '4' | '3' | '2';

export interface Card {
  rank: Rank;
  suit: Suit;
}

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
  // Blinds posted by SB/BB players who exist at the real table but weren't entered in the
  // hand (they folded pre-entry) — dead money already counted into pots.
  deadBlinds?: number;
  heroNet?: number;
  // Absent on hands recorded before unit modes existed — treat as 'chips'.
  unitMode?: UnitMode;
}

export const RANKS: Rank[] = ['A', 'K', 'Q', 'J', 'T', '9', '8', '7', '6', '5', '4', '3', '2'];
export const SUITS: Suit[] = ['spades', 'hearts', 'clubs', 'diamonds'];

export function cardKey(card: Card): string {
  return `${card.rank}${card.suit[0]}`;
}
