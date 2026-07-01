export type Currency = 'EUR' | 'USD' | 'GBP';
export type SessionType = 'tournament' | 'cash';
export type GameType = 'NLH' | 'PLO' | 'other';

export interface UserSettings {
  language: 'fr' | 'en';
  currency: Currency;
  notifications: boolean;
  theme: 'light' | 'dark';
}

export interface User {
  id: string;
  name: string;
  avatar?: string;
  createdAt: string;
  settings: UserSettings;
}

export interface Player {
  id: string;
  name: string;
  notes?: string;
}

export interface Stake {
  id: string;
  date: string;
  playerId: string;
  festivalId?: string;
  tournamentId?: string;
  buyIn: number;
  percentage: number;
  settled: boolean;
  cashed?: boolean;
  theirCashout?: number;
  notes?: string;
  createdAt: string;
}

export interface Country {
  id: string;
  name: string;
  code: string;
}

export interface Organizer {
  id: string;
  name: string;
}

export interface Festival {
  id: string;
  name: string;
  location?: string;
  countryId?: string;
  organizerId?: string;
}

export interface Tournament {
  id: string;
  festivalId: string;
  name: string;
  buyIn: number;
  totalPlayers?: number;
  startDate?: string; // ISO date, when known
  guaranteed?: number; // guaranteed prize pool
  featured?: boolean; // "Coup de cœur" pin
}

export interface Backing {
  playerId: string;
  profitShare: number;  // % of cashout they receive
  buyInShare: number;   // % of buy-in they contribute (0 = action only, no buy-in contribution)
}

export interface BaseSession {
  id: string;
  type: SessionType;
  date: string;
  venue: string;
  buyIn: number;
  cashOut: number;
  durationHours: number;
  backings?: Backing[];
  notes?: string;
  createdAt: string;
}

export interface TournamentSession extends BaseSession {
  type: 'tournament';
  tournamentId: string;
  reEntries: number;
  cashed: boolean;
  position?: number;
}

export interface CashSession extends BaseSession {
  type: 'cash';
  gameType: GameType;
  stakes: string;
}

export type Session = TournamentSession | CashSession;

export interface BankrollSnapshot {
  date: string;
  amount: number;
}

export interface ComputedStats {
  totalProfit: number;
  totalInvested: number;
  roi: number;
  hourlyRate: number;
  totalSessions: number;
  totalHours: number;
  biggestWin: number;
  biggestLoss: number;
  itmRate: number;
  thisMonthProfit: number;
  thisMonthSessions: number;
}
