import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useCallback, useMemo } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { BarChart3, Heart, Coins, Drama, Disc3, Layers, Spade, Diamond } from 'lucide-react-native';
import { GlassCard } from '../src/components/ui/GlassCard';
import { PokerChip } from '../src/components/ui/PokerChip';
import { SectionLabel } from '../src/components/ui/SectionLabel';
import { FestivalHeroCard } from '../src/components/dashboard/FestivalHeroCard';
import { ReplayerHeroCard } from '../src/components/dashboard/ReplayerHeroCard';
import { GameTile } from '../src/components/degen/GameTile';
import { useAppStore } from '../src/store/useAppStore';
import { useAuthStore } from '../src/store/useAuthStore';
import { useHandHistoryStore } from '../src/store/useHandHistoryStore';
import { isFestivalOngoing, initials } from '../src/lib/format';
import { fontFamily, fontSize, spacing } from '../src/design-system/theme';
import { useTheme } from '../src/design-system/ThemeProvider';

export default function DashboardScreen() {
  const { t } = useTranslation(['dashboard', 'degen']);
  const { colors } = useTheme();
  const router = useRouter();
  const {
    user, festivals, organizers,
    likedFestivalIds, toggleLikedFestival,
  } = useAppStore();
  const displayName = useAuthStore((s) => s.user?.pseudo) ?? user.name;
  // Home is the first screen after login — sync here too, so the Replayer tab is already
  // current whichever way the user reaches it (same silent pattern as that tab).
  useFocusEffect(
    useCallback(() => {
      void useHandHistoryStore.getState().syncNow();
    }, [])
  );

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
            <TouchableOpacity
              style={styles.avatar}
              onPress={() => router.push('/profile')}
              activeOpacity={0.75}
              accessibilityRole="button"
              accessibilityLabel={t('openProfile')}
            >
              <Text style={styles.avatarText}>{initials(displayName)}</Text>
            </TouchableOpacity>
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

          {/* Replayer: one row, between the featured card and the games */}
          <Animated.View entering={FadeInDown.delay(70).springify().damping(18).stiffness(140)}>
            <ReplayerHeroCard
              onNewHand={() => router.push('/hand-replayer')}
              onOpenHands={() => router.push('/replayer')}
            />
          </Animated.View>

          {/* Jeux */}
          <Animated.View entering={FadeInDown.delay(90).springify().damping(18).stiffness(140)} style={styles.section}>
            <View style={styles.sectionHeader}>
              <SectionLabel style={styles.sectionLabel}>{t('sections.games')}</SectionLabel>
              <TouchableOpacity
                onPress={() => router.push('/stats')}
                activeOpacity={0.7}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                style={styles.statsLink}
              >
                <BarChart3 size={13} color={colors.textTertiary} strokeWidth={2} />
                <SectionLabel>{t('sections.stats')}</SectionLabel>
              </TouchableOpacity>
            </View>
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
                name="OFC"
                description={t('degen:games.ofc')}
                icon={<Layers size={20} color={colors.textSecondary} strokeWidth={1.5} />}
                comingSoon={false}
                onPress={() => router.push('/games/ofc')}
              />
              <GameTile
                name="Poker"
                description={t('degen:games.poker')}
                icon={<Spade size={20} color={colors.textSecondary} strokeWidth={1.5} />}
              />
              <GameTile
                name="Blackjack"
                description={t('degen:games.blackjack')}
                icon={<Diamond size={20} color={colors.textSecondary} strokeWidth={1.5} />}
              />
            </View>
          </Animated.View>

          <View style={{ height: 32 }} />
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
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1E1F26',
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: fontSize.base,
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
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statsLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
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

});
