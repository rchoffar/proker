import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Users } from 'lucide-react-native';
import { GlassCard } from '../ui/GlassCard';
import { formatAmount, formatDateShort } from '../../lib/format';
import { fontFamily, fontSize, spacing, radius } from '../../design-system/theme';
import { useTheme } from '../../design-system/ThemeProvider';
import type { Stake, Player, Festival, Tournament } from '../../types';

interface Props {
  stake: Stake;
  player?: Player;
  festival?: Festival;
  tournament?: Tournament;
  onPress?: () => void;
}

function signedAmount(val: number): string {
  return `${val < 0 ? '-' : '+'}${formatAmount(val)}`;
}

export function StakeRow({ stake, player, festival, tournament, onPress }: Props) {
  const { t } = useTranslation('tracker');
  const { colors } = useTheme();
  const invested = (stake.percentage / 100) * stake.buyIn;
  const myReturn = stake.settled && stake.cashed
    ? (stake.percentage / 100) * (stake.theirCashout ?? 0)
    : 0;
  const profit = myReturn - invested;

  const tournamentLabel = tournament?.name ?? null;
  const festivalLabel = festival?.name ?? null;

  const primaryLabel = `${player?.name ?? '—'} · ${t('types.staking')}`;
  const secondaryLabel = [festivalLabel, tournamentLabel].filter(Boolean).join(' · ') || '—';

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.78}>
      <GlassCard padding={0} style={styles.card}>
        <View style={styles.content}>
          <View style={[styles.iconTile, { backgroundColor: colors.neutralTileBg }]}>
            <Users size={18} color={colors.textSecondary} strokeWidth={1.8} />
          </View>
          <View style={styles.left}>
            <Text style={[styles.primary, { color: colors.textPrimary }]} numberOfLines={1}>{primaryLabel}</Text>
            <Text style={[styles.secondary, { color: colors.textTertiary }]} numberOfLines={1}>{secondaryLabel}</Text>
          </View>
          <View style={styles.right}>
            {stake.settled ? (
              <Text style={[styles.profit, { color: profit >= 0 ? colors.accent : colors.loss }]}>
                {signedAmount(profit)}
              </Text>
            ) : (
              <Text style={[styles.pending, { color: colors.textTertiary }]}>{t('status.pending')}</Text>
            )}
            <Text style={[styles.meta, { color: colors.textTertiary }]}>{formatDateShort(stake.date.slice(0, 10))} · {t('percent', { value: stake.percentage })}</Text>
          </View>
        </View>
      </GlassCard>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    overflow: 'hidden',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.md,
    gap: spacing.md,
  },
  iconTile: {
    width: 40,
    height: 40,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  left: {
    flex: 1,
    gap: 3,
  },
  right: {
    alignItems: 'flex-end',
    gap: 4,
  },
  primary: {
    fontSize: fontSize.base,
    fontFamily: fontFamily.semibold,
  },
  secondary: {
    fontSize: fontSize.sm,
    fontFamily: fontFamily.regular,
  },
  profit: {
    fontSize: fontSize.base,
    fontFamily: fontFamily.bold,
    fontVariant: ['tabular-nums'],
  },
  pending: {
    fontSize: fontSize.sm,
    fontFamily: fontFamily.medium,
    fontStyle: 'italic',
  },
  meta: {
    fontSize: fontSize.xs,
    fontFamily: fontFamily.regular,
  },
});
