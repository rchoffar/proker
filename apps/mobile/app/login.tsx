import { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import Animated, { FadeInDown } from 'react-native-reanimated';
import * as AppleAuthentication from 'expo-apple-authentication';
import { useAuthStore } from '../src/store/useAuthStore';
import { LogoMark } from '../src/components/brand/LogoMark';
import { GlowBlob } from '../src/components/ui/GlowBlob';
import { fontFamily, fontSize, radius, spacing } from '../src/design-system/theme';
import { useTheme } from '../src/design-system/ThemeProvider';

type PendingProvider = 'google' | 'apple' | null;

export default function LoginScreen() {
  const { t } = useTranslation('auth');
  const { colors, scheme } = useTheme();
  const signInWithGoogle = useAuthStore((s) => s.signInWithGoogle);
  const signInWithApple = useAuthStore((s) => s.signInWithApple);

  const [pending, setPending] = useState<PendingProvider>(null);
  const [error, setError] = useState(false);

  const handleSignIn = async (provider: 'google' | 'apple') => {
    if (pending) return;
    setPending(provider);
    setError(false);
    try {
      if (provider === 'google') await signInWithGoogle();
      else await signInWithApple();
    } catch (e) {
      console.error('[auth]', provider, e); // visible dans les logs device/TestFlight
      setError(true);
    } finally {
      setPending(null);
    }
  };

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <GlowBlob size={340} top={-100} right={-110} />
      <View style={styles.hero}>
        <Animated.View entering={FadeInDown.springify().damping(18).stiffness(140)}>
          <View style={styles.logo}>
            <LogoMark />
          </View>
          <Text style={[styles.wordmark, { color: colors.textPrimary }]}>
            Ultimate{'\n'}Poker Kit
          </Text>
          <Text style={[styles.tagline, { color: colors.textTertiary }]}>{t('tagline')}</Text>
        </Animated.View>
      </View>

      <Animated.View entering={FadeInDown.delay(80).springify().damping(18).stiffness(140)} style={styles.actions}>
        {/* pointerEvents coupe aussi le bouton Apple natif, qui n'a pas de prop disabled. */}
        <View pointerEvents={pending ? 'none' : 'auto'} style={[styles.buttons, pending != null && styles.buttonsPending]}>
          <AppleAuthentication.AppleAuthenticationButton
            buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
            buttonStyle={
              scheme === 'dark'
                ? AppleAuthentication.AppleAuthenticationButtonStyle.WHITE
                : AppleAuthentication.AppleAuthenticationButtonStyle.BLACK
            }
            cornerRadius={radius.md}
            style={styles.appleButton}
            onPress={() => handleSignIn('apple')}
          />

          <TouchableOpacity
            style={[styles.googleButton, { borderColor: colors.surface.fieldBorder, backgroundColor: colors.surface.fieldBg }]}
            onPress={() => handleSignIn('google')}
            disabled={pending !== null}
            activeOpacity={0.8}
          >
            <Text style={[styles.googleButtonText, { color: colors.textPrimary }]}>{t('googleButton')}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.statusZone}>
          {pending ? (
            <View style={styles.pendingRow}>
              <ActivityIndicator size="small" color={colors.textPrimary} />
              <Text style={[styles.pendingText, { color: colors.textSecondary }]}>{t('connecting')}</Text>
            </View>
          ) : error ? (
            <Text style={[styles.error, { color: colors.loss }]}>{t('signInError')}</Text>
          ) : null}
        </View>

        <Text style={[styles.legal, { color: colors.textTertiary }]}>{t('legal')}</Text>
      </Animated.View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    paddingHorizontal: spacing.lg,
  },
  hero: {
    flex: 1,
    justifyContent: 'center',
  },
  logo: {
    marginBottom: spacing.xl,
  },
  wordmark: {
    fontSize: 40,
    lineHeight: 44,
    fontFamily: fontFamily.extrabold,
    letterSpacing: -1,
  },
  tagline: {
    marginTop: spacing.sm,
    fontSize: fontSize.base,
    fontFamily: fontFamily.regular,
    lineHeight: 21,
  },
  actions: {
    gap: spacing.md,
    paddingBottom: spacing.xl,
  },
  buttons: {
    gap: spacing.md,
  },
  buttonsPending: {
    opacity: 0.5,
  },
  // Hauteur fixe : le spinner/l'erreur apparaissent sans faire sauter les boutons.
  statusZone: {
    minHeight: 22,
    justifyContent: 'center',
  },
  pendingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  pendingText: {
    fontSize: fontSize.sm,
    fontFamily: fontFamily.medium,
  },
  appleButton: {
    height: 50,
  },
  googleButton: {
    height: 50,
    borderWidth: 1,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  googleButtonText: {
    fontSize: fontSize.md,
    fontFamily: fontFamily.semibold,
  },
  error: {
    fontSize: fontSize.sm,
    fontFamily: fontFamily.medium,
    textAlign: 'center',
  },
  legal: {
    fontSize: fontSize.xs,
    fontFamily: fontFamily.regular,
    textAlign: 'center',
  },
});
