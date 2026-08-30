import { useState, useMemo } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { ChevronLeft, ChevronRight, Clock, MapPin, Users } from 'lucide-react-native';
import { GlassCard } from '../../src/components/ui/GlassCard';
import { FeatureCard } from '../../src/components/ui/FeatureCard';
import { GlowBlob } from '../../src/components/ui/GlowBlob';
import { SectionLabel } from '../../src/components/ui/SectionLabel';
import { LikeButton } from '../../src/components/ui/LikeButton';
import { OrganizerLogo } from '../../src/components/ui/OrganizerLogo';
import { PokerChip } from '../../src/components/ui/PokerChip';
import { Pill } from '../../src/components/ui/Pill';
import { TournamentDetailModal } from '../../src/components/finder/TournamentDetailModal';
import { useAppStore } from '../../src/store/useAppStore';
import { formatAmount, formatChips, formatDateRange, formatLevelDuration } from '../../src/lib/format';
import { fontFamily, fontSize, spacing } from '../../src/design-system/theme';
import { useTheme } from '../../src/design-system/ThemeProvider';
import type { Tournament } from '../../src/types';

function TournamentRow({ tournament, onPress }: { tournament: Tournament; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.75}>
      <GlassCard padding={16}>
        <View style={styles.tournamentRow}>
          <View style={styles.tournamentRowLeft}>
            <View style={styles.tournamentNameRow}>
              <Text style={[styles.tournamentName, { color: colors.textPrimary }]} numberOfLines={1}>{tournament.name}</Text>
              {tournament.isMainEvent ? <Pill label="Main Event" tone="accent" /> : null}
            </View>
            <View style={styles.tournamentMetaRow}>
              <Text style={[styles.tournamentBuyIn, { color: colors.accent }]}>{formatAmount(tournament.buyIn)}</Text>
              {tournament.totalPlayers ? (
                <View style={styles.playersRow}>
                  <Users size={11} color={colors.textTertiary} strokeWidth={1.5} />
                  <Text style={[styles.playersText, { color: colors.textTertiary }]}>{formatChips(tournament.totalPlayers)}</Text>
                </View>
              ) : null}
            </View>
          </View>
        </View>
      </GlassCard>
    </TouchableOpacity>
  );
}

export default function FestivalDetailScreen() {
  const { colors } = useTheme();
  const { t: tr } = useTranslation('finder');
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const {
    festivals, tournaments, organizers,
    likedFestivalIds, toggleLikedFestival,
  } = useAppStore();

  const [selectedTournament, setSelectedTournament] = useState<Tournament | null>(null);

  const festival = festivals.find((f) => f.id === id);
  const organizer = festival?.organizerId ? organizers.find((o) => o.id === festival.organizerId) : undefined;

  const festivalTournaments = useMemo(
    () => tournaments.filter((t) => t.festivalId === festival?.id),
    [tournaments, festival?.id]
  );

  const buyIns = festivalTournaments.map((t) => t.buyIn);
  const minBuyIn = buyIns.length > 0 ? Math.min(...buyIns) : null;
  const maxBuyIn = buyIns.length > 0 ? Math.max(...buyIns) : null;
  const smallestTournament = festivalTournaments.find((t) => t.buyIn === minBuyIn);
  const biggestTournament = festivalTournaments.find((t) => t.buyIn === maxBuyIn);
  const mainEvent = festivalTournaments.find((t) => t.isMainEvent) ?? null;
  const otherTournaments = festivalTournaments.filter((t) => !t.isMainEvent);

  if (!festival) {
    return (
      <SafeAreaView style={styles.screen} edges={['top']}>
        <View style={styles.notFound}>
          <TouchableOpacity
            style={[styles.backButton, { backgroundColor: colors.neutralTileBg }]}
            onPress={() => router.back()}
            activeOpacity={0.7}
          >
            <ChevronLeft size={18} color={colors.textSecondary} strokeWidth={2} />
          </TouchableOpacity>
          <Text style={[styles.notFoundText, { color: colors.textSecondary }]}>{tr('festival.notFound')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  const liked = likedFestivalIds.includes(festival.id);
  const dateRange = formatDateRange(festival.startDate, festival.endDate);

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity
          style={[styles.backButton, { backgroundColor: colors.neutralTileBg }]}
          onPress={() => router.back()}
          activeOpacity={0.7}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <ChevronLeft size={18} color={colors.textSecondary} strokeWidth={2} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]} numberOfLines={1}>{festival.name}</Text>
        <LikeButton liked={liked} onToggle={() => toggleLikedFestival(festival.id)} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.stack}>
          <Animated.View entering={FadeInDown.delay(0).springify().damping(18).stiffness(140)}>
            <GlassCard variant="dark" padding={20} style={styles.infoCard}>
              <GlowBlob />
              {festival.location ? (
                <View style={styles.locationRow}>
                  {organizer?.logo ? <OrganizerLogo organizer={organizer} size={36} tone="dark" /> : null}
                  <View style={styles.locationTextWrap}>
                    <MapPin size={12} color={colors.onDarkTertiary} strokeWidth={1.5} />
                    <Text style={[styles.locationText, { color: colors.onDarkTertiary }]}>
                      {festival.location}{organizer ? ` · ${organizer.name}` : ''}
                    </Text>
                  </View>
                </View>
              ) : null}
              {dateRange ? <Text style={[styles.dateText, { color: colors.onDarkPrimary }]}>{dateRange}</Text> : null}
            </GlassCard>
          </Animated.View>

          {(minBuyIn !== null || maxBuyIn !== null) && (
            <Animated.View entering={FadeInDown.delay(60).springify().damping(18).stiffness(140)}>
              <GlassCard padding={18}>
                <View style={styles.statsRow}>
                  <View style={styles.statItem}>
                    <Text style={[styles.statValue, { color: colors.textPrimary }]}>{minBuyIn !== null ? formatAmount(minBuyIn) : '—'}</Text>
                    <Text style={[styles.statLabel, { color: colors.textTertiary }]} numberOfLines={1}>{smallestTournament?.name ?? tr('festival.smallest')}</Text>
                  </View>
                  <View style={[styles.statDivider, { backgroundColor: colors.hairline }]} />
                  <View style={styles.statItem}>
                    <Text style={[styles.statValue, { color: colors.textPrimary }]}>{maxBuyIn !== null ? formatAmount(maxBuyIn) : '—'}</Text>
                    <Text style={[styles.statLabel, { color: colors.textTertiary }]} numberOfLines={1}>{biggestTournament?.name ?? tr('festival.biggest')}</Text>
                  </View>
                  <View style={[styles.statDivider, { backgroundColor: colors.hairline }]} />
                  <View style={styles.statItem}>
                    <Text style={[styles.statValue, { color: colors.textPrimary }]}>{festivalTournaments.length}</Text>
                    <Text style={[styles.statLabel, { color: colors.textTertiary }]}>{tr('festival.tournaments')}</Text>
                  </View>
                </View>
              </GlassCard>
            </Animated.View>
          )}

          {mainEvent && (
            <Animated.View entering={FadeInDown.delay(120).springify().damping(18).stiffness(140)}>
              <TouchableOpacity onPress={() => setSelectedTournament(mainEvent)} activeOpacity={0.85}>
                <FeatureCard padding={20} style={styles.mainEventCard} chipSize={70} chipStyle={styles.mainEventChip}>
                  <SectionLabel tone="dark">Main Event</SectionLabel>
                  <View style={styles.mainEventHeader}>
                    <Text style={[styles.mainEventName, { color: colors.onDarkPrimary }]}>{mainEvent.name}</Text>
                    <Text style={[styles.mainEventBuyIn, { color: colors.accentBright }]}>{formatAmount(mainEvent.buyIn)}</Text>
                  </View>
                  {(mainEvent.blindStructure || mainEvent.guaranteed) ? (
                    <View style={styles.mainEventMetaRow}>
                      {mainEvent.blindStructure ? (
                        <View style={styles.mainEventMetaItem}>
                          <Clock size={12} color={colors.onDarkTertiary} strokeWidth={1.5} />
                          <Text style={[styles.mainEventMetaText, { color: colors.onDarkTertiary }]}>
                            {tr('festival.perLevel', { duration: formatLevelDuration(mainEvent.blindStructure.levels) })}
                          </Text>
                        </View>
                      ) : null}
                      {mainEvent.guaranteed ? (
                        <Pill
                          label={tr('festival.guaranteed', { amount: formatAmount(mainEvent.guaranteed) })}
                          tone="accent"
                          onDark
                        />
                      ) : null}
                    </View>
                  ) : null}
                  {mainEvent.blindStructure ? (
                    <View style={styles.mainEventHint}>
                      <Text style={[styles.mainEventHintText, { color: colors.onDarkTertiary }]}>{tr('festival.viewBlindStructure')}</Text>
                      <ChevronRight size={14} color={colors.onDarkTertiary} strokeWidth={1.8} />
                    </View>
                  ) : null}
                </FeatureCard>
              </TouchableOpacity>
            </Animated.View>
          )}

          {otherTournaments.length > 0 && (
            <Animated.View entering={FadeInDown.delay(180).springify().damping(18).stiffness(140)} style={styles.tournamentsSection}>
              <SectionLabel style={styles.sectionLabel}>{tr('festival.otherTournaments')}</SectionLabel>
              <View style={styles.tournamentsList}>
                {otherTournaments.map((t) => (
                  <TournamentRow
                    key={t.id}
                    tournament={t}
                    onPress={() => setSelectedTournament(t)}
                  />
                ))}
              </View>
            </Animated.View>
          )}

          <View style={{ height: 120 }} />
        </View>
      </ScrollView>

      <TournamentDetailModal
        tournament={selectedTournament}
        festival={festival}
        onClose={() => setSelectedTournament(null)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.sm,
  },
  backButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    fontSize: fontSize.lg,
    fontFamily: fontFamily.bold,
  },
  notFound: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  notFoundText: {
    fontSize: fontSize.md,
    fontFamily: fontFamily.medium,
  },
  content: {
    paddingHorizontal: spacing.base,
    paddingTop: spacing.sm,
  },
  stack: {
    gap: spacing.md,
  },

  infoCard: {
    gap: 4,
    overflow: 'hidden',
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  locationTextWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    flexShrink: 1,
  },
  locationText: {
    fontSize: fontSize.sm,
    fontFamily: fontFamily.medium,
  },
  dateText: {
    fontSize: fontSize.lg,
    fontFamily: fontFamily.bold,
    marginTop: 4,
  },

  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
    gap: 5,
  },
  statDivider: {
    width: 1,
    height: 32,
  },
  statValue: {
    fontSize: fontSize.md,
    fontFamily: fontFamily.bold,
    fontVariant: ['tabular-nums'],
  },
  statLabel: {
    fontSize: fontSize.xs,
    fontFamily: fontFamily.medium,
    textAlign: 'center',
  },

  mainEventCard: {
    overflow: 'hidden',
  },
  mainEventChip: {
    position: 'absolute',
    top: -14,
    right: -12,
  },
  mainEventHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
  },
  mainEventName: {
    fontSize: fontSize.md,
    fontFamily: fontFamily.bold,
    flex: 1,
  },
  mainEventBuyIn: {
    fontSize: fontSize.lg,
    fontFamily: fontFamily.extrabold,
  },
  mainEventMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  mainEventMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  mainEventMetaText: {
    fontSize: fontSize.xs,
    fontFamily: fontFamily.medium,
  },
  mainEventHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  mainEventHintText: {
    fontSize: fontSize.sm,
    fontFamily: fontFamily.medium,
  },

  tournamentsSection: {
    gap: spacing.sm,
  },
  sectionLabel: {
    marginLeft: 4,
  },
  tournamentsList: {
    gap: spacing.sm,
  },
  tournamentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  tournamentRowLeft: {
    flex: 1,
    gap: 6,
  },
  tournamentNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  tournamentName: {
    fontSize: fontSize.base,
    fontFamily: fontFamily.semibold,
    flexShrink: 1,
  },
  tournamentMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  tournamentBuyIn: {
    fontSize: fontSize.sm,
    fontFamily: fontFamily.bold,
  },
  playersRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  playersText: {
    fontSize: fontSize.xs,
    fontFamily: fontFamily.regular,
  },
});
