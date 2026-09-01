import { View, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { PlayingCard } from '../hand/PlayingCard';
import { TABLE } from '../hand/PokerTable';
import { fontFamily, fontSize, radius } from '../../design-system/theme';
import { useTheme } from '../../design-system/ThemeProvider';
import type { OfcGrid, RowId } from '../../lib/ofc';
import { ROW_CAPACITY, ROW_IDS } from '../../lib/ofc';

export interface OfcRowOverlay {
  win?: -1 | 0 | 1; // this row vs the compared opponent (scoring display)
  royalty?: number;
}

interface Props {
  // Visible cards (own grid, public grids, revealed grids). Absent → face-down backs.
  grid?: OfcGrid;
  gridCounts: { top: number; middle: number; bottom: number };
  size?: 'xs' | 'sm' | 'md';
  fouled?: boolean;
  // Row names (Haut/Milieu/Bas) down the left edge — on by default for the big board,
  // where the three lines must read at a glance; compact seats stay label-free.
  showLabels?: boolean;
  overlays?: Partial<Record<RowId, OfcRowOverlay>>;
}

// `xs` exists so that two opponents' boards fit ACROSS the felt while you have your own
// placement board open — the screens never scroll, so the only way to keep three players on
// one page is to give the boards you are only glancing at less room.
const CARD_GAP = { xs: 2, sm: 3, md: 5 } as const;
const SLOT = {
  xs: { width: 22, height: 31 },
  sm: { width: 30, height: 42 },
  md: { width: 46, height: 64 },
} as const;

const LOSS_ON_DARK = '#FF6B70';
// Visible against the dark felt — the theme hairline is too faint for empty slots.
const EMPTY_SLOT_BORDER = 'rgba(255, 255, 255, 0.28)';
const EMPTY_SLOT_BG = 'rgba(255, 255, 255, 0.04)';

export function OfcGridView({
  grid,
  gridCounts,
  size = 'md',
  fouled = false,
  showLabels = size === 'md',
  overlays,
}: Props) {
  const { t } = useTranslation('ofc');
  const { colors } = useTheme();
  const slot = SLOT[size];

  return (
    <View style={[styles.grid, { gap: CARD_GAP[size] + 1 }, showLabels && styles.gridLeft]}>
      {ROW_IDS.map((row) => {
        const overlay = overlays?.[row];
        const count = gridCounts[row];
        return (
          <View key={row} style={[styles.row, { gap: CARD_GAP[size] }]}>
            {showLabels && (
              <Text style={[styles.rowLabel, { color: colors.onDarkTertiary }]}>
                {t(`game.rows.${row}`)}
              </Text>
            )}
            {Array.from({ length: ROW_CAPACITY[row] }, (_, i) => {
              if (i >= count) {
                return (
                  <View
                    key={i}
                    style={[
                      styles.emptySlot,
                      { width: slot.width, height: slot.height },
                    ]}
                  />
                );
              }
              // `width` rather than `size` for xs: PlayingCard derives the rest from it, and
              // there is no xs tier in its own scale.
              return size === 'xs' ? (
                <PlayingCard key={i} card={grid?.[row][i]} faceDown={!grid} width={slot.width} />
              ) : (
                <PlayingCard key={i} card={grid?.[row][i]} faceDown={!grid} size={size} />
              );
            })}
            {overlay && (
              <View style={styles.overlayCol}>
                {overlay.win !== undefined && overlay.win !== 0 && (
                  <Text style={[styles.winTick, { color: overlay.win > 0 ? TABLE.gold : LOSS_ON_DARK }]}>
                    {overlay.win > 0 ? '+1' : '-1'}
                  </Text>
                )}
                {overlay.royalty !== undefined && overlay.royalty > 0 && (
                  <Text style={[styles.royalty, { color: TABLE.gold }]}>
                    {t('score.royaltyBadge', { points: overlay.royalty })}
                  </Text>
                )}
              </View>
            )}
          </View>
        );
      })}
      {fouled && (
        <View style={[styles.foulBanner, { backgroundColor: 'rgba(255, 107, 112, 0.16)' }]}>
          <Text style={[styles.foulText, { color: LOSS_ON_DARK }]}>{t('score.foul')}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    alignItems: 'center',
  },
  // With row labels the rows share a left edge — the label column keeps them aligned.
  gridLeft: {
    alignItems: 'flex-start',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rowLabel: {
    fontSize: fontSize.xs,
    fontFamily: fontFamily.semibold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    width: 46,
  },
  emptySlot: {
    borderRadius: radius.sm,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: EMPTY_SLOT_BORDER,
    backgroundColor: EMPTY_SLOT_BG,
  },
  overlayCol: {
    marginLeft: 2,
    alignItems: 'flex-start',
    gap: 1,
  },
  winTick: {
    fontSize: fontSize.xs,
    fontFamily: fontFamily.bold,
  },
  royalty: {
    fontSize: fontSize.xs,
    fontFamily: fontFamily.semibold,
  },
  foulBanner: {
    paddingHorizontal: 10,
    paddingVertical: 2,
    borderRadius: radius.full,
    marginTop: 2,
    alignSelf: 'center',
  },
  foulText: {
    fontSize: fontSize.xs,
    fontFamily: fontFamily.bold,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
});
