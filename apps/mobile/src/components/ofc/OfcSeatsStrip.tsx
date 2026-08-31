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
}

// The seats sit on green felt now, so they need the felt's own dark plate rather than the
// translucent white that read as a slightly lighter panel on the old black screen.
const DARK_CARD_BG = TABLE.plateBg;

export function OfcSeatsStrip({ seats, activeId }: Props) {
  const { t } = useTranslation('ofc');
  const { colors } = useTheme();

  return (
    <View style={styles.strip}>
      {seats.map((seat) => (
        <View
          key={seat.id}
          style={[
            styles.seat,
            { backgroundColor: DARK_CARD_BG, borderColor: seat.id === activeId ? TABLE.gold : colors.onDarkHairline },
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
            <OfcGridView grid={seat.grid} gridCounts={seat.gridCounts} size="sm" fouled={seat.fouled} />
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
  // A column, not a row: on the felt these are the boards laid out across the table, and a
  // seat card is about 184pt wide (five sm slots plus padding), so two of them never fit
  // side by side inside an oval. Stacked, they read as "your board / my board" facing each
  // other, which is how the game is actually played.
  strip: {
    alignItems: 'center',
    gap: spacing.sm,
  },
  seat: {
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.sm,
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
