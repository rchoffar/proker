import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Coins, Drama, Disc3, Hourglass } from 'lucide-react-native';
import { GameTile } from '../../src/components/degen/GameTile';
import { useFocusAnimKey } from '../../src/hooks/useFocusAnimKey';
import { fontFamily, fontSize, spacing } from '../../src/design-system/theme';
import { useTheme } from '../../src/design-system/ThemeProvider';

const GAMES: { name: string; description: string; Icon: typeof Coins; route?: '/games/roulette' | '/games/flip' }[] = [
  { name: 'Flip', description: 'Flop, turn, river : chacun sa main, la meilleure combinaison rafle la mise', Icon: Coins, route: '/games/flip' },
  { name: 'Bluff', description: 'Qui bluffe, qui plie ?', Icon: Drama },
  { name: 'Roulette', description: 'Misez, tournez, tentez le sort', Icon: Disc3, route: '/games/roulette' },
  { name: 'The Last Longer', description: 'Le dernier en lice remporte tout', Icon: Hourglass },
];

export default function DegenHubScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const animKey = useFocusAnimKey();

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View key={animKey} style={styles.stack}>
          <Animated.View entering={FadeInDown.delay(0).springify().damping(18).stiffness(140)} style={styles.header}>
            <Text style={[styles.title, { color: colors.textPrimary }]}>Degen Hub</Text>
            <Text style={[styles.subtitle, { color: colors.textTertiary }]}>Mini-jeux entre joueurs, bientôt disponibles</Text>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(60).springify().damping(18).stiffness(140)} style={styles.grid}>
            {GAMES.map(({ name, description, Icon, route }) => (
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
