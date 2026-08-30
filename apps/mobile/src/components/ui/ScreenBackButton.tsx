import { TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ChevronLeft } from 'lucide-react-native';
import { spacing } from '../../design-system/theme';
import { useTheme } from '../../design-system/ThemeProvider';

// Replayer, Stats and Profile used to be tabs, which never need a way back. They are pushed
// from home now, so they carry one — matching the setup screens' chevron.
export function ScreenBackButton() {
  const { colors } = useTheme();
  const { t } = useTranslation('common');
  const router = useRouter();

  return (
    <TouchableOpacity
      style={[styles.button, { backgroundColor: colors.neutralTileBg }]}
      onPress={() => router.back()}
      activeOpacity={0.7}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      accessibilityRole="button"
      accessibilityLabel={t('back')}
    >
      <ChevronLeft size={18} color={colors.textSecondary} strokeWidth={2} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-start',
    marginBottom: spacing.sm,
  },
});
