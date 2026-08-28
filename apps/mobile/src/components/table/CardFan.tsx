import { useEffect, type ReactNode } from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, {
  Easing,
  FlipInEasyY,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { PlayingCard } from '../hand/PlayingCard';
import type { Card } from '../../types';

// A player's hand as a fan of cards, shared by every table in the app (flip, bluff, the
// hand replayer).
//
// The one rule this component exists to enforce: a fan's cards overlap, so their paint
// order must be their document order (first card at the back, last in front) — ALWAYS.
// That rules out per-card `entering` animations, which move a view into Reanimated's own
// animation layer where sibling z-order is ignored; overlapping fans visibly shuffled
// mid-animation and snapped into place at the end. So the two entrances here are:
//   • flipIn — the WHOLE fan flips in as one packet (one entering on the row).
//   • deal   — each card flies in from the table centre on a plain animated transform,
//              never leaving the normal hierarchy.

export interface FanCard {
  card?: Card;
  faceDown?: boolean;
  dimmed?: boolean;
  // Border drawn around the card (bluff's witness / counter-example highlighting).
  highlightColor?: string;
}

export type FanSize = 'sm' | 'md';

export const FAN_GEOMETRY: Record<FanSize, { cardW: number; cardH: number; overlap: number; aboveOffset: number }> = {
  sm: { cardW: 30, cardH: 42, overlap: -12, aboveOffset: 44 },
  md: { cardW: 46, cardH: 64, overlap: -16, aboveOffset: 56 },
};

const FAN_ANGLES: Record<number, number[]> = {
  1: [0],
  2: [-6, 6],
  3: [-8, 0, 8],
  4: [-12, -4, 4, 12],
  5: [-14, -7, 0, 7, 14],
};

const DEAL_FLIGHT_MS = 320;

/** Four cards or more must go small: seats sit at the table's horizontal extremes, where
 *  a wide fan runs off the screen and over the board. */
export function fanSizeFor(count: number): FanSize {
  return count >= 4 ? 'sm' : 'md';
}

export function fanStep(size: FanSize): number {
  const g = FAN_GEOMETRY[size];
  return g.cardW + g.overlap;
}

export function fanWidth(count: number, size: FanSize): number {
  return FAN_GEOMETRY[size].cardW + Math.max(0, count - 1) * fanStep(size);
}

export interface DealSpec {
  // Offset from the fan's resting place to the table centre, in points.
  fromX: number;
  fromY: number;
  delayFor: (index: number) => number;
  ready: boolean;
}

interface DealtCardProps {
  children: ReactNode;
  fromX: number;
  fromY: number;
  delay: number;
  rotate: number;
  ready: boolean;
}

function DealtCard({ children, fromX, fromY, delay, rotate, ready }: DealtCardProps) {
  const progress = useSharedValue(0);

  useEffect(() => {
    if (!ready) return;
    progress.value = 0;
    progress.value = withDelay(delay, withTiming(1, { duration: DEAL_FLIGHT_MS, easing: Easing.out(Easing.cubic) }));
  }, [ready, delay, fromX, fromY, progress]);

  const style = useAnimatedStyle(() => {
    const p = progress.value;
    return {
      opacity: p === 0 ? 0 : 1,
      transform: [
        { translateX: fromX * (1 - p) },
        { translateY: fromY * (1 - p) },
        // Spins out of the deck and lands flat into its fan angle.
        { rotate: `${rotate * p + 18 * (1 - p)}deg` },
        { scale: 0.82 + 0.18 * p },
      ],
    };
  });

  return <Animated.View style={style}>{children}</Animated.View>;
}

interface Props {
  cards: FanCard[];
  size?: FanSize;
  /** Bump to re-fire the entrance on a new deal/round. */
  token?: string | number;
  /** Flip the whole fan in as one packet. Ignored when `deal` is set. */
  flipIn?: { delay: number; duration?: number } | null;
  /** Deal the cards in one by one from the table centre. */
  deal?: DealSpec | null;
  /** Floating badge (win chance…) pinned beside the fan without affecting its layout. */
  badge?: ReactNode;
  badgeSide?: 'left' | 'right';
}

export function CardFan({ cards, size, token = 0, flipIn = null, deal = null, badge, badgeSide = 'right' }: Props) {
  const fanSize = size ?? fanSizeFor(cards.length);
  const geometry = FAN_GEOMETRY[fanSize];
  const angles = FAN_ANGLES[cards.length] ?? FAN_ANGLES[2];
  const width = fanWidth(cards.length, fanSize);

  const cardNodes = cards.map((entry, i) => {
    const angle = angles[i] ?? 0;
    const card = (
      <PlayingCard card={entry.card} faceDown={entry.faceDown} size={fanSize} dimmed={entry.dimmed} />
    );
    const content = entry.highlightColor ? (
      <View style={[styles.highlight, { borderColor: entry.highlightColor }]}>{card}</View>
    ) : (
      card
    );

    // Rest offset of this card's centre from the fan's centre — the flight start needs it.
    const restOffsetX = -width / 2 + i * fanStep(fanSize) + geometry.cardW / 2;

    return (
      <View
        key={`${token}-${i}`}
        style={[
          i > 0 && { marginLeft: geometry.overlap },
          angle !== 0 && { marginTop: Math.abs(angle) * 0.4 },
          // No rotate here when dealing: DealtCard animates into the angle itself.
          angle !== 0 && !deal && { transform: [{ rotate: `${angle}deg` }] },
        ]}
      >
        {deal ? (
          <DealtCard
            fromX={deal.fromX - restOffsetX}
            fromY={deal.fromY}
            delay={deal.delayFor(i)}
            rotate={angle}
            ready={deal.ready}
          >
            {content}
          </DealtCard>
        ) : (
          content
        )}
      </View>
    );
  });

  const row = <View style={styles.row}>{cardNodes}</View>;

  return (
    <View style={styles.wrap}>
      {flipIn && !deal ? (
        <Animated.View
          key={`fan-${token}`}
          entering={FlipInEasyY.duration(flipIn.duration ?? 400).delay(flipIn.delay)}
        >
          {row}
        </Animated.View>
      ) : (
        row
      )}
      {badge ? (
        <View style={badgeSide === 'left' ? styles.badgeLeft : styles.badgeRight}>{badge}</View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
  highlight: {
    borderWidth: 2,
    borderRadius: 8,
    margin: -2,
  },
  // Pinned off the fan's edge so the cards keep their exact place; the side flips for
  // right-half seats, where hanging off the right edge would leave the screen.
  badgeRight: {
    position: 'absolute',
    left: '100%',
    marginLeft: 4,
    top: '50%',
  },
  badgeLeft: {
    position: 'absolute',
    right: '100%',
    marginRight: 4,
    top: '50%',
  },
});
