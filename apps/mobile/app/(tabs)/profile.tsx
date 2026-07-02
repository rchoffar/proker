import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Switch, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useCallback, useMemo } from 'react';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { ChevronRight } from 'lucide-react-native';
import { GlassCard } from '../../src/components/ui/GlassCard';
import { GlowBlob } from '../../src/components/ui/GlowBlob';
import { SectionLabel } from '../../src/components/ui/SectionLabel';
import { AnimatedNumber } from '../../src/components/ui/AnimatedNumber';
import { StatBadge } from '../../src/components/ui/StatBadge';
import { MetricGauge } from '../../src/components/ui/MetricGauge';
import { AreaChart } from '../../src/components/charts/AreaChart';
import { BarChart } from '../../src/components/charts/BarChart';
import { useAppStore } from '../../src/store/useAppStore';
import { useFocusAnimKey } from '../../src/hooks/useFocusAnimKey';
import { computeWindowedStats, computeWeeklyVolume } from '../../src/lib/stats';
import { useTheme } from '../../src/design-system/ThemeProvider';
import i18n from '../../src/i18n';
import { fontFamily, fontSize, spacing } from '../../src/design-system/theme';

function initials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('');
}

function formatCurrency(val: number, decimals = 0): string {
  const abs = Math.abs(val);
  const sign = val < 0 ? '-' : '';
  return `${sign}${abs.toFixed(decimals).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')} €`;
}

function SettingRow({
  label,
  value,
  onPress,
  control,
  destructive,
}: {
  label: string;
  value?: string;
  onPress?: () => void;
  control?: React.ReactNode;
  destructive?: boolean;
}) {
  const { colors } = useTheme();
  const Wrapper = onPress ? TouchableOpacity : View;
  return (
    <Wrapper style={styles.row} onPress={onPress} activeOpacity={0.7}>
      <Text style={[styles.rowLabel, { color: destructive ? colors.loss : colors.textPrimary }]}>{label}</Text>
      <View style={styles.rowRight}>
        {value ? <Text style={[styles.rowValue, { color: colors.textTertiary }]}>{value}</Text> : null}
        {control}
        {onPress && !control ? <ChevronRight size={16} color={colors.textTertiary} strokeWidth={1.8} /> : null}
      </View>
    </Wrapper>
  );
}

function Divider() {
  const { colors } = useTheme();
  return <View style={[styles.divider, { backgroundColor: colors.hairline }]} />;
}

export default function ProfileScreen() {
  const { colors, scheme, toggleScheme } = useTheme();
  const { user, stats, bankrollHistory, sessions, stakes, updateUser, resetStore } = useAppStore();
  const animKey = useFocusAnimKey();

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

  const roiSweep = Math.min(Math.abs(windowed90d.roi), 100);
  const roiColor = windowed90d.roi >= 0 ? colors.accent : colors.loss;

  const toggleLanguage = useCallback(() => {
    const next = user.settings.language === 'fr' ? 'en' : 'fr';
    updateUser({ settings: { ...user.settings, language: next } });
    i18n.changeLanguage(next);
  }, [user.settings, updateUser]);

  const toggleNotifications = useCallback((value: boolean) => {
    updateUser({ settings: { ...user.settings, notifications: value } });
  }, [user.settings, updateUser]);

  const handleReset = useCallback(() => {
    Alert.alert(
      'Réinitialiser les données',
      'Cette action efface toutes les sessions et stakes, et restaure les données de démo. Continuer ?',
      [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Réinitialiser', style: 'destructive', onPress: resetStore },
      ]
    );
  }, [resetStore]);

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View key={animKey} style={styles.stack}>

          <Animated.View entering={FadeInDown.delay(0).springify().damping(18).stiffness(140)} style={styles.header}>
            <Text style={[styles.title, { color: colors.textPrimary }]}>Profil</Text>
          </Animated.View>

          {/* Identity card */}
          <Animated.View entering={FadeInDown.delay(60).springify().damping(18).stiffness(140)}>
            <GlassCard variant="dark" padding={20}>
              <View style={styles.identityCard}>
                <View style={[styles.avatar, { backgroundColor: colors.onDarkHairline }]}>
                  <Text style={[styles.avatarText, { color: colors.onDarkPrimary }]}>{initials(user.name)}</Text>
                </View>
                <View>
                  <Text style={[styles.identityName, { color: colors.onDarkPrimary }]}>{user.name}</Text>
                  <Text style={[styles.identitySub, { color: colors.onDarkTertiary }]}>Joueur pro · Paris</Text>
                </View>
              </View>
            </GlassCard>
          </Animated.View>

          {/* Profit hero */}
          <Animated.View entering={FadeInDown.delay(120).springify().damping(18).stiffness(140)}>
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
                <Text style={[styles.heroFooterText, { color: colors.onDarkTertiary }]}>ce mois-ci</Text>
              </View>
              {bankrollHistory.length > 1 && (
                <View style={styles.heroSparkline}>
                  <AreaChart data={bankrollHistory.slice(-14)} height={56} tone="dark" color={isProfitPositive ? undefined : colors.loss} />
                </View>
              )}
            </GlassCard>
          </Animated.View>

          {/* Gauges row */}
          <Animated.View entering={FadeInDown.delay(180).springify().damping(18).stiffness(140)} style={styles.gaugesRow}>
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
          <Animated.View entering={FadeInDown.delay(240).springify().damping(18).stiffness(140)}>
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
          <Animated.View entering={FadeInDown.delay(300).springify().damping(18).stiffness(140)}>
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

          {/* Réglages */}
          <Animated.View entering={FadeInDown.delay(360).springify().damping(18).stiffness(140)}>
            <GlassCard padding={4}>
              <View style={styles.settingsHeader}>
                <Text style={[styles.settingsTitle, { color: colors.textTertiary }]}>Réglages</Text>
              </View>
              <SettingRow label="Devise" value={`${user.settings.currency} €`} />
              <Divider />
              <SettingRow
                label="Langue"
                value={user.settings.language === 'fr' ? 'Français' : 'English'}
                onPress={toggleLanguage}
              />
              <Divider />
              <SettingRow
                label="Notifications"
                control={
                  <Switch
                    value={user.settings.notifications}
                    onValueChange={toggleNotifications}
                    trackColor={{ false: colors.hairline, true: colors.accentTint }}
                    thumbColor={user.settings.notifications ? colors.accent : '#FFFFFF'}
                  />
                }
              />
              <Divider />
              <SettingRow
                label="Thème"
                value={scheme === 'dark' ? 'Sombre' : 'Clair'}
                onPress={toggleScheme}
              />
              <Divider />
              <SettingRow label="Réinitialiser les données" onPress={handleReset} destructive />
            </GlassCard>
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

  identityCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.base,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: fontSize.md,
    fontFamily: fontFamily.bold,
  },
  identityName: {
    fontSize: fontSize.lg,
    fontFamily: fontFamily.bold,
  },
  identitySub: {
    fontSize: fontSize.sm,
    fontFamily: fontFamily.regular,
    marginTop: 2,
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

  gaugesRow: {
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

  settingsHeader: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  settingsTitle: {
    fontSize: fontSize.xs,
    fontFamily: fontFamily.semibold,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.base,
  },
  rowLabel: {
    fontSize: fontSize.base,
    fontFamily: fontFamily.medium,
  },
  rowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  rowValue: {
    fontSize: fontSize.base,
    fontFamily: fontFamily.regular,
  },
  divider: {
    height: 1,
    marginLeft: spacing.md,
  },
});
