import type { TFunction } from 'i18next';
import type { Rank } from '../../types/hand';
import type { Claim, ClaimCategory } from './claims';

// Pure formatting helpers: no i18n state here — the caller passes its `t`.

function rankName(t: TFunction, rank: Rank, opts?: { plural?: boolean }): string {
  return t(`poker:ranks.${rank}.${opts?.plural ? 'plural' : 'singular'}`);
}

// French elision ("Paire d’as" instead of "Paire de as") — the `_elision` template
// variants exist in both languages (identical text in en), selected via i18next context.
function elisionContext(rank: Rank): { context: 'elision' } | undefined {
  return rank === 'A' ? { context: 'elision' } : undefined;
}

export function categoryLabel(category: ClaimCategory, t: TFunction): string {
  return t(`poker:handCategories.${category}`);
}

export function claimLabel(claim: Claim, t: TFunction): string {
  switch (claim.category) {
    case 'pair':
      return t('bluff:claims.pair', {
        rank: rankName(t, claim.rank, { plural: true }),
        ...elisionContext(claim.rank),
      });
    case 'twoPair':
      return t('bluff:claims.twoPair', {
        high: rankName(t, claim.high, { plural: true }),
        low: rankName(t, claim.low, { plural: true }),
      });
    case 'straight':
      return t('bluff:claims.straight', { high: rankName(t, claim.high) });
    case 'trips':
      return t('bluff:claims.trips', {
        rank: rankName(t, claim.rank, { plural: true }),
        ...elisionContext(claim.rank),
      });
    case 'flush':
      return t('bluff:claims.flush', { high: rankName(t, claim.high) });
    case 'fullHouse':
      return t('bluff:claims.fullHouse', {
        trips: rankName(t, claim.trips, { plural: true }),
        pair: rankName(t, claim.pair, { plural: true }),
      });
    case 'quads':
      return t('bluff:claims.quads', {
        rank: rankName(t, claim.rank, { plural: true }),
        ...elisionContext(claim.rank),
      });
    case 'straightFlush':
      return t('bluff:claims.straightFlush', { high: rankName(t, claim.high) });
    case 'royalFlush':
      return t('bluff:claims.royalFlush');
  }
}

/** Compact form for the table caption ("Paire de rois" stays short; params abbreviated). */
export function claimShortLabel(claim: Claim, t: TFunction): string {
  switch (claim.category) {
    case 'twoPair':
      return t('bluff:claims.twoPairShort', {
        high: rankName(t, claim.high, { plural: true }),
        low: rankName(t, claim.low, { plural: true }),
      });
    case 'fullHouse':
      return t('bluff:claims.fullHouseShort', {
        trips: rankName(t, claim.trips, { plural: true }),
        pair: rankName(t, claim.pair, { plural: true }),
      });
    default:
      return claimLabel(claim, t);
  }
}
