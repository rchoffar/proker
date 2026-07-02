import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Heart } from 'lucide-react-native';
import { GlassCard } from '../ui/GlassCard';
import { GlowBlob } from '../ui/GlowBlob';
import { formatAmount, formatDateRangeShort } from '../../lib/format';
import { colors, fontFamily, fontSize, spacing, radius } from '../../design-system/theme';
import type { Festival, Organizer } from '../../types';

interface Props {
  festival: Festival;
  organizer?: Organizer;
  tournamentCount?: number;
  buyInRange?: { min: number; max: number };
  variant?: 'full' | 'mini';
  onPress?: () => void;
}

function formatBuyInRange(range?: { min: number; max: number }): string {
  if (!range) return '';
  if (range.min === range.max) return formatAmount(range.min);
  return `${formatAmount(range.min)} – ${formatAmount(range.max)}`;
}

function Badge() {
  return (
    <View style={styles.badge}>
      <Heart size={11} color={colors.accentBright} strokeWidth={2} fill={colors.accentBright} />
      <Text style={styles.badgeText}>Coup de cœur</Text>
    </View>
  );
}

export function CoupDeCoeurCard({ festival, organizer, tournamentCount, buyInRange, variant = 'full', onPress }: Props) {
  if (variant === 'mini') {
    const dateRange = formatDateRangeShort(festival.startDate, festival.endDate);
    const subtitle = [dateRange, festival.location, organizer?.name].filter(Boolean).join(' · ');

    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.85} disabled={!onPress}>
        <GlassCard variant="dark" padding={14} style={styles.card}>
          <GlowBlob size={110} top={-30} right={-30} />
          <View style={styles.miniRow}>
            <View style={styles.miniContent}>
              <Badge />
              <Text style={styles.name} numberOfLines={1}>{festival.name}</Text>
              {subtitle ? <Text style={styles.venue} numberOfLines={1}>{subtitle}</Text> : null}
            </View>
            {buyInRange ? (
              <View style={styles.buyInChip}>
                <Text style={styles.buyInText}>{formatBuyInRange(buyInRange)}</Text>
              </View>
            ) : null}
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
        </View>

        {(festival.location || organizer) ? (
          <Text style={styles.venue} numberOfLines={1}>
            {festival.location}{organizer ? ` · ${organizer.name}` : ''}
          </Text>
        ) : null}
        <Text style={styles.name} numberOfLines={2}>{festival.name}</Text>

        <View style={styles.footer}>
          {buyInRange ? (
            <View style={styles.buyInChip}>
              <Text style={styles.buyInText}>{formatBuyInRange(buyInRange)}</Text>
            </View>
          ) : null}
          {tournamentCount ? (
            <Text style={styles.meta}>{tournamentCount} tournoi{tournamentCount > 1 ? 's' : ''}</Text>
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

  // Mini (Dashboard)
  miniRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  miniContent: {
    flex: 1,
    gap: 3,
  },
});
