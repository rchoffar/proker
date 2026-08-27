import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Club, Spade, Heart, Diamond } from 'lucide-react-native';
import { fontFamily, fontSize, radius, spacing } from '../../design-system/theme';
import { useTheme } from '../../design-system/ThemeProvider';
import { RANKS, SUITS, cardKey } from '../../types';
import type { Card, Suit } from '../../types';

interface Props {
  // The card group's slots (2 hero, 3 flop, 1 turn/river…). Holes stay in place: deselecting
  // the first hero card must not shift the second one into slot 0.
  value: (Card | undefined)[];
  onChange: (next: (Card | undefined)[]) => void;
  // Cards owned by OTHER groups — unpressable here.
  disabledCards: Card[];
  label?: string;
}

const SUIT_ICONS: Record<Suit, typeof Club> = {
  spades: Spade,
  hearts: Heart,
  clubs: Club,
  diamonds: Diamond,
};

export function CardGrid({ value, onChange, disabledCards, label }: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();

  const selectedKeys = new Set(value.filter(Boolean).map((c) => cardKey(c!)));
  const disabledKeys = new Set(disabledCards.map(cardKey));
  const pickedCount = value.filter(Boolean).length;
  const full = pickedCount >= value.length;

  const handlePress = (card: Card) => {
    const key = cardKey(card);
    if (selectedKeys.has(key)) {
      onChange(value.map((c) => (c && cardKey(c) === key ? undefined : c)));
      return;
    }
    if (full) return; // deselect first — the grid is the editor, no separate re-edit mode
    const next = [...value];
    next[next.findIndex((c) => !c)] = card;
    onChange(next);
  };

  return (
    <View style={styles.wrap}>
      {label || value.length > 1 ? (
        <Text style={[styles.counter, { color: colors.textSecondary }]}>
          {label ? `${label} — ` : ''}
          {pickedCount}/{t('common:cardCount', { count: value.length })}
        </Text>
      ) : null}
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
                  const key = cardKey(card);
                  const isSelected = selectedKeys.has(key);
                  const isDisabled = disabledKeys.has(key);
                  return (
                    <TouchableOpacity
                      key={rank}
                      onPress={() => handlePress(card)}
                      disabled={isDisabled}
                      activeOpacity={0.7}
                      style={[
                        styles.cell,
                        { backgroundColor: colors.cardFaceBg, borderColor: colors.cardFaceBorder },
                        isSelected && {
                          borderColor: colors.accent,
                          // Solid light green, NOT accentTint: the translucent tint over a dark
                          // screen made the black pips unreadable in dark scheme.
                          backgroundColor: colors.cardFaceSelectedBg,
                          borderWidth: 1.5,
                        },
                        isDisabled && styles.disabled,
                      ]}
                    >
                      <Text style={[styles.rankText, { color: suitColor }]}>{rank}</Text>
                      <SuitIcon size={11} color={suitColor} fill={suitColor} strokeWidth={0} />
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: spacing.sm,
  },
  counter: {
    fontSize: fontSize.sm,
    fontFamily: fontFamily.medium,
  },
  grid: {
    gap: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  suitLabel: {
    width: 16,
    alignItems: 'center',
  },
  cells: {
    flex: 1,
    flexDirection: 'row',
    gap: 2,
  },
  cell: {
    flex: 1,
    height: 54,
    borderRadius: radius.sm,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  rankText: {
    fontSize: fontSize.md,
    fontFamily: fontFamily.extrabold,
  },
  disabled: {
    opacity: 0.25,
  },
});
