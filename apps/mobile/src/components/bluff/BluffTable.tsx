import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { View, StyleSheet } from 'react-native';
import Animated, { FlipInEasyY, ZoomIn } from 'react-native-reanimated';
import { PlayingCard } from '../hand/PlayingCard';
import { TABLE } from '../hand/PokerTable';
import { SeatedTable } from '../table/SeatedTable';
import { TableWordmark } from '../table/TableWordmark';
import type { RevealResult } from '../../lib/bluff';
import { spacing } from '../../design-system/theme';
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
  // Face-down middle cards: backs while `hiddenBoard` is undefined, flipped up once the
  // caller passes the revealed cards (reveal/roundEnd/gameOver phases only).
  hiddenCount: number;
  hiddenBoard?: Card[];
  turnId: string | null;
  reveal: RevealResult | null;
  // Re-fires entering animations when a new round deals (same trick as flip's handToken).
  roundToken: number;
  // The standing call, or the round's result — ON the felt, above the board. It used to sit
  // above the table, where it ran into the header title and pushed the felt off the bottom
  // of the screen ("met les annonces au milieu de la table").
  announcement?: ReactNode;
  children?: ReactNode;
}

const POD_W = 84;

/**
 * Vertical margin the felt keeps for its seat pods: they are anchored 42pt above their point
 * on the ellipse (plus the card fan for bottom-half seats). Exported because a screen sizing
 * the felt to its measured space has to take this off first — it is clearance, not felt.
 */
export const BLUFF_TABLE_MARGIN_Y = 52;

export function BluffTable({ width, height, players, board, hiddenCount, hiddenBoard, turnId, reveal, roundToken, announcement, children }: Props) {
  const { t } = useTranslation('bluff');
  const witnessKeys = new Set((reveal?.witness ?? []).map(cardKey));
  // A failed Jeu Max's counter-example: the smallest higher combination that exists.
  const higherWitnessKeys = new Set((reveal?.higherWitness ?? []).map(cardKey));

  // The fan takes a colour (CardFan draws the border itself); the board still wraps nodes.
  const highlightColor = (card: Card): string | undefined =>
    higherWitnessKeys.has(cardKey(card))
      ? LOSS_ON_FELT
      : witnessKeys.has(cardKey(card))
        ? TABLE.gold
        : undefined;

  const highlight = (card: Card, node: ReactNode) =>
    higherWitnessKeys.has(cardKey(card)) ? (
      <View style={[styles.witness, { borderColor: LOSS_ON_FELT }]}>{node}</View>
    ) : witnessKeys.has(cardKey(card)) ? (
      <View style={[styles.witness, { borderColor: TABLE.gold }]}>{node}</View>
    ) : (
      node
    );

  return (
    <SeatedTable
      width={width}
      height={height}
      style={styles.table}
      token={roundToken}
      seatWidth={POD_W}
      // Bluff seats sit higher on the rail than the other games: a side seat fanning
      // downward would drop its cards onto the middle row.
      fanBelowAbove={0.18}
      seats={players.map((p, k) => {
        const isTurn = !reveal && !p.eliminated && p.id === turnId;
        const isLoser = reveal?.loserId === p.id;
        const ringColor = isLoser ? LOSS_ON_FELT : isTurn ? TABLE.gold : TABLE.neutralBorder;
        const revealed = reveal !== null && p.hand !== undefined && !p.eliminated;
        const shedsCard =
          reveal?.kind === 'jeuMax' && reveal.jeuMaxSuccess === true && p.id === reveal.catcherId;
        const secondLine = p.eliminated
          ? { text: t('table.eliminated'), color: LOSS_ON_FELT }
          : shedsCard
            ? {
                text: t('table.minusOneCard'),
                color: TABLE.gold,
                entering: ZoomIn.duration(250).delay(400),
              }
            : isLoser
              ? {
                  text: reveal!.eliminatesLoser ? t('table.eliminatedNow') : t('table.plusOneCard'),
                  color: LOSS_ON_FELT,
                  entering: ZoomIn.duration(250).delay(400),
                }
              : { text: t('common:cardCount', { count: p.cardCount }), color: TABLE.plateText };

        return {
          id: p.id,
          name: p.name,
          ringColor,
          ringWidth: isTurn || isLoser ? 2 : 1.5,
          glow: isTurn,
          dimmed: p.eliminated,
          plateBorderColor: isTurn || isLoser ? ringColor : undefined,
          secondLine,
          fan: p.eliminated
            ? undefined
            : {
                cards: Array.from({ length: p.cardCount }, (_, i) => {
                  const card = revealed ? p.hand![i] : undefined;
                  return {
                    card,
                    faceDown: !revealed,
                    highlightColor: card ? highlightColor(card) : undefined,
                  };
                }),
                flipInDelay: k * 90,
              },
        };
      })}
      center={
        <View style={styles.feltCenter}>
          {announcement}
          <View style={styles.boardRow}>
          {board.map((card, i) => (
            <Animated.View key={`board-${roundToken}-${cardKey(card)}`} entering={FlipInEasyY.duration(450).delay(i * 100)}>
              {highlight(card, <PlayingCard card={card} size="md" />)}
            </Animated.View>
          ))}
          {hiddenBoard
            ? hiddenBoard.map((card, i) => (
                <Animated.View
                  key={`hidden-up-${roundToken}-${cardKey(card)}`}
                  entering={FlipInEasyY.duration(450).delay((board.length + i) * 100)}
                >
                  {highlight(card, <PlayingCard card={card} size="md" />)}
                </Animated.View>
              ))
            : Array.from({ length: hiddenCount }, (_, i) => (
                <Animated.View
                  key={`hidden-down-${roundToken}-${i}`}
                  entering={FlipInEasyY.duration(450).delay((board.length + i) * 100)}
                >
                  <PlayingCard faceDown size="md" />
                </Animated.View>
              ))}
          </View>
          <TableWordmark />
        </View>
      }
    >
      {children}
    </SeatedTable>
  );
}

const styles = StyleSheet.create({
  table: {
    alignSelf: 'center',
    marginVertical: BLUFF_TABLE_MARGIN_Y,
  },
  feltCenter: {
    alignItems: 'center',
    gap: spacing.base,
  },
  boardRow: {
    flexDirection: 'row',
    gap: 4,
    minHeight: 64,
    alignItems: 'center',
  },
  witness: {
    borderWidth: 2,
    borderRadius: 8,
    margin: -2,
  },
});
