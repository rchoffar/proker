import { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { X, RotateCw } from 'lucide-react-native';
import { RouletteCardTable } from '../../../src/components/degen/RouletteCardTable';
import { useRouletteDraft } from '../../../src/store/useRouletteDraft';
import { useConfirmQuitGame } from '../../../src/hooks/useConfirmQuitGame';
import { useAppStore } from '../../../src/store/useAppStore';
import { recordRouletteSpin } from '../../../src/lib/gameStats';
import { fontFamily, fontSize, radius, spacing } from '../../../src/design-system/theme';
import { useTheme } from '../../../src/design-system/ThemeProvider';
import type { Player } from '../../../src/types';

export default function RoulettePlayScreen() {
  const { t } = useTranslation('games');
  const { colors } = useTheme();
  const router = useRouter();
  const players = useRouletteDraft((s) => s.players);
  const updateGameStats = useAppStore((s) => s.updateGameStats);

  const [spinToken, setSpinToken] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [winner, setWinner] = useState<Player | null>(null);

  // Only a draw in flight is worth guarding — a shown verdict or an idle table loses nothing.
  useConfirmQuitGame(spinning);

  const spin = () => {
    setWinner(null);
    setSpinning(true);
    setSpinToken((t) => t + 1);
  };

  // Fired by the table once the loser's card has grown to the center — the verdict moment.
  const handleResult = (result: Player) => {
    setWinner(result);
    setSpinning(false);
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
        <RouletteCardTable players={players} spinToken={spinToken} onResult={handleResult} />

        {winner ? (
          // The verdict, per the mockup: the loser's cream card is already big at the table
          // center (drawn by RouletteCardTable) — the text lands under it.
          <Animated.View entering={FadeIn.duration(300)} style={styles.verdict}>
            <Text style={[styles.verdictTitle, { color: colors.textPrimary }]} numberOfLines={1}>
              {t('roulette.lost', { name: winner.name })}
            </Text>
            <Text style={[styles.verdictSub, { color: colors.textSecondary }]}>
              {t('roulette.paysTheBill')}
            </Text>
            <TouchableOpacity style={[styles.primaryBtn, { backgroundColor: colors.accentBright }]} onPress={spin} activeOpacity={0.85}>
              <View style={styles.relancerContent}>
                <RotateCw size={16} color="#0A0A0F" strokeWidth={2} />
                <Text style={styles.primaryBtnText}>{t('roulette.spinAgain')}</Text>
              </View>
            </TouchableOpacity>
          </Animated.View>
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
    gap: spacing.lg,
    paddingHorizontal: spacing.xl,
  },
  verdict: {
    alignItems: 'center',
    gap: spacing.sm,
  },
  verdictTitle: {
    fontSize: fontSize['2xl'],
    fontFamily: fontFamily.extrabold,
    textAlign: 'center',
  },
  verdictSub: {
    fontSize: fontSize.md,
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
    marginTop: spacing.sm,
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
