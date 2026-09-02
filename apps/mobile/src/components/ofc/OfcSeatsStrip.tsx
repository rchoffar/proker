import { View, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Sparkles } from 'lucide-react-native';
import { OfcGridView } from './OfcGridView';
import { SEAT_BOARD_GAP, fitSeatBoards, seatBoardHeight, seatBoardWidth } from './seatsLayout';
import { TABLE } from '../hand/PokerTable';
import { fontFamily, fontSize, radius, spacing } from '../../design-system/theme';
import { useTheme } from '../../design-system/ThemeProvider';
import type { OfcGrid } from '../../lib/ofc';

// The shared view-model both modes render: Pass & Play derives it from the full state
// through the same visibility rules as online (redactFor) — `grid` is absent whenever
// the viewer may not see it (Fantasy Land pre-reveal).
export interface OfcSeatVM {
  id: string;
  name: string;
  chips: number;
  eliminated: boolean;
  inFantasyLand: boolean;
  fantasyPlaced: boolean;
  isButton: boolean;
  gridCounts: { top: number; middle: number; bottom: number };
  grid?: OfcGrid;
  fouled?: boolean; // scoring display
  connected?: boolean;
}

interface Props {
  seats: OfcSeatVM[];
  activeId: string | null;
  /**
   * The room inside the felt, from OfcTableFelt. The boards are laid out and sized to fill it
   * — orientation included, so the caller has no layout decision to make.
   */
  inner?: { width: number; height: number };
}

// No dark PLATE behind a seat — on green felt that reads as a rectangle swallowing the table,
// which is what reduced the felt to a green border the first time round. A thin outline is a
// different thing: with two boards side by side and eight points between them, it is what
// tells you where one ends and the next begins. Gold, and a shade darker inside, for whoever
// is acting.

// How the boards are sized and arranged lives in seatsLayout.ts — it is arithmetic against
// OfcGridView's real geometry, and it is tested.

export function OfcSeatsStrip({ seats, activeId, inner }: Props) {
  const { t } = useTranslation('ofc');
  const { colors } = useTheme();
  const fit = inner ? fitSeatBoards(seats.length, inner) : null;
  const slotWidth = fit?.slotWidth;
  const abreast = (fit?.cols ?? 1) > 1;

  return (
    <View
      style={[
        styles.strip,
        // The grid is a wrap, not a fixed split: the seats each take exactly the width their
        // cards need (never their header's, which would move the wrap points), and the row
        // measured above is what they wrap into.
        inner
          ? {
              width: inner.width,
              flexDirection: 'row',
              flexWrap: 'wrap',
              // A row's boards match each other's height even in the one case the floor cannot
              // cover on its own — a seat both fouled AND in Fantasy Land, which has two lines
              // to hang under its grid.
              alignItems: 'stretch',
            }
          : null,
      ]}
    >
      {seats.map((seat) => (
        <View
          key={seat.id}
          style={[
            styles.seat,
            // The reserved line under the grid has to be part of the BOX, not just of the
            // arithmetic: sized to its content, a fouled seat was one banner taller than the
            // seat beside it. The floor puts the empty line inside every seat instead, so the
            // outlines match whether the banner is there or not.
            slotWidth !== undefined && {
              width: seatBoardWidth(slotWidth),
              minHeight: seatBoardHeight(slotWidth),
            },
            seat.id === activeId && { borderColor: TABLE.gold, backgroundColor: 'rgba(0,0,0,0.18)' },
            seat.eliminated && styles.eliminatedSeat,
          ]}
        >
          {/* One line across the top of the board — name hard left, chips hard right — rather
              than a name stacked over its chip count. It costs one line instead of two and
              spends the felt's width, which there is plenty of, on the height the cards want. */}
          <View style={[styles.seatHeader, abreast && styles.seatHeaderAbreast]}>
            <View style={styles.seatIdentity}>
              {seat.isButton && (
                <View style={[styles.buttonBadge, { backgroundColor: TABLE.gold }]}>
                  <Text style={styles.buttonBadgeText}>{t('game.buttonBadge')}</Text>
                </View>
              )}
              <Text
                style={[
                  styles.seatName,
                  { color: seat.connected === false ? colors.onDarkTertiary : colors.onDarkPrimary },
                ]}
                numberOfLines={1}
              >
                {seat.name}
              </Text>
              {seat.inFantasyLand && <Sparkles size={12} color={TABLE.gold} strokeWidth={2} />}
            </View>
            <Text style={[styles.chips, { color: colors.onDarkSecondary }]} numberOfLines={1}>
              {seat.eliminated ? t('game.eliminated') : t('game.chips', { count: seat.chips })}
            </Text>
          </View>
          {!seat.eliminated && (
            // Compact on purpose: the acting player's board renders big in the screen's
            // action zone (and their seat leaves the strip), so nothing shows twice.
            <OfcGridView
              grid={seat.grid}
              gridCounts={seat.gridCounts}
              // `size` only decides the row gap now — slotWidth is what sets the cards, and it
              // is always present on the felt. The tier is the fallback for a caller with no
              // measurement to give.
              size="xs"
              slotWidth={slotWidth}
              fouled={seat.fouled}
            />
          )}
          {seat.inFantasyLand && !seat.eliminated && (
            <Text style={[styles.fantasyHint, { color: colors.onDarkTertiary }]}>
              {seat.fantasyPlaced ? t('game.fantasyPlaced') : t('game.fantasyArranging')}
            </Text>
          )}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  // One wrapping, centred row, whatever the grid turns out to be: one column reads as "your
  // board / my board" facing each other across the table, and more than one is what a short
  // felt needs — see the sizing note above. Both come out of the same wrap.
  strip: {
    alignItems: 'center',
    alignContent: 'center',
    justifyContent: 'center',
    gap: SEAT_BOARD_GAP,
  },
  seat: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
    borderRadius: radius.md,
    paddingHorizontal: 2,
    paddingVertical: spacing.xs,
    alignItems: 'center',
    gap: 3,
  },
  // Stretches so the identity and the chip count reach the board's two edges — which, for a
  // single board on the felt, is the felt's own top-left and top-right.
  seatHeader: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  // Two boards abreast get only half the felt each, and a name pinned left with a chip count
  // pinned right then reads as one run of four items across the table. They centre instead.
  seatHeaderAbreast: {
    justifyContent: 'center',
    gap: spacing.xs,
  },
  seatIdentity: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flexShrink: 1,
  },
  eliminatedSeat: {
    opacity: 0.45,
  },

  buttonBadge: {
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonBadgeText: {
    color: '#0A0A0F',
    fontSize: 9,
    fontFamily: fontFamily.extrabold,
  },
  seatName: {
    fontSize: fontSize.sm,
    fontFamily: fontFamily.semibold,
    flexShrink: 1,
  },
  chips: {
    fontSize: fontSize.xs,
    fontFamily: fontFamily.medium,
  },
  fantasyHint: {
    fontSize: fontSize.xs,
    fontFamily: fontFamily.regular,
  },
});
