import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Heart } from 'lucide-react-native';
import { GlassCard } from '../ui/GlassCard';
import { GlowBlob } from '../ui/GlowBlob';
import { LikeButton } from '../ui/LikeButton';
import { formatDateRange } from '../../lib/format';
import { fontFamily, fontSize, spacing, radius } from '../../design-system/theme';
import { useTheme } from '../../design-system/ThemeProvider';
import type { Festival, Organizer } from '../../types';

interface Props {
  festival: Festival;
  organizer?: Organizer;
  isOngoing: boolean;
  onPress: () => void;
  onAddResult: () => void;
  onToggleLike: () => void;
}

export function FestivalHeroCard({ festival, organizer, isOngoing, onPress, onAddResult, onToggleLike }: Props) {
  const { colors } = useTheme();
  const dateRange = formatDateRange(festival.startDate, festival.endDate);

  return (
    <GlassCard variant="dark" padding={20} style={styles.card}>
      <GlowBlob />
      <View style={styles.headerRow}>
        <View style={[styles.badge, { backgroundColor: colors.accentGlow }]}>
          <Heart size={11} color={colors.accentBright} strokeWidth={2} fill={colors.accentBright} />
          <Text style={[styles.badgeText, { color: colors.accentBright }]}>
            {isOngoing ? 'En ce moment' : 'Votre festival liké'}
          </Text>
        </View>
        <LikeButton liked onToggle={onToggleLike} tone="dark" />
      </View>

      <TouchableOpacity onPress={onPress} activeOpacity={0.85}>
        {organizer || festival.location ? (
          <Text style={[styles.venue, { color: colors.onDarkTertiary }]} numberOfLines={1}>
            {festival.location}{organizer ? ` · ${organizer.name}` : ''}
          </Text>
        ) : null}
        <Text style={[styles.name, { color: colors.onDarkPrimary }]} numberOfLines={2}>{festival.name}</Text>
        {dateRange ? <Text style={[styles.dates, { color: colors.onDarkSecondary }]}>{dateRange}</Text> : null}
      </TouchableOpacity>

      <View style={styles.actions}>
        <TouchableOpacity style={[styles.primaryButton, { backgroundColor: colors.accentBright }]} onPress={onPress} activeOpacity={0.85}>
          <Text style={styles.primaryButtonText}>Voir les tournois</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.secondaryButton, { borderColor: colors.onDarkHairline }]} onPress={onAddResult} activeOpacity={0.85}>
          <Text style={[styles.secondaryButtonText, { color: colors.onDarkPrimary }]}>Enregistrer un résultat</Text>
        </TouchableOpacity>
      </View>
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.sm,
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
    marginTop: 4,
  },
  name: {
    fontSize: fontSize.lg,
    fontFamily: fontFamily.bold,
    marginTop: 4,
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
  secondaryButton: {
    paddingVertical: spacing.sm + 4,
    borderRadius: radius.md,
    alignItems: 'center',
    borderWidth: 1,
  },
  secondaryButtonText: {
    fontSize: fontSize.sm,
    fontFamily: fontFamily.semibold,
  },
});
