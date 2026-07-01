import { View, StyleSheet } from 'react-native';
import { CartesianChart, Area, Line } from 'victory-native';
import { LinearGradient, vec } from '@shopify/react-native-skia';
import type { BankrollSnapshot } from '../../types';
import { useTheme } from '../../design-system/ThemeProvider';

interface AreaChartProps {
  data: BankrollSnapshot[];
  height?: number;
  tone?: 'light' | 'dark';
  /** Override the line/fill color directly (e.g. loss color when the trend is negative). */
  color?: string;
}

export function AreaChart({ data, height = 120, tone = 'light', color }: AreaChartProps) {
  const { colors } = useTheme();
  const chartData = data.map((d, i) => ({ x: i, y: d.amount }));
  const lineColor = color ?? (tone === 'dark' ? colors.accentBright : colors.accent);

  return (
    <View style={[styles.container, { height }]}>
      <CartesianChart
        data={chartData}
        xKey="x"
        yKeys={['y']}
        axisOptions={{
          tickCount: { x: 0, y: 3 },
          labelColor: 'transparent',
          lineColor: tone === 'dark' ? colors.onDarkHairline : colors.hairline,
        }}
        domainPadding={{ top: 16, bottom: 4 }}
      >
        {({ points, chartBounds }) => (
          <>
            <Area points={points.y} y0={chartBounds.bottom} animate={{ type: 'timing', duration: 800 }}>
              <LinearGradient
                start={vec(0, chartBounds.top)}
                end={vec(0, chartBounds.bottom)}
                colors={[`${lineColor}33`, `${lineColor}00`]}
              />
            </Area>
            <Line
              points={points.y}
              color={lineColor}
              strokeWidth={2}
              animate={{ type: 'timing', duration: 800 }}
            />
          </>
        )}
      </CartesianChart>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
});
