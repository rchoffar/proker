import { useState, type ReactNode } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { ChevronLeft, Info } from 'lucide-react-native';
import { BottomSheet } from '../ui/BottomSheet';
import { fontFamily, fontSize, radius, spacing } from '../../design-system/theme';
import { useTheme } from '../../design-system/ThemeProvider';

// Shared chrome of the four game setup screens (flip / bluff / ofc / roulette): header
// with back button, scrollable stack, sticky footer CTA. The per-game content (roster,
// mode switch, rule pickers, join code) comes in as children — wrap each block in
// <SetupBlock index={n}> to keep the staggered entrance.
//
// The rules blurb used to sit above the content as a three-line paragraph, which is the
// height the table needed. It lives behind the (!) in the header now: still one tap away for
// someone meeting the game, out of the way for everyone who has played it before.

interface Props {
  title: string;
  /** The game's rules, shown by the (!) beside the title. */
  subtitle: string;
  children: ReactNode;
  ctaLabel: string;
  ctaDisabled?: boolean;
  onCtaPress: () => void;
}

export function SetupBlock({ index, children }: { index: number; children: ReactNode }) {
  return (
    <Animated.View entering={FadeInDown.delay(index * 40).springify().damping(18).stiffness(140)}>
      {children}
    </Animated.View>
  );
}

export function GameSetupScreen({ title, subtitle, children, ctaLabel, ctaDisabled = false, onCtaPress }: Props) {
  const { colors } = useTheme();
  const router = useRouter();
  const { t } = useTranslation('games');
  const [rulesOpen, setRulesOpen] = useState(false);

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity
          style={[styles.backButton, { backgroundColor: colors.neutralTileBg }]}
          onPress={() => router.back()}
          activeOpacity={0.7}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <ChevronLeft size={18} color={colors.textSecondary} strokeWidth={2} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>{title}</Text>
        <TouchableOpacity
          style={[styles.backButton, { backgroundColor: colors.neutralTileBg }]}
          onPress={() => setRulesOpen(true)}
          activeOpacity={0.7}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Info size={17} color={colors.textSecondary} strokeWidth={2} />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
      >
        <View style={styles.stack}>
          {children}
          <View style={styles.footerSpacer} />
        </View>
      </ScrollView>

      <BottomSheet visible={rulesOpen} onClose={() => setRulesOpen(false)} title={t('setup.howToPlay')}>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>{subtitle}</Text>
      </BottomSheet>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.primaryBtn, ctaDisabled && styles.disabledBtn, { backgroundColor: colors.accentBright }]}
          onPress={onCtaPress}
          disabled={ctaDisabled}
          activeOpacity={0.85}
        >
          <Text style={styles.primaryBtnText}>{ctaLabel}</Text>
        </TouchableOpacity>
      </View>
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
    gap: spacing.md,
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.sm,
  },
  backButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    fontSize: fontSize.lg,
    fontFamily: fontFamily.bold,
  },
  content: {
    paddingHorizontal: spacing.base,
    paddingTop: spacing.sm,
  },
  stack: {
    gap: spacing.md,
  },
  subtitle: {
    fontSize: fontSize.base,
    fontFamily: fontFamily.regular,
    lineHeight: 22,
  },
  footerSpacer: {
    height: 100,
  },
  footer: {
    paddingHorizontal: spacing.base,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
  },
  primaryBtn: {
    borderRadius: radius.md,
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
