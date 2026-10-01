import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { BluffState } from '../lib/bluff';
import { mmkvStorage } from './mmkvStorage';

export interface SavedBluffGame {
  state: BluffState;
  statsRound: number | null;
  gameOverRecorded: boolean;
}
interface LocalGamesStore {
  games: Record<string, SavedBluffGame>;
  activeId: string | null;
  select: (id: string | null) => void;
  save: (id: string, game: SavedBluffGame) => void;
}
export const useBluffLocalGames = create<LocalGamesStore>()(persist((set) => ({
  games: {},
  activeId: null,
  select: activeId => set({ activeId }),
  save: (id, game) => set(s => ({ games: { ...s.games, [id]: game } })),
}), {
  name: 'bluff-local-games',
  storage: createJSONStorage(() => mmkvStorage),
  partialize: s => ({ games: s.games }),
}));
