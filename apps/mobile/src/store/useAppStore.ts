import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { User, Player, Festival, Tournament, Country, Organizer } from '../types';
import { mockUser, mockFestivals, mockTournaments, mockCountries, mockOrganizers } from '../data/mock';
import i18n, { defaultLocale } from '../i18n';
import type { FlipGameType } from '../lib/pokerHandEvaluator';
import type { OfcVariant } from '../lib/ofc';
import type { GameStatsState } from '../lib/gameStats';
import { mmkvStorage } from './mmkvStorage';

interface AppStore {
  user: User;
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
  bluffJeuMax: boolean;
  ofcLastPlayers: Player[];
  ofcStartingStack: number;
  ofcVariant: OfcVariant;
  gameStats: GameStatsState;

  updateUser: (patch: Partial<User>) => void;
  addPlayer: (player: Player) => void;
  toggleLikedFestival: (festivalId: string) => void;
  toggleLikedTournament: (tournamentId: string) => void;
  setRouletteLastPlayers: (players: Player[]) => void;
  setFlipDraftDefaults: (players: Player[], gameType: FlipGameType) => void;
  setBluffDefaults: (patch: { players?: Player[]; jeuMax?: boolean }) => void;
  setOfcDefaults: (patch: {
    players?: Player[];
    startingStack?: number;
    variant?: OfcVariant;
  }) => void;
  updateGameStats: (updater: (prev: GameStatsState) => GameStatsState) => void;
  resetStore: () => void;
}

export const useAppStore = create<AppStore>()(
  persist(
    (set) => ({
      // First launch: follow the device locale; afterwards the persisted choice wins (rehydrate below).
      user: { ...mockUser, settings: { ...mockUser.settings, language: defaultLocale } },
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
      bluffJeuMax: false,
      ofcLastPlayers: [],
      ofcStartingStack: 100,
      ofcVariant: 'classic',
      gameStats: {},

      updateUser: (patch) =>
        set((state) => ({ user: { ...state.user, ...patch } })),

      addPlayer: (player) =>
        set((state) => ({ players: [...state.players, player] })),

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
          bluffJeuMax: patch.jeuMax ?? state.bluffJeuMax,
        })),

      setOfcDefaults: (patch) =>
        set((state) => ({
          ofcLastPlayers: patch.players ?? state.ofcLastPlayers,
          ofcStartingStack: patch.startingStack ?? state.ofcStartingStack,
          ofcVariant: patch.variant ?? state.ofcVariant,
        })),

      updateGameStats: (updater) =>
        set((state) => ({ gameStats: updater(state.gameStats) })),

      resetStore: () => {
        mmkvStorage.removeItem('proker-app-store');
        // Keep the chosen theme — a data reset shouldn't flip the app back to light.
        set((state) => ({
          user: { ...mockUser, settings: { ...mockUser.settings, theme: state.user.settings.theme } },
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
          bluffJeuMax: false,
          ofcLastPlayers: [],
          ofcStartingStack: 100,
          ofcVariant: 'classic',
          gameStats: {},
        }));
      },
    }),
    {
      name: 'proker-app-store',
      storage: createJSONStorage(() => mmkvStorage),
      partialize: (state) => ({
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
        bluffJeuMax: state.bluffJeuMax,
        ofcLastPlayers: state.ofcLastPlayers,
        ofcStartingStack: state.ofcStartingStack,
        ofcVariant: state.ofcVariant,
        gameStats: state.gameStats,
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
          // Older persisted blobs predate game stats — no persist `migrate` exists.
          state.gameStats = state.gameStats ?? {};
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
