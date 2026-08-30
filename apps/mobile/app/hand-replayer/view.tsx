import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react-native';
import { HandRecapCard } from '../../src/components/hand/HandRecapCard';
import { GameIconButton } from '../../src/components/games/GamePlayHeader';
import { NoPlayersScreen } from '../../src/components/games/NoPlayersScreen';
import { useHandReplayerDraft } from '../../src/store/useHandReplayerDraft';
import { useTheme } from '../../src/design-system/ThemeProvider';
import { fontFamily, fontSize, radius, spacing } from '../../src/design-system/theme';

// Read-only detail for a saved hand: the recap preview with the same replay/export actions
// as the builder's final step, but no way to edit the hand. The saved-hands list sets the
// draft before pushing here.
export default function HandReplayerViewScreen() {
  const { t } = useTranslation('replayer');
  const { colors } = useTheme();
  const router = useRouter();
  const hand = useHandReplayerDraft((s) => s.hand);

  if (!hand) {
    return <NoPlayersScreen message={t('noHand')} onBack={() => router.back()} />;
  }

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <GameIconButton onPress={() => router.back()}>
          <X size={18} color={colors.textSecondary} strokeWidth={2} />
        </GameIconButton>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.previewWrap}>
          <HandRecapCard hand={hand} />
        </View>

        <TouchableOpacity
          style={[styles.primaryBtn, { backgroundColor: colors.accentBright }]}
          onPress={() => router.push('/hand-replayer/play')}
          activeOpacity={0.85}
        >
          <Text style={styles.primaryBtnText}>{t('replayHand')}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.secondaryBtn, { backgroundColor: colors.neutralTileBg }]}
          onPress={() => router.push({ pathname: '/hand-replayer/play', params: { export: '1' } })}
          activeOpacity={0.85}
        >
          <Text style={[styles.secondaryBtnText, { color: colors.textPrimary }]}>{t('exportReplay')}</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.sm,
  },
  content: {
    paddingHorizontal: spacing.base,
    paddingBottom: spacing.lg,
  },
  previewWrap: {
    marginTop: spacing.sm,
    marginBottom: spacing.md,
  },
  primaryBtn: {
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  primaryBtnText: {
    color: '#0A0A0F',
    fontSize: fontSize.md,
    fontFamily: fontFamily.bold,
  },
  secondaryBtn: {
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  secondaryBtnText: {
    fontSize: fontSize.md,
    fontFamily: fontFamily.semibold,
  },
});
