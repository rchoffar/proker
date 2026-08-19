import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Switch, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
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
import { useAuthStore } from '../../src/store/useAuthStore';
import { useIsActiveTab } from '../../src/hooks/useIsActiveTab';
import { computeWindowedStats, computeWeeklyVolume } from '../../src/lib/stats';
import { formatAmount, initials } from '../../src/lib/format';
import { useTheme } from '../../src/design-system/ThemeProvider';
import i18n from '../../src/i18n';
import { fontFamily, fontSize, spacing } from '../../src/design-system/theme';

// Native language names — deliberately NOT translated (a language is always named in itself).
const LANGUAGE_NAMES: Record<'fr' | 'en', string> = { fr: 'Français', en: 'English' };

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
  const { t } = useTranslation('profile');
  const { colors, scheme, toggleScheme } = useTheme();
  const { user, stats, bankrollHistory, sessions, stakes, updateUser, resetStore } = useAppStore();
  const authUser = useAuthStore((s) => s.user);
  const signOut = useAuthStore((s) => s.signOut);
  const deleteAccount = useAuthStore((s) => s.deleteAccount);
  const displayName = authUser?.pseudo ?? user.name;
  const isActive = useIsActiveTab();

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

  const handleSignOut = useCallback(() => {
    Alert.alert(
      t('signOutAlert.title'),
      t('signOutAlert.body'),
      [
        { text: t('common:cancel'), style: 'cancel' },
        { text: t('signOutAlert.confirm'), style: 'destructive', onPress: () => signOut() },
      ]
    );
  }, [signOut, t]);

  const handleDeleteAccount = useCallback(() => {
    Alert.alert(
      t('deleteAccountAlert.title'),
      t('deleteAccountAlert.body'),
      [
        { text: t('common:cancel'), style: 'cancel' },
        {
          text: t('deleteAccountAlert.confirm'),
          style: 'destructive',
          onPress: () => {
            deleteAccount().catch(() => {
              Alert.alert(t('deleteAccountAlert.title'), t('deleteAccountAlert.error'));
            });
          },
        },
      ]
    );
  }, [deleteAccount, t]);

  const handleReset = useCallback(() => {
    Alert.alert(
      t('resetAlert.title'),
      t('resetAlert.body'),
      [
        { text: t('common:cancel'), style: 'cancel' },
        { text: t('resetAlert.confirm'), style: 'destructive', onPress: resetStore },
      ]
    );
  }, [resetStore, t]);

  if (!isActive) return <View style={styles.screen} />;

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.stack}>

          <Animated.View entering={FadeInDown.delay(0).springify().damping(18).stiffness(140)} style={styles.header}>
            <Text style={[styles.title, { color: colors.textPrimary }]}>{t('title')}</Text>
          </Animated.View>

          {/* Identity card */}
          <Animated.View entering={FadeInDown.delay(60).springify().damping(18).stiffness(140)}>
            <GlassCard variant="dark" padding={20}>
              <View style={styles.identityCard}>
                <View style={[styles.avatar, { backgroundColor: colors.onDarkHairline }]}>
                  <Text style={[styles.avatarText, { color: colors.onDarkPrimary }]}>{initials(displayName)}</Text>
                </View>
                <View>
                  <Text style={[styles.identityName, { color: colors.onDarkPrimary }]}>{displayName}</Text>
                  <Text style={[styles.identitySub, { color: colors.onDarkTertiary }]}>
                    {authUser?.email ?? t('identityFallback')}
                  </Text>
                </View>
              </View>
            </GlassCard>
          </Animated.View>

          {/* Profit hero */}
          <Animated.View entering={FadeInDown.delay(120).springify().damping(18).stiffness(140)}>
            <GlassCard variant="dark" style={styles.heroCard} padding={24}>
              <GlowBlob />
              <View style={styles.heroHeader}>
                <SectionLabel tone="dark">{t('totalProfit')}</SectionLabel>
                <Text style={[styles.heroCurrency, { color: colors.onDarkTertiary }]}>EUR</Text>
              </View>
              <AnimatedNumber
                value={stats.totalProfit}
                formatFn={(v) => `${v >= 0 ? '+' : '-'}${formatAmount(v)}`}
                style={[styles.heroValue, { color: isProfitPositive ? colors.accentBright : colors.loss }]}
              />
              <View style={styles.heroFooter}>
                <StatBadge
                  tone="dark"
                  value={`${isMonthPositive ? '↗ +' : '↘ '}${formatAmount(stats.thisMonthProfit)}`}
                  trend={isMonthPositive ? 'up' : 'down'}
                />
                <Text style={[styles.heroFooterText, { color: colors.onDarkTertiary }]}>{t('thisMonth')}</Text>
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
                <SectionLabel>{t('roiDays', { days: 90 })}</SectionLabel>
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
                <SectionLabel>{t('itmDays', { days: 90 })}</SectionLabel>
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
                  <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>
                    {t('volumeTitle', {
                      month: new Intl.DateTimeFormat(i18n.language === 'fr' ? 'fr-FR' : 'en-US', { month: 'long' }).format(now),
                    })}
                  </Text>
                  <SectionLabel style={styles.cardCaption}>{t('byWeek')}</SectionLabel>
                </View>
                <Text style={[styles.volumeValue, { color: colors.textPrimary }]}>{t('hoursShort', { hours: monthHours.toFixed(0) })}</Text>
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
                  <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>{t('evolution')}</Text>
                  <SectionLabel style={styles.cardCaption}>{t('lastDays', { days: 30 })}</SectionLabel>
                </View>
                <Text style={[styles.evolutionDelta, { color: evolutionDelta >= 0 ? colors.accent : colors.loss }]}>
                  {evolutionDelta >= 0 ? '+' : '-'}{formatAmount(evolutionDelta)}
                </Text>
              </View>
              {last30d.length > 1 ? (
                <AreaChart data={last30d} height={110} tone="light" color={evolutionDelta >= 0 ? undefined : colors.loss} />
              ) : (
                <Text style={[styles.emptyChartText, { color: colors.textTertiary }]}>{t('notEnoughData')}</Text>
              )}
            </GlassCard>
          </Animated.View>

          {/* Réglages */}
          <Animated.View entering={FadeInDown.delay(360).springify().damping(18).stiffness(140)}>
            <GlassCard padding={4}>
              <View style={styles.settingsHeader}>
                <Text style={[styles.settingsTitle, { color: colors.textTertiary }]}>{t('settings.title')}</Text>
              </View>
              <SettingRow label={t('settings.currency')} value={`${user.settings.currency} €`} />
              <Divider />
              <SettingRow
                label={t('settings.language')}
                value={LANGUAGE_NAMES[user.settings.language === 'fr' ? 'fr' : 'en']}
                onPress={toggleLanguage}
              />
              <Divider />
              <SettingRow
                label={t('settings.notifications')}
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
                label={t('settings.theme')}
                value={scheme === 'dark' ? t('settings.themeDark') : t('settings.themeLight')}
                onPress={toggleScheme}
              />
              <Divider />
              <SettingRow label={t('settings.resetData')} onPress={handleReset} destructive />
              <Divider />
              <SettingRow label={t('settings.signOut')} onPress={handleSignOut} destructive />
              <Divider />
              <SettingRow label={t('settings.deleteAccount')} onPress={handleDeleteAccount} destructive />
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
