import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import { Lock } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { TABLE } from '../hand/PokerTable';
import { fontFamily, fontSize, radius, spacing } from '../../design-system/theme';
import { useTheme } from '../../design-system/ThemeProvider';

// Pass & Play's privacy screen: one phone, several players, so the table has to be blurred
// out until it has physically reached the person whose turn it is. Bluff and OFC had this
// blur-plus-name-plus-button block copied between them line for line, lock styles included.
//
// The caller decides WHEN to show it — bluff locks every turn, OFC only for a Fantasy Land
// arrangement (its initial five are set face-up in the same turn, so there is nothing to
// hide) — and passes its own copy, because the button says "show my turn" in one game and
// "show my cards" in the other.

interface Props {
  /** Whose turn it is; shown in gold under the prompt. */
  name: string;
  /** "Pass the phone to" — the caller's namespace owns the wording. */
  title: string;
  ctaLabel: string;
  onUnlock: () => void;
}

export function HandoffLock({ name, title, ctaLabel, onUnlock }: Props) {
  const { colors } = useTheme();
  return (
    <Animated.View entering={FadeIn.duration(200)} style={StyleSheet.absoluteFill}>
      <BlurView intensity={50} tint="dark" style={StyleSheet.absoluteFill} />
      <View style={styles.lockOverlay}>
        <Lock size={28} color={TABLE.gold} strokeWidth={1.5} />
        <Text style={styles.lockTitle}>{title}</Text>
        <Text style={[styles.lockName, { color: TABLE.gold }]}>{name}</Text>
        <TouchableOpacity
          style={[styles.lockBtn, { backgroundColor: colors.accentBright }]}
          onPress={() => {
            Haptics.selectionAsync();
            onUnlock();
          }}
          activeOpacity={0.85}
        >
          <Text style={styles.lockBtnText}>{ctaLabel}</Text>
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  lockOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(10, 12, 16, 0.72)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    padding: spacing.xl,
  },
  lockTitle: {
    fontSize: fontSize.base,
    fontFamily: fontFamily.medium,
    color: 'rgba(255,255,255,0.7)',
    marginTop: spacing.sm,
  },
  lockName: {
    fontSize: fontSize.display,
    fontFamily: fontFamily.display,
    textAlign: 'center',
  },
  lockBtn: {
    borderRadius: radius.md,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.lg,
  },
  lockBtnText: {
    color: '#0A0A0F',
    fontSize: fontSize.md,
    fontFamily: fontFamily.bold,
  },
});
