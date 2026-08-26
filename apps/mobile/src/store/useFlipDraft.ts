import { create } from 'zustand';
import type { Player } from '../types';
import type { FlipGameType } from '../lib/pokerHandEvaluator';

interface FlipDraftStore {
  players: Player[];
  gameType: FlipGameType;
  setDraft: (players: Player[], gameType: FlipGameType) => void;
}

// Intentionally NOT persisted (no MMKV/zustand `persist` middleware): this is a transient
// bridge to carry the confirmed player list + game type from the setup screen to the play
// screen without serializing it into router params.
export const useFlipDraft = create<FlipDraftStore>((set) => ({
  // TEMP-DEBUG: seeded players for simulator inspection — revert before commit
  players: [
    { id: 'dbg-1', name: 'Alice' },
    { id: 'dbg-2', name: 'Bob' },
    { id: 'dbg-3', name: 'Carol' },
  ],
  gameType: 'holdem',
  setDraft: (players, gameType) => set({ players, gameType }),
}));
