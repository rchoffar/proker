import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { HandHistory } from '../types';
import { ApiError, deleteHand, getHand, getHands, putHand } from '../lib/api/client';
import { reconcile } from '../lib/handSync';
import { mmkvStorage } from './mmkvStorage';
import { getSessionToken } from './sessionToken';

// Local-first hand history: full payloads are cached in MMKV so the list and replay work
// offline; every change is queued and pushed opportunistically (on save and on tab focus).
// The server is the source of truth per user — see src/lib/handSync.ts for the rules.
interface HandHistoryStore {
  hands: Record<string, HandHistory>;
  pendingUpserts: string[];
  pendingDeletes: string[];
  lastSyncedAt: string | null;

  saveLocal: (hand: HandHistory) => void;
  remove: (id: string) => void;
  syncNow: () => Promise<void>;
  clearAll: () => void;
}

const addUnique = (list: string[], id: string) => (list.includes(id) ? list : [...list, id]);

// One sync at a time: focus events and auto-saves can overlap; the loser just skips —
// whatever it wanted to push is still queued and rides the next sync.
let syncInFlight = false;

export const useHandHistoryStore = create<HandHistoryStore>()(
  persist(
    (set, get) => ({
      hands: {},
      pendingUpserts: [],
      pendingDeletes: [],
      lastSyncedAt: null,

      saveLocal: (hand) => {
        set((state) => ({
          hands: { ...state.hands, [hand.id]: hand },
          pendingUpserts: addUnique(state.pendingUpserts, hand.id),
          // Re-saving a hand cancels any queued deletion of it (rewind after delete-retry).
          pendingDeletes: state.pendingDeletes.filter((id) => id !== hand.id),
        }));
        void get().syncNow();
      },

      remove: (id) => {
        set((state) => {
          const hands = { ...state.hands };
          delete hands[id];
          return {
            hands,
            pendingUpserts: state.pendingUpserts.filter((pending) => pending !== id),
            pendingDeletes: addUnique(state.pendingDeletes, id),
          };
        });
        void get().syncNow();
      },

      syncNow: async () => {
        if (syncInFlight) return;
        syncInFlight = true;
        try {
          const token = await getSessionToken();
          if (!token) return;

          // Push deletions first: a 404 means the server never saw the hand — same outcome.
          for (const id of [...get().pendingDeletes]) {
            try {
              await deleteHand(token, id);
            } catch (e) {
              if (!(e instanceof ApiError && e.status === 404)) throw e;
            }
            set((state) => ({ pendingDeletes: state.pendingDeletes.filter((pending) => pending !== id) }));
          }

          // Push local changes before pulling, so the pull can't drop unsent hands.
          for (const id of [...get().pendingUpserts]) {
            const hand = get().hands[id];
            if (hand) await putHand(token, hand);
            set((state) => ({ pendingUpserts: state.pendingUpserts.filter((pending) => pending !== id) }));
          }

          const { hands: serverHands } = await getHands(token);
          const state = get();
          const { toFetch, toDrop } = reconcile(
            Object.keys(state.hands),
            state.pendingUpserts,
            state.pendingDeletes,
            serverHands.map((h) => h.id)
          );

          // Payloads are fetched only when missing locally: zero requests in the common
          // single-device case, a full re-hydrate after a reinstall or sign-in.
          for (const id of toFetch) {
            const { hand } = await getHand(token, id);
            set((s) => ({ hands: { ...s.hands, [hand.id]: hand } }));
          }
          if (toDrop.length > 0) {
            set((s) => {
              const hands = { ...s.hands };
              toDrop.forEach((id) => delete hands[id]);
              return { hands };
            });
          }
          set({ lastSyncedAt: new Date().toISOString() });
        } catch {
          // Offline ou serveur injoignable : tout reste en file, retenté au prochain
          // focus de l'onglet ou à la prochaine sauvegarde.
        } finally {
          syncInFlight = false;
        }
      },

      clearAll: () => {
        set({ hands: {}, pendingUpserts: [], pendingDeletes: [], lastSyncedAt: null });
      },
    }),
    {
      name: 'proker-hand-history',
      storage: createJSONStorage(() => mmkvStorage),
      partialize: (state) => ({
        hands: state.hands,
        pendingUpserts: state.pendingUpserts,
        pendingDeletes: state.pendingDeletes,
        lastSyncedAt: state.lastSyncedAt,
      }),
    }
  )
);

// Appelé à la déconnexion / suppression de compte : les mains en cache appartiennent au
// compte qui part, les garder les ferait fuiter vers le prochain compte sur cet appareil.
export function clearHandHistory(): void {
  useHandHistoryStore.getState().clearAll();
}
