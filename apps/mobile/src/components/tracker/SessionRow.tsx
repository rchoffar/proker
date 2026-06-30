import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { GlassCard } from '../ui/GlassCard';
import { colors, fontFamily, fontSize, spacing, radius } from '../../design-system/theme';
import type { Session, Festival, Tournament } from '../../types';

interface Props {
  session: Session;
  festival?: Festival;
  tournament?: Tournament;
  onPress?: () => void;
}

function getProfit(session: Session): number {
  if (session.type === 'tournament') {
    return session.cashOut - (session.reEntries + 1) * session.buyIn;
  }
  return session.cashOut - session.buyIn;
}

function formatCurrency(val: number): string {
  const abs = Math.abs(val);
  const sign = val < 0 ? '-' : '+';
  return `${sign}${abs.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')} €`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}

export function SessionRow({ session, festival, tournament, onPress }: Props) {
  const profit = getProfit(session);
  const isPositive = profit >= 0;
  const profitColor = isPositive ? colors.profit : colors.loss;

  const isTournament = session.type === 'tournament';
  const primaryLabel = session.type === 'tournament'
    ? (festival?.name ?? session.venue)
    : session.venue;
  const secondaryLabel = session.type === 'tournament'
    ? (tournament?.name ?? '')
    : `${session.stakes} ${session.gameType}`;

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.75}>
      <GlassCard padding={0} style={styles.card}>
        <View style={[styles.bar, { backgroundColor: profitColor }]} />
        <View style={styles.content}>
          <View style={styles.left}>
            <View style={[styles.pill, isTournament ? styles.pillTournament : styles.pillCash]}>
              <Text style={styles.pillText}>{isTournament ? 'Tournoi' : 'Cash'}</Text>
            </View>
            <Text style={styles.primary} numberOfLines={1}>{primaryLabel}</Text>
            {secondaryLabel ? (
              <Text style={styles.secondary} numberOfLines={1}>{secondaryLabel}</Text>
            ) : null}
          </View>
          <View style={styles.right}>
            <Text style={[styles.profit, { color: profitColor }]}>
              {formatCurrency(profit)}
            </Text>
            <Text style={styles.meta}>
              {formatDate(session.date)} · {session.durationHours}h
            </Text>
          </View>
        </View>
      </GlassCard>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
  },
  bar: {
    width: 3,
    borderTopLeftRadius: radius.xl,
    borderBottomLeftRadius: radius.xl,
  },
  content: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
    gap: 4,
  },
  pill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: radius.full,
    marginBottom: 3,
    backgroundColor: 'rgba(0, 200, 120, 0.12)',
  },
  pillTournament: {
    backgroundColor: 'rgba(255, 215, 0, 0.10)',
  },
  pillCash: {
    backgroundColor: 'rgba(0, 200, 120, 0.12)',
  },
  pillText: {
    color: colors.textSecondary,
    fontSize: fontSize.xs,
    fontFamily: fontFamily.semibold,
  },
  primary: {
    color: colors.textPrimary,
    fontSize: fontSize.base,
    fontFamily: fontFamily.semibold,
  },
  secondary: {
    color: colors.textSecondary,
    fontSize: fontSize.sm,
    fontFamily: fontFamily.regular,
  },
  profit: {
    fontSize: fontSize.md,
    fontFamily: fontFamily.bold,
  },
  meta: {
    color: colors.textTertiary,
    fontSize: fontSize.xs,
    fontFamily: fontFamily.regular,
  },
});
