import { useState } from 'react';
import { View, Text, TouchableOpacity, Pressable, StyleSheet, Dimensions } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Plus } from 'lucide-react-native';
import { PokerTable } from '../hand/PokerTable';
import { PlayerNameCard } from './PlayerNameCard';
import { SeatNameBubble } from './SeatNameBubble';
import { fontFamily, radius, spacing } from '../../design-system/theme';
import { useTheme } from '../../design-system/ThemeProvider';
import type { Player } from '../../types';

// The roulette setup, per Mathieu's mockup 00000980: a tall poker table whose felt holds
// a 3×3 grid of card slots — each player is a colored card with a ⊗, each free slot a
// dashed « + Ajouter un joueur » card. Tapping a free slot opens the name bubble there.
// The colors carry into the draw (same palette, same order).

export const ROULETTE_MAX_PLAYERS = 9;
const COLS = 3;

interface Props {
  players: Player[];
  selected: Player[];
  onChange: (selected: Player[]) => void;
}

export function RouletteSetupBoard({ players, selected, onChange }: Props) {
  const { t } = useTranslation('games');
  const { colors } = useTheme();
  const [addingSlot, setAddingSlot] = useState<number | null>(null);

  const boardW = Dimensions.get('window').width - spacing.xl * 2;
  const boardH = Math.min(Math.round(boardW * 1.35), Math.round(Dimensions.get('window').height * 0.52));

  // Explicit 3×3 grid on the felt — positions are computed, not flexed, so the add bubble
  // (and the draw's grow animation) can anchor to exact slot centers.
  const rows = Math.ceil(ROULETTE_MAX_PLAYERS / COLS);
  const gap = spacing.md;
  const feltW = boardW - 24 - spacing.base * 2;
  const feltH = boardH - 24 - spacing.base * 2;
  const cardW = Math.min(
    88,
    Math.floor((feltW - gap * (COLS - 1)) / COLS),
    Math.floor(((feltH - gap * (rows - 1)) / rows) * (64 / 90)),
  );
  const cardH = Math.round(cardW * (90 / 64));
  const slotCenter = (i: number) => {
    const col = i % COLS;
    const row = Math.floor(i / COLS);
    return {
      x: boardW / 2 + (col - (COLS - 1) / 2) * (cardW + gap),
      y: boardH / 2 + (row - (rows - 1) / 2) * (cardH + gap),
    };
  };

  const suggestions = players
    .filter((p) => !selected.some((s) => s.id === p.id))
    .map((p) => p.name);

  const pickName = (name: string) => {
    if (selected.length >= ROULETTE_MAX_PLAYERS) return;
    const existing = players.find((p) => p.name === name);
    const player = existing ?? { id: `p-${Date.now()}`, name };
    if (!selected.some((p) => p.id === player.id)) onChange([...selected, player]);
  };

  return (
    <View style={{ width: boardW, height: boardH, alignSelf: 'center' }}>
      <PokerTable width={boardW} height={boardH}>
        {Array.from({ length: ROULETTE_MAX_PLAYERS }, (_, i) => {
          const { x, y } = slotCenter(i);
          const player = selected[i];
          const left = x - cardW / 2;
          const top = y - cardH / 2;
          return player ? (
            <PlayerNameCard
              key={player.id}
              name={player.name}
              color={colors.calendarPalette[i % colors.calendarPalette.length]}
              width={cardW}
              onRemove={() => onChange(selected.filter((p) => p.id !== player.id))}
              style={{ position: 'absolute', left, top }}
            />
          ) : (
            <TouchableOpacity
              key={`slot-${i}`}
              style={[styles.emptySlot, { left, top, width: cardW, height: cardH }]}
              onPress={() => setAddingSlot(i)}
              activeOpacity={0.75}
            >
              <Plus size={22} color="rgba(255,255,255,0.75)" strokeWidth={2} />
              <Text style={styles.emptySlotText} numberOfLines={2}>
                {t('setup.addPlayer')}
              </Text>
            </TouchableOpacity>
          );
        })}
      </PokerTable>

      {addingSlot !== null && (
        <>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setAddingSlot(null)} />
          <SeatNameBubble
            anchor={{ ...slotCenter(addingSlot), below: slotCenter(addingSlot).y < boardH / 2 }}
            boardWidth={boardW}
            suggestions={suggestions}
            onPick={pickName}
            onClose={() => setAddingSlot(null)}
          />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  emptySlot: {
    position: 'absolute',
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: 'rgba(255,255,255,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingHorizontal: 4,
  },
  emptySlotText: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 10,
    fontFamily: fontFamily.medium,
    textAlign: 'center',
  },
});
