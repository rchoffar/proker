import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Switch, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { ChevronRight } from 'lucide-react-native';
import { GlassCard } from '../../src/components/ui/GlassCard';
import { useAppStore } from '../../src/store/useAppStore';
import { useAuthStore } from '../../src/store/useAuthStore';
import { useIsActiveTab } from '../../src/hooks/useIsActiveTab';
import { initials } from '../../src/lib/format';
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
  const { user, updateUser, resetStore } = useAppStore();
  const authUser = useAuthStore((s) => s.user);
  const signOut = useAuthStore((s) => s.signOut);
  const deleteAccount = useAuthStore((s) => s.deleteAccount);
  const displayName = authUser?.pseudo ?? user.name;
  const isActive = useIsActiveTab();

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

          {/* Réglages */}
          <Animated.View entering={FadeInDown.delay(120).springify().damping(18).stiffness(140)}>
            <GlassCard padding={4}>
              <View style={styles.settingsHeader}>
                <Text style={[styles.settingsTitle, { color: colors.textTertiary }]}>{t('settings.title')}</Text>
              </View>
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
