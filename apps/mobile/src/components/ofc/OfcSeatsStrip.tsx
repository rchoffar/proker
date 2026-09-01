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
  /** The room inside the felt, from OfcTableFelt. Compact boards are sized to fill it. */
  inner?: { width: number; height: number };
}

// No dark PLATE behind a seat — on green felt that reads as a rectangle swallowing the table,
// which is what reduced the felt to a green border the first time round. A thin outline is a
// different thing: with two boards side by side and eight points between them, it is what
// tells you where one ends and the next begins. Gold, and a shade darker inside, for whoever
// is acting.

// A compact board is as big as BOTH dimensions allow, and which one binds depends on how many
// boards there are — that is the whole rule, rather than a guessed size per case.
//
// Alone, the height binds: three rows and a name line inside whatever the placement board
// left over, with width going spare. Two abreast and the width binds instead — five slots
// each, twice, plus the gap — and it binds hard: it is why three players looks like there is
// room to spare and the cards still cannot grow much. Stacking them would be worse, not
// better: half the height each for a width neither can use.

/** Vertical: a seat's own name/chips line, the row gaps, and its border/padding. */
const HEADER_H = 22;
const ROW_GAP = 2;
const SEAT_CHROME_Y = 8;
/** Horizontal: the gap between two boards, and each board's border/padding. */
const BOARD_GAP = spacing.sm;
const SEAT_CHROME_X = 6;
/** Never so small it stops being readable, never bigger than the big board below it. */
const SLOT_MIN = 24;
const SLOT_MAX = 46;

const clampSlot = (w: number) => Math.min(SLOT_MAX, Math.max(SLOT_MIN, w));

/** Widest slot three rows of it fit into `height`, header and gaps taken off. */
function slotForHeight(height: number): number {
  const rows = height - HEADER_H - ROW_GAP * 2 - SEAT_CHROME_Y;
  return clampSlot(Math.floor((rows / 3) * (46 / 64)));
}

/** Widest slot five of them fit into `width`, shared between `boards` boards. */
function slotForWidth(width: number, boards: number): number {
  const perBoard = (width - BOARD_GAP * (boards - 1)) / boards;
  return clampSlot(Math.floor((perBoard - SEAT_CHROME_X - ROW_GAP * 4) / 5));
}

export function OfcSeatsStrip({ seats, activeId, compact = false, inner }: Props) {
  const { t } = useTranslation('ofc');
  const { colors } = useTheme();
  const abreast = compact && seats.length > 1;
  const slotWidth =
    compact && inner
      ? Math.min(slotForHeight(inner.height), slotForWidth(inner.width, seats.length))
      : compact
        ? SLOT_MIN
        : undefined;

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
    gap: BOARD_GAP,
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
