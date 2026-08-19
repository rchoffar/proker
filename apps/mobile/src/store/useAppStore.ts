import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { createMMKV } from 'react-native-mmkv';
import type { User, Session, Stake, Player, BankrollSnapshot, ComputedStats, Festival, Tournament, Country, Organizer } from '../types';
import { mockUser, mockFestivals, mockTournaments, mockCountries, mockOrganizers } from '../data/mock';
import { computeWindowedStats, computeBankrollHistory } from '../lib/stats';
import i18n, { defaultLocale } from '../i18n';
import type { FlipGameType } from '../lib/pokerHandEvaluator';

export { sessionNetValues } from '../lib/stats';

const mmkv = createMMKV({ id: 'proker' });

const mmkvStorage = {
  setItem: (name: string, value: string) => { mmkv.set(name, value); },
  getItem: (name: string) => mmkv.getString(name) ?? null,
  removeItem: (name: string) => { mmkv.remove(name); },
};

function computeStats(sessions: Session[], stakes: Stake[]): ComputedStats {
  return computeWindowedStats(sessions, stakes, Infinity);
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
  likedFestivalIds: string[];
  likedTournamentIds: string[];
  rouletteLastPlayers: Player[];
  flipLastPlayers: Player[];
  flipLastGameType: FlipGameType;
  bluffLastPlayers: Player[];
  bluffPseudo: string;

  addSession: (session: Session) => void;
  updateSession: (session: Session) => void;
  addStake: (stake: Stake) => void;
  updateUser: (patch: Partial<User>) => void;
  addFestival: (festival: Festival) => void;
  addTournament: (tournament: Tournament) => void;
  addPlayer: (player: Player) => void;
  addCountry: (country: Country) => void;
  addOrganizer: (organizer: Organizer) => void;
  toggleLikedFestival: (festivalId: string) => void;
  toggleLikedTournament: (tournamentId: string) => void;
  setRouletteLastPlayers: (players: Player[]) => void;
  setFlipDraftDefaults: (players: Player[], gameType: FlipGameType) => void;
  setBluffDefaults: (patch: { players?: Player[]; pseudo?: string }) => void;
  resetStore: () => void;
}

export const useAppStore = create<AppStore>()(
  persist(
    (set) => ({
      // First launch: follow the device locale; afterwards the persisted choice wins (rehydrate below).
      user: { ...mockUser, settings: { ...mockUser.settings, language: defaultLocale } },
      sessions: [],
      stakes: [],
      bankrollHistory: [],
      stats: computeStats([], []),
      festivals: mockFestivals,
      tournaments: mockTournaments,
      players: [],
      countries: mockCountries,
      organizers: mockOrganizers,
      likedFestivalIds: [],
      likedTournamentIds: [],
      rouletteLastPlayers: [],
      flipLastPlayers: [],
      flipLastGameType: 'holdem',
      bluffLastPlayers: [],
      bluffPseudo: '',

      addSession: (session) =>
        set((state) => {
          const sessions = [session, ...state.sessions];
          return {
            sessions,
            stats: computeStats(sessions, state.stakes),
            bankrollHistory: computeBankrollHistory(sessions, state.stakes),
          };
        }),

      updateSession: (session) =>
        set((state) => {
          const sessions = state.sessions.map((s) => (s.id === session.id ? session : s));
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

      toggleLikedFestival: (festivalId) =>
        set((state) => ({
          likedFestivalIds: state.likedFestivalIds.includes(festivalId)
            ? state.likedFestivalIds.filter((id) => id !== festivalId)
            : [...state.likedFestivalIds, festivalId],
        })),

      toggleLikedTournament: (tournamentId) =>
        set((state) => ({
          likedTournamentIds: state.likedTournamentIds.includes(tournamentId)
            ? state.likedTournamentIds.filter((id) => id !== tournamentId)
            : [...state.likedTournamentIds, tournamentId],
        })),

      setRouletteLastPlayers: (players) => set({ rouletteLastPlayers: players }),

      setFlipDraftDefaults: (players, gameType) => set({ flipLastPlayers: players, flipLastGameType: gameType }),

      setBluffDefaults: (patch) =>
        set((state) => ({
          bluffLastPlayers: patch.players ?? state.bluffLastPlayers,
          bluffPseudo: patch.pseudo ?? state.bluffPseudo,
        })),

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
          likedFestivalIds: [],
          likedTournamentIds: [],
          rouletteLastPlayers: [],
          flipLastPlayers: [],
          flipLastGameType: 'holdem',
          bluffLastPlayers: [],
          bluffPseudo: '',
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
        likedFestivalIds: state.likedFestivalIds,
        likedTournamentIds: state.likedTournamentIds,
        rouletteLastPlayers: state.rouletteLastPlayers,
        flipLastPlayers: state.flipLastPlayers,
        flipLastGameType: state.flipLastGameType,
        bluffLastPlayers: state.bluffLastPlayers,
        bluffPseudo: state.bluffPseudo,
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
          state.likedFestivalIds = (state.likedFestivalIds ?? []).filter((id) =>
            state.festivals.some((f) => f.id === id)
          );
          state.likedTournamentIds = (state.likedTournamentIds ?? []).filter((id) =>
            state.tournaments.some((t) => t.id === id)
          );
          state.stats = computeStats(state.sessions, state.stakes);
          state.bankrollHistory = computeBankrollHistory(state.sessions, state.stakes);
          // Re-apply the persisted language choice — i18next inits with the device
          // locale and would otherwise silently override the user's setting on boot.
          // MMKV rehydration is synchronous, so this runs before the first frame.
          if (state.user?.settings?.language) {
            i18n.changeLanguage(state.user.settings.language);
          }
        }
      },
    }
  )
);
