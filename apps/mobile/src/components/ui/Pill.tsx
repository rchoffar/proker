import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { fontFamily, fontSize, radius } from '../../design-system/theme';
import { useTheme } from '../../design-system/ThemeProvider';

interface PillProps {
  label: string;
  tone?: 'neutral' | 'accent';
  /**
   * Sitting on a dark surface. `accent` is a deep emerald meant for light backgrounds — on a
   * dark card it goes muddy, so the vivid one takes over, the way SectionLabel's dark tone
   * does.
   */
  onDark?: boolean;
  style?: ViewStyle;
}

export function Pill({ label, tone = 'neutral', onDark = false, style }: PillProps) {
  const { colors } = useTheme();
  const isAccent = tone === 'accent';

  const background = isAccent
    ? onDark
      ? colors.accentGlow
      : colors.accentTint
    : onDark
      ? colors.onDarkHairline
      : colors.neutralTileBg;
  const text = isAccent
    ? onDark
      ? colors.accentBright
      : colors.accent
    : onDark
      ? colors.onDarkSecondary
      : colors.textTertiary;

  return (
    <View style={[styles.pill, { backgroundColor: background }, style]}>
      <Text style={[styles.text, { color: text }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.full,
  },
  text: {
    fontSize: fontSize.xs,
    fontFamily: fontFamily.semibold,
  },
});
