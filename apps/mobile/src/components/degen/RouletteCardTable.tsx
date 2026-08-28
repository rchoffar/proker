import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useAnimatedReaction,
  useSharedValue,
  withDelay,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { PokerTable, TABLE } from '../hand/PokerTable';
import { PlayerNameCard } from '../games/PlayerNameCard';
import { fontFamily, fontSize, radius, spacing } from '../../design-system/theme';
import { useTheme } from '../../design-system/ThemeProvider';
import type { Player } from '../../types';

// The roulette, per Mathieu's mockup: every player is a colored card on the felt; a warm
// light hops from card to card — the lit card turns fully CREAM with a gold halo — slows
// down, stops, and after a beat the loser's card grows to the center of the table before
// the verdict shows. The loser is still picked by Math.random up front; the hop schedule
// and the grow are pure staging.

const HOPS = 22;
const HOP_MIN_MS = 70;
const HOP_MAX_MS = 550;
const LAND_HOLD_MS = 450;
const GROW_MS = 650;
const GROW_SCALE = 2.4;
const CREAM = '#F1E6C8';
const CREAM_TEXT = '#1A150F';
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

// The mockup's highlight is not a border: the whole card turns ivory. An opaque cream
// twin (dark name, gold halo) sits on top of the colored card and fades with the light.
function CardSlot({ index, name, color, width, activeIndex, dimmed }: CardSlotProps) {
  const litStyle = useAnimatedStyle(() => ({
    opacity: withTiming(activeIndex.value === index ? 1 : 0, { duration: 120 }),
  }));
  const height = Math.round(width * (90 / 64));

  return (
    <View style={{ width, height }}>
      <PlayerNameCard name={name} color={color} width={width} dimmed={dimmed} />
      {/* Cream twin LAST and without zIndex — iOS turns zIndex into layer.zPosition,
          which would poke through full-screen overlays. */}
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.litCard, litStyle]}>
        <Text style={styles.litName} numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.6}>
          {name}
        </Text>
      </Animated.View>
    </View>
  );
}

interface RouletteCardTableProps {
  players: Player[];
  /** Increment to trigger a new draw. 0 means "not drawn yet". */
  spinToken: number;
  /** Fired once the loser's card has finished growing to the center. */
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
  const hopData = useSharedValue<{ seq: number[]; cumulative: number[] }>({ seq: [], cumulative: [] });
  const grow = useSharedValue(0);
  // Tagged with the spin token so a new draw invalidates everything without effect resets.
  const [landed, setLanded] = useState<{ token: number; index: number } | null>(null);
  const [grown, setGrown] = useState<{ token: number; index: number } | null>(null);

  const n = Math.max(players.length, 1);
  // Explicit grid positions (2 columns up to 4 players, 3 beyond) — the grow animation
  // starts from the exact slot center.
  const cols = n <= 4 ? 2 : 3;
  const rows = Math.ceil(n / cols);
  const gap = spacing.md;
  const feltW = width - 24 - spacing.base * 2;
  const feltH = tableH - 24 - spacing.base * 2;
  const cardW = Math.min(
    84,
    Math.floor((feltW - gap * (cols - 1)) / cols),
    Math.floor(((feltH - gap * (rows - 1)) / rows) * (64 / 90)),
  );
  const cardH = Math.round(cardW * (90 / 64));
  const slotCenter = (i: number) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    // The last row may be partial — center it.
    const rowCount = Math.min(cols, n - row * cols);
    return {
      x: width / 2 + (col - (rowCount - 1) / 2) * (cardW + gap),
      y: tableH / 2 + (row - (rows - 1) / 2) * (cardH + gap),
    };
  };

  useEffect(() => {
    if (spinToken === 0 || players.length < 2) return;

    const { loserIndex, seq, cumulative, total } = computeHopSchedule(players.length);
    const loser = players[loserIndex];
    let cancelled = false;
    elapsed.value = 0;
    grow.value = 0;
    triggerTick();
    activeIndex.value = seq[0];
    hopData.value = { seq, cumulative };
    elapsed.value = withTiming(total, { duration: total, easing: Easing.linear }, (finished) => {
      if (finished) {
        runOnJS(Haptics.notificationAsync)(LAND_TYPE);
        runOnJS(setLanded)({ token: spinToken, index: loserIndex });
      }
    });
    // Landing → short hold → the loser's card grows to the table center → verdict.
    const growTimer = setTimeout(() => {
      if (cancelled) return;
      setGrown({ token: spinToken, index: loserIndex });
      grow.value = withDelay(
        60,
        withTiming(1, { duration: GROW_MS, easing: Easing.out(Easing.cubic) }, (finished) => {
          if (finished) runOnJS(onResult)(loser);
        }),
      );
    }, total + LAND_HOLD_MS);
    return () => {
      cancelled = true;
      clearTimeout(growTimer);
    };
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
    (index, previous) => {
      if (index !== -1 && index !== previous) {
        activeIndex.value = index;
        runOnJS(triggerTick)();
      }
    },
  );

  const landedIndex = landed !== null && landed.token === spinToken && landed.index < players.length ? landed.index : null;
  const grownIndex = grown !== null && grown.token === spinToken && grown.index < players.length ? grown.index : null;

  const grownCenter = grownIndex !== null ? slotCenter(grownIndex) : { x: width / 2, y: tableH / 2 };
  const grownStyle = useAnimatedStyle(() => {
    const p = grow.value;
    return {
      opacity: p > 0 ? 1 : 0,
      transform: [
        { translateX: (width / 2 - grownCenter.x) * p },
        { translateY: (tableH / 2 - grownCenter.y) * p },
        { scale: 1 + (GROW_SCALE - 1) * p },
      ],
    };
  });

  return (
    <PokerTable width={width} height={tableH}>
      {players.map((p, i) => {
        const { x, y } = slotCenter(i);
        return (
          <View key={p.id} style={{ position: 'absolute', left: x - cardW / 2, top: y - cardH / 2 }}>
            <CardSlot
              index={i}
              name={p.name}
              color={colors.calendarPalette[i % colors.calendarPalette.length]}
              width={cardW}
              activeIndex={activeIndex}
              dimmed={landedIndex !== null && i !== landedIndex}
            />
          </View>
        );
      })}

      {/* The winner reveal: a cream twin of the loser's card travels from its slot to the
          table center while scaling up. Rendered last, no zIndex (see CardSlot). */}
      {grownIndex !== null && (
        <Animated.View
          pointerEvents="none"
          style={[
            {
              position: 'absolute',
              left: grownCenter.x - cardW / 2,
              top: grownCenter.y - cardH / 2,
              width: cardW,
              height: cardH,
            },
            styles.litCard,
            grownStyle,
          ]}
        >
          <Text style={styles.litName} numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.6}>
            {players[grownIndex].name}
          </Text>
        </Animated.View>
      )}
    </PokerTable>
  );
}

const styles = StyleSheet.create({
  litCard: {
    borderRadius: radius.lg,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.9)',
    backgroundColor: CREAM,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
    shadowColor: TABLE.gold,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.95,
    shadowRadius: 18,
    elevation: 12,
  },
  litName: {
    color: CREAM_TEXT,
    fontSize: fontSize.sm,
    fontFamily: fontFamily.bold,
    textAlign: 'center',
  },
});
