import { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { fontFamily, fontSize, radius, spacing } from '../../design-system/theme';
import { useTheme } from '../../design-system/ThemeProvider';

// Determinate progress bar: a hairline track with an accent fill that eases toward each
// new value, plus an optional label and percentage. `onDark` picks the on-dark text and
// track tokens for game surfaces (which stay dark in both themes).

interface Props {
  /** 0 to 1. Values outside the range are clamped. */
  value: number;
  label?: string;
  showPercent?: boolean;
  onDark?: boolean;
}

export function ProgressBar({ value, label, showPercent = true, onDark = false }: Props) {
  const { colors } = useTheme();
  const progress = useSharedValue(0);
  const clamped = Math.max(0, Math.min(1, value));

  useEffect(() => {
    progress.value = withTiming(clamped, { duration: 260, easing: Easing.out(Easing.quad) });
  }, [clamped, progress]);

  const fillStyle = useAnimatedStyle(() => ({ width: `${progress.value * 100}%` }));

  const labelColor = onDark ? colors.onDarkSecondary : colors.textSecondary;
  const valueColor = onDark ? colors.onDarkPrimary : colors.textPrimary;

  return (
    <View style={styles.wrap}>
      {label || showPercent ? (
        <View style={styles.header}>
          {label ? (
            <Text style={[styles.label, { color: labelColor }]} numberOfLines={1}>
              {label}
            </Text>
          ) : (
            <View style={styles.spacer} />
          )}
          {showPercent ? (
            <Text style={[styles.percent, { color: valueColor }]}>{Math.round(clamped * 100)}%</Text>
          ) : null}
        </View>
      ) : null}
      <View style={[styles.track, { backgroundColor: onDark ? colors.onDarkHairline : colors.hairline }]}>
        <Animated.View style={[styles.fill, { backgroundColor: colors.accentBright }, fillStyle]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignSelf: 'stretch',
    gap: 6,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  spacer: {
    flex: 1,
  },
  label: {
    flex: 1,
    fontSize: fontSize.xs,
    fontFamily: fontFamily.medium,
  },
  percent: {
    fontSize: fontSize.xs,
    fontFamily: fontFamily.bold,
    fontVariant: ['tabular-nums'],
  },
  track: {
    height: 6,
    borderRadius: radius.full,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: radius.full,
  },
});
