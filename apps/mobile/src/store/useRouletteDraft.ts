import { create } from 'zustand';
import type { Player } from '../types';

interface RouletteDraftStore {
  players: Player[];
  setPlayers: (players: Player[]) => void;
}

// Intentionally NOT persisted (no MMKV/zustand `persist` middleware): this is a transient
// bridge to carry the confirmed player list from the setup screen to the play screen without
// serializing it into router params.
export const useRouletteDraft = create<RouletteDraftStore>((set) => ({
  players: [],
  setPlayers: (players) => set({ players }),
}));
