import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useCallback, useMemo, useState } from 'react';
import { useRouter } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { TrendingUp, ChevronRight, Heart } from 'lucide-react-native';
import { GlassCard } from '../../src/components/ui/GlassCard';
import { SectionLabel } from '../../src/components/ui/SectionLabel';
import { FestivalCard } from '../../src/components/finder/FestivalCard';
import { CoupDeCoeurCard } from '../../src/components/tournaments/CoupDeCoeurCard';
import { FestivalHeroCard } from '../../src/components/dashboard/FestivalHeroCard';
import { AddSessionSheet } from '../../src/components/tracker/AddSessionSheet';
import type { SaveRecord } from '../../src/components/tracker/AddSessionSheet';
import { useAppStore } from '../../src/store/useAppStore';
import { useFocusAnimKey } from '../../src/hooks/useFocusAnimKey';
import { isFestivalOngoing } from '../../src/lib/format';
import { fontFamily, fontSize, spacing } from '../../src/design-system/theme';
import { useTheme } from '../../src/design-system/ThemeProvider';
import type { Festival } from '../../src/types';

function initials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('');
}

export default function DashboardScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const {
    user, stats, festivals, tournaments, organizers, players,
    likedFestivalIds, toggleLikedFestival,
    addSession, addStake, addFestival, addTournament, addPlayer,
  } = useAppStore();
  const animKey = useFocusAnimKey();
  const [showAddModal, setShowAddModal] = useState(false);
  const [addSessionFestival, setAddSessionFestival] = useState<Festival | null>(null);

  const organizerById = useMemo(() => {
    const map: Record<string, (typeof organizers)[number]> = {};
    for (const o of organizers) map[o.id] = o;
    return map;
  }, [organizers]);

  const todayIso = new Date().toISOString().slice(0, 10);

  const likedFestivals = useMemo(
    () => festivals.filter((f) => likedFestivalIds.includes(f.id)),
    [festivals, likedFestivalIds]
  );

  const ongoingFestival = useMemo(
    () => likedFestivals.find((f) => isFestivalOngoing(f.startDate, f.endDate, todayIso)) ?? null,
    [likedFestivals, todayIso]
  );

  const mostRecentlyLiked = useMemo(() => {
    if (likedFestivalIds.length === 0) return null;
    const lastId = likedFestivalIds[likedFestivalIds.length - 1];
    return festivals.find((f) => f.id === lastId) ?? null;
  }, [likedFestivalIds, festivals]);

  const currentFestival = ongoingFestival ?? mostRecentlyLiked;

  const featured = useMemo(() => festivals.find((f) => f.featured) ?? null, [festivals]);
  const showFeatured = featured !== null && featured.id !== currentFestival?.id;

  const upcomingLiked = useMemo(
    () =>
      likedFestivals
        .filter((f) => f.id !== currentFestival?.id && f.startDate && f.startDate >= todayIso)
        .sort((a, b) => (a.startDate! < b.startDate! ? -1 : 1)),
    [likedFestivals, currentFestival, todayIso]
  );

  const discoverFestivals = useMemo(
    () =>
      festivals
        .filter((f) => !likedFestivalIds.includes(f.id) && f.id !== featured?.id && f.startDate && f.startDate >= todayIso)
        .sort((a, b) => (a.startDate! < b.startDate! ? -1 : 1))
        .slice(0, 5),
    [festivals, likedFestivalIds, featured, todayIso]
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
      setAddSessionFestival(null);
    },
    [players, festivals, tournaments, addPlayer, addFestival, addTournament, addSession, addStake]
  );

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View key={animKey} style={styles.cardStack}>

          {/* Header */}
          <Animated.View entering={FadeInDown.delay(0).springify().damping(18).stiffness(140)} style={styles.header}>
            <Text style={[styles.title, { color: colors.textPrimary }]}>Dashboard</Text>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{initials(user.name)}</Text>
            </View>
          </Animated.View>

          {/* Festival hero */}
          <Animated.View entering={FadeInDown.delay(60).springify().damping(18).stiffness(140)}>
            {currentFestival ? (
              <FestivalHeroCard
                festival={currentFestival}
                organizer={currentFestival.organizerId ? organizerById[currentFestival.organizerId] : undefined}
                isOngoing={currentFestival.id === ongoingFestival?.id}
                onPress={() => router.push(`/festival/${currentFestival.id}`)}
                onAddResult={() => {
                  setAddSessionFestival(currentFestival);
                  setShowAddModal(true);
                }}
                onToggleLike={() => toggleLikedFestival(currentFestival.id)}
              />
            ) : (
              <TouchableOpacity onPress={() => router.push('/festivals')} activeOpacity={0.85}>
                <GlassCard variant="dark" padding={24} style={styles.emptyHero}>
                  <Heart size={22} color={colors.onDarkTertiary} strokeWidth={1.5} />
                  <Text style={[styles.emptyHeroTitle, { color: colors.onDarkPrimary }]}>Aimez un festival</Text>
                  <Text style={[styles.emptyHeroSubtitle, { color: colors.onDarkTertiary }]}>
                    Retrouvez ici vos festivals préférés pour suivre leurs tournois
                  </Text>
                </GlassCard>
              </TouchableOpacity>
            )}
          </Animated.View>

          {/* Coup de cœur */}
          {showFeatured && featured && (
            <Animated.View entering={FadeInDown.delay(100).springify().damping(18).stiffness(140)} style={styles.section}>
              <SectionLabel style={styles.sectionLabel}>Coup de cœur</SectionLabel>
              <CoupDeCoeurCard
                festival={featured}
                organizer={featured.organizerId ? organizerById[featured.organizerId] : undefined}
                tournamentCount={tournaments.filter((t) => t.festivalId === featured.id).length}
                variant="mini"
                onPress={() => router.push(`/festival/${featured.id}`)}
              />
            </Animated.View>
          )}

          {/* Vos festivals à venir */}
          {upcomingLiked.length > 0 && (
            <Animated.View entering={FadeInDown.delay(120).springify().damping(18).stiffness(140)} style={styles.section}>
              <SectionLabel style={styles.sectionLabel}>Vos festivals à venir</SectionLabel>
              <View style={styles.sectionList}>
                {upcomingLiked.map((f) => (
                  <FestivalCard
                    key={f.id}
                    festival={f}
                    organizer={f.organizerId ? organizerById[f.organizerId] : undefined}
                    tournamentCount={tournaments.filter((t) => t.festivalId === f.id).length}
                    liked
                    variant="mini"
                    onPress={() => router.push(`/festival/${f.id}`)}
                    onToggleLike={() => toggleLikedFestival(f.id)}
                  />
                ))}
              </View>
            </Animated.View>
          )}

          {/* Découvrir */}
          {discoverFestivals.length > 0 && (
            <Animated.View entering={FadeInDown.delay(180).springify().damping(18).stiffness(140)} style={styles.section}>
              <SectionLabel style={styles.sectionLabel}>Découvrir</SectionLabel>
              <View style={styles.sectionList}>
                {discoverFestivals.map((f) => (
                  <FestivalCard
                    key={f.id}
                    festival={f}
                    organizer={f.organizerId ? organizerById[f.organizerId] : undefined}
                    tournamentCount={tournaments.filter((t) => t.festivalId === f.id).length}
                    liked={false}
                    variant="mini"
                    onPress={() => router.push(`/festival/${f.id}`)}
                    onToggleLike={() => toggleLikedFestival(f.id)}
                  />
                ))}
              </View>
              <TouchableOpacity onPress={() => router.push('/festivals')} activeOpacity={0.7} style={styles.seeAllLink}>
                <Text style={[styles.seeAllText, { color: colors.accent }]}>Voir tous les festivals →</Text>
              </TouchableOpacity>
            </Animated.View>
          )}

          {/* Mes sessions */}
          <Animated.View entering={FadeInDown.delay(240).springify().damping(18).stiffness(140)}>
            <TouchableOpacity onPress={() => router.push('/tracker')} activeOpacity={0.8}>
              <GlassCard padding={16}>
                <View style={styles.sessionsRow}>
                  <View style={[styles.sessionsIcon, { backgroundColor: colors.accentTint }]}>
                    <TrendingUp size={18} color={colors.accent} strokeWidth={1.8} />
                  </View>
                  <View style={styles.sessionsInfo}>
                    <Text style={[styles.sessionsTitle, { color: colors.textPrimary }]}>Mes sessions</Text>
                    <Text style={[styles.sessionsSubtitle, { color: colors.textTertiary }]}>
                      {stats.totalSessions} session{stats.totalSessions > 1 ? 's' : ''} enregistrée{stats.totalSessions > 1 ? 's' : ''}
                    </Text>
                  </View>
                  <ChevronRight size={18} color={colors.textTertiary} strokeWidth={1.8} />
                </View>
              </GlassCard>
            </TouchableOpacity>
          </Animated.View>

          <View style={{ height: 120 }} />
        </View>
      </ScrollView>

      <AddSessionSheet
        visible={showAddModal}
        onClose={() => { setShowAddModal(false); setAddSessionFestival(null); }}
        onSave={handleSave}
        festivals={festivals}
        tournaments={tournaments}
        players={players}
        initialFestival={addSessionFestival}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: spacing.base,
    paddingTop: spacing.md,
  },
  cardStack: {
    gap: spacing.md,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
  },
  title: {
    fontSize: fontSize.display,
    fontFamily: fontFamily.display,
    letterSpacing: -1,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1E1F26',
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: fontSize.sm,
    fontFamily: fontFamily.bold,
  },

  sessionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  sessionsIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sessionsInfo: {
    flex: 1,
    gap: 2,
  },
  sessionsTitle: {
    fontSize: fontSize.base,
    fontFamily: fontFamily.semibold,
  },
  sessionsSubtitle: {
    fontSize: fontSize.xs,
    fontFamily: fontFamily.regular,
  },

  emptyHero: {
    alignItems: 'center',
    gap: spacing.sm,
  },
  emptyHeroTitle: {
    fontSize: fontSize.md,
    fontFamily: fontFamily.bold,
  },
  emptyHeroSubtitle: {
    fontSize: fontSize.sm,
    fontFamily: fontFamily.regular,
    textAlign: 'center',
  },

  section: {
    gap: spacing.sm,
  },
  sectionLabel: {
    marginLeft: 4,
  },
  sectionList: {
    gap: spacing.sm,
  },
  seeAllLink: {
    alignSelf: 'center',
    marginTop: spacing.xs,
    paddingVertical: spacing.xs,
  },
  seeAllText: {
    fontSize: fontSize.sm,
    fontFamily: fontFamily.semibold,
  },
});
