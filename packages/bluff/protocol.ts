import type { Card } from '../ofc/cards.js';
import type { BluffState } from './engine.js';

export interface RedactedPlayer {
  id: string;
  name: string;
  cardCount: number;
  eliminated: boolean;
  connected: boolean;
  jeuMaxAttempts: number;
  jeuMaxSuccesses: number;
  hand?: Card[]; // only the viewer's own hand — everyone's once the round is revealed
}

// What leaves the host device: no boardStock (future middle cards), no foreign hands
// and no face-down middle cards outside the reveal window.
export interface RedactedState extends Omit<BluffState, 'players' | 'boardStock' | 'hiddenBoard'> {
  players: RedactedPlayer[];
  hiddenBoardCount: number; // always present — clients render that many card backs
  hiddenBoard?: Card[]; // only once the round is revealed
}

const PUBLIC_HAND_PHASES = new Set<BluffState['phase']>(['reveal', 'roundEnd', 'gameOver']);

/**
 * The single choke point deciding what a given viewer may see. The host's own UI must
 * render through this too, so a redaction bug is immediately visible at the host's table.
 */
export function redactFor(
  state: BluffState,
  viewerId: string,
  connectedById?: Map<string, boolean>,
): RedactedState {
  const handsPublic = PUBLIC_HAND_PHASES.has(state.phase);
  const { boardStock: _boardStock, hiddenBoard, players, ...rest } = state;
  return {
    ...rest,
    hiddenBoardCount: hiddenBoard.length,
    ...(handsPublic ? { hiddenBoard } : {}),
    players: players.map((p) => ({
      id: p.id,
      name: p.name,
      cardCount: p.cardCount,
      eliminated: p.eliminated,
      connected: connectedById?.get(p.id) ?? true,
      jeuMaxAttempts: p.jeuMaxAttempts,
      jeuMaxSuccesses: p.jeuMaxSuccesses,
      ...(p.id === viewerId || (handsPublic && !p.eliminated) ? { hand: p.hand } : {}),
    })),
  };
}
