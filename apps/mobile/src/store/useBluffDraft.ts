import { create } from 'zustand';
import type { Player } from '../types';

export type BluffMode = 'passPlay' | 'host' | 'guest';

interface BluffDraftStore {
  mode: BluffMode;
  players: Player[]; // passPlay only
  pseudo: string; // online modes
  joinCode: string | null; // guest only
  setDraft: (draft: { mode: BluffMode; players?: Player[]; pseudo?: string; joinCode?: string | null }) => void;
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
  setDraft: ({ mode, players = [], pseudo = '', joinCode = null }) =>
    set({ mode, players, pseudo, joinCode }),
  clear: () => set({ mode: 'passPlay', players: [], pseudo: '', joinCode: null }),
}));
