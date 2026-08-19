import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useTranslation } from 'react-i18next';
import { MapPin } from 'lucide-react-native';
import { GlassCard } from '../ui/GlassCard';
import { LikeButton } from '../ui/LikeButton';
import { OrganizerLogo } from '../ui/OrganizerLogo';
import { formatAmount, formatDateRangeShort } from '../../lib/format';
import { fontFamily, fontSize, spacing, radius } from '../../design-system/theme';
import { useTheme } from '../../design-system/ThemeProvider';
import type { Festival, Organizer } from '../../types';

interface Props {
  festival: Festival;
  organizer?: Organizer;
  tournamentCount: number;
  buyInRange?: { min: number; max: number };
  liked: boolean;
  onPress: () => void;
  onToggleLike: () => void;
  variant?: 'full' | 'mini';
}

function formatBuyInRange(range?: { min: number; max: number }): string {
  if (!range) return '';
  if (range.min === range.max) return formatAmount(range.min);
  return `${formatAmount(range.min)} – ${formatAmount(range.max)}`;
}

export function FestivalCard({
  festival,
  organizer,
  tournamentCount,
  buyInRange,
  liked,
  onPress,
  onToggleLike,
  variant = 'full',
}: Props) {
  const { colors } = useTheme();
  const { t } = useTranslation('finder');

  if (variant === 'mini') {
    const dateRange = formatDateRangeShort(festival.startDate, festival.endDate);
    const subtitle = [festival.location, organizer?.name].filter(Boolean).join(' · ');

    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.85}>
        <GlassCard padding={14}>
          <View style={styles.miniRow}>
            <View style={styles.miniContent}>
              <View style={styles.nameRow}>
                {organizer?.logo ? <OrganizerLogo organizer={organizer} size={20} /> : null}
                <Text style={[styles.name, styles.nameText, { color: colors.textPrimary }]} numberOfLines={1}>{festival.name}</Text>
              </View>
              <View style={styles.miniMetaRow}>
                {dateRange ? (
                  <View style={[styles.pill, { backgroundColor: colors.neutralTileBg }]}>
                    <Text style={[styles.pillText, { color: colors.textSecondary }]}>{dateRange}</Text>
                  </View>
                ) : null}
                {subtitle ? <Text style={[styles.subtitle, { color: colors.textTertiary }]} numberOfLines={1}>{subtitle}</Text> : null}
              </View>
            </View>
            <LikeButton liked={liked} onToggle={onToggleLike} size={16} />
          </View>
        </GlassCard>
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.75}>
      <GlassCard padding={16}>
        <View style={styles.fullHeader}>
          <View style={styles.fullHeaderLeft}>
            <View style={styles.nameRow}>
              {organizer?.logo ? <OrganizerLogo organizer={organizer} size={20} /> : null}
              <Text style={[styles.name, styles.nameText, { color: colors.textPrimary }]} numberOfLines={2}>{festival.name}</Text>
            </View>
            {festival.location ? (
              <View style={styles.locationRow}>
                <MapPin size={11} color={colors.textTertiary} strokeWidth={1.5} />
                <Text style={[styles.subtitle, { color: colors.textTertiary }]} numberOfLines={1}>
                  {festival.location}{organizer ? ` · ${organizer.name}` : ''}
                </Text>
              </View>
            ) : null}
          </View>
          <LikeButton liked={liked} onToggle={onToggleLike} />
        </View>

        <View style={styles.footerRow}>
          {festival.startDate ? (
            <View style={[styles.pill, { backgroundColor: colors.neutralTileBg }]}>
              <Text style={[styles.pillText, { color: colors.textSecondary }]}>
                {formatDateRangeShort(festival.startDate, festival.endDate)}
              </Text>
            </View>
          ) : null}
          {buyInRange ? (
            <View style={[styles.pill, { backgroundColor: colors.accentTint }]}>
              <Text style={[styles.pillText, { color: colors.accent }]}>{formatBuyInRange(buyInRange)}</Text>
            </View>
          ) : null}
          <Text style={[styles.tournamentCount, { color: colors.textTertiary }]}>
            {t('tournamentCount', { count: tournamentCount })}
          </Text>
        </View>
      </GlassCard>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  fullHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  fullHeaderLeft: {
    flex: 1,
    gap: 4,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  name: {
    fontSize: fontSize.base,
    fontFamily: fontFamily.semibold,
  },
  nameText: {
    flexShrink: 1,
  },
  subtitle: {
    fontSize: fontSize.xs,
    fontFamily: fontFamily.regular,
    flexShrink: 1,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  pill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.full,
  },
  pillText: {
    fontSize: fontSize.xs,
    fontFamily: fontFamily.semibold,
  },
  tournamentCount: {
    fontSize: fontSize.xs,
    fontFamily: fontFamily.regular,
    marginLeft: 'auto',
  },

  // Mini variant (Dashboard lists)
  miniRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  miniContent: {
    flex: 1,
    gap: 4,
  },
  miniMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
});
