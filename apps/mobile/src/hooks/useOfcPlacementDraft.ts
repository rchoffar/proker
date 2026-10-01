import { useState } from 'react';
import type { OfcPlacement } from '../lib/ofc';
import { mmkvStorage } from '../store/mmkvStorage';
import { RANKS, SUITS } from '../types/hand';

/** Optional per-game staging; local pass-and-play never writes an online draft. */
export function useOfcPlacementDraft(key?: string) {
  const [placements, setState] = useState<OfcPlacement[]>(() => {
    if (!key) return [];
    try {
      const saved: unknown = JSON.parse(mmkvStorage.getItem(key) ?? '[]');
      if (!Array.isArray(saved) || saved.length > 13 || !saved.every(p => p && ['top', 'middle', 'bottom'].includes(p.row) && p.card && RANKS.includes(p.card.rank) && SUITS.includes(p.card.suit))) return [];
      return saved as OfcPlacement[];
    } catch { return []; }
  });
  const setPlacements = (next: OfcPlacement[]) => {
    setState(next);
    if (key) mmkvStorage.setItem(key, JSON.stringify(next));
  };
  return [placements, setPlacements] as const;
}
