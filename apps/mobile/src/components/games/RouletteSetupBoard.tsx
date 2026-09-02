import { useRef, useState } from 'react';
import { View, Text, TouchableOpacity, Pressable, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Plus } from 'lucide-react-native';
import { PokerTable } from '../hand/PokerTable';
import { setupTableSize } from '../table/tableSize';
import { fillHeight, useSetupViewport } from './setupViewport';
import { PlayerNameCard } from './PlayerNameCard';
import { SeatNameBubble } from './SeatNameBubble';
import { useSeatedRoster } from './useSeatedRoster';
import { useAuthStore } from '../../store/useAuthStore';
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
  /** Take the height the parent gives instead of a fraction of the screen — the cards on the
   *  felt grow with it. Same contract as SeatTableBoard. */
  fill?: boolean;
}

export function RouletteSetupBoard({ players, selected, onChange, fill = false }: Props) {
  const { t } = useTranslation('games');
  const { colors } = useTheme();
  const [addingSlot, setAddingSlot] = useState<number | null>(null);
  // Slots hold their player, same as the seated boards — and here the slot also picks the
  // colour, so a removal used to recolour everybody below it.
  const { seats, sitAt, standUp } = useSeatedRoster(selected, ROULETTE_MAX_PLAYERS, onChange);
  // Measured when a slot is tapped, for the bubble's keyboard clamp — see SeatNameBubble.
  const boardRef = useRef<View>(null);
  const [boardTopOnScreen, setBoardTopOnScreen] = useState<number | null>(null);
  const openSlot = (i: number) => {
    boardRef.current?.measureInWindow((_x, y) => setBoardTopOnScreen(y));
    setAddingSlot(i);
  };
  const [offeredH, setOfferedH] = useState<number | null>(null);
  const viewportH = useSetupViewport();

  // Same felt as the seated boards, to the point: the roulette has no seats on the rail but
  // its table must still be the table.
  const { width: boardW, height: boardH } = setupTableSize(fill ? fillHeight(offeredH, viewportH) : null);

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

  // The account pseudo always leads the suggestions — same per-pseudo stats merging
  // rationale as SeatTableBoard.
  const pseudo = useAuthStore((s) => s.user?.pseudo) ?? '';
  const known = players
    .filter((p) => !selected.some((s) => s.id === p.id))
    .map((p) => p.name);
  const suggestions = [
    ...(pseudo && !selected.some((p) => p.name === pseudo) ? [pseudo] : []),
    ...known.filter((n) => n !== pseudo),
  ];

  const pickName = (name: string) => {
    if (addingSlot === null) return;
    const existing = players.find((p) => p.name === name);
    sitAt(addingSlot, existing ?? { id: `p-${Date.now()}`, name });
  };

  const board = (
    <View ref={boardRef} style={{ width: boardW, height: boardH, alignSelf: 'center' }}>
      <PokerTable width={boardW} height={boardH}>
        {Array.from({ length: ROULETTE_MAX_PLAYERS }, (_, i) => {
          const { x, y } = slotCenter(i);
          const player = seats[i];
          const left = x - cardW / 2;
          const top = y - cardH / 2;
          return player ? (
            <PlayerNameCard
              key={player.id}
              name={player.name}
              color={colors.calendarPalette[i % colors.calendarPalette.length]}
              width={cardW}
              onRemove={() => standUp(player.id)}
              style={{ position: 'absolute', left, top }}
            />
          ) : (
            <TouchableOpacity
              key={`slot-${i}`}
              style={[styles.emptySlot, { left, top, width: cardW, height: cardH }]}
              onPress={() => openSlot(i)}
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
            boardTopOnScreen={boardTopOnScreen}
            suggestions={suggestions}
            onPick={pickName}
            onClose={() => setAddingSlot(null)}
          />
        </>
      )}
    </View>
  );

  if (!fill) return board;
  return (
    <View style={styles.fillWrap} onLayout={(e) => setOfferedH(e.nativeEvent.layout.height)}>
      {board}
    </View>
  );
}

const styles = StyleSheet.create({
  fillWrap: {
    flex: 1,
    justifyContent: 'center',
  },
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
