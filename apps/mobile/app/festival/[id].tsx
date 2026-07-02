import { useState, useMemo, useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { ChevronLeft, ChevronRight, MapPin, Users } from 'lucide-react-native';
import { GlassCard } from '../../src/components/ui/GlassCard';
import { GlowBlob } from '../../src/components/ui/GlowBlob';
import { SectionLabel } from '../../src/components/ui/SectionLabel';
import { LikeButton } from '../../src/components/ui/LikeButton';
import { Pill } from '../../src/components/ui/Pill';
import { TournamentDetailModal } from '../../src/components/finder/TournamentDetailModal';
import { AddSessionSheet } from '../../src/components/tracker/AddSessionSheet';
import type { SaveRecord } from '../../src/components/tracker/AddSessionSheet';
import { useAppStore } from '../../src/store/useAppStore';
import { formatAmount, formatDateRange } from '../../src/lib/format';
import { fontFamily, fontSize, spacing } from '../../src/design-system/theme';
import { useTheme } from '../../src/design-system/ThemeProvider';
import type { Tournament, TournamentSession } from '../../src/types';

function TournamentRow({
  tournament,
  liked,
  onPress,
  onToggleLike,
}: {
  tournament: Tournament;
  liked: boolean;
  onPress: () => void;
  onToggleLike: () => void;
}) {
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
                  <Text style={[styles.playersText, { color: colors.textTertiary }]}>{tournament.totalPlayers.toLocaleString('fr-FR')}</Text>
                </View>
              ) : null}
            </View>
          </View>
          <LikeButton liked={liked} onToggle={onToggleLike} />
        </View>
      </GlassCard>
    </TouchableOpacity>
  );
}

export default function FestivalDetailScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const {
    festivals, tournaments, organizers, sessions, players,
    likedFestivalIds, likedTournamentIds, toggleLikedFestival, toggleLikedTournament,
    addSession, addStake, addFestival, addTournament, addPlayer,
  } = useAppStore();

  const [selectedTournament, setSelectedTournament] = useState<Tournament | null>(null);
  const [addSessionTournament, setAddSessionTournament] = useState<Tournament | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);

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

  const tournamentSessions = useMemo(
    () => sessions.filter((s): s is TournamentSession => s.type === 'tournament'),
    [sessions]
  );

  const selectedTournamentSessions = useMemo(
    () => (selectedTournament ? tournamentSessions.filter((s) => s.tournamentId === selectedTournament.id) : []),
    [selectedTournament, tournamentSessions]
  );

  const handleSave = useCallback(
    (record: SaveRecord) => {
      for (const p of record.newPlayers ?? []) {
        if (!players.find((existing) => existing.id === p.id)) addPlayer(p);
      }
      if (record.newFestival && !festivals.find((f) => f.id === record.newFestival!.id)) {
        addFestival(record.newFestival);
      }
      if (record.newTournament && !tournaments.find((t) => t.id === record.newTournament!.id)) {
        addTournament(record.newTournament);
      }
      if (record.session) addSession(record.session);
      if (record.stake) addStake(record.stake);
      setShowAddModal(false);
      setAddSessionTournament(null);
    },
    [players, festivals, tournaments, addPlayer, addFestival, addTournament, addSession, addStake]
  );

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
          <Text style={[styles.notFoundText, { color: colors.textSecondary }]}>Festival introuvable</Text>
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
                  <MapPin size={12} color={colors.onDarkTertiary} strokeWidth={1.5} />
                  <Text style={[styles.locationText, { color: colors.onDarkTertiary }]}>
                    {festival.location}{organizer ? ` · ${organizer.name}` : ''}
                  </Text>
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
                    <Text style={[styles.statLabel, { color: colors.textTertiary }]} numberOfLines={1}>{smallestTournament?.name ?? 'Plus petit'}</Text>
                  </View>
                  <View style={[styles.statDivider, { backgroundColor: colors.hairline }]} />
                  <View style={styles.statItem}>
                    <Text style={[styles.statValue, { color: colors.textPrimary }]}>{maxBuyIn !== null ? formatAmount(maxBuyIn) : '—'}</Text>
                    <Text style={[styles.statLabel, { color: colors.textTertiary }]} numberOfLines={1}>{biggestTournament?.name ?? 'Plus gros'}</Text>
                  </View>
                  <View style={[styles.statDivider, { backgroundColor: colors.hairline }]} />
                  <View style={styles.statItem}>
                    <Text style={[styles.statValue, { color: colors.textPrimary }]}>{festivalTournaments.length}</Text>
                    <Text style={[styles.statLabel, { color: colors.textTertiary }]}>Tournois</Text>
                  </View>
                </View>
              </GlassCard>
            </Animated.View>
          )}

          {mainEvent && (
            <Animated.View entering={FadeInDown.delay(120).springify().damping(18).stiffness(140)}>
              <TouchableOpacity onPress={() => setSelectedTournament(mainEvent)} activeOpacity={0.85}>
                <GlassCard padding={20}>
                  <SectionLabel>Main Event</SectionLabel>
                  <View style={styles.mainEventHeader}>
                    <Text style={[styles.mainEventName, { color: colors.textPrimary }]}>{mainEvent.name}</Text>
                    <Text style={[styles.mainEventBuyIn, { color: colors.accent }]}>{formatAmount(mainEvent.buyIn)}</Text>
                  </View>
                  {mainEvent.blindStructure ? (
                    <View style={styles.mainEventHint}>
                      <Text style={[styles.mainEventHintText, { color: colors.textTertiary }]}>Voir la structure de blindes</Text>
                      <ChevronRight size={14} color={colors.textTertiary} strokeWidth={1.8} />
                    </View>
                  ) : null}
                </GlassCard>
              </TouchableOpacity>
            </Animated.View>
          )}

          {otherTournaments.length > 0 && (
            <Animated.View entering={FadeInDown.delay(180).springify().damping(18).stiffness(140)} style={styles.tournamentsSection}>
              <SectionLabel style={styles.sectionLabel}>Autres tournois</SectionLabel>
              <View style={styles.tournamentsList}>
                {otherTournaments.map((t) => (
                  <TournamentRow
                    key={t.id}
                    tournament={t}
                    liked={likedTournamentIds.includes(t.id)}
                    onPress={() => setSelectedTournament(t)}
                    onToggleLike={() => toggleLikedTournament(t.id)}
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
        sessions={selectedTournamentSessions}
        onClose={() => setSelectedTournament(null)}
        onAddSession={() => {
          const tournament = selectedTournament;
          setSelectedTournament(null);
          setTimeout(() => {
            setAddSessionTournament(tournament);
            setShowAddModal(true);
          }, 350);
        }}
      />

      <AddSessionSheet
        visible={showAddModal}
        onClose={() => { setShowAddModal(false); setAddSessionTournament(null); }}
        onSave={handleSave}
        festivals={festivals}
        tournaments={tournaments}
        players={players}
        initialTournament={addSessionTournament}
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
    gap: 5,
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

  mainEventHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
    marginBottom: spacing.md,
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
    justifyContent: 'space-between',
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
