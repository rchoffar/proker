import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import * as Haptics from 'expo-haptics';
import { BottomSheet } from '../ui/BottomSheet';
import { RankGrid } from './RankGrid';
import {
  CATEGORY_ORDER,
  FLUSH_HIGHS,
  SF_HIGHS,
  STRAIGHT_HIGHS,
  allowedPrimaryRanksOnBoard,
  allowedSecondaryRanksOnBoard,
  categoryHasAllowedClaim,
  categoryLabel,
  claimLabel,
  isClaimForbiddenByBoard,
  isStrictlyHigher,
} from '../../lib/bluff';
import type { Claim, ClaimCategory, FlushHigh, SFHigh, StraightHigh } from '../../lib/bluff';
import type { Card } from '../../types';
import { TABLE } from '../hand/PokerTable';
import { fontFamily, fontSize, radius, spacing } from '../../design-system/theme';
import { useTheme } from '../../design-system/ThemeProvider';
import type { Rank } from '../../types';

interface Props {
  visible: boolean;
  onClose: () => void;
  currentClaim: Claim | null;
  // Face-up middle cards — they forbid vacuous/dominated announcements (domination.ts).
  board: Card[];
  onSubmit: (claim: Claim) => void;
}

const RANK_DOMAINS: Partial<Record<ClaimCategory, Rank[]>> = {
  straight: STRAIGHT_HIGHS,
  flush: FLUSH_HIGHS,
  straightFlush: SF_HIGHS,
};

function buildDraft(category: ClaimCategory | null, primary: Rank | null, secondary: Rank | null): Claim | null {
  if (!category) return null;
  switch (category) {
    case 'pair':
    case 'trips':
    case 'quads':
      return primary ? { category, rank: primary } : null;
    case 'twoPair':
      // Low pair is picked first (primary), then the high — matches how it's said at the table.
      return primary && secondary ? { category, high: secondary, low: primary } : null;
    case 'fullHouse':
      return primary && secondary ? { category, trips: primary, pair: secondary } : null;
    case 'straight':
      return primary ? { category, high: primary as StraightHigh } : null;
    case 'flush':
      return primary ? { category, high: primary as FlushHigh } : null;
    case 'straightFlush':
      return primary ? { category, high: primary as SFHigh } : null;
    case 'royalFlush':
      return { category };
  }
}

export function ClaimPickerSheet({ visible, onClose, currentClaim, board, onSubmit }: Props) {
  const { t } = useTranslation('bluff');
  const { colors } = useTheme();
  const [category, setCategory] = useState<ClaimCategory | null>(null);
  const [primary, setPrimary] = useState<Rank | null>(null);
  const [secondary, setSecondary] = useState<Rank | null>(null);

  // Fresh draft every time the sheet opens (the claim to beat changes between turns).
  useEffect(() => {
    if (visible) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reset transient draft on open
      setCategory(null);
      setPrimary(null);
      setSecondary(null);
    }
  }, [visible]);

  const draft = buildDraft(category, primary, secondary);
  const canSubmit =
    draft !== null && isStrictlyHigher(draft, currentClaim) && !isClaimForbiddenByBoard(draft, board);

  const primaryAllowed = useMemo(
    () => (category ? allowedPrimaryRanksOnBoard(category, currentClaim, board) : new Set<Rank>()),
    [category, currentClaim, board],
  );
  const secondaryAllowed = useMemo(() => {
    if ((category !== 'twoPair' && category !== 'fullHouse') || !primary) return new Set<Rank>();
    return allowedSecondaryRanksOnBoard(category, primary, currentClaim, board);
  }, [category, primary, currentClaim, board]);

  const pickCategory = (cat: ClaimCategory) => {
    Haptics.selectionAsync();
    setCategory(cat);
    setPrimary(null);
    setSecondary(null);
  };

  const pickPrimary = (rank: Rank) => {
    setPrimary(rank);
    setSecondary(null);
  };

  const handleSubmit = () => {
    if (!draft) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onSubmit(draft);
  };

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title={t('picker.title')}
      footer={
        <TouchableOpacity
          style={[styles.submitBtn, { backgroundColor: colors.accentBright }, !canSubmit && styles.disabledBtn]}
          onPress={handleSubmit}
          disabled={!canSubmit}
          activeOpacity={0.85}
        >
          <Text style={styles.submitText}>
            {draft ? t('picker.announceClaim', { claim: claimLabel(draft, t).toLowerCase() }) : t('picker.title')}
          </Text>
        </TouchableOpacity>
      }
    >
      <View style={styles.stack}>
        <View style={[styles.toBeat, { borderColor: TABLE.goldDeep, backgroundColor: colors.neutralTileBg }]}>
          <Text style={[styles.toBeatLabel, { color: colors.textTertiary }]}>{t('picker.toBeat')}</Text>
          <Text style={[styles.toBeatValue, { color: currentClaim ? TABLE.goldDeep : colors.textSecondary }]}>
            {currentClaim ? claimLabel(currentClaim, t) : t('picker.noClaim')}
          </Text>
        </View>

        <View style={styles.categoryGrid}>
          {CATEGORY_ORDER.map((cat) => {
            const enabled = categoryHasAllowedClaim(cat, currentClaim, board);
            const active = cat === category;
            return (
              <TouchableOpacity
                key={cat}
                onPress={() => pickCategory(cat)}
                disabled={!enabled}
                activeOpacity={0.8}
                style={[
                  styles.categoryChip,
                  { borderColor: colors.surface.fieldBorder, backgroundColor: colors.surface.fieldBg },
                  active && { borderColor: colors.accent, backgroundColor: colors.accentTint },
                  !enabled && styles.disabledChip,
                ]}
              >
                <Text style={[styles.categoryText, { color: active ? colors.accent : colors.textSecondary }]}>
                  {categoryLabel(cat, t)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {category && category !== 'royalFlush' ? (
          <RankGrid
            label={t(`picker.primary.${category}`)}
            value={primary}
            onChange={pickPrimary}
            allowed={primaryAllowed}
            domain={RANK_DOMAINS[category]}
          />
        ) : null}
        {category === 'straight' && (
          <Text style={[styles.hint, { color: colors.textTertiary }]}>{t('picker.wheelHint')}</Text>
        )}

        {(category === 'twoPair' || category === 'fullHouse') && primary ? (
          <RankGrid
            label={category === 'twoPair' ? t('picker.highPair') : t('picker.pairOf')}
            value={secondary}
            onChange={setSecondary}
            allowed={secondaryAllowed}
          />
        ) : null}

        {draft ? (
          <Text style={[styles.preview, { color: TABLE.goldDeep }]}>{claimLabel(draft, t)}</Text>
        ) : null}
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: spacing.md,
  },
  toBeat: {
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.sm,
    gap: 2,
  },
  toBeatLabel: {
    fontSize: fontSize.xs,
    fontFamily: fontFamily.medium,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  toBeatValue: {
    fontSize: fontSize.base,
    fontFamily: fontFamily.bold,
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  categoryChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    borderWidth: 1,
  },
  disabledChip: {
    opacity: 0.3,
  },
  categoryText: {
    fontSize: fontSize.sm,
    fontFamily: fontFamily.semibold,
  },
  hint: {
    fontSize: fontSize.xs,
    fontFamily: fontFamily.regular,
  },
  preview: {
    fontSize: fontSize.lg,
    fontFamily: fontFamily.display,
    textAlign: 'center',
    paddingVertical: spacing.sm,
  },
  submitBtn: {
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  disabledBtn: {
    opacity: 0.4,
  },
  submitText: {
    color: '#0A0A0F',
    fontSize: fontSize.md,
    fontFamily: fontFamily.bold,
  },
});
