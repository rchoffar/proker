import type { ReactNode } from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

// The table keeps one fixed look in both color schemes, exactly like the playing-card faces:
// walnut rail, top-lit green felt, brass for money. Theme tokens still drive everything
// outside the rail.
export const TABLE = {
  rail: '#221B15',
  railEdge: '#3A2E24',
  feltTop: '#2E7B55',
  feltMid: '#1A4C35',
  feltBottom: '#0E3122',
  line: 'rgba(255,255,255,0.12)',
  gold: '#E7C36F',
  goldDeep: 'rgba(156, 123, 60, 0.75)',
  plateBg: 'rgba(8, 12, 10, 0.82)',
  plateText: '#F2EFE8',
  neutralBorder: 'rgba(255,255,255,0.18)',
};

// Seats sit on the rail along an ellipse; seat k = 0 is pinned at the bottom center (90°)
// and the others follow clockwise in order.
export function seatPoint(k: number, n: number, width: number, height: number): { x: number; y: number } {
  const angle = Math.PI / 2 + (2 * Math.PI * k) / n;
  return {
    x: width / 2 + (width / 2) * Math.cos(angle),
    y: height / 2 + (height / 2) * Math.sin(angle),
  };
}

interface Props {
  width: number;
  height: number;
  style?: ViewStyle | ViewStyle[];
  // Absolutely-positioned content: felt center, seat pods, hero cards…
  children?: ReactNode;
}

// The racetrack itself: walnut rail, gradient felt, inner betting line. Callers place their
// own content (board, pot, seats) absolutely inside.
export function PokerTable({ width, height, style, children }: Props) {
  return (
    <View style={[{ width, height }, style]}>
      <View style={[styles.rail, { borderRadius: width / 2 }]} />
      <LinearGradient
        colors={[TABLE.feltTop, TABLE.feltMid, TABLE.feltBottom]}
        style={[styles.felt, { borderRadius: (width - 24) / 2 }]}
      />
      <View style={[styles.bettingLine, { borderRadius: (width - 76) / 2 }]} />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  rail: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: TABLE.rail,
    borderWidth: 1.5,
    borderColor: TABLE.railEdge,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.45,
    shadowRadius: 28,
    elevation: 12,
  },
  felt: {
    position: 'absolute',
    top: 12,
    left: 12,
    right: 12,
    bottom: 12,
    overflow: 'hidden',
  },
  bettingLine: {
    position: 'absolute',
    top: 38,
    left: 38,
    right: 38,
    bottom: 38,
    borderWidth: 1.25,
    borderColor: TABLE.line,
  },
});
