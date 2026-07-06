import { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Club, Spade, Heart, Diamond } from 'lucide-react-native';
import { BottomSheet } from '../ui/BottomSheet';
import { fontFamily, fontSize, radius, spacing } from '../../design-system/theme';
import { useTheme } from '../../design-system/ThemeProvider';
import { RANKS, SUITS, cardKey } from '../../types';
import type { Card, Suit } from '../../types';

interface Props {
  visible: boolean;
  onClose: () => void;
  onComplete: (cards: Card[]) => void;
  disabledCards: Card[];
  slots?: number;
  label?: string;
}

const SUIT_ICONS: Record<Suit, typeof Club> = {
  spades: Spade,
  hearts: Heart,
  clubs: Club,
  diamonds: Diamond,
};

export function CardPicker({ visible, onClose, onComplete, disabledCards, slots = 1, label }: Props) {
  const { colors } = useTheme();
  const [picked, setPicked] = useState<Card[]>([]);

  useEffect(() => {
    if (visible) setPicked([]);
  }, [visible]);

  const disabledKeys = new Set([...disabledCards, ...picked].map(cardKey));

  const handleSelect = (card: Card) => {
    const next = [...picked, card];
    if (next.length >= slots) {
      setPicked([]);
      onComplete(next);
    } else {
      setPicked(next);
    }
  };

  const title =
    slots > 1 ? `${label ?? 'Choisissez une carte'} — carte ${picked.length + 1}/${slots}` : label ?? 'Choisissez une carte';

  return (
    <BottomSheet visible={visible} onClose={onClose} title={title}>
      <View style={styles.grid}>
        {SUITS.map((suit) => {
          const isRed = suit === 'hearts' || suit === 'diamonds';
          const suitColor = isRed ? colors.cardSuitRed : colors.cardSuitBlack;
          const SuitIcon = SUIT_ICONS[suit];
          return (
            <View key={suit} style={styles.row}>
              <View style={styles.suitLabel}>
                <SuitIcon size={16} color={suitColor} fill={suitColor} strokeWidth={0} />
              </View>
              <View style={styles.cells}>
                {RANKS.map((rank) => {
                  const card: Card = { rank, suit };
                  const isDisabled = disabledKeys.has(cardKey(card));
                  return (
                    <TouchableOpacity
                      key={rank}
                      onPress={() => handleSelect(card)}
                      disabled={isDisabled}
                      activeOpacity={0.7}
                      style={[
                        styles.cell,
                        { backgroundColor: colors.cardFaceBg, borderColor: colors.cardFaceBorder },
                        isDisabled && styles.disabled,
                      ]}
                    >
                      <Text style={[styles.rankText, { color: suitColor }]}>{rank}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          );
        })}
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  grid: {
    gap: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  suitLabel: {
    width: 20,
    alignItems: 'center',
  },
  cells: {
    flex: 1,
    flexDirection: 'row',
    gap: 3,
  },
  cell: {
    flex: 1,
    height: 34,
    borderRadius: radius.sm,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankText: {
    fontSize: fontSize.sm,
    fontFamily: fontFamily.extrabold,
  },
  disabled: {
    opacity: 0.25,
  },
});
