import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { BottomSheet } from '../ui/BottomSheet';
import { PlayingCard } from './PlayingCard';
import { fontFamily, fontSize, spacing } from '../../design-system/theme';
import { useTheme } from '../../design-system/ThemeProvider';
import { RANKS, SUITS, cardKey } from '../../types';
import type { Card } from '../../types';

interface Props {
  visible: boolean;
  onClose: () => void;
  onSelect: (card: Card) => void;
  disabledCards: Card[];
  title?: string;
}

export function CardPicker({ visible, onClose, onSelect, disabledCards, title = 'Choisissez une carte' }: Props) {
  const { colors } = useTheme();
  const disabledKeys = new Set(disabledCards.map(cardKey));

  return (
    <BottomSheet visible={visible} onClose={onClose} title={title}>
      <View style={styles.grid}>
        {RANKS.map((rank) => (
          <View key={rank} style={styles.row}>
            <Text style={[styles.rankLabel, { color: colors.textSecondary }]}>{rank}</Text>
            <View style={styles.suits}>
              {SUITS.map((suit) => {
                const card: Card = { rank, suit };
                const isDisabled = disabledKeys.has(cardKey(card));
                return (
                  <TouchableOpacity
                    key={suit}
                    onPress={() => onSelect(card)}
                    disabled={isDisabled}
                    activeOpacity={0.7}
                    style={isDisabled ? styles.disabled : undefined}
                  >
                    <PlayingCard card={card} size="sm" />
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        ))}
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
    gap: spacing.md,
  },
  rankLabel: {
    width: 20,
    fontSize: fontSize.md,
    fontFamily: fontFamily.bold,
    textAlign: 'center',
  },
  suits: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  disabled: {
    opacity: 0.25,
  },
});
