import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { Club, Spade, Heart, Diamond } from 'lucide-react-native';
import { PokerChip } from '../ui/PokerChip';
import { fontFamily, radius } from '../../design-system/theme';
import { useTheme } from '../../design-system/ThemeProvider';
import type { Card, Suit } from '../../types';

interface Props {
  card?: Card;
  faceDown?: boolean;
  size?: 'sm' | 'md' | 'lg';
  style?: ViewStyle;
}

const SIZES = {
  sm: { width: 30, height: 42, rankSize: 11, cornerIcon: 9, centerIcon: 15 },
  md: { width: 46, height: 64, rankSize: 15, cornerIcon: 12, centerIcon: 22 },
  lg: { width: 64, height: 90, rankSize: 20, cornerIcon: 16, centerIcon: 32 },
} as const;

const SUIT_ICONS: Record<Suit, typeof Club> = {
  clubs: Club,
  spades: Spade,
  hearts: Heart,
  diamonds: Diamond,
};

export function PlayingCard({ card, faceDown = false, size = 'md', style }: Props) {
  const { colors } = useTheme();
  const dims = SIZES[size];

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
        <SuitIcon size={dims.cornerIcon} color={suitColor} fill={suitColor} strokeWidth={0} />
      </View>
      <View style={styles.center}>
        <SuitIcon size={dims.centerIcon} color={suitColor} fill={suitColor} strokeWidth={0} />
      </View>
      <View style={[styles.corner, styles.cornerBottom]}>
        <Text style={[styles.rank, { fontSize: dims.rankSize, color: suitColor }]}>{card.rank}</Text>
        <SuitIcon size={dims.cornerIcon} color={suitColor} fill={suitColor} strokeWidth={0} />
      </View>
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
