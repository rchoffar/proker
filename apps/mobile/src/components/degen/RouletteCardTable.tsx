import { useEffect, useState } from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useAnimatedReaction,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { PokerTable, TABLE } from '../hand/PokerTable';
import { PlayerNameCard } from '../games/PlayerNameCard';
import { spacing } from '../../design-system/theme';
import { useTheme } from '../../design-system/ThemeProvider';
import type { Player } from '../../types';

// The roulette, reimagined: every player is a card lying on the felt, a light hops from
// card to card, slows down, and the card it stops on pays the bill. Replaces the spinning
// wheel — names were unreadable mid-spin and the whole thing was over before it built any
// suspense. The loser is still picked by Math.random up front; the hop schedule is pure
// staging, precomputed to land on them.

const HOPS = 22;
const HOP_MIN_MS = 70;
const HOP_MAX_MS = 550;
const LAND_TYPE = Haptics.NotificationFeedbackType.Success;

function triggerTick() {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
}

/** Random walk over card indices, decelerating, whose last hop is the chosen loser. */
function computeHopSchedule(count: number) {
  const loserIndex = Math.floor(Math.random() * count);
  const seq: number[] = [];
  let prev = -1;
  for (let k = 0; k < HOPS - 1; k++) {
    let next = Math.floor(Math.random() * count);
    // No immediate repeat, and keep the run-up off the loser so the landing stays a reveal.
    while (next === prev || (k === HOPS - 2 && next === loserIndex)) {
      next = (next + 1) % count;
    }
    seq.push(next);
    prev = next;
  }
  seq.push(loserIndex);

  // Ease-in quad on hop durations: fast flicker at launch, long dwells at the end.
  const cumulative: number[] = [];
  let total = 0;
  for (let k = 0; k < HOPS; k++) {
    const p = k / (HOPS - 1);
    total += HOP_MIN_MS + (HOP_MAX_MS - HOP_MIN_MS) * p * p;
    cumulative.push(total);
  }
  return { loserIndex, seq, cumulative, total };
}

interface CardSlotProps {
  index: number;
  name: string;
  color: string;
  width: number;
  activeIndex: SharedValue<number>;
  dimmed: boolean;
}

function CardSlot({ index, name, color, width, activeIndex, dimmed }: CardSlotProps) {
  const glowStyle = useAnimatedStyle(() => ({
    opacity: withTiming(activeIndex.value === index ? 1 : 0, { duration: 120 }),
  }));
  const height = Math.round(width * (90 / 64));

  return (
    <View style={{ width, height }}>
      <PlayerNameCard name={name} color={color} width={width} dimmed={dimmed} />
      {/* Glow overlay LAST and without zIndex — iOS turns zIndex into layer.zPosition,
          which would poke through full-screen overlays like WinCelebration. */}
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.glow, glowStyle]} />
    </View>
  );
}

interface RouletteCardTableProps {
  players: Player[];
  /** Increment to trigger a new draw. 0 means "not drawn yet". */
  spinToken: number;
  onResult: (player: Player) => void;
  width?: number;
  height?: number;
}

export function RouletteCardTable({
  players,
  spinToken,
  onResult,
  width = Dimensions.get('window').width - spacing.xl * 2,
  height,
}: RouletteCardTableProps) {
  const { colors } = useTheme();
  const tableH = height ?? Math.min(Math.round(width * 1.35), Math.round(Dimensions.get('window').height * 0.58));

  const elapsed = useSharedValue(0);
  const activeIndex = useSharedValue(-1);
  const lastHop = useSharedValue(-1);
  const hopData = useSharedValue<{ seq: number[]; cumulative: number[] }>({ seq: [], cumulative: [] });
  // Tagged with the spin token so a new draw invalidates the highlight without an effect reset.
  const [landed, setLanded] = useState<{ token: number; index: number } | null>(null);

  const n = Math.max(players.length, 1);
  // Grid on the felt: 2 columns up to 4 players, 3 beyond; card size fits both axes.
  const cols = n <= 4 ? 2 : 3;
  const rows = Math.ceil(n / cols);
  const feltW = width - 24 - spacing.base * 2;
  const feltH = tableH - 24 - spacing.base * 2;
  const gap = spacing.md;
  const cardW = Math.min(
    84,
    Math.floor((feltW - gap * (cols - 1)) / cols),
    Math.floor(((feltH - gap * (rows - 1)) / rows) * (64 / 90)),
  );

  useEffect(() => {
    if (spinToken === 0 || players.length < 2) return;

    const { loserIndex, seq, cumulative, total } = computeHopSchedule(players.length);
    const loser = players[loserIndex];
    lastHop.value = -1;
    elapsed.value = 0;
    triggerTick();
    elapsed.value = withTiming(total, { duration: total, easing: Easing.linear }, (finished) => {
      if (finished) {
        runOnJS(Haptics.notificationAsync)(LAND_TYPE);
        runOnJS(setLanded)({ token: spinToken, index: loserIndex });
        runOnJS(onResult)(loser);
      }
    });

    // Map elapsed time → current hop → lit card, with a haptic tick per hop.
    // (Registered per spin via the shared values below — the reaction itself is stable.)
    activeIndex.value = seq[0];
    hopData.value = { seq, cumulative };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spinToken]);

  useAnimatedReaction(
    () => {
      const { seq, cumulative } = hopData.value;
      if (seq.length === 0) return -1;
      let k = 0;
      while (k < cumulative.length - 1 && elapsed.value >= cumulative[k]) k++;
      return seq[k];
    },
    (index) => {
      if (index !== -1 && index !== lastHop.value) {
        lastHop.value = index;
        activeIndex.value = index;
        runOnJS(triggerTick)();
      }
    },
  );

  const landedIndex = landed !== null && landed.token === spinToken && landed.index < players.length ? landed.index : null;

  return (
    <PokerTable width={width} height={tableH}>
      <View style={styles.grid}>
        <View style={[styles.cards, { gap }]}>
          {players.map((p, i) => (
            <CardSlot
              key={p.id}
              index={i}
              name={p.name}
              color={colors.calendarPalette[i % colors.calendarPalette.length]}
              width={cardW}
              activeIndex={activeIndex}
              dimmed={landedIndex !== null && i !== landedIndex}
            />
          ))}
        </View>
      </View>
    </PokerTable>
  );
}

const styles = StyleSheet.create({
  grid: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.base + 12,
  },
  cards: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'center',
  },
  glow: {
    borderRadius: 12,
    borderWidth: 2.5,
    borderColor: TABLE.gold,
    shadowColor: TABLE.gold,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 14,
    elevation: 10,
    backgroundColor: 'rgba(231,195,111,0.14)',
  },
});
