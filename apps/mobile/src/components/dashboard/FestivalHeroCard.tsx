import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Radio, Star } from 'lucide-react-native';
import { OrganizerLogo } from '../ui/OrganizerLogo';
import { formatDateRange } from '../../lib/format';
import { fontFamily, fontSize, spacing, radius } from '../../design-system/theme';
import { FeatureCard } from '../ui/FeatureCard';
import { useTheme } from '../../design-system/ThemeProvider';
import type { Festival, Organizer } from '../../types';

type HeroBadge = 'featured' | 'ongoing';

interface Props {
  festival: Festival;
  organizer?: Organizer;
  badge: HeroBadge;
  onPress: () => void;
}

export function FestivalHeroCard({ festival, organizer, badge, onPress }: Props) {
  const { t } = useTranslation('dashboard');
  const { colors } = useTheme();
  const dateRange = formatDateRange(festival.startDate, festival.endDate);
  const BadgeIcon = badge === 'featured' ? Star : Radio;

  return (
    <FeatureCard padding={20} style={styles.card}>
      <View style={styles.headerRow}>
        <View style={[styles.badge, { backgroundColor: colors.accentGlow }]}>
          <BadgeIcon size={11} color={colors.accentBright} strokeWidth={2} fill={colors.accentBright} />
          <Text style={[styles.badgeText, { color: colors.accentBright }]}>{t(`hero.${badge}`)}</Text>
        </View>
      </View>

      <TouchableOpacity onPress={onPress} activeOpacity={0.85}>
        {organizer || festival.location ? (
          <Text style={[styles.venue, { color: colors.onDarkTertiary }]} numberOfLines={1}>
            {festival.location}{organizer ? ` · ${organizer.name}` : ''}
          </Text>
        ) : null}
        <View style={styles.nameRow}>
          {organizer?.logo ? <OrganizerLogo organizer={organizer} size={20} tone="dark" /> : null}
          <Text style={[styles.name, styles.nameText, { color: colors.onDarkPrimary }]} numberOfLines={2}>{festival.name}</Text>
        </View>
        {dateRange ? <Text style={[styles.dates, { color: colors.onDarkSecondary }]}>{dateRange}</Text> : null}
      </TouchableOpacity>

      <View style={styles.actions}>
        <TouchableOpacity style={[styles.primaryButton, { backgroundColor: colors.accentBright }]} onPress={onPress} activeOpacity={0.85}>
          <Text style={styles.primaryButtonText}>{t('hero.viewTournaments')}</Text>
        </TouchableOpacity>
      </View>
    </FeatureCard>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.sm,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.full,
    alignSelf: 'flex-start',
  },
  badgeText: {
    fontSize: fontSize.xs,
    fontFamily: fontFamily.semibold,
    letterSpacing: 0.3,
  },
  venue: {
    fontSize: fontSize.xs,
    fontFamily: fontFamily.medium,
    flexShrink: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  name: {
    fontSize: fontSize.lg,
    fontFamily: fontFamily.bold,
  },
  nameText: {
    flexShrink: 1,
  },
  dates: {
    fontSize: fontSize.sm,
    fontFamily: fontFamily.regular,
    marginTop: 4,
  },
  actions: {
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  primaryButton: {
    paddingVertical: spacing.sm + 4,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#0A0A0F',
    fontSize: fontSize.base,
    fontFamily: fontFamily.bold,
  },
});
