import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { createMMKV } from 'react-native-mmkv';
import type { User, Session, Stake, Player, BankrollSnapshot, ComputedStats, Festival, Tournament, TournamentSession, Backing, Country, Organizer } from '../types';
import { mockUser, mockFestivals, mockTournaments, mockCountries, mockOrganizers } from '../data/mock';

const mmkv = createMMKV({ id: 'proker' });

const mmkvStorage = {
  setItem: (name: string, value: string) => { mmkv.set(name, value); },
  getItem: (name: string) => mmkv.getString(name) ?? null,
  removeItem: (name: string) => { mmkv.remove(name); },
};

function sessionNetValues(session: Session): { invested: number; profit: number } {
  const bs = session.backings ?? [];
  const totalBuyIn = session.type === 'tournament'
    ? (session.reEntries + 1) * session.buyIn
    : session.buyIn;
  // what you actually pay after backer contributions
  const yourInvested = totalBuyIn - bs.reduce((sum, b) => sum + (b.buyInShare / 100) * totalBuyIn, 0);
  // what you actually receive after paying out backers
  const yourCashout = session.cashOut - bs.reduce((sum, b) => sum + (b.profitShare / 100) * session.cashOut, 0);
  return { invested: yourInvested, profit: yourCashout - yourInvested };
}

function getSessionProfit(session: Session): number {
  return sessionNetValues(session).profit;
}

function getSessionInvested(session: Session): number {
  return sessionNetValues(session).invested;
}

function getStakeProfit(stake: Stake): number {
  if (!stake.settled) return 0;
  const invested = (stake.percentage / 100) * stake.buyIn;
  const myReturn = stake.cashed ? (stake.percentage / 100) * (stake.theirCashout ?? 0) : 0;
  return myReturn - invested;
}

function computeStats(sessions: Session[], stakes: Stake[]): ComputedStats {
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
      if ((s as TournamentSession).cashed) tournamentsCashed++;
    }
    if (s.date.startsWith(thisMonth)) {
      thisMonthProfit += profit;
      thisMonthSessions++;
    }
  }

  for (const stake of stakes) {
    if (stake.settled) {
      const invested = (stake.percentage / 100) * stake.buyIn;
      const profit = getStakeProfit(stake);
      totalProfit += profit;
      totalInvested += invested;
      if (profit > biggestWin) biggestWin = profit;
      if (profit < biggestLoss) biggestLoss = profit;
      if (stake.date.startsWith(thisMonth)) {
        thisMonthProfit += profit;
      }
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

type HistoryEntry = { date: string; profit: number };

function computeBankrollHistory(sessions: Session[], stakes: Stake[]): BankrollSnapshot[] {
  const entries: HistoryEntry[] = [
    ...sessions.map((s) => ({ date: s.date.slice(0, 10), profit: getSessionProfit(s) })),
    ...stakes
      .filter((s) => s.settled)
      .map((s) => ({ date: s.date.slice(0, 10), profit: getStakeProfit(s) })),
  ];
  if (entries.length === 0) return [];
  entries.sort((a, b) => a.date.localeCompare(b.date));
  let running = 0;
  return entries.map((e) => ({ date: e.date, amount: (running += e.profit) }));
}

interface AppStore {
  user: User;
  sessions: Session[];
  stakes: Stake[];
  bankrollHistory: BankrollSnapshot[];
  stats: ComputedStats;
  festivals: Festival[];
  tournaments: Tournament[];
  players: Player[];
  countries: Country[];
  organizers: Organizer[];

  addSession: (session: Session) => void;
  addStake: (stake: Stake) => void;
  updateUser: (patch: Partial<User>) => void;
  addFestival: (festival: Festival) => void;
  addTournament: (tournament: Tournament) => void;
  addPlayer: (player: Player) => void;
  addCountry: (country: Country) => void;
  addOrganizer: (organizer: Organizer) => void;
  resetStore: () => void;
}

export const useAppStore = create<AppStore>()(
  persist(
    (set) => ({
      user: mockUser,
      sessions: [],
      stakes: [],
      bankrollHistory: [],
      stats: computeStats([], []),
      festivals: mockFestivals,
      tournaments: mockTournaments,
      players: [],
      countries: mockCountries,
      organizers: mockOrganizers,

      addSession: (session) =>
        set((state) => {
          const sessions = [session, ...state.sessions];
          return {
            sessions,
            stats: computeStats(sessions, state.stakes),
            bankrollHistory: computeBankrollHistory(sessions, state.stakes),
          };
        }),

      addStake: (stake) =>
        set((state) => {
          const stakes = [stake, ...state.stakes];
          return {
            stakes,
            stats: computeStats(state.sessions, stakes),
            bankrollHistory: computeBankrollHistory(state.sessions, stakes),
          };
        }),

      updateUser: (patch) =>
        set((state) => ({ user: { ...state.user, ...patch } })),

      addFestival: (festival) =>
        set((state) => ({ festivals: [...state.festivals, festival] })),

      addTournament: (tournament) =>
        set((state) => ({ tournaments: [...state.tournaments, tournament] })),

      addPlayer: (player) =>
        set((state) => ({ players: [...state.players, player] })),

      addCountry: (country) =>
        set((state) => ({ countries: [...state.countries, country] })),

      addOrganizer: (organizer) =>
        set((state) => ({ organizers: [...state.organizers, organizer] })),

      resetStore: () => {
        mmkv.remove('proker-app-store');
        set({
          user: mockUser,
          sessions: [],
          stakes: [],
          bankrollHistory: [],
          stats: computeStats([], []),
          festivals: mockFestivals,
          tournaments: mockTournaments,
          players: [],
          countries: mockCountries,
          organizers: mockOrganizers,
        });
      },
    }),
    {
      name: 'proker-app-store',
      storage: createJSONStorage(() => mmkvStorage),
      partialize: (state) => ({
        sessions: state.sessions,
        stakes: state.stakes,
        festivals: state.festivals,
        tournaments: state.tournaments,
        players: state.players,
        countries: state.countries,
        organizers: state.organizers,
        user: state.user,
      }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          // Always use fresh mock data for reference entities so schema changes
          // (new fields like countryId, organizerId) are reflected immediately.
          // User-added festivals and tournaments are preserved.
          state.countries = mockCountries;
          state.organizers = mockOrganizers;
          state.festivals = [
            ...mockFestivals,
            ...state.festivals.filter((f) => !mockFestivals.some((m) => m.id === f.id)),
          ];
          state.tournaments = [
            ...mockTournaments,
            ...state.tournaments.filter((t) => !mockTournaments.some((m) => m.id === t.id)),
          ];
          state.stats = computeStats(state.sessions, state.stakes);
          state.bankrollHistory = computeBankrollHistory(state.sessions, state.stakes);
        }
      },
    }
  )
);
