import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Heart, Users } from 'lucide-react-native';
import { GlassCard } from '../ui/GlassCard';
import { GlowBlob } from '../ui/GlowBlob';
import { colors, fontFamily, fontSize, spacing, radius } from '../../design-system/theme';
import type { Tournament, Festival } from '../../types';

interface Props {
  tournament: Tournament;
  festival?: Festival;
  variant?: 'full' | 'mini';
  onPress?: () => void;
}

function formatAmount(val: number): string {
  return `${val.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')} €`;
}

function formatDateParts(iso?: string): { day: string; month: string } {
  if (!iso) return { day: '', month: '' };
  const date = new Date(iso);
  return {
    day: date.toLocaleDateString('fr-FR', { day: '2-digit' }),
    month: date.toLocaleDateString('fr-FR', { month: 'short' }).replace('.', '').toUpperCase(),
  };
}

function Badge() {
  return (
    <View style={styles.badge}>
      <Heart size={11} color={colors.accentBright} strokeWidth={2} fill={colors.accentBright} />
      <Text style={styles.badgeText}>Coup de cœur</Text>
    </View>
  );
}

export function CoupDeCoeurCard({ tournament, festival, variant = 'full', onPress }: Props) {
  if (variant === 'mini') {
    const { day, month } = formatDateParts(tournament.startDate);
    const subtitle = [
      festival?.name,
      festival?.location,
      tournament.guaranteed ? `${formatAmount(tournament.guaranteed)} garantis` : null,
    ].filter(Boolean).join(' · ');

    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.85} disabled={!onPress}>
        <GlassCard variant="dark" padding={14} style={styles.card}>
          <GlowBlob size={110} top={-30} right={-30} />
          <View style={styles.miniRow}>
            {day ? (
              <>
                <View style={styles.miniDateBlock}>
                  <Text style={styles.miniDay}>{day}</Text>
                  <Text style={styles.miniMonth}>{month}</Text>
                </View>
                <View style={styles.miniDivider} />
              </>
            ) : null}
            <View style={styles.miniContent}>
              <Badge />
              <Text style={styles.name} numberOfLines={1}>{tournament.name}</Text>
              {subtitle ? <Text style={styles.venue} numberOfLines={1}>{subtitle}</Text> : null}
            </View>
            <View style={styles.buyInChip}>
              <Text style={styles.buyInText}>{formatAmount(tournament.buyIn)}</Text>
            </View>
          </View>
        </GlassCard>
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.85} disabled={!onPress}>
      <GlassCard variant="dark" padding={20} style={styles.card}>
        <GlowBlob />
        <View style={styles.headerRow}>
          <Badge />
          {tournament.guaranteed ? (
            <Text style={styles.guaranteed}>{formatAmount(tournament.guaranteed)} garantis</Text>
          ) : null}
        </View>

        {festival ? (
          <Text style={styles.venue} numberOfLines={1}>
            {festival.name}{festival.location ? ` · ${festival.location}` : ''}
          </Text>
        ) : null}
        <Text style={styles.name} numberOfLines={2}>{tournament.name}</Text>

        <View style={styles.footer}>
          <View style={styles.buyInChip}>
            <Text style={styles.buyInText}>{formatAmount(tournament.buyIn)}</Text>
          </View>
          {tournament.totalPlayers ? (
            <View style={styles.playersRow}>
              <Users size={11} color={colors.onDarkTertiary} strokeWidth={1.5} />
              <Text style={styles.meta}>{tournament.totalPlayers.toLocaleString('fr-FR')}</Text>
            </View>
          ) : null}
        </View>
      </GlassCard>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: 6,
    overflow: 'hidden',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.full,
    backgroundColor: colors.accentGlow,
    alignSelf: 'flex-start',
  },
  badgeText: {
    color: colors.accentBright,
    fontSize: fontSize.xs,
    fontFamily: fontFamily.semibold,
    letterSpacing: 0.3,
  },
  guaranteed: {
    color: colors.onDarkPrimary,
    fontSize: fontSize.sm,
    fontFamily: fontFamily.bold,
  },
  venue: {
    color: colors.onDarkTertiary,
    fontSize: fontSize.xs,
    fontFamily: fontFamily.medium,
    marginTop: 4,
  },
  name: {
    color: colors.onDarkPrimary,
    fontSize: fontSize.md,
    fontFamily: fontFamily.bold,
    marginTop: 4,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  meta: {
    color: colors.onDarkTertiary,
    fontSize: fontSize.xs,
    fontFamily: fontFamily.regular,
  },
  buyInChip: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.full,
    backgroundColor: colors.accentGlow,
  },
  buyInText: {
    color: colors.accentBright,
    fontSize: fontSize.xs,
    fontFamily: fontFamily.bold,
  },
  playersRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },

  // Mini (Dashboard "Prochains tournois")
  miniRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  miniDateBlock: {
    width: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  miniDay: {
    color: colors.onDarkPrimary,
    fontSize: fontSize.md,
    fontFamily: fontFamily.bold,
    fontVariant: ['tabular-nums'],
  },
  miniMonth: {
    color: colors.onDarkTertiary,
    fontSize: 9,
    fontFamily: fontFamily.semibold,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  miniDivider: {
    width: 1,
    alignSelf: 'stretch',
    backgroundColor: colors.onDarkHairline,
  },
  miniContent: {
    flex: 1,
    gap: 3,
  },
});
