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
}

// No card behind a seat: on green felt a dark plate around a whole grid is a rectangle that
// swallows the table — once the screen stopped scrolling and the felt tightened around its
// content, the oval was reduced to a green border around it. The cards sit straight on the
// felt, like a real board, and only the player acting gets an outline.

export function OfcSeatsStrip({ seats, activeId, compact = false }: Props) {
  const { t } = useTranslation('ofc');
  const { colors } = useTheme();

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
          <View style={styles.seatHeader}>
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
          <Text style={[styles.chips, { color: colors.onDarkSecondary }]}>
            {seat.eliminated ? t('game.eliminated') : t('game.chips', { count: seat.chips })}
          </Text>
          {!seat.eliminated && (
            // Compact on purpose: the acting player's board renders big in the screen's
            // action zone (and their seat leaves the strip), so nothing shows twice.
            <OfcGridView
              grid={seat.grid}
              gridCounts={seat.gridCounts}
              size={compact ? 'xs' : 'sm'}
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
  },
  seat: {
    borderWidth: 1,
    borderColor: 'transparent',
    borderRadius: radius.md,
    paddingHorizontal: spacing.xs,
    paddingVertical: 4,
    alignItems: 'center',
    gap: 3,
  },
  eliminatedSeat: {
    opacity: 0.45,
  },
  seatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    maxWidth: 150,
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
