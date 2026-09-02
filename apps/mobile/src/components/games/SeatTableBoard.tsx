import { useRef, useState, type ReactNode } from 'react';
import { View, Text, TouchableOpacity, Pressable, StyleSheet } from 'react-native';
import { X, Plus } from 'lucide-react-native';
import { PokerTable, TABLE, seatPoint } from '../hand/PokerTable';
import { SETUP_SQUEEZE_X, SETUP_TABLE, setupTableSize } from '../table/tableSize';
import { fillHeight, subtract, useSetupViewport } from './setupViewport';
import { PlayingCard } from '../hand/PlayingCard';
import { SeatNameBubble } from './SeatNameBubble';
import { useSeatedRoster } from './useSeatedRoster';
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

const SEAT_D = SETUP_TABLE.seatDiameter;

// How far a filled seat's name plate reaches below its circle: a ~19pt plate (10pt text,
// 2pt padding, 1pt border) pulled up by styles.namePlate's marginTop of -6.
const PLATE_BELOW_SEAT = 14;
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
  /**
   * Take the height the parent gives instead of a fraction of the screen. The setup screens
   * hand the table whatever is left between the mode switch and the CTA, so the felt fills
   * the screen rather than floating in it.
   */
  fill?: boolean;
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
  fill = false,
}: Props) {
  const { colors } = useTheme();
  const [addingSeat, setAddingSeat] = useState<number | null>(null);
  // A seat holds the player put in it: the roster's own order cannot express a gap, so it is
  // the seats that say who sits where, and they emit the roster in seat order.
  const { seats, sitAt, standUp } = useSeatedRoster(selected, maxPlayers, onChange);
  // Measured when a seat is tapped, for the bubble's keyboard clamp — the board only knows
  // its own coordinates, and the keyboard comes in screen ones.
  const boardRef = useRef<View>(null);
  const [boardTopOnScreen, setBoardTopOnScreen] = useState<number | null>(null);
  const openSeat = (k: number) => {
    boardRef.current?.measureInWindow((_x, y) => setBoardTopOnScreen(y));
    setAddingSeat(k);
  };
  // Measured on the first layout pass when filling. Until then the board keeps its old
  // screen-fraction height, so it renders at roughly the right size straight away.
  const [offeredH, setOfferedH] = useState<number | null>(null);
  const viewportH = useSetupViewport();

  const boardW = SETUP_TABLE.boardWidth;

  // Seats sit ON the rail, half outside the felt — but only where a seat actually is. Three
  // players put nobody at the top of the oval (the ring is bottom, upper-left, upper-right),
  // and the half-seat reserved up there was a gap under the header, which is what OFC showed.
  // The fractions are the seat ring's shape, so they hold at any table height.
  const seatYFractions = Array.from({ length: maxPlayers }, (_, k) => seatPoint(k, maxPlayers, 1, 1).y);
  const topmost = Math.min(...seatYFractions);
  const bottommost = Math.max(...seatYFractions);
  // `extra` is whatever hangs below the seat circle on top of the circle itself. Only the
  // bottom of the board has any: a seat's name plate sits under it, and reserving just the
  // half circle left the plate to fall under the sticky CTA — "le pseudo en bas disparaît".
  const overhang = (fraction: number, extra = 0) => Math.max(0, Math.round(SEAT_D / 2 + extra - fraction));

  // Padding and felt height depend on each other; two passes settle it, since each pad is
  // either the full overhang or nothing.
  let padTop = SEAT_D / 2;
  let padBottom = SEAT_D / 2 + PLATE_BELOW_SEAT;
  let size = setupTableSize(fill ? subtract(fillHeight(offeredH, viewportH), padTop + padBottom) : null);
  for (let pass = 0; pass < 2; pass++) {
    padTop = overhang(topmost * size.height);
    padBottom = overhang((1 - bottommost) * size.height, PLATE_BELOW_SEAT);
    size = setupTableSize(fill ? subtract(fillHeight(offeredH, viewportH), padTop + padBottom) : null);
  }
  const tableW = size.width;
  const tableH = size.height;
  const boardH = padTop + tableH + padBottom;
  // Horizontally, whatever the content area has left over the felt — the squeeze below
  // covers the rest.
  const padX = Math.max(0, Math.round((boardW - tableW) / 2));

  // A seat's place on the rail, pulled in from the horizontal extremes so its circle and name
  // plate stay on screen — the same trick SeatedTable plays with the play table's pods.
  const seatCenter = (k: number) => {
    const { x, y } = seatPoint(k, maxPlayers, tableW, tableH);
    return { cx: tableW / 2 + (x - tableW / 2) * SETUP_SQUEEZE_X + padX, cy: y + padTop };
  };

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
    if (addingSeat === null) return;
    const existing = players.find((p) => p.name === name);
    sitAt(addingSeat, existing ?? { id: `p-${Date.now()}`, name });
  };

  const board = (
    <View ref={boardRef} style={{ width: boardW, height: boardH, alignSelf: 'center' }}>
      <PokerTable width={tableW} height={tableH} style={{ position: 'absolute', left: padX, top: padTop }}>
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
        const { cx, cy } = seatCenter(k);
        const player = seats[k];
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
                  onPress={() => standUp(player.id)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  activeOpacity={0.7}
                >
                  <X size={11} color={TABLE.plateText} strokeWidth={2.5} />
                </TouchableOpacity>
              </>
            ) : seatsInteractive ? (
              <TouchableOpacity
                style={[styles.seat, { backgroundColor: 'rgba(8,12,10,0.72)' }]}
                onPress={() => openSeat(k)}
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
              const { cx, cy } = seatCenter(addingSeat);
              return { x: cx, y: cy, below: cy - padTop < tableH / 2 };
            })()}
            boardWidth={boardW}
            boardTopOnScreen={boardTopOnScreen}
            suggestions={suggestions}
            onPick={pickName}
            onClose={() => setAddingSeat(null)}
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
