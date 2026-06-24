import { create } from 'zustand';
import type { User, Session, BankrollSnapshot, ComputedStats } from '../types';
import { mockUser, mockSessions, mockBankrollHistory } from '../data/mock';

function getSessionProfit(session: Session): number {
  if (session.type === 'tournament') {
    return session.cashOut - session.totalInvested;
  }
  return session.cashOut - session.buyIn;
}

function getSessionInvested(session: Session): number {
  if (session.type === 'tournament') return session.totalInvested;
  return session.buyIn;
}

function computeStats(sessions: Session[]): ComputedStats {
  const now = new Date();
  const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  let totalProfit = 0;
  let totalInvested = 0;
  let totalHours = 0;
  let biggestWin = 0;
  let biggestLoss = 0;
  let tournamentsCashed = 0;
  let totalTournaments = 0;
  let thisMonthProfit = 0;
  let thisMonthSessions = 0;

  for (const s of sessions) {
    const profit = getSessionProfit(s);
    const invested = getSessionInvested(s);
    totalProfit += profit;
    totalInvested += invested;
    totalHours += s.durationHours;
    if (profit > biggestWin) biggestWin = profit;
    if (profit < biggestLoss) biggestLoss = profit;
    if (s.type === 'tournament') {
      totalTournaments++;
      if (s.cashed) tournamentsCashed++;
    }
    if (s.date.startsWith(thisMonth)) {
      thisMonthProfit += profit;
      thisMonthSessions++;
    }
  }

  return {
    totalProfit,
    totalInvested,
    roi: totalInvested > 0 ? (totalProfit / totalInvested) * 100 : 0,
    hourlyRate: totalHours > 0 ? totalProfit / totalHours : 0,
    totalSessions: sessions.length,
    totalHours,
    biggestWin,
    biggestLoss,
    itmRate: totalTournaments > 0 ? (tournamentsCashed / totalTournaments) * 100 : 0,
    thisMonthProfit,
    thisMonthSessions,
  };
}

interface AppStore {
  user: User;
  sessions: Session[];
  bankrollHistory: BankrollSnapshot[];
  stats: ComputedStats;

  addSession: (session: Session) => void;
  updateUser: (patch: Partial<User>) => void;
}

export const useAppStore = create<AppStore>((set) => ({
  user: mockUser,
  sessions: mockSessions,
  bankrollHistory: mockBankrollHistory,
  stats: computeStats(mockSessions),

  addSession: (session) =>
    set((state) => {
      const sessions = [session, ...state.sessions];
      return { sessions, stats: computeStats(sessions) };
    }),

  updateUser: (patch) =>
    set((state) => ({ user: { ...state.user, ...patch } })),
}));
