import { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { GlassCard } from '../src/components/ui/GlassCard';
import { useAuthStore } from '../src/store/useAuthStore';
import { useAppStore } from '../src/store/useAppStore';
import { fontFamily, fontSize, radius, spacing } from '../src/design-system/theme';
import { useTheme } from '../src/design-system/ThemeProvider';

const PSEUDO_MIN = 2;
const PSEUDO_MAX = 20;

export default function ChoosePseudoScreen() {
  const { t } = useTranslation('auth');
  const { colors } = useTheme();
  const setPseudo = useAuthStore((s) => s.setPseudo);

  const [value, setValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);

  const trimmed = value.trim();
  const valid = trimmed.length >= PSEUDO_MIN && trimmed.length <= PSEUDO_MAX;

  const handleSubmit = async () => {
    if (!valid || saving) return;
    setSaving(true);
    setError(false);
    try {
      await setPseudo(trimmed);
      // Réutilise le pseudo du compte comme pseudo Bluff par défaut.
      const { bluffPseudo, setBluffDefaults } = useAppStore.getState();
      if (!bluffPseudo) setBluffDefaults({ pseudo: trimmed });
      // La garde du layout racine bascule vers les onglets toute seule.
    } catch {
      setError(true);
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.content}>
          <Animated.View entering={FadeInDown.springify().damping(18).stiffness(140)}>
            <Text style={[styles.title, { color: colors.textPrimary }]}>{t('pseudo.title')}</Text>
            <Text style={[styles.subtitle, { color: colors.textTertiary }]}>{t('pseudo.subtitle')}</Text>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(60).springify().damping(18).stiffness(140)}>
            <GlassCard padding={16}>
              <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>{t('pseudo.fieldLabel')}</Text>
              <TextInput
                value={value}
                onChangeText={setValue}
                placeholder={t('pseudo.placeholder')}
                placeholderTextColor={colors.textTertiary}
                maxLength={PSEUDO_MAX}
                autoFocus
                autoCorrect={false}
                autoCapitalize="none"
                returnKeyType="done"
                onSubmitEditing={handleSubmit}
                style={[styles.input, { color: colors.textPrimary, borderColor: colors.surface.fieldBorder, backgroundColor: colors.surface.fieldBg }]}
              />
              {error ? <Text style={[styles.error, { color: colors.loss }]}>{t('pseudo.saveError')}</Text> : null}
            </GlassCard>
          </Animated.View>
        </View>

        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.primaryBtn, { backgroundColor: colors.accentBright }, (!valid || saving) && styles.disabledBtn]}
            onPress={handleSubmit}
            disabled={!valid || saving}
            activeOpacity={0.85}
          >
            {saving ? (
              <ActivityIndicator size="small" color="#0A0A0F" />
            ) : (
              <Text style={styles.primaryBtnText}>{t('pseudo.cta')}</Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    gap: spacing.lg,
  },
  title: {
    fontSize: fontSize['2xl'],
    fontFamily: fontFamily.extrabold,
  },
  subtitle: {
    marginTop: spacing.sm,
    fontSize: fontSize.base,
    fontFamily: fontFamily.regular,
    lineHeight: 20,
  },
  fieldLabel: {
    fontSize: fontSize.sm,
    fontFamily: fontFamily.medium,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.sm,
  },
  input: {
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.md,
    fontSize: fontSize.base,
    fontFamily: fontFamily.medium,
  },
  error: {
    marginTop: spacing.sm,
    fontSize: fontSize.sm,
    fontFamily: fontFamily.medium,
  },
  footer: {
    paddingHorizontal: spacing.lg,
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
