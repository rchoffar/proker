import { useMemo } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Coins, Drama, Disc3, Hourglass, Layers } from 'lucide-react-native';
import { GameTile } from '../../src/components/degen/GameTile';
import { useIsActiveTab } from '../../src/hooks/useIsActiveTab';
import { fontFamily, fontSize, spacing } from '../../src/design-system/theme';
import { useTheme } from '../../src/design-system/ThemeProvider';

export default function DegenHubScreen() {
  const { t } = useTranslation('degen');
  const { colors } = useTheme();
  const router = useRouter();
  const isActive = useIsActiveTab();

  // Game names are titles — identical in both languages; only descriptions are translated.
  const games = useMemo<{ name: string; description: string; Icon: typeof Coins; route?: '/games/roulette' | '/games/flip' | '/games/bluff' }[]>(
    () => [
      { name: 'Flip', description: t('games.flip'), Icon: Coins, route: '/games/flip' },
      { name: 'Bluff', description: t('games.bluff'), Icon: Drama, route: '/games/bluff' },
      { name: 'Roulette', description: t('games.roulette'), Icon: Disc3, route: '/games/roulette' },
      { name: 'The Last Longer', description: t('games.lastLonger'), Icon: Hourglass },
      { name: 'Open-Face Chinese Poker', description: t('games.ofc'), Icon: Layers },
    ],
    [t]
  );

  if (!isActive) return <View style={styles.screen} />;

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.stack}>
          <Animated.View entering={FadeInDown.delay(0).springify().damping(18).stiffness(140)} style={styles.header}>
            <Text style={[styles.title, { color: colors.textPrimary }]}>{t('hub.title')}</Text>
            <Text style={[styles.subtitle, { color: colors.textTertiary }]}>{t('hub.subtitle')}</Text>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(60).springify().damping(18).stiffness(140)} style={styles.grid}>
            {games.map(({ name, description, Icon, route }) => (
              <GameTile
                key={name}
                name={name}
                description={description}
                icon={<Icon size={20} color={colors.textSecondary} strokeWidth={1.5} />}
                comingSoon={!route}
                onPress={route ? () => router.push(route) : undefined}
              />
            ))}
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
    gap: spacing.lg,
  },
  header: {
    paddingVertical: spacing.sm,
    gap: 4,
  },
  title: {
    fontSize: fontSize.display,
    fontFamily: fontFamily.display,
    letterSpacing: -1,
  },
  subtitle: {
    fontSize: fontSize.sm,
    fontFamily: fontFamily.regular,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: spacing.md,
  },
});
