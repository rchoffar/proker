import { useState, type ReactNode } from 'react';
import { View, StyleSheet, type LayoutChangeEvent } from 'react-native';
import { PokerTable } from '../hand/PokerTable';
import { TableWordmark } from '../table/TableWordmark';
import { PLAY_TABLE } from '../table/tableSize';
import { spacing } from '../../design-system/theme';

// OFC had no table at all: both play screens were a caption, a row of seat cards and — only
// while it was your turn — the action panel. Out of turn that left two small grids at the top
// of a black screen and nothing else, which is the "écran noir" Mathieu sent three shots of.
//
// The first version had a floor of 0.85 × width so an oval would always "read as a table".
// That optimised for the wrong thing: at two players the content is one small grid (~130pt)
// and the floor forced ~300, so the felt ate 40% of the screen and pushed the placement board
// out of frame.
//
// It is elastic instead. The screens are one page and NOTHING scrolls — not the page, not
// the felt — so height is a fixed budget with an order of priority: the placement board is
// what you are using, so it keeps its size, and the felt takes what is left. It never takes
// more than the seats need, which is what stops it from becoming a green border around a
// board again. Keeping everything on one screen is the seat strip's job: it goes compact
// when it has more than one board to show (see OfcSeatsStrip).

/** Breathing room around the seats, inside the felt. */
const FELT_PAD = spacing.base;

interface Props {
  /** The seat strip. Anything laid out here is centred on the felt. */
  children: ReactNode;
}

export function OfcTableFelt({ children }: Props) {
  const [contentH, setContentH] = useState<number | null>(null);
  const [slotH, setSlotH] = useState<number | null>(null);
  const width = PLAY_TABLE.width;

  const measure = (set: (v: number) => void, current: number | null) => (e: LayoutChangeEvent) => {
    const next = Math.round(e.nativeEvent.layout.height);
    if (next > 0 && next !== current) set(next);
  };

  // As tall as the slot allows, capped at the size every other game's felt uses so it stays
  // recognisably the same table, and never taller than the seats actually need.
  const natural = (contentH ?? 0) + FELT_PAD * 2;
  const height = Math.min(natural || PLAY_TABLE.height, PLAY_TABLE.height, slotH ?? PLAY_TABLE.height);

  return (
    <View style={styles.slot} onLayout={measure(setSlotH, slotH)}>
      <PokerTable width={width} height={height} style={styles.table}>
        <View style={styles.center} pointerEvents="box-none">
          {/* The measured box is everything the felt has to hold — the wordmark included, or
              the felt comes out a wordmark too short and it spills onto the rail. */}
          <View style={styles.measured} onLayout={measure(setContentH, contentH)} pointerEvents="box-none">
            {children}
            <TableWordmark />
          </View>
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
  // Normal flow rather than an absolute inset: PokerTable's own layers are the absolute ones,
  // so a flex child fills the box.
  center: {
    flex: 1,
    paddingHorizontal: spacing.base,
    paddingVertical: FELT_PAD,
    alignItems: 'center',
    justifyContent: 'center',
  },
  measured: {
    alignItems: 'center',
    gap: spacing.sm,
  },
});
