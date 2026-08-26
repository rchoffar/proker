import { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { X, RotateCw } from 'lucide-react-native';
import { RouletteWheel } from '../../../src/components/degen/RouletteWheel';
import { WinCelebration } from '../../../src/components/hand/WinCelebration';
import { useRouletteDraft } from '../../../src/store/useRouletteDraft';
import { useConfirmQuitGame } from '../../../src/hooks/useConfirmQuitGame';
import { useAppStore } from '../../../src/store/useAppStore';
import { recordRouletteSpin } from '../../../src/lib/gameStats';
import { fontFamily, fontSize, radius, shadow, spacing } from '../../../src/design-system/theme';
import { useTheme } from '../../../src/design-system/ThemeProvider';
import type { Player } from '../../../src/types';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function RoulettePlayScreen() {
  const { t } = useTranslation('games');
  const { colors } = useTheme();
  const router = useRouter();
  const players = useRouletteDraft((s) => s.players);
  const updateGameStats = useAppStore((s) => s.updateGameStats);

  const [spinToken, setSpinToken] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [winner, setWinner] = useState<Player | null>(null);
  const [celebrating, setCelebrating] = useState(false);

  // Only a spin in flight is worth guarding — a shown winner or an idle wheel loses nothing.
  useConfirmQuitGame(spinning);

  const spin = () => {
    setWinner(null);
    setCelebrating(false);
    setSpinning(true);
    setSpinToken((t) => t + 1);
  };

  const handleResult = (result: Player) => {
    setWinner(result);
    setSpinning(false);
    setCelebrating(true);
    updateGameStats((s) =>
      recordRouletteSpin(s, {
        picked: result.name,
        survivors: players.filter((p) => p.id !== result.id).map((p) => p.name),
      })
    );
  };

  const finish = () => router.dismissTo('/(tabs)/degen');

  if (players.length < 2) {
    return (
      <SafeAreaView style={[styles.screen, styles.centered]}>
        <Text style={{ color: colors.textPrimary }}>{t('play.noPlayers')}</Text>
        <TouchableOpacity onPress={() => router.back()} style={[styles.primaryBtn, { backgroundColor: colors.accentBright, marginTop: spacing.base }]}>
          <Text style={styles.primaryBtnText}>{t('common:back')}</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity style={[styles.iconBtn, { backgroundColor: colors.neutralTileBg }]} onPress={finish} activeOpacity={0.7}>
          <X size={18} color={colors.textSecondary} strokeWidth={2} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Roulette</Text>
        <View style={styles.iconBtn} />
      </View>

      <View style={styles.body}>
        <RouletteWheel players={players} spinToken={spinToken} onResult={handleResult} />

        {winner ? (
          <>
            <Animated.View entering={FadeInDown.delay(80).springify().damping(18).stiffness(140)}>
              <TouchableOpacity style={[styles.primaryBtn, { backgroundColor: colors.accentBright }]} onPress={spin} activeOpacity={0.85}>
                <View style={styles.relancerContent}>
                  <RotateCw size={16} color="#0A0A0F" strokeWidth={2} />
                  <Text style={styles.primaryBtnText}>{t('roulette.spinAgain')}</Text>
                </View>
              </TouchableOpacity>
            </Animated.View>

            <Animated.View entering={FadeIn.duration(300)} style={styles.resultWrap}>
              <LinearGradient
                colors={['#20222A', '#101116']}
                start={{ x: 0.15, y: 0 }}
                end={{ x: 0.85, y: 1 }}
                style={[styles.resultCard, { borderColor: colors.surface.darkGlassBorder }]}
              >
                <Text style={[styles.resultLabel, { color: colors.onDarkTertiary }]}>{t('roulette.payUp')}</Text>
                <Text style={[styles.resultName, { color: colors.onDarkPrimary }]} numberOfLines={1}>{winner.name}</Text>
                <Text style={[styles.resultSub, { color: colors.onDarkSecondary }]}>{t('roulette.paysTheBill')}</Text>
              </LinearGradient>
            </Animated.View>
          </>
        ) : (
          <Animated.View entering={FadeInDown.delay(80).springify().damping(18).stiffness(140)}>
            <TouchableOpacity
              style={[styles.primaryBtn, spinning && styles.disabledBtn, { backgroundColor: colors.accentBright }]}
              onPress={spin}
              disabled={spinning}
              activeOpacity={0.85}
            >
              <Text style={styles.primaryBtnText}>{spinning ? t('roulette.spinning') : t('roulette.spinWheel')}</Text>
            </TouchableOpacity>
          </Animated.View>
        )}

      </View>

      {celebrating && winner && (
        <WinCelebration
          width={SCREEN_WIDTH}
          height={SCREEN_HEIGHT}
          borderRadius={0}
          title={t('roulette.payUp').toUpperCase()}
          subtitle={winner.name}
          detail={t('roulette.paysTheBill')}
          onDone={() => setCelebrating(false)}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  centered: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.sm,
  },
  iconBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: fontSize.lg,
    fontFamily: fontFamily.bold,
  },
  body: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xl,
    paddingHorizontal: spacing.xl,
  },
  resultWrap: {
    width: '100%',
    gap: spacing.md,
  },
  resultCard: {
    borderRadius: radius['2xl'],
    borderWidth: 1,
    padding: 20,
    gap: 4,
    ...shadow.dark,
  },
  resultLabel: {
    fontSize: fontSize.xs,
    fontFamily: fontFamily.semibold,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    textAlign: 'center',
  },
  resultName: {
    fontSize: fontSize['2xl'],
    fontFamily: fontFamily.extrabold,
    textAlign: 'center',
  },
  resultSub: {
    fontSize: fontSize.sm,
    fontFamily: fontFamily.medium,
    textAlign: 'center',
  },
  relancerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  primaryBtn: {
    borderRadius: radius.md,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  disabledBtn: {
    opacity: 0.4,
  },
  primaryBtnText: {
    color: '#0A0A0F',
    fontSize: fontSize.md,
    fontFamily: fontFamily.bold,
  },
});
