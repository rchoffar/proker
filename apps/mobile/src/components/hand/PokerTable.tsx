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

// Seat placement lives in seatLayout.ts (pure geometry, so it can be tested); re-exported
// here because every table already imports it from PokerTable.
export { seatPoint } from '../table/seatLayout';

interface Props {
  width: number;
  height: number;
  /**
   * Corner radius of the rail. Defaults to a racetrack (half the width) — the shape every
   * card game wants. OFC passes a small one on purpose: its content is a GRID, and a
   * racetrack narrows exactly where a grid's top and bottom rows are, so rows that fit the
   * felt's width still spilled past its edge.
   */
  cornerRadius?: number;
  style?: ViewStyle | ViewStyle[];
  // Absolutely-positioned content: felt center, seat pods, hero cards…
  children?: ReactNode;
}

// The racetrack itself: walnut rail, gradient felt, inner betting line. Callers place their
// own content (board, pot, seats) absolutely inside.
export function PokerTable({ width, height, style, cornerRadius, children }: Props) {
  const rail = cornerRadius ?? width / 2;
  const inset = (px: number) => Math.max(0, rail - px);

  return (
    <View style={[{ width, height }, style]}>
      <View style={[styles.rail, { borderRadius: rail }]} />
      <LinearGradient
        colors={[TABLE.feltTop, TABLE.feltMid, TABLE.feltBottom]}
        style={[styles.felt, { borderRadius: cornerRadius ? inset(12) : (width - 24) / 2 }]}
      />
      {/* The betting line is a card-table convention: it marks where bets are pushed. A grid
          table has no betting line, and drawn as a rectangle it ran straight through the
          boards — so it comes with the racetrack only. */}
      {cornerRadius === undefined && (
        <View style={[styles.bettingLine, { borderRadius: (width - 76) / 2 }]} />
      )}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  // NO `elevation` here, deliberately. On Android elevation orders siblings regardless of
  // tree order, so the rail — the backmost child, and the only place a drop shadow could
  // live — drew on top of the felt, the betting line and everything the caller puts
  // inside: the whole table came out as a solid walnut blob, exported videos included
  // (Mathieu, 30/08). Moving the elevation to the outer view only moves the bug, because
  // SeatTableBoard renders its seats as siblings of PokerTable and they would go behind
  // it. So Android goes without the drop shadow — barely visible on the near-black
  // backgrounds these screens use — and the shadow* props keep it on iOS, which orders by
  // tree and ignores elevation. Anything added here that needs to sit above the felt must
  // rely on tree order or zIndex, never on elevation.
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
