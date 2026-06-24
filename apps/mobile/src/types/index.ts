export type Currency = 'EUR' | 'USD' | 'GBP';
export type SessionType = 'tournament' | 'cash';
export type GameType = 'NLH' | 'PLO' | 'other';

export interface UserSettings {
  language: 'fr' | 'en';
  currency: Currency;
  notifications: boolean;
}

export interface User {
  id: string;
  name: string;
  avatar?: string;
  bankroll: number;
  createdAt: string;
  settings: UserSettings;
}

export interface BaseSession {
  id: string;
  type: SessionType;
  date: string;
  venue: string;
  buyIn: number;
  cashOut: number;
  durationHours: number;
  notes?: string;
  createdAt: string;
}

export interface TournamentSession extends BaseSession {
  type: 'tournament';
  tournamentName?: string;
  reEntries: number;
  totalInvested: number;
  cashed: boolean;
  position?: number;
  totalPlayers?: number;
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
