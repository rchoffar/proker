import { View, StyleSheet } from 'react-native';
import { CartesianChart, Area, Line } from 'victory-native';
import type { BankrollSnapshot } from '../../types';
import { colors } from '../../design-system/theme';

interface ProfitChartProps {
  data: BankrollSnapshot[];
  height?: number;
  positive?: boolean;
}

export function ProfitChart({ data, height = 120, positive = true }: ProfitChartProps) {
  const chartData = data.map((d, i) => ({ x: i, y: d.amount }));
  const lineColor = positive ? colors.profit : colors.loss;
  const areaColor = positive
    ? 'rgba(0, 200, 120, 0.15)'
    : 'rgba(255, 71, 87, 0.15)';

  return (
    <View style={[styles.container, { height }]}>
      <CartesianChart
        data={chartData}
        xKey="x"
        yKeys={['y']}
        axisOptions={{
          tickCount: { x: 0, y: 0 },
          labelColor: 'transparent',
          lineColor: 'transparent',
        }}
        domainPadding={{ top: 16, bottom: 4 }}
      >
        {({ points, chartBounds }) => (
          <>
            <Area
              points={points.y}
              y0={chartBounds.bottom}
              color={areaColor}
              animate={{ type: 'timing', duration: 800 }}
            />
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
