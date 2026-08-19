import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Trophy, Banknote } from 'lucide-react-native';
import { GlassCard } from '../ui/GlassCard';
import { formatAmount, formatDateShort } from '../../lib/format';
import { fontFamily, fontSize, spacing, radius } from '../../design-system/theme';
import { useTheme } from '../../design-system/ThemeProvider';
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

function signedAmount(val: number): string {
  return `${val < 0 ? '-' : '+'}${formatAmount(val)}`;
}

export function SessionRow({ session, festival, tournament, onPress }: Props) {
  const { t } = useTranslation('tracker');
  const { colors } = useTheme();
  const profit = getProfit(session);
  const isPositive = profit >= 0;
  const profitColor = isPositive ? colors.accent : colors.loss;
  const isTournament = session.type === 'tournament';

  const typeLabel = isTournament ? t('types.tournament') : t('types.cash');
  const titleName = isTournament ? (tournament?.name ?? festival?.name ?? session.venue) : session.venue;
  const venue = isTournament ? (festival?.name ?? session.venue) : session.venue;
  const detail = isTournament
    ? (session.reEntries > 0 ? t('row.reEntries', { count: session.reEntries }) : t('row.noReEntry'))
    : `${session.stakes} ${session.gameType}`;

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.75}>
      <GlassCard padding={0} style={styles.card}>
        <View style={styles.content}>
          <View style={[styles.iconTile, { backgroundColor: isTournament ? colors.accentTint : colors.neutralTileBg }]}>
            {isTournament
              ? <Trophy size={18} color={colors.accent} strokeWidth={1.8} />
              : <Banknote size={18} color={colors.textSecondary} strokeWidth={1.8} />}
          </View>
          <View style={styles.left}>
            <Text style={[styles.primary, { color: colors.textPrimary }]} numberOfLines={1}>{titleName} · {typeLabel}</Text>
            <Text style={[styles.secondary, { color: colors.textSecondary }]} numberOfLines={1}>{venue} · {detail}</Text>
          </View>
          <View style={styles.right}>
            <Text style={[styles.profit, { color: profitColor }]}>
              {signedAmount(profit)}
            </Text>
            <Text style={[styles.meta, { color: colors.textTertiary }]}>
              {formatDateShort(session.date.slice(0, 10))} · {t('hoursShort', { hours: session.durationHours })}
            </Text>
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
    fontSize: fontSize.md,
    fontFamily: fontFamily.bold,
    fontVariant: ['tabular-nums'],
  },
  meta: {
    fontSize: fontSize.xs,
    fontFamily: fontFamily.regular,
  },
});
