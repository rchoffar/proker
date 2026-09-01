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
   * The felt is sharing the page with your own placement board, which leaves it too little
   * height for full-size boards. They shrink and sit side by side instead of stacked —
   * nothing on these screens scrolls, so this is what keeps everything on one page.
   */
  compact?: boolean;
  /** Height available inside the felt, from OfcTableFelt. A lone board fills it. */
  innerHeight?: number;
}

// No dark PLATE behind a seat — on green felt that reads as a rectangle swallowing the table,
// which is what reduced the felt to a green border the first time round. A thin outline is a
// different thing: with two boards side by side and eight points between them, it is what
// tells you where one ends and the next begins. Gold, and a shade darker inside, for whoever
// is acting.

// What limits a compact board depends on how many there are, and the two limits are nothing
// alike.
//
// Alone, the limit is HEIGHT — three rows plus a header line inside whatever the placement
// board leaves over — and there is width going spare, so the slot is as big as that height
// allows.
//
// Two abreast, the limit is WIDTH: five slots each, twice, plus the gap between them, inside
// the felt. That one binds long before the height does, which is why the felt looks like it
// has room left at three players and yet the cards cannot grow. Stacking them instead would
// make them smaller still — half the height each, for a full width neither can use.
const COMPACT_SLOT_ABREAST = 26;
/** Height a seat spends on its own name/chips line, before the grid gets any. */
const HEADER_H = 22;
/** Never so small it stops being readable, never so big the felt's width runs out. */
const SLOT_MIN = 26;
const SLOT_MAX = 46;

/** The tallest slot three rows of it can be inside `innerHeight`. */
function slotForHeight(innerHeight: number): number {
  const rows = Math.max(0, innerHeight - HEADER_H - CARD_ROW_GAP * 2 - SEAT_CHROME);
  const height = Math.floor(rows / 3);
  const width = Math.round((height * 46) / 64);
  return Math.min(SLOT_MAX, Math.max(SLOT_MIN, width));
}

/** Row gap and border/padding OfcGridView and the seat spend on themselves. */
const CARD_ROW_GAP = 4;
const SEAT_CHROME = 10;

export function OfcSeatsStrip({ seats, activeId, compact = false, innerHeight }: Props) {
  const { t } = useTranslation('ofc');
  const { colors } = useTheme();
  const abreast = compact && seats.length > 1;
  // Abreast, the width runs out long before the height does, so the slot is fixed. Alone, the
  // height is the only limit — so it takes exactly as much of it as there is.
  const slotWidth = !compact
    ? undefined
    : abreast
      ? COMPACT_SLOT_ABREAST
      : innerHeight
        ? slotForHeight(innerHeight)
        : SLOT_MIN;

  return (
    <View style={[styles.strip, compact && styles.stripCompact]}>
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
              size={compact ? 'xs' : 'sm'}
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
  strip: {
    alignItems: 'center',
    gap: spacing.sm,
  },
  stripCompact: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  seat: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
    borderRadius: radius.md,
    paddingHorizontal: spacing.xs,
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
