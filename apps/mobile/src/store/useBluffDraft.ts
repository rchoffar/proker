import { create } from 'zustand';
import type { Player } from '../types';
import type { BluffVariant } from '../lib/bluff';

export type BluffMode = 'passPlay';

interface BluffDraftStore {
  mode: BluffMode;
  players: Player[];
  jeuMax: boolean;
  variant: BluffVariant;
  setDraft: (draft: {
    mode: BluffMode;
    players?: Player[];
    jeuMax?: boolean;
    variant?: BluffVariant;
  }) => void;
  clear: () => void;
}

// Intentionally NOT persisted (no MMKV/zustand `persist` middleware): this is a transient
// bridge to carry the confirmed setup (players and rules) from the setup screen
// to the play screens without serializing it into router params.
export const useBluffDraft = create<BluffDraftStore>((set) => ({
  mode: 'passPlay',
  players: [],
  jeuMax: false,
  variant: 'standard',
  setDraft: ({ mode, players = [], jeuMax = false, variant = 'standard' }) =>
    set({ mode, players, jeuMax, variant }),
  clear: () => set({ mode: 'passPlay', players: [], jeuMax: false, variant: 'standard' }),
}));
