import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Plus, MapPin, Dices } from 'lucide-react-native';
import { GlassCard } from '../../src/components/ui/GlassCard';
import { AnimatedNumber } from '../../src/components/ui/AnimatedNumber';
import { StatBadge } from '../../src/components/ui/StatBadge';
import { ProfitChart } from '../../src/components/charts/ProfitChart';
import { useAppStore } from '../../src/store/useAppStore';
import { colors, fontFamily, fontSize, spacing, radius } from '../../src/design-system/theme';

function formatCurrency(val: number, decimals = 0): string {
  const abs = Math.abs(val);
  const sign = val < 0 ? '-' : '';
  return `${sign}${abs.toFixed(decimals).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')} €`;
}

function getGreeting(t: (k: string) => string): string {
  const h = new Date().getHours();
  if (h < 12) return t('dashboard.greeting_morning');
  if (h < 18) return t('dashboard.greeting_afternoon');
  return t('dashboard.greeting_evening');
}

export default function DashboardScreen() {
  const { t } = useTranslation();
  const { user, stats, bankrollHistory, sessions } = useAppStore();
  const lastSession = sessions[0];

  const isMonthPositive = stats.thisMonthProfit >= 0;
  const isTotalPositive = stats.totalProfit >= 0;
  const isRoiPositive = stats.roi >= 0;
  const isHourlyPositive = stats.hourlyRate >= 0;

  const lastSessionProfit =
    lastSession.type === 'tournament'
      ? lastSession.cashOut - lastSession.totalInvested
      : lastSession.cashOut - lastSession.buyIn;

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Header ── */}
        <Animated.View entering={FadeInDown.delay(0).duration(500)} style={styles.header}>
          <View>
            <Text style={styles.greeting}>
              {getGreeting(t)}, {user.name.split(' ')[0]}
            </Text>
            <Text style={styles.date}>
              {new Date().toLocaleDateString(
                user.settings.language === 'fr' ? 'fr-FR' : 'en-US',
                { weekday: 'long', day: 'numeric', month: 'long' }
              )}
            </Text>
          </View>
          <TouchableOpacity style={styles.avatarBtn}>
            <View style={styles.avatarCircle}>
              <Text style={styles.avatarText}>
                {user.name.split(' ').map((n) => n[0]).join('')}
              </Text>
            </View>
          </TouchableOpacity>
        </Animated.View>

        {/* ── Bankroll Card (full width, featured) ── */}
        <Animated.View entering={FadeInDown.delay(80).duration(500)}>
          <GlassCard variant="gold" style={styles.bankrollCard} padding={24}>
            <Text style={styles.cardLabel}>{t('dashboard.bankroll_label')}</Text>
            <AnimatedNumber
              value={user.bankroll}
              formatFn={formatCurrency}
              style={styles.bankrollValue}
            />
            <View style={styles.bankrollFooter}>
              <StatBadge
                value={`${isMonthPositive ? '+' : ''}${formatCurrency(stats.thisMonthProfit)}`}
                trend={isMonthPositive ? 'up' : 'down'}
              />
              <Text style={styles.cardMeta}>{t('dashboard.profit_month')}</Text>
            </View>
          </GlassCard>
        </Animated.View>

        {/* ── 2-col row: Profit + ROI ── */}
        <Animated.View
          entering={FadeInDown.delay(160).duration(500)}
          style={styles.row}
        >
          <GlassCard style={styles.halfCard} padding={20}>
            <Text style={styles.cardLabel}>{t('dashboard.profit_label')}</Text>
            <AnimatedNumber
              value={stats.totalProfit}
              formatFn={formatCurrency}
              style={[styles.metricValue, { color: isTotalPositive ? colors.profit : colors.loss }]}
            />
            <Text style={styles.cardMeta}>{t('dashboard.profit_alltime')}</Text>
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
          entering={FadeInDown.delay(220).duration(500)}
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

        {/* ── Performance Chart ── */}
        <Animated.View entering={FadeInDown.delay(280).duration(500)}>
          <GlassCard variant="dark" style={styles.chartCard} padding={20}>
            <View style={styles.chartHeader}>
              <Text style={styles.cardLabel}>{t('dashboard.performance_label')}</Text>
              <StatBadge
                value={`+${stats.roi.toFixed(1)}% ROI`}
                trend={isTotalPositive ? 'up' : 'down'}
              />
            </View>
            <ProfitChart
              data={bankrollHistory}
              height={130}
              positive={isTotalPositive}
            />
          </GlassCard>
        </Animated.View>

        {/* ── Last Session ── */}
        {lastSession && (
          <Animated.View entering={FadeInDown.delay(340).duration(500)}>
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

        {/* ── Quick Actions ── */}
        <Animated.View
          entering={FadeInDown.delay(400).duration(500)}
          style={styles.actions}
        >
          <Pressable style={styles.actionPrimary}>
            <Plus size={18} color={colors.textInverse} strokeWidth={2.5} />
            <Text style={styles.actionPrimaryText}>{t('dashboard.quick_add')}</Text>
          </Pressable>
          <Pressable style={styles.actionSecondary}>
            <MapPin size={16} color={colors.gold} strokeWidth={1.5} />
            <Text style={styles.actionSecondaryText}>{t('dashboard.quick_finder')}</Text>
          </Pressable>
          <Pressable style={styles.actionSecondary}>
            <Dices size={16} color={colors.gold} strokeWidth={1.5} />
            <Text style={styles.actionSecondaryText}>{t('dashboard.quick_degen')}</Text>
          </Pressable>
        </Animated.View>

        {/* Bottom padding for tab bar */}
        <View style={{ height: 100 }} />
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
    gap: spacing.sm + 2,
  },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    marginBottom: spacing.xs,
  },
  greeting: {
    color: colors.textPrimary,
    fontSize: fontSize.xl,
    fontFamily: fontFamily.bold,
  },
  date: {
    color: colors.textSecondary,
    fontSize: fontSize.sm,
    fontFamily: fontFamily.regular,
    marginTop: 2,
    textTransform: 'capitalize',
  },
  avatarBtn: {},
  avatarCircle: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    backgroundColor: colors.glassGoldFill,
    borderWidth: 1,
    borderColor: colors.glassBorderGold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: colors.gold,
    fontSize: fontSize.sm,
    fontFamily: fontFamily.bold,
  },

  // Bankroll card
  bankrollCard: {},
  bankrollValue: {
    color: colors.gold,
    fontSize: fontSize['4xl'],
    fontFamily: fontFamily.extrabold,
    marginTop: spacing.xs,
    marginBottom: spacing.sm,
  },
  bankrollFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },

  // Layout
  row: {
    flexDirection: 'row',
    gap: spacing.sm + 2,
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
    fontSize: fontSize['2xl'],
    fontFamily: fontFamily.bold,
    marginTop: spacing.xs,
    marginBottom: 2,
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

  // Actions
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  actionPrimary: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    backgroundColor: colors.gold,
    borderRadius: radius.full,
    paddingVertical: spacing.md,
  },
  actionPrimaryText: {
    color: colors.textInverse,
    fontSize: fontSize.sm,
    fontFamily: fontFamily.bold,
  },
  actionSecondary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.glassBorderGold,
    backgroundColor: colors.glassGoldFill,
  },
  actionSecondaryText: {
    color: colors.gold,
    fontSize: fontSize.sm,
    fontFamily: fontFamily.semibold,
  },
});
