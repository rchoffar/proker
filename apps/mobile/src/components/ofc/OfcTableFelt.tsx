import { useState, type ReactNode } from 'react';
import { View, StyleSheet, type LayoutChangeEvent } from 'react-native';
import { PokerTable } from '../hand/PokerTable';
import { TableWordmark } from '../table/TableWordmark';
import { PLAY_TABLE } from '../table/tableSize';
import { radius, spacing } from '../../design-system/theme';

// OFC had no table at all: both play screens were a caption, a row of seat cards and — only
// while it was your turn — the action panel. Out of turn that left two small grids at the top
// of a black screen and nothing else, which is the "écran noir" Mathieu sent three shots of.
//
// The felt takes the height that is LEFT OVER, and all of it. The page does not scroll and the
// placement board is protected by `flexShrink: 0`, so "leftover" means height nothing else
// wants — hugging the boards instead only left a band of black under the table. It hands that
// height down so the boards can be sized to fill it rather than guessed at.
//
// The measurement runs one way on purpose: the slot's height comes from the PARENT, never from
// the children. Sizing the boards from a height the boards themselves determined would feed
// back into itself and oscillate.

/** Breathing room around the seats, inside the felt. */
const FELT_PAD = spacing.md;
/**
 * A rounded rectangle, not the racetrack every other game uses. OFC's content is a grid, and
 * a racetrack pinches in exactly where a grid's top and bottom rows sit: rows that fitted the
 * felt's width still ran out past its edge. A rectangle gives every row the same width, which
 * is also what lets the cards be bigger.
 */
const FELT_RADIUS = radius.xl;
/** Total width PokerTable's rail takes off the felt (12 each side). */
const RAIL = 24;

interface Props {
  /** Given the room inside the felt, so boards can be sized to fill it exactly. */
  children: (inner: { width: number; height: number }) => ReactNode;
}

export function OfcTableFelt({ children }: Props) {
  const [slotH, setSlotH] = useState<number | null>(null);
  const width = PLAY_TABLE.width;

  const onLayout = (e: LayoutChangeEvent) => {
    const next = Math.round(e.nativeEvent.layout.height);
    if (next > 0 && next !== slotH) setSlotH(next);
  };

  // Capped at the size every other game's felt uses, so it stays recognisably the same table.
  const height = Math.min(PLAY_TABLE.height, slotH ?? PLAY_TABLE.height);
  // The rail is 12 a side and already frames the boards, so the centre spends nothing more on
  // horizontal padding: at two boards abreast every point of width is a point of card.
  const inner = { width: width - RAIL, height: Math.max(0, height - FELT_PAD * 2) };

  return (
    <View style={styles.slot} onLayout={onLayout}>
      <PokerTable width={width} height={height} cornerRadius={FELT_RADIUS} style={styles.table}>
        {/* Behind the cards, and out of the layout: in flow it cost the boards a line of
            height they had better use for, and the felt is the one place a watermark belongs
            anyway. */}
        <View style={styles.brand} pointerEvents="none">
          <TableWordmark />
        </View>
        <View style={styles.center} pointerEvents="box-none">
          {children(inner)}
        </View>
      </PokerTable>
    </View>
  );
}

const styles = StyleSheet.create({
  // Claims the leftover height, and gives it back when the placement board needs it.
  slot: {
    flex: 1,
    justifyContent: 'center',
  },
  table: {
    alignSelf: 'center',
  },
  brand: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: spacing.lg,
    alignItems: 'center',
  },
  // Normal flow rather than an absolute inset: PokerTable's own layers are the absolute ones,
  // so a flex child fills the box.
  center: {
    flex: 1,
    paddingVertical: FELT_PAD,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
