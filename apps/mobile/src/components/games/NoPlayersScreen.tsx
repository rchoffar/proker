import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useTranslation } from 'react-i18next';
import { fontFamily, fontSize, radius, spacing } from '../../design-system/theme';
import { useTheme } from '../../design-system/ThemeProvider';
import { SCREEN_BG } from './gameSurface';

// What a play route shows when it was reached without a roster — a deep link, or a draft
// store that was never filled. Four games and both replayer screens each carried their own
// copy of this, which is how the same sentence ended up written two different ways across
// three i18n namespaces.
//
// The message is a prop: each game says it in its own namespace, and the replayer says
// "no hand" rather than "no players".

interface Props {
  message: string;
  onBack: () => void;
  /** Game surfaces paint their own dark background; themed screens let the root show through. */
  onDark?: boolean;
}

export function NoPlayersScreen({ message, onBack, onDark = false }: Props) {
  const { colors } = useTheme();
  const { t } = useTranslation('common');
  return (
    <SafeAreaView style={[styles.screen, onDark && { backgroundColor: SCREEN_BG }]}>
      {onDark && <StatusBar style="light" />}
      <View style={styles.centered}>
        <Text style={{ color: onDark ? colors.onDarkPrimary : colors.textPrimary }}>{message}</Text>
        <TouchableOpacity
          onPress={onBack}
          style={[styles.primaryBtn, { backgroundColor: colors.accentBright }]}
          activeOpacity={0.85}
        >
          <Text style={styles.primaryBtnText}>{t('back')}</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  primaryBtn: {
    borderRadius: radius.md,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.base,
  },
  primaryBtnText: {
    color: '#0A0A0F',
    fontSize: fontSize.md,
    fontFamily: fontFamily.bold,
  },
});
