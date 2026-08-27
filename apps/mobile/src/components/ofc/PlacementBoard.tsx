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
import type { HandSortMode, OfcPlacement, RowId } from '../../lib/ofc';
import { HAND_SORT_MODES, ROW_CAPACITY, ROW_IDS, sortHand } from '../../lib/ofc';

// Interactive editor for the multi-card commits (initial 5, Fantasy Land 13-16): tap
// a tray card, tap a row to place it, tap a placed card to take it back. Everything stays
// local (freely rearrangeable) until Commit emits ONE engine action. With `discards` > 0
// (pineapple Fantasy Land: 14-16 dealt, 13 placed) the leftover tray cards preview as the
// discards — they are inferred by the engine, never sent.

interface Props {
  hand: Card[];
  onCommit: (placements: OfcPlacement[]) => void;
  commitLabel: string;
  discards?: number; // tray cards intentionally left unplaced (0 = place everything)
}

const DARK_CARD_BG = 'rgba(255, 255, 255, 0.05)';
const INITIAL_TRAY_MAX = 5; // above this the tray is a Fantasy Land hand

export function PlacementBoard({ hand, onCommit, commitLabel, discards = 0 }: Props) {
  const { t } = useTranslation('ofc');
  const { colors } = useTheme();
  const [layout, setLayout] = useState<Record<RowId, Card[]>>({ top: [], middle: [], bottom: [] });
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  // Display-only tray order — placements reference the cards, so sorting commits nothing.
  const [sortMode, setSortMode] = useState<HandSortMode | null>(null);

  const placedKeys = useMemo(
    () => new Set(ROW_IDS.flatMap((row) => layout[row].map(cardKey))),
    [layout],
  );
  // Sort the FULL hand, then filter out placed cards: the pairs mode groups by rank count,
  // and counting the shrinking tray instead made a pair's remaining card jump to the singles
  // block the moment its sibling was placed.
  const ordered = sortMode ? sortHand(hand, sortMode) : hand;
  const tray = ordered.filter((card) => !placedKeys.has(cardKey(card)));
  // A Fantasy Land tray (14-16 cards) is unreadable unsorted — offer the sort filter there.
  const sortable = hand.length > INITIAL_TRAY_MAX;
  const done = tray.length === discards;

  const placeInto = (row: RowId) => {
    if (!selectedKey || layout[row].length >= ROW_CAPACITY[row]) return;
    const card = tray.find((c) => cardKey(c) === selectedKey);
    if (!card) return;
    Haptics.selectionAsync();
    setLayout((prev) => ({ ...prev, [row]: [...prev[row], card] }));
    setSelectedKey(null);
  };

  const takeBack = (row: RowId, card: Card) => {
    Haptics.selectionAsync();
    setLayout((prev) => ({ ...prev, [row]: prev[row].filter((c) => cardKey(c) !== cardKey(card)) }));
  };

  const commit = () => {
    onCommit(ROW_IDS.flatMap((row) => layout[row].map((card) => ({ card, row }))));
  };

  const cardSize = hand.length > 8 ? 'sm' : 'md';

  return (
    <View style={styles.board}>
      <View style={styles.rows}>
        {ROW_IDS.map((row) => (
          <Pressable
            key={row}
            onPress={() => placeInto(row)}
            style={[
              styles.rowZone,
              {
                backgroundColor: DARK_CARD_BG,
                borderColor: selectedKey && layout[row].length < ROW_CAPACITY[row] ? TABLE.gold : colors.onDarkHairline,
              },
            ]}
          >
            <View style={styles.rowLabelCol}>
              <Text style={[styles.rowLabel, { color: colors.onDarkTertiary }]}>{t(`game.rows.${row}`)}</Text>
              <Text style={[styles.rowFillText, { color: colors.onDarkTertiary }]}>
                {t('game.rowFill', { filled: layout[row].length, cap: ROW_CAPACITY[row] })}
              </Text>
            </View>
            <View style={styles.rowCards}>
              {layout[row].map((card) => (
                <TouchableOpacity key={cardKey(card)} onPress={() => takeBack(row, card)} activeOpacity={0.7}>
                  <PlayingCard card={card} size={cardSize} />
                </TouchableOpacity>
              ))}
              {Array.from({ length: ROW_CAPACITY[row] - layout[row].length }, (_, i) => (
                <View
                  key={`empty-${i}`}
                  style={[
                    styles.emptySlot,
                    cardSize === 'sm' ? styles.slotSm : styles.slotMd,
                    { borderColor: colors.onDarkHairline },
                  ]}
                />
              ))}
            </View>
          </Pressable>
        ))}
        <Text style={[styles.orderHint, { color: colors.onDarkTertiary }]}>{t('game.orderHint')}</Text>
      </View>

      {sortable && (
        <View style={styles.sortRow}>
          <Text style={[styles.sortLabel, { color: colors.onDarkTertiary }]}>{t('game.sort.label')}</Text>
          {HAND_SORT_MODES.map((mode) => {
            const active = sortMode === mode;
            return (
              <TouchableOpacity
                key={mode}
                onPress={() => {
                  Haptics.selectionAsync();
                  setSortMode(active ? null : mode);
                }}
                activeOpacity={0.7}
                style={[
                  styles.sortChip,
                  { backgroundColor: DARK_CARD_BG, borderColor: active ? TABLE.gold : colors.onDarkHairline },
                ]}
              >
                <Text style={[styles.sortChipText, { color: active ? TABLE.gold : colors.onDarkSecondary }]}>
                  {t(`game.sort.${mode}`)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      <View style={styles.tray}>
        {tray.map((card) => {
          const key = cardKey(card);
          const selected = key === selectedKey;
          const isDiscard = done && discards > 0;
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
                size={cardSize}
                style={selected ? { borderColor: TABLE.gold, borderWidth: 2 } : undefined}
              />
            </TouchableOpacity>
          );
        })}
        {done && (
          <Text style={[styles.trayHint, { color: colors.onDarkTertiary }]}>
            {discards > 0 ? t('game.willDiscard', { count: discards }) : t('game.allPlaced')}
          </Text>
        )}
      </View>

      <TouchableOpacity
        style={[styles.commitBtn, { backgroundColor: colors.accentBright }, !done && styles.disabledBtn]}
        onPress={commit}
        disabled={!done}
        activeOpacity={0.85}
      >
        <Text style={styles.commitText}>{commitLabel}</Text>
      </TouchableOpacity>
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
  },
  slotSm: {
    width: 30,
    height: 42,
  },
  slotMd: {
    width: 46,
    height: 64,
  },
  tray: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 5,
    justifyContent: 'center',
    minHeight: 46,
    alignItems: 'center',
  },
  sortRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  sortLabel: {
    fontSize: fontSize.xs,
    fontFamily: fontFamily.medium,
    marginRight: 2,
  },
  sortChip: {
    borderWidth: 1,
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
  },
  sortChipText: {
    fontSize: fontSize.xs,
    fontFamily: fontFamily.semibold,
  },
  trayHint: {
    fontSize: fontSize.sm,
    fontFamily: fontFamily.medium,
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
});
