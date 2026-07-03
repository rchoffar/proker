export type Suit = 'clubs' | 'diamonds' | 'hearts' | 'spades';
export type Rank = 'A' | 'K' | 'Q' | 'J' | 'T' | '9' | '8' | '7' | '6' | '5' | '4' | '3' | '2';

export interface Card {
  rank: Rank;
  suit: Suit;
}

export type Street = 'preflop' | 'flop' | 'turn' | 'river';

export type ActionType = 'fold' | 'check' | 'call' | 'bet' | 'raise' | 'allin';

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
  winnerId?: string;
  winningHandDescription?: string;
  heroNet?: number;
}

export const RANKS: Rank[] = ['A', 'K', 'Q', 'J', 'T', '9', '8', '7', '6', '5', '4', '3', '2'];
export const SUITS: Suit[] = ['spades', 'hearts', 'clubs', 'diamonds'];

export function cardKey(card: Card): string {
  return `${card.rank}${card.suit[0]}`;
}
