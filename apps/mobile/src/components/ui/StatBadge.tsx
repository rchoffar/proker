import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react-native';
import { fontSize, fontFamily, radius, spacing } from '../../design-system/theme';
import { useTheme } from '../../design-system/ThemeProvider';

type Trend = 'up' | 'down' | 'neutral';

interface StatBadgeProps {
  value: string;
  trend?: Trend;
  style?: ViewStyle;
  tone?: 'light' | 'dark';
}

export function StatBadge({ value, trend = 'neutral', style, tone = 'light' }: StatBadgeProps) {
  const { colors } = useTheme();
  const isUp = trend === 'up';
  const isDown = trend === 'down';
  const upColor = tone === 'dark' ? colors.accentBright : colors.accent;

  return (
    <View style={[styles.badge, isUp && { backgroundColor: colors.accentTint }, isDown && styles.down, style]}>
      {trend === 'up' && <TrendingUp size={10} color={upColor} strokeWidth={2} />}
      {trend === 'down' && <TrendingDown size={10} color={colors.loss} strokeWidth={2} />}
      {trend === 'neutral' && <Minus size={10} color={colors.textTertiary} strokeWidth={2} />}
      <Text style={[styles.text, { color: colors.textTertiary }, isUp && { color: upColor }, isDown && { color: colors.loss }]}>
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
    backgroundColor: 'rgba(138, 143, 153, 0.12)',
  },
  down: { backgroundColor: 'rgba(229, 72, 77, 0.14)' },
  text: {
    fontSize: fontSize.xs,
    fontFamily: fontFamily.semibold,
  },
});
