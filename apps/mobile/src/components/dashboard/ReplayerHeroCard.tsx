import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { ChevronRight, History, Plus } from 'lucide-react-native';
import { GlassCard } from '../ui/GlassCard';
import { formatDateShort } from '../../lib/format';
import { fontFamily, fontSize, spacing } from '../../design-system/theme';
import { useTheme } from '../../design-system/ThemeProvider';
import type { HandHistory } from '../../types';

// The replayer's featured spot on the home screen: gold-accented (the app's "poker table"
// color, deliberately distinct from the money green), showing the two most recent hands
// and a new-hand CTA. Replaces the plain game tile the replayer used to hide behind.

interface Props {
  // Newest-first, already sliced to ≤2 by the caller.
  hands: HandHistory[];
  onOpenHand: (hand: HandHistory) => void;
  onNewHand: () => void;
}

export function ReplayerHeroCard({ hands, onOpenHand, onNewHand }: Props) {
  const { t } = useTranslation(['dashboard', 'replayer']);
  const { colors } = useTheme();

  return (
    <GlassCard padding={16} style={{ borderColor: colors.goldTint, borderWidth: 1 }}>
      <View style={styles.headerRow}>
        <View style={[styles.iconDisc, { backgroundColor: colors.goldTint }]}>
          <History size={18} color={colors.gold} strokeWidth={1.8} />
        </View>
        <View style={styles.headerText}>
          <Text style={[styles.title, { color: colors.textPrimary }]} numberOfLines={1}>
            {t('dashboard:games.replayTitle')}
          </Text>
          <Text style={[styles.subtitle, { color: colors.textTertiary }]} numberOfLines={1}>
            {hands.length > 0 ? t('dashboard:games.replayDesc') : t('replayer:list.empty.title')}
          </Text>
        </View>
        <TouchableOpacity
          style={[styles.newBtn, { backgroundColor: colors.goldTint }]}
          onPress={onNewHand}
          activeOpacity={0.8}
          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
        >
          <Plus size={14} color={colors.gold} strokeWidth={2.5} />
          <Text style={[styles.newBtnText, { color: colors.gold }]}>{t('replayer:list.newHand')}</Text>
        </TouchableOpacity>
      </View>

      {hands.map((hand) => (
        <TouchableOpacity
          key={hand.id}
          activeOpacity={0.75}
          onPress={() => onOpenHand(hand)}
          style={[styles.row, { borderTopColor: colors.hairline }]}
        >
          <View style={styles.rowInfo}>
            <Text style={[styles.rowTitle, { color: colors.textPrimary }]} numberOfLines={1}>
              {hand.title || t('replayer:untitledHand')}
            </Text>
            <Text style={[styles.rowSub, { color: colors.textTertiary }]} numberOfLines={1}>
              {hand.stakes
                ? t('replayer:list.rowMetaWithStakes', {
                    date: formatDateShort(hand.createdAt.slice(0, 10)),
                    stakes: hand.stakes,
                  })
                : formatDateShort(hand.createdAt.slice(0, 10))}
            </Text>
          </View>
          <ChevronRight size={18} color={colors.textTertiary} strokeWidth={1.8} />
        </TouchableOpacity>
      ))}
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  iconDisc: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: {
    flex: 1,
    gap: 1,
  },
  title: {
    fontSize: fontSize.base,
    fontFamily: fontFamily.bold,
  },
  subtitle: {
    fontSize: fontSize.xs,
    fontFamily: fontFamily.regular,
  },
  newBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 999,
  },
  newBtnText: {
    fontSize: fontSize.xs,
    fontFamily: fontFamily.bold,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    marginTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  rowInfo: {
    flex: 1,
    gap: 2,
  },
  rowTitle: {
    fontSize: fontSize.sm,
    fontFamily: fontFamily.semibold,
  },
  rowSub: {
    fontSize: fontSize.xs,
    fontFamily: fontFamily.regular,
  },
});
