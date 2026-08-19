import { useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Pressable } from 'react-native';
import { useTranslation } from 'react-i18next';
import * as Haptics from 'expo-haptics';
import { PlayingCard } from '../hand/PlayingCard';
import { TABLE } from '../hand/PokerTable';
import { fontFamily, fontSize, radius, spacing } from '../../design-system/theme';
import { useTheme } from '../../design-system/ThemeProvider';
import { cardKey } from '../../types/hand';
import type { Card } from '../../types/hand';
import type { OfcGrid, OfcPlacement, RowId } from '../../lib/ofc';
import { ROW_CAPACITY, ROW_IDS } from '../../lib/ofc';

// The draw turn, both variants. Classic: 1 card, tap a row → the placement commits
// immediately (one-tap feel). Pineapple: 3 cards, stage 2 into the rows (tap a staged
// card to take it back), the leftover card previews as the discard, Confirm commits.
// Committed grid cards render read-only; only staged cards are removable. Callers pass a
// `key` per turn so the staging state resets with each new draw.

interface Props {
  cards: Card[]; // the pending draw (1 or 3)
  placeCount: number; // how many of them must be placed (1 or 2)
  grid: OfcGrid; // the actor's committed grid
  discards?: Card[]; // the actor's own past discards (pineapple)
  onCommit: (placements: OfcPlacement[]) => void;
}

const DARK_CARD_BG = 'rgba(255, 255, 255, 0.05)';

export function DrawPlacement({ cards, placeCount, grid, discards, onCommit }: Props) {
  const { t } = useTranslation('ofc');
  const { colors } = useTheme();
  const [staged, setStaged] = useState<OfcPlacement[]>([]);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  const stagedKeys = useMemo(() => new Set(staged.map((p) => cardKey(p.card))), [staged]);
  const tray = cards.filter((card) => !stagedKeys.has(cardKey(card)));
  const done = staged.length === placeCount;
  // Auto-select so the classic single card (and the pineapple leader) is one tap away.
  const activeKey = done ? null : selectedKey ?? (tray[0] ? cardKey(tray[0]) : null);

  const stagedIn = (row: RowId) => staged.filter((p) => p.row === row);
  const capacityLeft = (row: RowId) =>
    ROW_CAPACITY[row] - grid[row].length - stagedIn(row).length;

  const placeInto = (row: RowId) => {
    if (!activeKey || capacityLeft(row) <= 0) return;
    const card = tray.find((c) => cardKey(c) === activeKey);
    if (!card) return;
    Haptics.selectionAsync();
    const next = [...staged, { card, row }];
    if (placeCount === 1) {
      onCommit(next);
      return;
    }
    setStaged(next);
    setSelectedKey(null);
  };

  const takeBack = (placement: OfcPlacement) => {
    Haptics.selectionAsync();
    setStaged((prev) => prev.filter((p) => cardKey(p.card) !== cardKey(placement.card)));
  };

  return (
    <View style={styles.board}>
      <View style={styles.rows}>
        {ROW_IDS.map((row) => {
          const filled = grid[row].length + stagedIn(row).length;
          return (
            <Pressable
              key={row}
              onPress={() => placeInto(row)}
              style={[
                styles.rowZone,
                {
                  backgroundColor: DARK_CARD_BG,
                  borderColor: activeKey && capacityLeft(row) > 0 ? TABLE.gold : colors.onDarkHairline,
                },
              ]}
            >
              <View style={styles.rowLabelCol}>
                <Text style={[styles.rowLabel, { color: colors.onDarkTertiary }]}>{t(`game.rows.${row}`)}</Text>
                <Text style={[styles.rowFillText, { color: colors.onDarkTertiary }]}>
                  {t('game.rowFill', { filled, cap: ROW_CAPACITY[row] })}
                </Text>
              </View>
              <View style={styles.rowCards}>
                {grid[row].map((card) => (
                  <PlayingCard key={cardKey(card)} card={card} size="sm" />
                ))}
                {stagedIn(row).map((placement) => (
                  <TouchableOpacity
                    key={cardKey(placement.card)}
                    onPress={() => takeBack(placement)}
                    activeOpacity={0.7}
                  >
                    <PlayingCard
                      card={placement.card}
                      size="sm"
                      style={{ borderColor: TABLE.gold, borderWidth: 2 }}
                    />
                  </TouchableOpacity>
                ))}
                {Array.from({ length: ROW_CAPACITY[row] - filled }, (_, i) => (
                  <View key={`empty-${i}`} style={[styles.emptySlot, { borderColor: colors.onDarkHairline }]} />
                ))}
              </View>
            </Pressable>
          );
        })}
        <Text style={[styles.orderHint, { color: colors.onDarkTertiary }]}>{t('game.orderHint')}</Text>
      </View>

      <View style={styles.tray}>
        {tray.map((card) => {
          const key = cardKey(card);
          const selected = key === activeKey;
          const isDiscard = done && placeCount > 1;
          return (
            <TouchableOpacity
              key={key}
              onPress={() => setSelectedKey(selected ? null : key)}
              activeOpacity={0.7}
              disabled={isDiscard}
              style={[selected && { transform: [{ translateY: -6 }] }, isDiscard && styles.discardCard]}
            >
              <PlayingCard
                card={card}
                size="md"
                style={selected ? { borderColor: TABLE.gold, borderWidth: 2 } : undefined}
              />
            </TouchableOpacity>
          );
        })}
        {done && placeCount > 1 && (
          <Text style={[styles.trayHint, { color: colors.onDarkTertiary }]}>{t('game.willDiscard')}</Text>
        )}
      </View>

      {placeCount > 1 && (
        <TouchableOpacity
          style={[styles.commitBtn, { backgroundColor: colors.accentBright }, !done && styles.disabledBtn]}
          onPress={() => onCommit(staged)}
          disabled={!done}
          activeOpacity={0.85}
        >
          <Text style={styles.commitText}>{t('game.commit')}</Text>
        </TouchableOpacity>
      )}

      {!!discards?.length && (
        <View style={styles.discardsRow}>
          <Text style={[styles.discardsLabel, { color: colors.onDarkTertiary }]}>{t('game.yourDiscards')}</Text>
          <View style={styles.discardsCards}>
            {discards.map((card) => (
              <View key={cardKey(card)} style={styles.discardCard}>
                <PlayingCard card={card} size="sm" />
              </View>
            ))}
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  board: {
    gap: spacing.md,
  },
  rows: {
    gap: spacing.sm,
  },
  rowZone: {
    borderWidth: 1,
    borderRadius: radius.md,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  rowLabelCol: {
    width: 52,
    gap: 1,
  },
  rowLabel: {
    fontSize: fontSize.xs,
    fontFamily: fontFamily.semibold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  rowFillText: {
    fontSize: fontSize.xs,
    fontFamily: fontFamily.medium,
    opacity: 0.8,
  },
  orderHint: {
    fontSize: fontSize.xs,
    fontFamily: fontFamily.regular,
    textAlign: 'center',
    marginTop: 2,
  },
  rowCards: {
    flexDirection: 'row',
    gap: 4,
    flex: 1,
    flexWrap: 'wrap',
  },
  emptySlot: {
    borderRadius: radius.sm,
    borderWidth: 1,
    borderStyle: 'dashed',
    opacity: 0.6,
    width: 30,
    height: 42,
  },
  tray: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    justifyContent: 'center',
    minHeight: 64,
    alignItems: 'center',
  },
  trayHint: {
    fontSize: fontSize.sm,
    fontFamily: fontFamily.medium,
    maxWidth: 120,
  },
  discardCard: {
    opacity: 0.45,
  },
  commitBtn: {
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  disabledBtn: {
    opacity: 0.4,
  },
  commitText: {
    color: '#0A0A0F',
    fontSize: fontSize.md,
    fontFamily: fontFamily.bold,
  },
  discardsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    justifyContent: 'center',
  },
  discardsLabel: {
    fontSize: fontSize.xs,
    fontFamily: fontFamily.medium,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  discardsCards: {
    flexDirection: 'row',
    gap: 4,
  },
});
