import {
  View,
  Text,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useCallback, useMemo, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { GlassCard } from '../../src/components/ui/GlassCard';
import { GlowBlob } from '../../src/components/ui/GlowBlob';
import { SectionLabel } from '../../src/components/ui/SectionLabel';
import { AnimatedNumber } from '../../src/components/ui/AnimatedNumber';
import { StatBadge } from '../../src/components/ui/StatBadge';
import { MetricGauge } from '../../src/components/ui/MetricGauge';
import { AreaChart } from '../../src/components/charts/AreaChart';
import { BarChart } from '../../src/components/charts/BarChart';
import { CoupDeCoeurCard } from '../../src/components/tournaments/CoupDeCoeurCard';
import { useAppStore } from '../../src/store/useAppStore';
import { computeWindowedStats, computeWeeklyVolume } from '../../src/lib/stats';
import { fontFamily, fontSize, spacing, radius } from '../../src/design-system/theme';
import { useTheme } from '../../src/design-system/ThemeProvider';

function formatCurrency(val: number, decimals = 0): string {
  const abs = Math.abs(val);
  const sign = val < 0 ? '-' : '';
  return `${sign}${abs.toFixed(decimals).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')} €`;
}

function initials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('');
}

function formatDateParts(iso: string): { day: string; month: string } {
  const date = new Date(iso);
  return {
    day: date.toLocaleDateString('fr-FR', { day: '2-digit' }),
    month: date.toLocaleDateString('fr-FR', { month: 'short' }).replace('.', '').toUpperCase(),
  };
}

export default function DashboardScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { user, stats, bankrollHistory, sessions, stakes, tournaments, festivals } = useAppStore();
  const [animKey, setAnimKey] = useState(0);

  useFocusEffect(
    useCallback(() => {
      setAnimKey((k) => k + 1);
    }, [])
  );

  const isMonthPositive = stats.thisMonthProfit >= 0;
  const isProfitPositive = stats.totalProfit >= 0;

  const windowed90d = useMemo(() => computeWindowedStats(sessions, stakes, 90), [sessions, stakes]);

  const now = new Date();
  const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const weeklyVolume = useMemo(() => computeWeeklyVolume(sessions, currentMonthKey), [sessions, currentMonthKey]);
  const monthHours = weeklyVolume.reduce((sum, w) => sum + w.hours, 0);

  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const last30d = useMemo(
    () => bankrollHistory.filter((h) => h.date >= thirtyDaysAgo),
    [bankrollHistory, thirtyDaysAgo]
  );
  const evolutionDelta = last30d.length > 0 ? last30d[last30d.length - 1].amount - last30d[0].amount : 0;

  const upcoming = useMemo(
    () => tournaments
      .filter((t2) => !!t2.startDate)
      .sort((a, b) => (a.startDate! < b.startDate! ? -1 : 1))
      .slice(0, 3),
    [tournaments]
  );
  const featured = upcoming.find((t2) => t2.featured) ?? null;
  const plainUpcoming = upcoming.filter((t2) => t2.id !== featured?.id);

  const roiSweep = Math.min(Math.abs(windowed90d.roi), 100);
  const roiColor = windowed90d.roi >= 0 ? colors.accent : colors.loss;

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

          {/* Profit hero */}
          <Animated.View entering={FadeInDown.delay(60).springify().damping(18).stiffness(140)}>
            <GlassCard variant="dark" style={styles.heroCard} padding={24}>
              <GlowBlob />
              <View style={styles.heroHeader}>
                <SectionLabel tone="dark">Profit total</SectionLabel>
                <Text style={[styles.heroCurrency, { color: colors.onDarkTertiary }]}>EUR</Text>
              </View>
              <AnimatedNumber
                value={stats.totalProfit}
                formatFn={(v) => `${v >= 0 ? '+' : ''}${formatCurrency(Math.abs(v))}`}
                style={[styles.heroValue, { color: colors.accentBright }]}
              />
              <View style={styles.heroFooter}>
                <StatBadge
                  tone="dark"
                  value={`${isMonthPositive ? '↗ +' : '↘ '}${formatCurrency(Math.abs(stats.thisMonthProfit))}`}
                  trend={isMonthPositive ? 'up' : 'down'}
                />
                <Text style={[styles.heroFooterText, { color: colors.onDarkTertiary }]}>{t('dashboard.profit_month')}</Text>
              </View>
              {bankrollHistory.length > 1 && (
                <View style={styles.heroSparkline}>
                  <AreaChart data={bankrollHistory.slice(-14)} height={56} tone="dark" color={isProfitPositive ? undefined : colors.loss} />
                </View>
              )}
            </GlassCard>
          </Animated.View>

          {/* Gauges row */}
          <Animated.View entering={FadeInDown.delay(120).springify().damping(18).stiffness(140)} style={styles.row}>
            <GlassCard style={styles.halfCard} padding={18}>
              <View style={styles.gaugeCardInner}>
                <SectionLabel>ROI · 90 j</SectionLabel>
                <View style={styles.gaugeWrap}>
                  <MetricGauge
                    value={roiSweep}
                    centerLabel={`${windowed90d.roi >= 0 ? '+' : ''}${windowed90d.roi.toFixed(0)}%`}
                    color={roiColor}
                  />
                </View>
              </View>
            </GlassCard>
            <GlassCard style={styles.halfCard} padding={18}>
              <View style={styles.gaugeCardInner}>
                <SectionLabel>ITM · 90 j</SectionLabel>
                <View style={styles.gaugeWrap}>
                  <MetricGauge
                    value={windowed90d.itmRate}
                    centerLabel={`${windowed90d.itmRate.toFixed(0)}%`}
                    color={colors.neutralChart}
                  />
                </View>
              </View>
            </GlassCard>
          </Animated.View>

          {/* Volume */}
          <Animated.View entering={FadeInDown.delay(180).springify().damping(18).stiffness(140)}>
            <GlassCard padding={20}>
              <View style={styles.cardHeaderRow}>
                <View>
                  <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>Volume · {now.toLocaleDateString('fr-FR', { month: 'long' })}</Text>
                  <SectionLabel style={styles.cardCaption}>Réparti par semaine</SectionLabel>
                </View>
                <Text style={[styles.volumeValue, { color: colors.textPrimary }]}>{monthHours.toFixed(0)}h</Text>
              </View>
              <View style={styles.chartSpacer}>
                <BarChart data={weeklyVolume} height={90} />
              </View>
            </GlassCard>
          </Animated.View>

          {/* Évolution */}
          <Animated.View entering={FadeInDown.delay(240).springify().damping(18).stiffness(140)}>
            <GlassCard padding={20}>
              <View style={styles.cardHeaderRow}>
                <View>
                  <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>Évolution</Text>
                  <SectionLabel style={styles.cardCaption}>30 derniers jours</SectionLabel>
                </View>
                <Text style={[styles.evolutionDelta, { color: evolutionDelta >= 0 ? colors.accent : colors.loss }]}>
                  {evolutionDelta >= 0 ? '+' : ''}{formatCurrency(evolutionDelta)}
                </Text>
              </View>
              {last30d.length > 1 ? (
                <AreaChart data={last30d} height={110} tone="light" color={evolutionDelta >= 0 ? undefined : colors.loss} />
              ) : (
                <Text style={[styles.emptyChartText, { color: colors.textTertiary }]}>Pas encore assez de données</Text>
              )}
            </GlassCard>
          </Animated.View>

          {/* Prochains tournois */}
          {(featured || plainUpcoming.length > 0) && (
            <Animated.View entering={FadeInDown.delay(300).springify().damping(18).stiffness(140)}>
              <GlassCard padding={20}>
                <View style={styles.tournoisStack}>
                  <SectionLabel>Prochains tournois</SectionLabel>
                  {featured && (
                    <CoupDeCoeurCard
                      tournament={featured}
                      festival={festivals.find((f) => f.id === featured.festivalId)}
                      variant="mini"
                    />
                  )}
                  {plainUpcoming.map((t2) => {
                    const festival = festivals.find((f) => f.id === t2.festivalId);
                    const { day, month } = formatDateParts(t2.startDate!);
                    return (
                      <View key={t2.id} style={styles.upcomingRow}>
                        <View style={styles.upcomingDate}>
                          <Text style={[styles.upcomingDay, { color: colors.textPrimary }]}>{day}</Text>
                          <Text style={[styles.upcomingMonth, { color: colors.textTertiary }]}>{month}</Text>
                        </View>
                        <View style={[styles.upcomingDivider, { backgroundColor: colors.hairline }]} />
                        <View style={styles.upcomingInfo}>
                          <Text style={[styles.upcomingName, { color: colors.textPrimary }]} numberOfLines={1}>{t2.name}</Text>
                          <Text style={[styles.upcomingVenue, { color: colors.textTertiary }]} numberOfLines={1}>{festival?.name ?? ''}</Text>
                        </View>
                        <View style={[styles.buyInChip, { backgroundColor: colors.neutralTileBg }]}>
                          <Text style={[styles.buyInChipText, { color: colors.textSecondary }]}>{formatCurrency(t2.buyIn)}</Text>
                        </View>
                      </View>
                    );
                  })}
                </View>
              </GlassCard>
            </Animated.View>
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

  heroCard: {
    overflow: 'hidden',
  },
  heroHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  heroCurrency: {
    fontSize: fontSize.xs,
    fontFamily: fontFamily.semibold,
    letterSpacing: 1,
  },
  heroValue: {
    fontSize: fontSize.display,
    fontFamily: fontFamily.extrabold,
    marginTop: spacing.sm,
    marginBottom: spacing.md,
    letterSpacing: -1,
    fontVariant: ['tabular-nums'],
  },
  heroFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  heroFooterText: {
    fontSize: fontSize.sm,
    fontFamily: fontFamily.regular,
  },
  heroSparkline: {
    marginTop: spacing.md,
  },

  row: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  halfCard: {
    flex: 1,
  },
  gaugeCardInner: {
    alignItems: 'center',
  },
  gaugeWrap: {
    marginTop: spacing.sm,
  },

  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
  },
  cardTitle: {
    fontSize: fontSize.md,
    fontFamily: fontFamily.bold,
  },
  cardCaption: {
    marginTop: 3,
  },
  volumeValue: {
    fontSize: fontSize['2xl'],
    fontFamily: fontFamily.extrabold,
    letterSpacing: -0.5,
  },
  chartSpacer: {
    marginTop: spacing.sm,
  },

  evolutionDelta: {
    fontSize: fontSize.lg,
    fontFamily: fontFamily.bold,
  },
  emptyChartText: {
    fontSize: fontSize.sm,
    fontFamily: fontFamily.regular,
    textAlign: 'center',
    paddingVertical: spacing.xl,
  },

  tournoisStack: {
    gap: spacing.md,
  },
  upcomingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  upcomingDate: {
    width: 34,
    alignItems: 'center',
  },
  upcomingDay: {
    fontSize: fontSize.md,
    fontFamily: fontFamily.bold,
    fontVariant: ['tabular-nums'],
  },
  upcomingMonth: {
    fontSize: 9,
    fontFamily: fontFamily.semibold,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  upcomingDivider: {
    width: 1,
    height: 30,
  },
  upcomingInfo: {
    flex: 1,
    gap: 2,
  },
  upcomingName: {
    fontSize: fontSize.base,
    fontFamily: fontFamily.semibold,
  },
  upcomingVenue: {
    fontSize: fontSize.xs,
    fontFamily: fontFamily.regular,
  },
  buyInChip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.full,
  },
  buyInChipText: {
    fontSize: fontSize.xs,
    fontFamily: fontFamily.bold,
  },
});
