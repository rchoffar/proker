import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { Club, Spade, Heart, Diamond } from 'lucide-react-native';
import { PokerChip } from '../ui/PokerChip';
import { fontFamily, radius } from '../../design-system/theme';
import { useTheme } from '../../design-system/ThemeProvider';
import type { Card, Suit } from '../../types';

interface Props {
  card?: Card;
  faceDown?: boolean;
  // Dashed empty slot at card dimensions — "your pick goes here", as opposed to
  // faceDown which means a hidden card.
  placeholder?: boolean;
  // Greyed-out state for showdowns — cards that are not part of the winning hand.
  dimmed?: boolean;
  size?: 'sm' | 'md' | 'lg';
  // Exact width in points; overrides `size`, with all other dimensions derived
  // proportionally from the lg tier. For rows that must fit N cards on any screen.
  width?: number;
  style?: ViewStyle;
}

const SIZES = {
  sm: { width: 30, height: 42, rankSize: 11, centerIcon: 15 },
  md: { width: 46, height: 64, rankSize: 15, centerIcon: 22 },
  lg: { width: 64, height: 90, rankSize: 20, centerIcon: 32 },
} as const;

function dimsForWidth(width: number): { width: number; height: number; rankSize: number; centerIcon: number } {
  return {
    width,
    height: Math.round((width * 90) / 64),
    rankSize: Math.round((width * 20) / 64),
    centerIcon: Math.round((width * 32) / 64),
  };
}

const SUIT_ICONS: Record<Suit, typeof Club> = {
  clubs: Club,
  spades: Spade,
  hearts: Heart,
  diamonds: Diamond,
};

export function PlayingCard({ card, faceDown = false, placeholder = false, dimmed = false, size = 'md', width, style }: Props) {
  const { colors } = useTheme();
  const dims = width !== undefined ? dimsForWidth(width) : SIZES[size];

  if (placeholder) {
    return (
      <View
        style={[
          styles.base,
          styles.placeholder,
          { width: dims.width, height: dims.height, backgroundColor: colors.neutralTileBg, borderColor: colors.hairline },
          // An empty slot has nothing to darken — it just recedes.
          dimmed && styles.placeholderDimmed,
          style,
        ]}
      />
    );
  }

  if (faceDown || !card) {
    return (
      <View
        style={[
          styles.base,
          { width: dims.width, height: dims.height, backgroundColor: '#1B1D24', borderColor: 'rgba(255,255,255,0.14)' },
          styles.backCenter,
          style,
        ]}
      >
        <PokerChip size={dims.width * 0.7} color="rgba(255,255,255,0.18)" />
        {dimmed && <View style={styles.dimScrim} pointerEvents="none" />}
      </View>
    );
  }

  const isRed = card.suit === 'hearts' || card.suit === 'diamonds';
  const suitColor = isRed ? colors.cardSuitRed : colors.cardSuitBlack;
  const SuitIcon = SUIT_ICONS[card.suit];

  return (
    <View
      style={[
        styles.base,
        { width: dims.width, height: dims.height, backgroundColor: colors.cardFaceBg, borderColor: colors.cardFaceBorder },
        style,
      ]}
    >
      <View style={styles.corner}>
        <Text style={[styles.rank, { fontSize: dims.rankSize, color: suitColor }]}>{card.rank}</Text>
      </View>
      <View style={styles.center}>
        <SuitIcon size={dims.centerIcon} color={suitColor} fill={suitColor} strokeWidth={0} />
      </View>
      <View style={[styles.corner, styles.cornerBottom]}>
        <Text style={[styles.rank, { fontSize: dims.rankSize, color: suitColor }]}>{card.rank}</Text>
      </View>
      {dimmed && <View style={styles.dimScrim} pointerEvents="none" />}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.sm,
    borderWidth: 1,
    overflow: 'hidden',
  },
  backCenter: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholder: {
    borderStyle: 'dashed',
  },
  placeholderDimmed: {
    opacity: 0.35,
  },
  // Out-of-play cards (non-winning at showdown) darken instead of fading: a translucent
  // card let the felt bleed through and read as a rendering glitch. The scrim clips to
  // the card's rounded corners via `base`'s overflow: hidden.
  dimScrim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(10, 12, 16, 0.6)',
  },
  corner: {
    position: 'absolute',
    top: 3,
    left: 4,
    alignItems: 'center',
    gap: 1,
  },
  cornerBottom: {
    top: undefined,
    left: undefined,
    bottom: 3,
    right: 4,
    transform: [{ rotate: '180deg' }],
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rank: {
    fontFamily: fontFamily.extrabold,
    lineHeight: undefined,
  },
});
