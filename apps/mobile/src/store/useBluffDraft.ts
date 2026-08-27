import { create } from 'zustand';
import type { Player } from '../types';
import type { BluffVariant } from '../lib/bluff';

export type BluffMode = 'passPlay' | 'host' | 'guest';

interface BluffDraftStore {
  mode: BluffMode;
  players: Player[]; // passPlay only
  pseudo: string; // online modes
  joinCode: string | null; // guest only
  jeuMax: boolean; // passPlay + host — guests learn it from the host's state
  variant: BluffVariant; // passPlay + host — guests learn it from the host's state
  setDraft: (draft: {
    mode: BluffMode;
    players?: Player[];
    pseudo?: string;
    joinCode?: string | null;
    jeuMax?: boolean;
    variant?: BluffVariant;
  }) => void;
  clear: () => void;
}

// Intentionally NOT persisted (no MMKV/zustand `persist` middleware): this is a transient
// bridge to carry the confirmed setup (players or online identity) from the setup screen
// to the play screens without serializing it into router params.
export const useBluffDraft = create<BluffDraftStore>((set) => ({
  mode: 'passPlay',
  players: [],
  pseudo: '',
  joinCode: null,
  jeuMax: false,
  variant: 'standard',
  setDraft: ({ mode, players = [], pseudo = '', joinCode = null, jeuMax = false, variant = 'standard' }) =>
    set({ mode, players, pseudo, joinCode, jeuMax, variant }),
  clear: () => set({ mode: 'passPlay', players: [], pseudo: '', joinCode: null, jeuMax: false, variant: 'standard' }),
}));
