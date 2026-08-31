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
// So the seats go on a felt, like every other game's. The felt hugs its content but never
// collapses: FLOOR_RATIO keeps it reading as a table when two players hold five cards
// between them, and PLAY_TABLE.height caps it so it cannot push the action panel off screen
// at three. Width is PLAY_TABLE.width — the same felt every other game uses, so walking from
// the setup board into the hand does not resize the table.

const FELT_PAD = spacing['3xl'];
/** Minimum height as a fraction of the width — below this an oval stops reading as a table. */
const FLOOR_RATIO = 0.85;

interface Props {
  /** The seat strip. Anything laid out here is centred on the felt. */
  children: ReactNode;
}

export function OfcTableFelt({ children }: Props) {
  const [contentH, setContentH] = useState<number | null>(null);
  const width = PLAY_TABLE.width;
  const onLayout = (e: LayoutChangeEvent) => {
    const next = Math.round(e.nativeEvent.layout.height);
    if (next > 0 && next !== contentH) setContentH(next);
  };

  const height = Math.min(
    PLAY_TABLE.height,
    Math.max(Math.round(width * FLOOR_RATIO), (contentH ?? 0) + FELT_PAD * 2),
  );

  return (
    <PokerTable width={width} height={height} style={styles.table}>
      <View style={styles.center} pointerEvents="box-none">
        <View onLayout={onLayout} pointerEvents="box-none">
          {children}
        </View>
        <TableWordmark />
      </View>
    </PokerTable>
  );
}

const styles = StyleSheet.create({
  table: {
    alignSelf: 'center',
  },
  // Normal flow rather than an absolute inset: PokerTable's own layers are the absolute
  // ones, so a flex child fills the box and content that outgrows the cap spills visibly
  // instead of being clipped. The inset clears the betting line (drawn at 38).
  center: {
    flex: 1,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing['3xl'],
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.base,
  },
});
