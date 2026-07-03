import { StyleSheet, ViewStyle } from 'react-native';
import { Canvas, Circle } from '@shopify/react-native-skia';

interface PokerChipProps {
  size?: number;
  color?: string;
  style?: ViewStyle;
}

const EDGE_DOTS = 12;

/** An abstract, code-drawn poker chip motif (concentric rings + edge dots) — matches GlowBlob's Skia decoration pattern. */
export function PokerChip({ size = 64, color = 'rgba(255, 255, 255, 0.08)', style }: PokerChipProps) {
  const cx = size / 2;
  const cy = size / 2;
  const outerR = size / 2 - 2;
  const innerR = outerR * 0.62;
  const dotR = size * 0.035;
  const dotOrbit = outerR * 0.84;

  const dots = Array.from({ length: EDGE_DOTS }, (_, i) => {
    const angle = (i / EDGE_DOTS) * Math.PI * 2;
    return {
      key: i,
      x: cx + dotOrbit * Math.cos(angle),
      y: cy + dotOrbit * Math.sin(angle),
    };
  });

  return (
    <Canvas style={[styles.canvas, { width: size, height: size }, style]} pointerEvents="none">
      <Circle cx={cx} cy={cy} r={outerR} color={color} style="stroke" strokeWidth={2} />
      <Circle cx={cx} cy={cy} r={innerR} color={color} style="stroke" strokeWidth={1.5} />
      {dots.map((d) => (
        <Circle key={d.key} cx={d.x} cy={d.y} r={dotR} color={color} />
      ))}
    </Canvas>
  );
}

const styles = StyleSheet.create({
  canvas: {},
});
