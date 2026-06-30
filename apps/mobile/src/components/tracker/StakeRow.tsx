import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { GlassCard } from '../ui/GlassCard';
import { colors, fontFamily, fontSize, spacing, radius } from '../../design-system/theme';
import type { Stake, Player, Festival, Tournament } from '../../types';

const STAKE_COLOR = '#6366F1';

interface Props {
  stake: Stake;
  player?: Player;
  festival?: Festival;
  tournament?: Tournament;
  onPress?: () => void;
}

function formatCurrency(val: number): string {
  const abs = Math.abs(val);
  const sign = val < 0 ? '-' : '+';
  return `${sign}${abs.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')} €`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}

export function StakeRow({ stake, player, festival, tournament, onPress }: Props) {
  const invested = (stake.percentage / 100) * stake.buyIn;
  const myReturn = stake.settled && stake.cashed
    ? (stake.percentage / 100) * (stake.theirCashout ?? 0)
    : 0;
  const profit = myReturn - invested;

  const tournamentLabel = tournament?.name ?? null;
  const festivalLabel = festival?.name ?? null;

  const primaryLabel = player?.name ?? '—';
  const secondaryLabel = [festivalLabel, tournamentLabel].filter(Boolean).join(' · ') || '—';

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.78}>
      <GlassCard variant="dark" padding={0} style={styles.card}>
        <View style={[styles.bar, { backgroundColor: STAKE_COLOR }]} />
        <View style={styles.content}>
          <View style={styles.left}>
            <View style={styles.pill}>
              <Text style={styles.pillText}>Staking</Text>
            </View>
            <Text style={styles.primary} numberOfLines={1}>{primaryLabel}</Text>
            <Text style={styles.secondary} numberOfLines={1}>{secondaryLabel}</Text>
          </View>
          <View style={styles.right}>
            {stake.settled ? (
              <Text style={[styles.profit, { color: profit >= 0 ? colors.profit : colors.loss }]}>
                {formatCurrency(profit)}
              </Text>
            ) : (
              <Text style={styles.pending}>En attente</Text>
            )}
            <Text style={styles.meta}>{formatDate(stake.date)}</Text>
            <Text style={styles.meta}>{stake.percentage}%</Text>
          </View>
        </View>
      </GlassCard>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    overflow: 'hidden',
  },
  bar: {
    width: 3,
  },
  content: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.md,
    gap: spacing.sm,
  },
  left: {
    flex: 1,
    gap: 3,
  },
  right: {
    alignItems: 'flex-end',
    gap: 3,
  },
  pill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: radius.full,
    backgroundColor: 'rgba(99,102,241,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(99,102,241,0.30)',
    marginBottom: 2,
  },
  pillText: {
    color: '#A5B4FC',
    fontSize: fontSize.xs - 1,
    fontFamily: fontFamily.semibold,
    letterSpacing: 0.3,
  },
  primary: {
    color: colors.textPrimary,
    fontSize: fontSize.base,
    fontFamily: fontFamily.semibold,
  },
  secondary: {
    color: colors.textTertiary,
    fontSize: fontSize.xs,
    fontFamily: fontFamily.regular,
  },
  profit: {
    fontSize: fontSize.base,
    fontFamily: fontFamily.bold,
    fontVariant: ['tabular-nums'],
  },
  pending: {
    color: colors.textTertiary,
    fontSize: fontSize.sm,
    fontFamily: fontFamily.medium,
    fontStyle: 'italic',
  },
  meta: {
    color: colors.textTertiary,
    fontSize: fontSize.xs,
    fontFamily: fontFamily.regular,
  },
});
