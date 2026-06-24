import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react-native';
import { colors, fontSize, fontFamily, radius, spacing } from '../../design-system/theme';

type Trend = 'up' | 'down' | 'neutral';

interface StatBadgeProps {
  value: string;
  trend?: Trend;
  style?: ViewStyle;
}

export function StatBadge({ value, trend = 'neutral', style }: StatBadgeProps) {
  const isUp = trend === 'up';
  const isDown = trend === 'down';

  return (
    <View style={[styles.badge, isUp && styles.up, isDown && styles.down, style]}>
      {trend === 'up' && <TrendingUp size={10} color={colors.profit} strokeWidth={2} />}
      {trend === 'down' && <TrendingDown size={10} color={colors.loss} strokeWidth={2} />}
      {trend === 'neutral' && <Minus size={10} color={colors.neutral} strokeWidth={2} />}
      <Text style={[styles.text, isUp && styles.textUp, isDown && styles.textDown]}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.sm,
    backgroundColor: 'rgba(138, 138, 154, 0.12)',
  },
  up: { backgroundColor: colors.profitBg },
  down: { backgroundColor: colors.lossBg },
  text: {
    fontSize: fontSize.xs,
    fontFamily: fontFamily.semibold,
    color: colors.neutral,
  },
  textUp: { color: colors.profit },
  textDown: { color: colors.loss },
});
