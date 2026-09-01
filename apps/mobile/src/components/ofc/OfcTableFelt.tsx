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
// The first version of this felt had a floor of 0.85 × width so an oval would always "read as
// a table". That was optimising for the wrong thing: at two players the content is one small
// grid (~130pt) and the floor forced ~300, so the felt ate 40% of the screen for an empty grid
// and pushed the placement board out of frame — "il est plus difficile de voir toutes les
// informations à l'OFC maintenant qu'il y a la jolie table design".
//
// So it is elastic instead, and answers both reports at once: it takes whatever height is
// LEFT OVER. Out of turn nothing else wants the room and it stretches to fill the void; while
// you are placing, the action panel takes what it needs and the felt shrinks back to its
// content. The slot is `flex: 1` with a `minHeight` of the content, which is what stops the
// shrink from going past it; the screens' scroll containers need `flexGrow: 1` or there is no
// leftover space to claim in the first place.

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

  // Never smaller than the seats it holds; otherwise as tall as the slot allows, capped at the
  // size every other game's felt uses so it stays recognisably the same table.
  const natural = (contentH ?? 0) + FELT_PAD * 2;
  const height = Math.max(natural, Math.min(PLAY_TABLE.height, slotH ?? 0));

  return (
    <View style={[styles.slot, { minHeight: natural }]} onLayout={measure(setSlotH, slotH)}>
      <PokerTable width={width} height={height} style={styles.table}>
        <View style={styles.center} pointerEvents="box-none">
          <View onLayout={measure(setContentH, contentH)} pointerEvents="box-none">
            {children}
          </View>
          <TableWordmark />
        </View>
      </PokerTable>
    </View>
  );
}

const styles = StyleSheet.create({
  // Claims the leftover height, and gives it all back down to `minHeight` when a sibling —
  // the placement board — needs it.
  slot: {
    flex: 1,
    justifyContent: 'center',
  },
  table: {
    alignSelf: 'center',
  },
  // Normal flow rather than an absolute inset: PokerTable's own layers are the absolute
  // ones, so a flex child fills the box and content that outgrows the cap spills visibly
  // instead of being clipped.
  center: {
    flex: 1,
    paddingHorizontal: spacing.base,
    paddingVertical: FELT_PAD,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
});
