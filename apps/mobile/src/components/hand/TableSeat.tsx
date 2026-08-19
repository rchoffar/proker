import type { ComponentProps, ReactNode } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { TABLE } from './PokerTable';
import { fontFamily, fontSize, radius, spacing } from '../../design-system/theme';
import { initials } from '../../lib/format';

type EnteringProp = ComponentProps<typeof Animated.View>['entering'];

// Default upward anchor shift when a card fan sits above the avatar, so the avatar itself
// stays on the rail regardless of the fan's presence. Tuned for sm cards — pass
// cardsAboveOffset for taller fans.
const CARDS_ABOVE_OFFSET = 34;

interface SecondLine {
  text: string;
  color?: string;
  entering?: EnteringProp;
}

interface Props {
  // Seat point on the table (from seatPoint) — the component centers itself on it.
  x: number;
  y: number;
  width?: number;
  name: string;
  // Avatar ring: neutral by default; gold for hero/winner, loss red for folded/loser…
  ringColor?: string;
  ringWidth?: number;
  // Winner-style glow around the avatar.
  glow?: boolean;
  dimmed?: boolean;
  // Small gold tag on the avatar (table position, dealer…).
  tag?: string;
  plateBorderColor?: string;
  // Second plate line under the name: stack, hand category, status…
  secondLine?: SecondLine | null;
  // In-flow card fans, toward the felt: above the avatar for bottom-half seats, below for
  // top-half seats. The wrapper overlaps the avatar slightly like a real card fan.
  cardsAbove?: ReactNode;
  cardsBelow?: ReactNode;
  // Upward anchor shift applied when cardsAbove is set — roughly the fan's visible height.
  cardsAboveOffset?: number;
  entering?: EnteringProp;
  // Absolutely-positioned extras (dealer button, action bubble, face-down peek cards) —
  // positioned by the caller relative to the pod. The avatar+plate stack paints at zIndex 1,
  // so a child without zIndex renders behind it (peek cards) and zIndex 2+ renders above.
  children?: ReactNode;
}

// One seat pod on a PokerTable: avatar + name plate, with slots for everything a specific
// game wants to hang on it.
export function TableSeat({
  x,
  y,
  width = 80,
  name,
  ringColor = TABLE.neutralBorder,
  ringWidth = 1.5,
  glow = false,
  dimmed = false,
  tag,
  plateBorderColor = 'rgba(255,255,255,0.08)',
  secondLine,
  cardsAbove,
  cardsBelow,
  cardsAboveOffset = CARDS_ABOVE_OFFSET,
  entering = FadeIn.duration(300),
  children,
}: Props) {
  return (
    <Animated.View
      entering={entering}
      pointerEvents="none"
      style={[styles.pod, { width, left: x - width / 2, top: y - 42 - (cardsAbove ? cardsAboveOffset : 0) }]}
    >
      {cardsAbove && <View style={[styles.cards, styles.cardsAbove]}>{cardsAbove}</View>}
      <View style={[styles.podInner, { width }, dimmed && styles.dimmed]}>
        <View style={[styles.avatar, { borderColor: ringColor, borderWidth: ringWidth }, glow && styles.avatarGlow]}>
          <Text style={styles.avatarText}>{initials(name)}</Text>
          {tag ? (
            <View style={styles.tag}>
              <Text style={styles.tagText}>{tag}</Text>
            </View>
          ) : null}
        </View>
        <View style={[styles.plate, { borderColor: plateBorderColor, minWidth: width - 10, maxWidth: width + 20 }]}>
          <Text style={styles.plateName} numberOfLines={1}>
            {name}
          </Text>
          {secondLine ? (
            <Animated.Text
              entering={secondLine.entering}
              style={[styles.plateSecond, { color: secondLine.color ?? TABLE.gold }]}
              numberOfLines={1}
            >
              {secondLine.text}
            </Animated.Text>
          ) : null}
        </View>
      </View>
      {cardsBelow && <View style={[styles.cards, styles.cardsBelow]}>{cardsBelow}</View>}
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  pod: {
    position: 'absolute',
    alignItems: 'center',
  },
  podInner: {
    alignItems: 'center',
    zIndex: 1,
  },
  dimmed: {
    opacity: 0.4,
  },
  // Fans sit BEHIND the avatar/plate stack (zIndex 0 vs 1) and only tuck slightly under it —
  // painting them on top used to clip the plate's second line.
  cards: {
    flexDirection: 'row',
    justifyContent: 'center',
    zIndex: 0,
  },
  cardsAbove: {
    marginBottom: -8,
  },
  cardsBelow: {
    marginTop: -4,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#131A16',
  },
  avatarGlow: {
    shadowColor: TABLE.gold,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.7,
    shadowRadius: 10,
    elevation: 8,
  },
  avatarText: {
    fontSize: fontSize.xs,
    fontFamily: fontFamily.bold,
    color: TABLE.plateText,
  },
  tag: {
    position: 'absolute',
    top: -5,
    right: -10,
    backgroundColor: TABLE.plateBg,
    borderWidth: 1,
    borderColor: TABLE.goldDeep,
    borderRadius: radius.full,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  tagText: {
    fontSize: 8,
    fontFamily: fontFamily.extrabold,
    letterSpacing: 0.5,
    color: TABLE.gold,
  },
  plate: {
    marginTop: -8,
    zIndex: 2,
    alignItems: 'center',
    backgroundColor: TABLE.plateBg,
    borderWidth: 1,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  plateName: {
    fontSize: 10,
    fontFamily: fontFamily.semibold,
    color: TABLE.plateText,
  },
  plateSecond: {
    fontSize: 9,
    fontFamily: fontFamily.bold,
  },
});
