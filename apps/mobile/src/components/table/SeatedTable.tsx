import type { ComponentProps, ReactNode } from 'react';
import { StyleSheet, Text, View, type ViewStyle } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { PokerTable, seatPoint, TABLE } from '../hand/PokerTable';
import { TableSeat } from '../hand/TableSeat';
import { CardFan, FAN_GEOMETRY, fanSizeFor, type DealSpec, type FanCard, type FanSize } from './CardFan';
import { fontFamily, radius } from '../../design-system/theme';

// How far along the line from a seat to the pot its chip sits. Far enough in to clear the
// card fan, which occupies the pod's felt-facing side, and short of the board in the middle.
const BLIND_INSET = 0.34;
const BLIND_W = 54;
const BLIND_H = 18;

// One poker table with players seated around it — the layer every card game shares
// (flip, bluff, the hand replayer). Callers pass data: who sits where, what's in their
// hand, what's on the felt. Seat placement, fan geometry, which side of the pod the cards
// hang on, and the deal-from-centre flight all live here, so a layout fix lands in every
// game at once.

type EnteringProp = ComponentProps<typeof Animated.View>['entering'];

export interface SeatFan {
  cards: FanCard[];
  size?: FanSize;
  /** Flip the fan in as one packet, `delay` ms after the deal starts. */
  flipInDelay?: number;
  flipInDuration?: number;
  /** Deal the cards in one by one from the felt centre instead of flipping them in. */
  deal?: { ready: boolean; delayFor: (seatIndex: number, cardIndex: number) => number };
}

export interface SeatSpec {
  id: string;
  name: string;
  ringColor?: string;
  ringWidth?: number;
  glow?: boolean;
  dimmed?: boolean;
  tag?: string;
  plateBorderColor?: string;
  secondLine?: { text: string; color?: string; entering?: EnteringProp } | null;
  fan?: SeatFan;
  /** Floating badge beside the fan (win chance…); always on the fan's right. */
  badge?: ReactNode;
  /** Absolutely-positioned extras relative to the pod (action bubbles…). */
  extras?: ReactNode;
  /**
   * A blind this seat posted, as a chip on the felt between them and the pot — where it sits
   * on a real table. Deliberately narrow: every other bet already announces itself through
   * its action bubble, so a chip for those as well says it twice. Blinds are the exception
   * because posts are filtered out of the bubbles.
   */
  blind?: string;
  entering?: EnteringProp;
}

interface Props {
  width: number;
  height: number;
  seats: SeatSpec[];
  /** Content on the felt (board, pot…). */
  center?: ReactNode;
  /** Absolutely-positioned felt content that must paint BELOW the seat pods. */
  underSeats?: ReactNode;
  /** Overlays drawn above everything (celebrations…). */
  children?: ReactNode;
  seatWidth?: number;
  /**
   * Seats sit exactly on the table's left/right extremes, where fans and long name plates
   * spill past the screen — the ring is squeezed horizontally by this factor. The default is
   * tuned against PLAY_TABLE's width (see tableSize.ts); the two move together.
   */
  squeezeX?: number;
  /**
   * Fans hang below the pod for seats above this fraction of the height, above it for the
   * rest, so they always point toward the felt without landing on the board.
   */
  fanBelowAbove?: number;
  style?: ViewStyle | ViewStyle[];
  /** Re-fires fan entrances on a new deal/round. */
  token?: string | number;
}

export function SeatedTable({
  width,
  height,
  seats,
  center,
  underSeats,
  children,
  seatWidth = 84,
  squeezeX = 0.86,
  fanBelowAbove = 0.5,
  style,
  token = 0,
}: Props) {
  return (
    <PokerTable width={width} height={height} style={style}>
      {center ? (
        <View style={styles.feltCenter} pointerEvents="none">
          {center}
        </View>
      ) : null}

      {underSeats}

      {/* Blinds, on the line between each seat and the pot. Deliberately NOT part of the pod:
          the pod's felt-facing side is where the card fan goes, and chips belong further in
          than the cards anyway — cards in front of the player, money towards the middle. */}
      {seats.map((seat, k) => {
        if (!seat.blind) return null;
        const point = seatPoint(k, seats.length, width, height);
        const x = width / 2 + (point.x - width / 2) * squeezeX;
        const cx = x + (width / 2 - x) * BLIND_INSET;
        const cy = point.y + (height / 2 - point.y) * BLIND_INSET;
        return (
          <Animated.View
            key={`blind-${seat.id}`}
            entering={FadeIn.duration(200)}
            pointerEvents="none"
            style={[styles.blind, { left: cx - BLIND_W / 2, top: cy - BLIND_H / 2, width: BLIND_W }]}
          >
            <Text style={styles.blindText} numberOfLines={1}>
              {seat.blind}
            </Text>
          </Animated.View>
        );
      })}

      {seats.map((seat, k) => {
        const point = seatPoint(k, seats.length, width, height);
        const x = width / 2 + (point.x - width / 2) * squeezeX;
        const y = point.y;
        // Cards toward the felt: below the pod for top-half seats, above it for the rest.
        const cardsBelowPod = y < height * fanBelowAbove;

        let fanNode: ReactNode = null;
        if (seat.fan && seat.fan.cards.length > 0) {
          const size = seat.fan.size ?? fanSizeFor(seat.fan.cards.length, seats.length);
          const geometry = FAN_GEOMETRY[size];
          const deal: DealSpec | null = seat.fan.deal
            ? {
                // Flight start: the vector from the fan's resting centre back to the middle
                // of the felt, where the dealer sits.
                fromX: width / 2 - x,
                fromY: height / 2 - (cardsBelowPod ? y + geometry.aboveOffset : y - geometry.aboveOffset),
                delayFor: (i) => seat.fan!.deal!.delayFor(k, i),
                ready: seat.fan.deal.ready,
              }
            : null;

          fanNode = (
            <CardFan
              cards={seat.fan.cards}
              size={size}
              token={token}
              flipIn={
                deal || seat.fan.flipInDelay === undefined
                  ? null
                  : { delay: seat.fan.flipInDelay, duration: seat.fan.flipInDuration }
              }
              deal={deal}
              badge={seat.badge}
              // Always the same side of the hand, whichever side of the table the seat is on:
              // flipping it per seat made the win chances read as belonging to whoever they
              // happened to sit next to. The felt is wide enough now to keep them all right.
              badgeSide="right"
            />
          );
        }

        const fanSize = seat.fan ? seat.fan.size ?? fanSizeFor(seat.fan.cards.length, seats.length) : 'md';

        return (
          <TableSeat
            key={seat.id}
            x={x}
            y={y}
            width={seatWidth}
            name={seat.name}
            ringColor={seat.ringColor}
            ringWidth={seat.ringWidth}
            glow={seat.glow}
            dimmed={seat.dimmed}
            tag={seat.tag}
            plateBorderColor={seat.plateBorderColor}
            secondLine={seat.secondLine}
            entering={seat.entering}
            cardsAbove={!cardsBelowPod ? fanNode : undefined}
            cardsBelow={cardsBelowPod ? fanNode : undefined}
            cardsAboveOffset={FAN_GEOMETRY[fanSize].aboveOffset}
          >
            {seat.extras}
          </TableSeat>
        );
      })}

      {children}
    </PokerTable>
  );
}

const styles = StyleSheet.create({
  blind: {
    position: 'absolute',
    height: BLIND_H,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: TABLE.goldDeep,
    backgroundColor: TABLE.plateBg,
  },
  blindText: {
    fontSize: 10,
    fontFamily: fontFamily.bold,
    color: TABLE.gold,
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
});
