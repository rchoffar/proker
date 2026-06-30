import {
  View,
  Text,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { GlassCard } from '../../src/components/ui/GlassCard';
import { AnimatedNumber } from '../../src/components/ui/AnimatedNumber';
import { StatBadge } from '../../src/components/ui/StatBadge';
import { ProfitChart } from '../../src/components/charts/ProfitChart';
import { BackgroundCanvas } from '../../src/components/ui/BackgroundCanvas';
import { useAppStore } from '../../src/store/useAppStore';
import { colors, fontFamily, fontSize, spacing, radius } from '../../src/design-system/theme';

function formatCurrency(val: number, decimals = 0): string {
  const abs = Math.abs(val);
  const sign = val < 0 ? '-' : '';
  return `${sign}${abs.toFixed(decimals).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')} €`;
}


export default function DashboardScreen() {
  const { t } = useTranslation();
  const { user, stats, bankrollHistory, sessions } = useAppStore();
  const lastSession = sessions[0] ?? null;
  const [animKey, setAnimKey] = useState(0);

  useFocusEffect(
    useCallback(() => {
      setAnimKey(k => k + 1);
    }, [])
  );

  const isMonthPositive = stats.thisMonthProfit >= 0;
  const isProfitPositive = stats.totalProfit >= 0;
  const isRoiPositive = stats.roi >= 0;
  const isHourlyPositive = stats.hourlyRate >= 0;

  const lastSessionProfit = lastSession
    ? lastSession.type === 'tournament'
      ? lastSession.cashOut - (lastSession.reEntries + 1) * lastSession.buyIn
      : lastSession.cashOut - lastSession.buyIn
    : 0;

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <BackgroundCanvas />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View key={animKey} style={styles.cardStack}>
        {/* ── Total Profit Card (full width, featured) ── */}
        <Animated.View entering={FadeInDown.delay(0).springify().damping(18).stiffness(140)}>
          <GlassCard variant="gold" style={styles.bankrollCard} padding={24}>
            <Text style={styles.cardLabel}>Profit total</Text>
            <AnimatedNumber
              value={stats.totalProfit}
              formatFn={(v) => `${v >= 0 ? '+' : ''}${formatCurrency(Math.abs(v))}`}
              style={[styles.bankrollValue, { color: isProfitPositive ? colors.profit : colors.loss }]}
            />
            <View style={styles.bankrollDivider} />
            <View style={styles.bankrollFooter}>
              <StatBadge
                value={`${isMonthPositive ? '+' : ''}${formatCurrency(stats.thisMonthProfit)}`}
                trend={isMonthPositive ? 'up' : 'down'}
              />
              <Text style={styles.cardMeta}>{t('dashboard.profit_month')}</Text>
            </View>
          </GlassCard>
        </Animated.View>

        {/* ── 2-col row: Meilleur gain + ROI ── */}
        <Animated.View
          entering={FadeInDown.delay(80).springify().damping(18).stiffness(140)}
          style={styles.row}
        >
          <GlassCard style={styles.halfCard} padding={20}>
            <Text style={styles.cardLabel}>Meilleur gain</Text>
            <AnimatedNumber
              value={stats.biggestWin}
              formatFn={(v) => `+${formatCurrency(v)}`}
              style={[styles.metricValue, { color: colors.profit }]}
            />
            <Text style={styles.cardMeta}>all-time</Text>
          </GlassCard>

          <GlassCard style={styles.halfCard} padding={20}>
            <Text style={styles.cardLabel}>{t('dashboard.roi_label')}</Text>
            <AnimatedNumber
              value={stats.roi}
              suffix="%"
              decimals={1}
              style={[styles.metricValue, { color: isRoiPositive ? colors.profit : colors.loss }]}
            />
            <Text style={styles.cardMeta}>{t('dashboard.profit_alltime')}</Text>
          </GlassCard>
        </Animated.View>

        {/* ── 2-col row: Hourly + Sessions ── */}
        <Animated.View
          entering={FadeInDown.delay(160).springify().damping(18).stiffness(140)}
          style={styles.row}
        >
          <GlassCard style={styles.halfCard} padding={20}>
            <Text style={styles.cardLabel}>{t('dashboard.hourly_label')}</Text>
            <AnimatedNumber
              value={stats.hourlyRate}
              formatFn={(v) => `${v >= 0 ? '+' : ''}${formatCurrency(v)}`}
              style={[styles.metricValue, { color: isHourlyPositive ? colors.profit : colors.loss }]}
            />
            <Text style={styles.cardMeta}>/ heure</Text>
          </GlassCard>

          <GlassCard style={styles.halfCard} padding={20}>
            <Text style={styles.cardLabel}>{t('dashboard.sessions_label')}</Text>
            <AnimatedNumber
              value={stats.thisMonthSessions}
              style={styles.metricValue}
            />
            <Text style={styles.cardMeta}>{t('dashboard.sessions_month')}</Text>
          </GlassCard>
        </Animated.View>

        {/* ── Sponsored Tournament ── */}
        <Animated.View entering={FadeInDown.delay(240).springify().damping(18).stiffness(140)}>
          <GlassCard variant="dark" style={styles.sponsoredCard} padding={20}>
            <View style={styles.sponsoredHeader}>
              <View style={styles.sponsoredBadge}>
                <Text style={styles.sponsoredBadgeText}>COUP DE CŒUR</Text>
              </View>
              <Text style={styles.sponsoredPrize}>15 000 €</Text>
            </View>
            <Text style={styles.sponsoredName}>Winamax Poker Tour — Paris</Text>
            <Text style={styles.sponsoredSub}>Buy-in 550 € · 12 juil. 2025</Text>
            <View style={styles.sponsoredDivider} />
            <View style={styles.sponsoredFooter}>
              <View style={styles.sponsoredCta}>
                <Text style={styles.sponsoredCtaText}>Voir le tournoi</Text>
              </View>
            </View>
          </GlassCard>
        </Animated.View>

        {/* ── Performance Chart ── */}
        {bankrollHistory.length > 0 && (
          <Animated.View entering={FadeInDown.delay(320).springify().damping(18).stiffness(140)}>
            <GlassCard variant="dark" style={styles.chartCard} padding={20}>
              <View style={styles.chartHeader}>
                <Text style={styles.cardLabel}>{t('dashboard.performance_label')}</Text>
                <StatBadge
                  value={`+${stats.roi.toFixed(1)}% ROI`}
                  trend={isProfitPositive ? 'up' : 'down'}
                />
              </View>
              <ProfitChart
                data={bankrollHistory}
                height={130}
                positive={isProfitPositive}
              />
            </GlassCard>
          </Animated.View>
        )}

        {/* ── Last Session ── */}
        {lastSession && (
          <Animated.View entering={FadeInDown.delay(400).springify().damping(18).stiffness(140)}>
            <GlassCard style={styles.lastSessionCard} padding={20}>
              <View style={styles.lastSessionHeader}>
                <Text style={styles.cardLabel}>{t('dashboard.last_session')}</Text>
                {lastSession.type === 'cash' ? (
                  <View style={styles.typePill}>
                    <Text style={styles.typePillText}>Cash</Text>
                  </View>
                ) : (
                  <View style={[styles.typePill, styles.typePillTournament]}>
                    <Text style={styles.typePillText}>Tournoi</Text>
                  </View>
                )}
              </View>
              <Text style={styles.lastSessionVenue}>{lastSession.venue}</Text>
              <View style={styles.lastSessionFooter}>
                <View style={styles.lastSessionMeta}>
                  <Text style={styles.cardMeta}>
                    {new Date(lastSession.date).toLocaleDateString(
                      user.settings.language === 'fr' ? 'fr-FR' : 'en-US',
                      { day: 'numeric', month: 'short' }
                    )}
                  </Text>
                  <Text style={styles.dot}>·</Text>
                  <Text style={styles.cardMeta}>{lastSession.durationHours}h</Text>
                </View>
                <Text
                  style={[
                    styles.lastSessionProfit,
                    { color: lastSessionProfit >= 0 ? colors.profit : colors.loss },
                  ]}
                >
                  {lastSessionProfit >= 0 ? '+' : ''}{formatCurrency(lastSessionProfit)}
                </Text>
              </View>
            </GlassCard>
          </Animated.View>
        )}

        {/* Bottom padding for tab bar */}
        <View style={{ height: 120 }} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bgBase,
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: spacing.base,
    paddingTop: spacing.md,
  },
  cardStack: {
    gap: spacing.sm,
  },

  // Bankroll card
  bankrollCard: {},
  bankrollValue: {
    color: colors.textPrimary,
    fontSize: 52,
    fontFamily: fontFamily.extrabold,
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
    letterSpacing: -1,
  },
  bankrollDivider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.10)',
    marginBottom: spacing.md,
  },
  bankrollFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },

  // Layout
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  halfCard: {
    flex: 1,
  },

  // Metric cards
  cardLabel: {
    color: colors.textSecondary,
    fontSize: fontSize.sm,
    fontFamily: fontFamily.medium,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  cardMeta: {
    color: colors.textTertiary,
    fontSize: fontSize.xs,
    fontFamily: fontFamily.regular,
    marginTop: 4,
  },
  metricValue: {
    color: colors.textPrimary,
    fontSize: 26,
    fontFamily: fontFamily.bold,
    marginTop: spacing.sm,
    marginBottom: 4,
    letterSpacing: -0.5,
  },

  // Chart card
  chartCard: {},
  chartHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },

  // Last session
  lastSessionCard: {},
  lastSessionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  lastSessionVenue: {
    color: colors.textPrimary,
    fontSize: fontSize.md,
    fontFamily: fontFamily.semibold,
    marginBottom: spacing.sm,
  },
  lastSessionFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  lastSessionMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  dot: {
    color: colors.textTertiary,
    fontSize: fontSize.sm,
  },
  lastSessionProfit: {
    fontSize: fontSize.lg,
    fontFamily: fontFamily.bold,
  },
  typePill: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: radius.full,
    backgroundColor: 'rgba(0, 200, 120, 0.12)',
  },
  typePillTournament: {
    backgroundColor: 'rgba(255, 215, 0, 0.10)',
  },
  typePillText: {
    color: colors.textSecondary,
    fontSize: fontSize.xs,
    fontFamily: fontFamily.semibold,
  },

  // Sponsored tournament
  sponsoredCard: {},
  sponsoredHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  sponsoredBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.full,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.18)',
  },
  sponsoredBadgeText: {
    color: colors.textSecondary,
    fontSize: fontSize.xs,
    fontFamily: fontFamily.semibold,
    letterSpacing: 0.8,
  },
  sponsoredPrize: {
    color: colors.textPrimary,
    fontSize: fontSize.lg,
    fontFamily: fontFamily.bold,
  },
  sponsoredName: {
    color: colors.textPrimary,
    fontSize: fontSize.md,
    fontFamily: fontFamily.semibold,
    marginBottom: 4,
  },
  sponsoredSub: {
    color: colors.textSecondary,
    fontSize: fontSize.sm,
    fontFamily: fontFamily.regular,
  },
  sponsoredDivider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    marginVertical: spacing.md,
  },
  sponsoredFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sponsoredCta: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.full,
    backgroundColor: 'rgba(255, 255, 255, 0.14)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.22)',
  },
  sponsoredCtaText: {
    color: colors.textPrimary,
    fontSize: fontSize.sm,
    fontFamily: fontFamily.semibold,
  },

});
