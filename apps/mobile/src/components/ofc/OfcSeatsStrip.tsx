import { View, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Sparkles } from 'lucide-react-native';
import { OfcGridView } from './OfcGridView';
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

// The boards are sized AND oriented to the room the felt has — never to a fixed tier, and
// never to a flag the screen passes down.
//
// Both of those were bugs. A fixed `sm` outside the placing phase meant that at scoring, where
// the felt shrinks to share the page with the scoresheet, two stacked boards measured about
// 320pt inside a felt given far less and spilled over the caption above and the scoresheet
// below. And tying the orientation to "is the placement board open" got it backwards whenever
// the felt was short: stacked, two boards have to split the height, which at scoring left a
// 13pt slot — unreadable, and past the floor, so it overflowed anyway.
//
// So both orientations are measured and the roomier one wins. That is not a tie-breaker, it is
// the whole decision, and it goes the other way depending on the felt: tall (out of turn, with
// the page to itself) stacking wins, because each board keeps the full width and only shares
// height. Short (sharing with the placement board, or with the scoresheet) side by side wins,
// because the height is what ran out. Reading the numbers beats asserting the layout.

/** Vertical: a seat's own name/chips line, the row gaps, and its border/padding. */
const HEADER_H = 22;
const ROW_GAP = 2;
const SEAT_CHROME_Y = 8;
/** Horizontal: the gap between boards, and each board's border/padding. */
const BOARD_GAP = spacing.sm;
const SEAT_CHROME_X = 6;
/**
 * The floor has to stay BELOW what the tightest case needs, or it stops being a floor and
 * becomes an overflow: at three players on a short felt the arithmetic asks for 18, and a
 * floor of 20 pinned both orientations to 20, made them tie, and then spilled 370pt of boards
 * into 190pt of felt. Small cards on a crowded non-scrolling page are the honest trade; boards
 * over the scoresheet are not.
 */
const SLOT_MIN = 14;
const SLOT_MAX = 46;

const clampSlot = (w: number) => Math.min(SLOT_MAX, Math.max(SLOT_MIN, w));

/** Widest slot three rows of it fit into `height`, shared between `down` stacked boards. */
function slotForHeight(height: number, down: number): number {
  const perBoard = (height - BOARD_GAP * (down - 1)) / down;
  const rows = perBoard - HEADER_H - ROW_GAP * 2 - SEAT_CHROME_Y;
  return clampSlot(Math.floor((rows / 3) * (46 / 64)));
}

/** Widest slot five of them fit into `width`, shared between `across` boards. */
function slotForWidth(width: number, across: number): number {
  const perBoard = (width - BOARD_GAP * (across - 1)) / across;
  return clampSlot(Math.floor((perBoard - SEAT_CHROME_X - ROW_GAP * 4) / 5));
}

export function OfcSeatsStrip({ seats, activeId, inner }: Props) {
  const { t } = useTranslation('ofc');
  const { colors } = useTheme();
  // Measure both ways round and take the roomier — see the note above for why neither
  // orientation is right on its own.
  const fit = (across: number, down: number) =>
    inner ? Math.min(slotForHeight(inner.height, down), slotForWidth(inner.width, across)) : 0;
  const n = seats.length;
  const abreast = n > 1 && fit(n, 1) > fit(1, n);
  const slotWidth = inner ? (abreast ? fit(n, 1) : fit(1, n)) : undefined;

  return (
    <View style={[styles.strip, abreast && styles.stripAbreast]}>
      {seats.map((seat) => (
        <View
          key={seat.id}
          style={[
            styles.seat,
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
  // Stacked by default: at sm a board is about 170pt wide, so two never fit across an oval,
  // and stacked they read as "your board / my board" facing each other, which is how the game
  // is played. Compact flips to a row, where xs boards do fit side by side — the only way to
  // keep three players and a placement board on one non-scrolling page.
  // Stacked by default — "your board / my board" facing each other across a table, and each
  // board keeps the felt's full width. Abreast when the height is what ran short.
  strip: {
    alignItems: 'center',
    gap: BOARD_GAP,
  },
  stripAbreast: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'flex-start',
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
