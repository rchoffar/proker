import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Switch, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { ChevronRight } from 'lucide-react-native';
import { GlassCard } from '../../src/components/ui/GlassCard';
import { useAppStore } from '../../src/store/useAppStore';
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
  const { user, stats, updateUser, resetStore } = useAppStore();
  const [animKey, setAnimKey] = useState(0);

  useFocusEffect(
    useCallback(() => {
      setAnimKey((k) => k + 1);
    }, [])
  );

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

          {/* Stats strip */}
          <Animated.View entering={FadeInDown.delay(120).springify().damping(18).stiffness(140)}>
            <GlassCard padding={20}>
              <View style={styles.statsRow}>
                <View style={styles.statItem}>
                  <Text style={[styles.statValue, { color: stats.roi >= 0 ? colors.accent : colors.loss }]}>
                    {stats.roi >= 0 ? '+' : ''}{stats.roi.toFixed(0)}%
                  </Text>
                  <Text style={[styles.statLabel, { color: colors.textTertiary }]}>ROI</Text>
                </View>
                <View style={[styles.statDivider, { backgroundColor: colors.hairline }]} />
                <View style={styles.statItem}>
                  <Text style={[styles.statValue, { color: colors.textPrimary }]}>{stats.totalSessions}</Text>
                  <Text style={[styles.statLabel, { color: colors.textTertiary }]}>Sessions</Text>
                </View>
                <View style={[styles.statDivider, { backgroundColor: colors.hairline }]} />
                <View style={styles.statItem}>
                  <Text style={[styles.statValue, { color: colors.textPrimary }]}>{stats.totalHours.toFixed(0)}h</Text>
                  <Text style={[styles.statLabel, { color: colors.textTertiary }]}>Volume</Text>
                </View>
              </View>
            </GlassCard>
          </Animated.View>

          {/* Réglages */}
          <Animated.View entering={FadeInDown.delay(180).springify().damping(18).stiffness(140)}>
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

  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
    gap: 5,
  },
  statDivider: {
    width: 1,
    height: 32,
  },
  statValue: {
    fontSize: fontSize.lg,
    fontFamily: fontFamily.bold,
  },
  statLabel: {
    fontSize: fontSize.xs,
    fontFamily: fontFamily.medium,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
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
