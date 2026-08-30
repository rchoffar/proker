import { useState, type ReactNode } from 'react';
import { View, Text, TouchableOpacity, Pressable, StyleSheet, Dimensions } from 'react-native';
import { X, Plus } from 'lucide-react-native';
import { PokerTable, TABLE, seatPoint } from '../hand/PokerTable';
import { SETUP_TABLE } from '../table/tableSize';
import { PlayingCard } from '../hand/PlayingCard';
import { SeatNameBubble } from './SeatNameBubble';
import { useAuthStore } from '../../store/useAuthStore';
import { initials } from '../../lib/format';
import { fontFamily, radius, spacing } from '../../design-system/theme';
import { useTheme } from '../../design-system/ThemeProvider';
import type { Player } from '../../types';

// The flip/bluff/OFC setup roster, per Mathieu's mockup: a vertical poker table whose
// SEATS are the roster — gold-ringed circles on the rail, "+" when free. Tapping a free
// seat opens the name bubble right there; a filled seat shows the player's initials with
// their name plate and a ⊗ to remove.
//
// The felt centre is the screen's main content, not decoration: callers pass the game name
// and its options in through `center` (see FeltOptions). Without one it falls back to the
// face-down deck and dealer chip that used to be all the felt held.

const SEAT_D = 58;
// The betting line is inset 38pt a side; centre content stays inside it.
const FELT_INSET = 38;

interface Props {
  // Every known player (store) — the bubble suggests the ones not yet seated.
  players: Player[];
  selected: Player[];
  onChange: (selected: Player[]) => void;
  maxPlayers: number;
  /** Rendered on the felt. Receives the width available inside the betting line. */
  center?: (feltWidth: number) => ReactNode;
  /**
   * False when the roster is not the local player's to fill — hosting online, where the
   * seats fill as people join. Empty seats then wait instead of inviting a tap.
   */
  seatsInteractive?: boolean;
  /** Label under an empty seat when it is not interactive ("waiting…"). */
  emptySeatLabel?: string;
  /** Seated players to grey out — an online member who has dropped the connection. */
  dimmedIds?: string[];
}

export function SeatTableBoard({
  players,
  selected,
  onChange,
  maxPlayers,
  center,
  seatsInteractive = true,
  emptySeatLabel,
  dimmedIds,
}: Props) {
  const { colors } = useTheme();
  const [addingSeat, setAddingSeat] = useState<number | null>(null);

  const boardW = SETUP_TABLE.boardWidth;
  const tableW = boardW - SEAT_D;
  const tableH = Math.min(
    Math.round(tableW * SETUP_TABLE.maxAspect),
    Math.round(Dimensions.get('window').height * SETUP_TABLE.heightRatio)
  );
  const boardH = tableH + SEAT_D;
  const pad = SEAT_D / 2; // seats are centered ON the rail, half outside the table box

  // The account pseudo always leads the suggestions: playing pass&play under it is what
  // merges these local games into the same per-pseudo stats as the online ones.
  const pseudo = useAuthStore((s) => s.user?.pseudo) ?? '';
  const known = players
    .filter((p) => !selected.some((s) => s.id === p.id))
    .map((p) => p.name);
  const suggestions = [
    ...(pseudo && !selected.some((p) => p.name === pseudo) ? [pseudo] : []),
    ...known.filter((n) => n !== pseudo),
  ];

  const pickName = (name: string) => {
    const existing = players.find((p) => p.name === name);
    const player = existing ?? { id: `p-${Date.now()}`, name };
    if (!selected.some((p) => p.id === player.id)) onChange([...selected, player]);
  };

  const remove = (id: string) => onChange(selected.filter((p) => p.id !== id));

  return (
    <View style={{ width: boardW, height: boardH, alignSelf: 'center' }}>
      <PokerTable width={tableW} height={tableH} style={{ position: 'absolute', left: pad, top: pad }}>
        {center ? (
          <View style={styles.feltCenter} pointerEvents="box-none">
            {center(tableW - FELT_INSET * 2)}
          </View>
        ) : (
          /* Felt dressing when the caller has nothing to put there. */
          <View style={styles.feltCenter} pointerEvents="none">
            <View style={styles.deckPair}>
              <PlayingCard faceDown size="sm" style={styles.deckLeft} />
              <PlayingCard faceDown size="sm" style={styles.deckRight} />
            </View>
            <View style={styles.dealerChip}>
              <Text style={styles.dealerChipText}>D</Text>
            </View>
          </View>
        )}
      </PokerTable>

      {Array.from({ length: maxPlayers }, (_, k) => {
        const { x, y } = seatPoint(k, maxPlayers, tableW, tableH);
        const cx = x + pad;
        const cy = y + pad;
        const player = selected[k];
        return (
          <View key={k} style={[styles.seatWrap, { left: cx - SEAT_D / 2, top: cy - SEAT_D / 2 }]}>
            {player ? (
              <>
                <View
                  style={[styles.seat, styles.seatFilled, dimmedIds?.includes(player.id) && styles.seatDimmed]}
                >
                  <Text style={styles.seatInitials}>{initials(player.name)}</Text>
                </View>
                <View style={styles.namePlate}>
                  <Text style={styles.namePlateText} numberOfLines={1}>
                    {player.name}
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.removeBadge}
                  onPress={() => remove(player.id)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  activeOpacity={0.7}
                >
                  <X size={11} color={TABLE.plateText} strokeWidth={2.5} />
                </TouchableOpacity>
              </>
            ) : seatsInteractive ? (
              <TouchableOpacity
                style={[styles.seat, { backgroundColor: 'rgba(8,12,10,0.72)' }]}
                onPress={() => setAddingSeat(k)}
                activeOpacity={0.75}
              >
                <Plus size={26} color={colors.accentBright} strokeWidth={2.5} />
              </TouchableOpacity>
            ) : (
              <>
                <View style={[styles.seat, styles.seatWaiting]} />
                {emptySeatLabel ? (
                  <View style={[styles.namePlate, styles.namePlateWaiting]}>
                    <Text style={[styles.namePlateText, styles.namePlateTextWaiting]} numberOfLines={1}>
                      {emptySeatLabel}
                    </Text>
                  </View>
                ) : null}
              </>
            )}
          </View>
        );
      })}

      {addingSeat !== null && (
        <>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setAddingSeat(null)} />
          <SeatNameBubble
            anchor={(() => {
              const { x, y } = seatPoint(addingSeat, maxPlayers, tableW, tableH);
              return { x: x + pad, y: y + pad, below: y < tableH / 2 };
            })()}
            boardWidth={boardW}
            suggestions={suggestions}
            onPick={pickName}
            onClose={() => setAddingSeat(null)}
          />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  seatWrap: {
    position: 'absolute',
    width: SEAT_D,
    alignItems: 'center',
  },
  seat: {
    width: SEAT_D,
    height: SEAT_D,
    borderRadius: SEAT_D / 2,
    borderWidth: 2.5,
    borderColor: TABLE.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  seatFilled: {
    backgroundColor: '#131A16',
  },
  seatDimmed: {
    opacity: 0.45,
  },
  seatWaiting: {
    backgroundColor: 'rgba(8,12,10,0.5)',
    borderStyle: 'dashed',
    borderColor: 'rgba(231,195,111,0.45)',
  },
  seatInitials: {
    color: TABLE.plateText,
    fontSize: 16,
    fontFamily: fontFamily.bold,
  },
  namePlate: {
    marginTop: -6,
    maxWidth: SEAT_D + 34,
    backgroundColor: TABLE.plateBg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  namePlateText: {
    color: TABLE.plateText,
    fontSize: 10,
    fontFamily: fontFamily.semibold,
  },
  namePlateWaiting: {
    backgroundColor: 'rgba(8,12,10,0.55)',
  },
  namePlateTextWaiting: {
    color: 'rgba(255,255,255,0.5)',
    fontFamily: fontFamily.regular,
  },
  removeBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  feltCenter: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  deckPair: {
    flexDirection: 'row',
  },
  deckLeft: {
    transform: [{ rotate: '-8deg' }],
  },
  deckRight: {
    transform: [{ rotate: '8deg' }],
    marginLeft: -14,
    marginTop: 2,
  },
  dealerChip: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#F4EFE4',
    borderWidth: 1,
    borderColor: '#C9BFA8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dealerChipText: {
    fontSize: 11,
    fontFamily: fontFamily.extrabold,
    color: '#1A150F',
  },
});
