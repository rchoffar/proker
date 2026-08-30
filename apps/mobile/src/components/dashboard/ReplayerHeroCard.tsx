import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { ChevronRight, History, Plus } from 'lucide-react-native';
import { GlassCard } from '../ui/GlassCard';
import { fontFamily, fontSize, spacing, radius } from '../../design-system/theme';
import { useTheme } from '../../design-system/ThemeProvider';

// The replayer's spot on the home screen: gold-accented (the app's "poker table" color,
// deliberately distinct from the money green), one row tall.
//
// It used to list the two most recent hands, which roughly doubled its height and pushed the
// games below the fold — on a games app, opening to a scroll. The list is one tap away in the
// Replayer tab, so the card carries only its two actions: creating a hand, and reaching the
// ones already saved. Both are real buttons rather than a pressable card with a tag on it —
// nothing here should be clickable without looking it.

interface Props {
  onNewHand: () => void;
  onOpenHands: () => void;
}

export function ReplayerHeroCard({ onNewHand, onOpenHands }: Props) {
  const { t } = useTranslation(['dashboard', 'replayer']);
  const { colors } = useTheme();

  return (
    <GlassCard padding={14} style={{ borderColor: colors.goldTint, borderWidth: 1 }}>
      <View style={styles.row}>
        <View style={[styles.iconDisc, { backgroundColor: colors.goldTint }]}>
          <History size={18} color={colors.gold} strokeWidth={1.8} />
        </View>
        <View style={styles.text}>
          <Text style={[styles.title, { color: colors.textPrimary }]} numberOfLines={1}>
            {t('dashboard:games.replayTitle')}
          </Text>
          <Text style={[styles.subtitle, { color: colors.textTertiary }]} numberOfLines={1}>
            {t('dashboard:games.replayDesc')}
          </Text>
        </View>
      </View>

      <View style={styles.actions}>
        <TouchableOpacity
          style={[styles.primaryBtn, { backgroundColor: colors.gold }]}
          onPress={onNewHand}
          activeOpacity={0.85}
        >
          <Plus size={15} color="#1A150F" strokeWidth={2.6} />
          <Text style={styles.primaryBtnText}>{t('replayer:list.newHand')}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.secondaryBtn, { borderColor: colors.goldTint }]}
          onPress={onOpenHands}
          activeOpacity={0.85}
        >
          <Text style={[styles.secondaryBtnText, { color: colors.gold }]}>{t('dashboard:games.myHands')}</Text>
          <ChevronRight size={15} color={colors.gold} strokeWidth={2.2} />
        </TouchableOpacity>
      </View>
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  iconDisc: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
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
  // Side by side and equal weight: two ways into the same feature, not a primary with an
  // afterthought beside it.
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  primaryBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: spacing.sm + 2,
    borderRadius: radius.md,
  },
  primaryBtnText: {
    color: '#1A150F',
    fontSize: fontSize.sm,
    fontFamily: fontFamily.bold,
  },
  secondaryBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    paddingVertical: spacing.sm + 2,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  secondaryBtnText: {
    fontSize: fontSize.sm,
    fontFamily: fontFamily.bold,
  },
});
