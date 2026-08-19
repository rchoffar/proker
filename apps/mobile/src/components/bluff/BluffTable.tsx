import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { View, StyleSheet } from 'react-native';
import Animated, { FlipInEasyY, ZoomIn } from 'react-native-reanimated';
import { PlayingCard } from '../hand/PlayingCard';
import { PokerTable, TABLE, seatPoint } from '../hand/PokerTable';
import { TableSeat } from '../hand/TableSeat';
import type { RevealResult } from '../../lib/bluff';
import { cardKey } from '../../types';
import type { Card } from '../../types';

// The felt is dark in both themes (like the TABLE palette) — theme-invariant loss red,
// bright enough to read on the rail.
const LOSS_ON_FELT = '#FF6B70';

// View model shared by Pass & Play (derived from full BluffState) and online (RedactedState):
// `hand` is only present when those cards are visible to the viewer.
export interface BluffSeatVM {
  id: string;
  name: string;
  cardCount: number;
  eliminated: boolean;
  hand?: Card[];
}

interface Props {
  width: number;
  height: number;
  players: BluffSeatVM[];
  board: Card[];
  turnId: string | null;
  reveal: RevealResult | null;
  // Re-fires entering animations when a new round deals (same trick as flip's handToken).
  roundToken: number;
  children?: ReactNode;
}

const POD_W = 84;

const FAN_ANGLES: Record<number, number[]> = {
  1: [0],
  2: [-6, 6],
  3: [-8, 0, 8],
  4: [-12, -4, 4, 12],
  5: [-14, -7, 0, 7, 14],
};

export function BluffTable({ width, height, players, board, turnId, reveal, roundToken, children }: Props) {
  const { t } = useTranslation('bluff');
  const witnessKeys = new Set((reveal?.witness ?? []).map(cardKey));

  const highlight = (card: Card, node: ReactNode) =>
    witnessKeys.has(cardKey(card)) ? (
      <View style={[styles.witness, { borderColor: TABLE.gold }]}>{node}</View>
    ) : (
      node
    );

  return (
    <PokerTable width={width} height={height} style={styles.table}>
      <View style={styles.feltCenter} pointerEvents="none">
        <View style={styles.boardRow}>
          {board.map((card, i) => (
            <Animated.View key={`board-${roundToken}-${cardKey(card)}`} entering={FlipInEasyY.duration(450).delay(i * 100)}>
              {highlight(card, <PlayingCard card={card} size="md" />)}
            </Animated.View>
          ))}
        </View>
      </View>

      {players.map((p, k) => {
        const { x, y } = seatPoint(k, players.length, width, height);
        const cardsOnTop = y >= height / 2;
        const isTurn = !reveal && !p.eliminated && p.id === turnId;
        const isLoser = reveal?.loserId === p.id;
        const ringColor = isLoser ? LOSS_ON_FELT : isTurn ? TABLE.gold : TABLE.neutralBorder;
        const fanAngles = FAN_ANGLES[p.cardCount] ?? FAN_ANGLES[2];
        const fanSize = p.cardCount >= 4 ? 'sm' : 'md';
        const revealed = reveal !== null && p.hand !== undefined && !p.eliminated;

        const fan = p.eliminated
          ? undefined
          : Array.from({ length: p.cardCount }, (_, i) => {
              const card = revealed ? p.hand![i] : undefined;
              const node = (
                <PlayingCard card={card} faceDown={!revealed} size={fanSize} />
              );
              return (
                <Animated.View
                  key={`${roundToken}-${revealed ? 'up' : 'down'}-${i}`}
                  entering={FlipInEasyY.duration(400).delay(k * 90 + i * 70)}
                  style={[
                    { transform: [{ rotate: `${fanAngles[i] ?? 0}deg` }] },
                    i > 0 && (p.cardCount >= 4 ? styles.fanOverlapTight : styles.fanOverlap),
                    (fanAngles[i] ?? 0) !== 0 && { marginTop: Math.abs(fanAngles[i] ?? 0) * 0.4 },
                  ]}
                >
                  {card ? highlight(card, node) : node}
                </Animated.View>
              );
            });

        const secondLine = p.eliminated
          ? { text: t('table.eliminated'), color: LOSS_ON_FELT }
          : isLoser
            ? {
                text: reveal!.eliminatesLoser ? t('table.eliminatedNow') : t('table.plusOneCard'),
                color: LOSS_ON_FELT,
                entering: ZoomIn.duration(250).delay(400),
              }
            : { text: t('common:cardCount', { count: p.cardCount }), color: TABLE.plateText };

        return (
          <TableSeat
            key={p.id}
            x={x}
            y={y}
            width={POD_W}
            name={p.name}
            ringColor={ringColor}
            ringWidth={isTurn || isLoser ? 2 : 1.5}
            glow={isTurn}
            dimmed={p.eliminated}
            plateBorderColor={isTurn || isLoser ? ringColor : undefined}
            secondLine={secondLine}
            cardsAbove={cardsOnTop ? fan : undefined}
            cardsBelow={cardsOnTop ? undefined : fan}
            cardsAboveOffset={fanSize === 'md' ? 56 : 40}
          />
        );
      })}

      {children}
    </PokerTable>
  );
}

const styles = StyleSheet.create({
  table: {
    alignSelf: 'center',
    // Seat pods are anchored 42px above their ellipse point (plus the card fan for
    // bottom-half seats) — reserve clearance so the top seat never overlaps the caption,
    // same trick as flip's play screen.
    marginVertical: 52,
  },
  feltCenter: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boardRow: {
    flexDirection: 'row',
    gap: 4,
    minHeight: 64,
    alignItems: 'center',
  },
  fanOverlap: {
    marginLeft: -16,
  },
  fanOverlapTight: {
    marginLeft: -14,
  },
  witness: {
    borderWidth: 2,
    borderRadius: 8,
    margin: -2,
  },
});
