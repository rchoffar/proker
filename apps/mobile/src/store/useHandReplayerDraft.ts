import { create } from 'zustand';
import type { HandHistory } from '../types';

interface HandReplayerDraftStore {
  hand: HandHistory | null;
  setHand: (hand: HandHistory) => void;
  clear: () => void;
}

// Intentionally NOT persisted (no MMKV/zustand `persist` middleware): this is a transient
// bridge to carry the just-built hand from the builder screen to the replay screen without
// serializing it into router params.
export const useHandReplayerDraft = create<HandReplayerDraftStore>((set) => ({
  hand: null,
  setHand: (hand) => set({ hand }),
  clear: () => set({ hand: null }),
}));
