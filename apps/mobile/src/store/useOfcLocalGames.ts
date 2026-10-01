import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { OfcState } from '../lib/ofc';
import { mmkvStorage } from './mmkvStorage';

export interface SavedOfcGame {
  state: OfcState;
  startingStack: number;
  statsHand: number | null;
  gameOverRecorded: boolean;
}
interface LocalGamesStore {
  games: Record<string, SavedOfcGame>;
  activeId: string | null;
  select: (id: string | null) => void;
  save: (id: string, game: SavedOfcGame) => void;
}
export const useOfcLocalGames = create<LocalGamesStore>()(persist((set) => ({
  games: {},
  activeId: null,
  select: activeId => set({ activeId }),
  save: (id, game) => set(s => ({ games: { ...s.games, [id]: game } })),
}), {
  name: 'ofc-local-games',
  storage: createJSONStorage(() => mmkvStorage),
  partialize: s => ({ games: s.games }),
}));
