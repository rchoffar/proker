import { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, Easing, useReducedMotion } from 'react-native-reanimated';
import { fontFamily, fontSize } from '../../design-system/theme';
import { useTheme } from '../../design-system/ThemeProvider';

export interface BarChartDatum {
  label: string;
  hours: number;
  isCurrent: boolean;
}

interface BarChartProps {
  data: BarChartDatum[];
  height?: number;
}

function Bar({ heightFraction, color }: { heightFraction: number; color: string }) {
  const reducedMotion = useReducedMotion();
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = reducedMotion
      ? heightFraction
      : withTiming(heightFraction, { duration: 800, easing: Easing.out(Easing.cubic) });
  }, [heightFraction, reducedMotion, progress]);

  const style = useAnimatedStyle(() => ({
    height: `${Math.max(4, progress.value * 100)}%`,
    backgroundColor: color,
  }));

  return (
    <View style={styles.barTrack}>
      <Animated.View style={[styles.bar, style]} />
    </View>
  );
}

export function BarChart({ data, height = 110 }: BarChartProps) {
  const { colors } = useTheme();
  const max = Math.max(1, ...data.map((d) => d.hours));

  return (
    <View style={[styles.container, { height }]}>
      <View style={styles.barsRow}>
        {data.map((d, i) => (
          <Bar key={i} heightFraction={d.hours / max} color={d.isCurrent ? colors.accent : colors.neutralChart} />
        ))}
      </View>
      <View style={styles.labelsRow}>
        {data.map((d, i) => (
          <Text key={i} style={[styles.label, { color: colors.textTertiary }]}>{d.label}</Text>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  barsRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
  },
  barTrack: {
    flex: 1,
    height: '100%',
    justifyContent: 'flex-end',
  },
  bar: {
    width: '100%',
    borderTopLeftRadius: 6,
    borderTopRightRadius: 6,
  },
  labelsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 6,
  },
  label: {
    flex: 1,
    textAlign: 'center',
    fontSize: fontSize.xs,
    fontFamily: fontFamily.medium,
  },
});
