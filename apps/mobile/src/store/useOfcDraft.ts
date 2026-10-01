import { create } from 'zustand';
import type { OfcVariant } from '../lib/ofc';
import type { Player } from '../types';

export type OfcMode = 'passPlay';

interface OfcDraftStore {
  mode: OfcMode;
  players: Player[];
  startingStack: number;
  variant: OfcVariant;
  setDraft: (draft: {
    mode: OfcMode;
    players?: Player[];
    startingStack?: number;
    variant?: OfcVariant;
  }) => void;
  clear: () => void;
}

// Intentionally NOT persisted (no MMKV/zustand `persist` middleware): this is a transient
// bridge to carry the confirmed setup (players and rules) from the setup screen
// to the play screens without serializing it into router params.
export const useOfcDraft = create<OfcDraftStore>((set) => ({
  mode: 'passPlay',
  players: [],
  startingStack: 100,
  variant: 'classic',
  setDraft: ({ mode, players = [], startingStack = 100, variant = 'classic' }) =>
    set({ mode, players, startingStack, variant }),
  clear: () =>
    set({ mode: 'passPlay', players: [], startingStack: 100, variant: 'classic' }),
}));
