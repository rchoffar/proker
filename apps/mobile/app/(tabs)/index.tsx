import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useMemo } from 'react';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { BarChart3, ChevronRight, Heart, History, Coins, Drama, Disc3, Layers, Trophy } from 'lucide-react-native';
import { GlassCard } from '../../src/components/ui/GlassCard';
import { PokerChip } from '../../src/components/ui/PokerChip';
import { SectionLabel } from '../../src/components/ui/SectionLabel';
import { Pill } from '../../src/components/ui/Pill';
import { FestivalHeroCard } from '../../src/components/dashboard/FestivalHeroCard';
import { GameTile } from '../../src/components/degen/GameTile';
import { useAppStore } from '../../src/store/useAppStore';
import { useAuthStore } from '../../src/store/useAuthStore';
import { useIsActiveTab } from '../../src/hooks/useIsActiveTab';
import { hasAnyStats, totals } from '../../src/lib/gameStats';
import { formatAmount, formatDateShort, isFestivalOngoing, initials } from '../../src/lib/format';
import { fontFamily, fontSize, spacing } from '../../src/design-system/theme';
import { useTheme } from '../../src/design-system/ThemeProvider';

export default function DashboardScreen() {
  const { t } = useTranslation(['dashboard', 'degen']);
  const { colors } = useTheme();
  const router = useRouter();
  const {
    user, festivals, tournaments, organizers,
    likedFestivalIds, toggleLikedFestival, gameStats,
  } = useAppStore();
  const displayName = useAuthStore((s) => s.user?.pseudo) ?? user.name;
  const isActive = useIsActiveTab();

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

  // Le héros affiche le festival mis en avant par nous (flag featured) ;
  // repli sur le festival liké en cours puis le dernier liké si aucun n'est poussé.
  const featuredFestival = useMemo(() => festivals.find((f) => f.featured) ?? null, [festivals]);
  const currentFestival = featuredFestival ?? ongoingFestival ?? mostRecentlyLiked;
  const heroBadge = currentFestival === featuredFestival
    ? ('featured' as const)
    : currentFestival === ongoingFestival
      ? ('ongoing' as const)
      : ('liked' as const);

  // Tournoi à la une : le prochain Main Event à venir, sinon le prochain tournoi daté.
  const featuredTournament = useMemo(() => {
    const upcoming = tournaments
      .filter((tn) => tn.startDate && tn.startDate >= todayIso)
      .sort((a, b) => (a.startDate! < b.startDate! ? -1 : 1));
    return upcoming.find((tn) => tn.isMainEvent) ?? upcoming[0] ?? null;
  }, [tournaments, todayIso]);

  const featuredTournamentFestival = useMemo(
    () => (featuredTournament ? festivals.find((f) => f.id === featuredTournament.festivalId) ?? null : null),
    [featuredTournament, festivals]
  );

  const statsTotals = useMemo(() => totals(gameStats), [gameStats]);

  if (!isActive) return <View style={styles.screen} />;

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.cardStack}>

          {/* Header */}
          <Animated.View entering={FadeInDown.delay(0).springify().damping(18).stiffness(140)} style={styles.header}>
            <Text style={[styles.title, { color: colors.textPrimary }]}>{t('title')}</Text>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{initials(displayName)}</Text>
            </View>
          </Animated.View>

          {/* Festival hero */}
          <Animated.View entering={FadeInDown.delay(60).springify().damping(18).stiffness(140)}>
            {currentFestival ? (
              <FestivalHeroCard
                festival={currentFestival}
                organizer={currentFestival.organizerId ? organizerById[currentFestival.organizerId] : undefined}
                badge={heroBadge}
                liked={likedFestivalIds.includes(currentFestival.id)}
                onPress={() => router.push(`/festival/${currentFestival.id}`)}
                onToggleLike={() => toggleLikedFestival(currentFestival.id)}
              />
            ) : (
              <GlassCard variant="dark" padding={24} style={styles.emptyHero}>
                <View style={styles.emptyHeroIconWrap}>
                  <PokerChip size={90} style={styles.emptyHeroChip} color={colors.onDarkHairline} />
                  <Heart size={22} color={colors.onDarkTertiary} strokeWidth={1.5} />
                </View>
                <Text style={[styles.emptyHeroTitle, { color: colors.onDarkPrimary }]}>{t('emptyHero.title')}</Text>
                <Text style={[styles.emptyHeroSubtitle, { color: colors.onDarkTertiary }]}>
                  {t('emptyHero.subtitle')}
                </Text>
              </GlassCard>
            )}
          </Animated.View>

          {/* Jeux */}
          <Animated.View entering={FadeInDown.delay(90).springify().damping(18).stiffness(140)} style={styles.section}>
            <SectionLabel style={styles.sectionLabel}>{t('sections.games')}</SectionLabel>
            <View style={styles.grid}>
              <GameTile
                name="Flip"
                description={t('degen:games.flip')}
                icon={<Coins size={20} color={colors.textSecondary} strokeWidth={1.5} />}
                comingSoon={false}
                onPress={() => router.push('/games/flip')}
              />
              <GameTile
                name="Bluff"
                description={t('degen:games.bluff')}
                icon={<Drama size={20} color={colors.textSecondary} strokeWidth={1.5} />}
                comingSoon={false}
                onPress={() => router.push('/games/bluff')}
              />
              <GameTile
                name="Roulette"
                description={t('degen:games.roulette')}
                icon={<Disc3 size={20} color={colors.textSecondary} strokeWidth={1.5} />}
                comingSoon={false}
                onPress={() => router.push('/games/roulette')}
              />
              <GameTile
                name="Open-Face Chinese Poker"
                description={t('degen:games.ofc')}
                icon={<Layers size={20} color={colors.textSecondary} strokeWidth={1.5} />}
                comingSoon={false}
                onPress={() => router.push('/games/ofc')}
              />
              <GameTile
                name={t('games.replayTitle')}
                description={t('games.replayDesc')}
                icon={<History size={20} color={colors.textSecondary} strokeWidth={1.5} />}
                comingSoon={false}
                pillLabel={t('tilePills.open')}
                onPress={() => router.push('/hand-replayer')}
              />
            </View>
          </Animated.View>

          {/* Tournoi à la une */}
          {featuredTournament && (
            <Animated.View entering={FadeInDown.delay(160).springify().damping(18).stiffness(140)} style={styles.section}>
              <SectionLabel style={styles.sectionLabel}>{t('sections.featuredTournament')}</SectionLabel>
              <TouchableOpacity
                onPress={() => router.push(`/festival/${featuredTournament.festivalId}`)}
                activeOpacity={0.8}
              >
                <GlassCard padding={16}>
                  <View style={styles.tournamentRow}>
                    <View style={[styles.tournamentIcon, { backgroundColor: colors.accentTint }]}>
                      <Trophy size={18} color={colors.accent} strokeWidth={1.8} />
                    </View>
                    <View style={styles.tournamentInfo}>
                      <Text style={[styles.tournamentName, { color: colors.textPrimary }]} numberOfLines={1}>
                        {featuredTournament.name}
                      </Text>
                      <Text style={[styles.tournamentSub, { color: colors.textTertiary }]} numberOfLines={1}>
                        {[featuredTournamentFestival?.name, featuredTournament.startDate ? formatDateShort(featuredTournament.startDate) : null]
                          .filter(Boolean)
                          .join(' · ')}
                      </Text>
                      <View style={styles.tournamentPills}>
                        {featuredTournament.isMainEvent ? <Pill label="Main Event" tone="accent" /> : null}
                        <Pill label={t('tournament.buyIn', { amount: formatAmount(featuredTournament.buyIn) })} />
                        {featuredTournament.guaranteed ? (
                          <Pill label={t('tournament.guaranteed', { amount: formatAmount(featuredTournament.guaranteed) })} />
                        ) : null}
                      </View>
                    </View>
                    <ChevronRight size={18} color={colors.textTertiary} strokeWidth={1.8} />
                  </View>
                </GlassCard>
              </TouchableOpacity>
            </Animated.View>
          )}

          {/* Stats rapides des mini-jeux — le détail par pseudo vit dans l'onglet Stats */}
          <Animated.View entering={FadeInDown.delay(200).springify().damping(18).stiffness(140)} style={styles.section}>
            <SectionLabel style={styles.sectionLabel}>{t('sections.stats')}</SectionLabel>
            <TouchableOpacity onPress={() => router.push('/stats')} activeOpacity={0.8}>
              <GlassCard padding={16}>
                <View style={styles.tournamentRow}>
                  <View style={[styles.tournamentIcon, { backgroundColor: colors.accentTint }]}>
                    <BarChart3 size={18} color={colors.accent} strokeWidth={1.8} />
                  </View>
                  <View style={styles.tournamentInfo}>
                    <Text style={[styles.tournamentName, { color: colors.textPrimary }]}>{t('quickStats.title')}</Text>
                    <Text style={[styles.tournamentSub, { color: colors.textTertiary }]} numberOfLines={1}>
                      {hasAnyStats(gameStats)
                        ? t('quickStats.players', { count: statsTotals.pseudos })
                        : t('quickStats.empty')}
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

  emptyHero: {
    alignItems: 'center',
    gap: spacing.sm,
    overflow: 'hidden',
  },
  emptyHeroIconWrap: {
    width: 90,
    height: 90,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyHeroChip: {
    position: 'absolute',
    top: 0,
    left: 0,
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
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: spacing.md,
  },

  tournamentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  tournamentIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tournamentInfo: {
    flex: 1,
    gap: 3,
  },
  tournamentName: {
    fontSize: fontSize.base,
    fontFamily: fontFamily.semibold,
  },
  tournamentSub: {
    fontSize: fontSize.xs,
    fontFamily: fontFamily.regular,
  },
  tournamentPills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: 3,
  },
});
