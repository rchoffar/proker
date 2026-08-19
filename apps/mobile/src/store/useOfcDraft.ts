import { create } from 'zustand';
import type { OfcVariant } from '../lib/ofc';
import type { Player } from '../types';

export type OfcMode = 'passPlay' | 'host' | 'guest';

interface OfcDraftStore {
  mode: OfcMode;
  players: Player[]; // passPlay only
  startingStack: number;
  variant: OfcVariant; // passPlay + host (the game creator picks the mode)
  pseudo: string; // online modes
  joinCode: string | null; // guest only
  setDraft: (draft: {
    mode: OfcMode;
    players?: Player[];
    startingStack?: number;
    variant?: OfcVariant;
    pseudo?: string;
    joinCode?: string | null;
  }) => void;
  clear: () => void;
}

// Intentionally NOT persisted (no MMKV/zustand `persist` middleware): this is a transient
// bridge to carry the confirmed setup (players or online identity) from the setup screen
// to the play screens without serializing it into router params.
export const useOfcDraft = create<OfcDraftStore>((set) => ({
  mode: 'passPlay',
  players: [],
  startingStack: 100,
  variant: 'classic',
  pseudo: '',
  joinCode: null,
  setDraft: ({ mode, players = [], startingStack = 100, variant = 'classic', pseudo = '', joinCode = null }) =>
    set({ mode, players, startingStack, variant, pseudo, joinCode }),
  clear: () =>
    set({ mode: 'passPlay', players: [], startingStack: 100, variant: 'classic', pseudo: '', joinCode: null }),
}));
