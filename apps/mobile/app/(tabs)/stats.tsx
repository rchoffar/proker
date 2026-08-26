import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { BarChart3 } from 'lucide-react-native';
import { GlassCard } from '../../src/components/ui/GlassCard';
import { SectionLabel } from '../../src/components/ui/SectionLabel';
import { Pill } from '../../src/components/ui/Pill';
import { useAppStore } from '../../src/store/useAppStore';
import { useIsActiveTab } from '../../src/hooks/useIsActiveTab';
import {
  bluffCatchRate,
  bluffChallengeSurvivalRate,
  flipWinRate,
  hasAnyStats,
  ofcFantasyRate,
  ofcFoulRate,
  rouletteSurvivalRate,
  sortedByGame,
  type PseudoStats,
} from '../../src/lib/gameStats';
import { useTheme } from '../../src/design-system/ThemeProvider';
import { fontFamily, fontSize, spacing } from '../../src/design-system/theme';

const pct = (rate: number): number => Math.round(rate * 100);

function StatRow({
  rank,
  name,
  primary,
  sub,
  pills,
}: {
  rank: number;
  name: string;
  primary: string;
  sub?: string[];
  pills?: string[];
}) {
  const { colors } = useTheme();
  return (
    <View style={styles.row}>
      <View style={styles.rowTop}>
        <View style={styles.rowName}>
          <Text style={[styles.rank, { color: colors.textTertiary }]}>{rank}</Text>
          <Text style={[styles.name, { color: colors.textPrimary }]} numberOfLines={1}>
            {name}
          </Text>
        </View>
        <Text style={[styles.primary, { color: colors.textPrimary }]}>{primary}</Text>
      </View>
      {(sub?.length || pills?.length) ? (
        <View style={styles.rowBottom}>
          <View style={styles.subCol}>
            {sub?.map((line) => (
              <Text key={line} style={[styles.sub, { color: colors.textTertiary }]} numberOfLines={1}>
                {line}
              </Text>
            ))}
          </View>
          <View style={styles.pills}>
            {pills?.map((label) => (
              <Pill key={label} label={label} tone="accent" />
            ))}
          </View>
        </View>
      ) : null}
    </View>
  );
}

function Divider() {
  const { colors } = useTheme();
  return <View style={[styles.divider, { backgroundColor: colors.hairline }]} />;
}

function GameSection({
  title,
  delay,
  rows,
}: {
  title: string;
  delay: number;
  rows: React.ReactNode[];
}) {
  if (rows.length === 0) return null;
  return (
    <Animated.View entering={FadeInDown.delay(delay).springify().damping(18).stiffness(140)}>
      <SectionLabel style={styles.sectionLabel}>{title}</SectionLabel>
      <GlassCard padding={4}>
        {rows.map((row, i) => (
          <View key={i}>
            {i > 0 ? <Divider /> : null}
            {row}
          </View>
        ))}
      </GlassCard>
    </Animated.View>
  );
}

export default function StatsScreen() {
  const { t } = useTranslation('stats');
  const { colors } = useTheme();
  const gameStats = useAppStore((s) => s.gameStats);
  const isActive = useIsActiveTab();

  if (!isActive) return <View style={styles.screen} />;

  const flipRows = sortedByGame(gameStats, 'flip').map(([key, p]: [string, PseudoStats], i) => {
    const s = p.flip!;
    const winRate = flipWinRate(s);
    return (
      <StatRow
        key={key}
        rank={i + 1}
        name={p.displayName}
        primary={t('winLoss', { wins: s.wins, losses: s.losses })}
        sub={[t('flip.rounds', { count: s.rounds })]}
        pills={winRate !== null ? [t('flip.winRate', { value: pct(winRate) })] : []}
      />
    );
  });

  const rouletteRows = sortedByGame(gameStats, 'roulette').map(([key, p]: [string, PseudoStats], i) => {
    const s = p.roulette!;
    const survival = rouletteSurvivalRate(s);
    return (
      <StatRow
        key={key}
        rank={i + 1}
        name={p.displayName}
        primary={t('roulette.picked', { count: s.picked })}
        sub={[t('roulette.spins', { count: s.spins })]}
        pills={survival !== null ? [t('roulette.survival', { value: pct(survival) })] : []}
      />
    );
  });

  const bluffRows = sortedByGame(gameStats, 'bluff').map(([key, p]: [string, PseudoStats], i) => {
    const s = p.bluff!;
    const catchRate = bluffCatchRate(s);
    const cleanRate = bluffChallengeSurvivalRate(s);
    const sub: string[] = [];
    if (s.catchAttempts > 0) sub.push(t('bluff.catches', { success: s.catchSuccesses, attempts: s.catchAttempts }));
    if (s.timesChallenged > 0) sub.push(t('bluff.caught', { caught: s.caughtBluffing, challenged: s.timesChallenged }));
    const pills: string[] = [];
    if (catchRate !== null) pills.push(t('bluff.catchRate', { value: pct(catchRate) }));
    if (cleanRate !== null) pills.push(t('bluff.survivalRate', { value: pct(cleanRate) }));
    return (
      <StatRow
        key={key}
        rank={i + 1}
        name={p.displayName}
        primary={t('bluff.games', { won: s.gamesWon, count: s.games })}
        sub={sub}
        pills={pills}
      />
    );
  });

  const ofcRows = sortedByGame(gameStats, 'ofc').map(([key, p]: [string, PseudoStats], i) => {
    const s = p.ofc!;
    const flRate = ofcFantasyRate(s);
    const foulRate = ofcFoulRate(s);
    const pills: string[] = [];
    if (flRate !== null) pills.push(t('ofc.fantasy', { value: pct(flRate) }));
    if (foulRate !== null) pills.push(t('ofc.fouls', { value: pct(foulRate) }));
    return (
      <StatRow
        key={key}
        rank={i + 1}
        name={p.displayName}
        primary={t('ofc.games', { won: s.gamesWon, count: s.games })}
        sub={[t('ofc.hands', { count: s.hands })]}
        pills={pills}
      />
    );
  });

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.stack}>
          <Animated.View entering={FadeInDown.delay(0).springify().damping(18).stiffness(140)} style={styles.header}>
            <Text style={[styles.title, { color: colors.textPrimary }]}>{t('title')}</Text>
          </Animated.View>

          {!hasAnyStats(gameStats) ? (
            <Animated.View entering={FadeInDown.delay(60).springify().damping(18).stiffness(140)}>
              <GlassCard variant="dark" padding={24}>
                <View style={styles.emptyCard}>
                  <BarChart3 size={28} color={colors.onDarkTertiary} strokeWidth={1.5} />
                  <Text style={[styles.emptyTitle, { color: colors.onDarkPrimary }]}>{t('empty.title')}</Text>
                  <Text style={[styles.emptySubtitle, { color: colors.onDarkTertiary }]}>{t('empty.subtitle')}</Text>
                </View>
              </GlassCard>
            </Animated.View>
          ) : (
            <>
              <GameSection title={t('games.flip')} delay={60} rows={flipRows} />
              <GameSection title={t('games.roulette')} delay={120} rows={rouletteRows} />
              <GameSection title={t('games.bluff')} delay={180} rows={bluffRows} />
              <GameSection title={t('games.ofc')} delay={240} rows={ofcRows} />
            </>
          )}

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
  content: {
    paddingHorizontal: spacing.base,
    paddingTop: spacing.md,
  },
  stack: {
    gap: spacing.md,
  },
  header: {
    paddingVertical: spacing.sm,
  },
  title: {
    fontSize: fontSize.display,
    fontFamily: fontFamily.display,
    letterSpacing: -1,
  },

  sectionLabel: {
    marginBottom: spacing.sm,
    marginLeft: spacing.xs,
  },

  emptyCard: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
  },
  emptyTitle: {
    fontSize: fontSize.md,
    fontFamily: fontFamily.bold,
  },
  emptySubtitle: {
    fontSize: fontSize.sm,
    fontFamily: fontFamily.regular,
    textAlign: 'center',
    lineHeight: 20,
  },

  row: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.base,
    gap: spacing.xs,
  },
  rowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  rowName: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flexShrink: 1,
  },
  rank: {
    fontSize: fontSize.xs,
    fontFamily: fontFamily.semibold,
    fontVariant: ['tabular-nums'],
    width: 14,
  },
  name: {
    fontSize: fontSize.base,
    fontFamily: fontFamily.semibold,
    flexShrink: 1,
  },
  primary: {
    fontSize: fontSize.base,
    fontFamily: fontFamily.bold,
    fontVariant: ['tabular-nums'],
  },
  rowBottom: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: spacing.sm,
    paddingLeft: 14 + spacing.sm,
  },
  subCol: {
    flexShrink: 1,
    gap: 2,
  },
  sub: {
    fontSize: fontSize.sm,
    fontFamily: fontFamily.regular,
  },
  pills: {
    flexDirection: 'row',
    gap: spacing.xs,
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
  },
  divider: {
    height: 1,
    marginLeft: spacing.md,
  },
});
