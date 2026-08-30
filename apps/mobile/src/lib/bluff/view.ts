import type { BluffPhase, BluffState } from './engine';
import type { Claim } from './claims';
import type { RedactedPlayer, RedactedState } from './protocol';
import type { Card } from '../../types';

// Everything the two Bluff screens derive from a game state, in one react-free place.
//
// Pass & Play and online render the same felt from two different sources, so each screen
// used to work out "whose turn is it", "may I call liar", "what does the caption say" and
// "what goes in each seat" for itself — the same rules written twice, drifting apart. The
// difference between the modes is not the rules; it is only WHO is looking, so that is the
// input: a redacted state plus the id of the viewer it was redacted for.
//
// Captions come back as key + params, never as a translated string: src/lib is free of
// react and i18n by convention (see labels.ts), and the keys are literal unions so `t()`
// still type-checks them against the generated resource types.

/** Hands are public to the whole table only once the round has been called. */
const PUBLIC_HAND_PHASES = new Set<BluffPhase>(['reveal', 'roundEnd', 'gameOver']);

export type BluffCaption =
  | { kind: 'none' }
  /** The standing claim, rendered through `claimLabel`. */
  | { kind: 'claim'; claim: Claim }
  | {
      kind: 'text';
      key:
        | 'game.chooseBoardYou'
        | 'game.chooseBoardOther'
        | 'game.openBiddingYou'
        | 'game.openBiddingOther';
      name?: string;
    };

export interface BluffPlayView {
  /** True in the phases where every surviving hand is shown face-up. */
  handsPublic: boolean;
  /** Seat order, rotated to put the viewer first only when the mode asks for it. */
  orderedPlayers: RedactedPlayer[];
  viewer: RedactedPlayer | null;
  turnPlayer: RedactedPlayer | null;
  starter: RedactedPlayer | null;
  winner: RedactedPlayer | null;
  isViewerTurn: boolean;
  isViewerStarter: boolean;
  canCatch: boolean;
  mustCatch: boolean;
  caption: BluffCaption;
}

export interface BluffViewOptions {
  /** The id `redactFor` was called with: the acting player locally, this device online. */
  viewerId: string;
  /** Online seats the viewer at the bottom; on a shared phone the seats must not move. */
  rotateToViewer: boolean;
  /** Online says "your turn"; a shared phone names the player out loud instead. */
  addressViewerAsYou: boolean;
}

export function bluffPlayView(view: RedactedState, opts: BluffViewOptions): BluffPlayView {
  const { viewerId, rotateToViewer, addressViewerAsYou } = opts;
  const { phase, players } = view;
  const handsPublic = PUBLIC_HAND_PHASES.has(phase);

  const viewer = players.find((p) => p.id === viewerId) ?? null;
  const turnPlayer = players.find((p) => p.id === view.turnId) ?? null;
  const starter = players.find((p) => p.id === view.starterId) ?? null;
  const winner = view.winnerId ? players.find((p) => p.id === view.winnerId) ?? null : null;

  const viewerIdx = players.findIndex((p) => p.id === viewerId);
  const orderedPlayers =
    rotateToViewer && viewerIdx > 0
      ? [...players.slice(viewerIdx), ...players.slice(0, viewerIdx)]
      : players;

  // Online only lets you act on your own turn; on a shared phone the person holding it is
  // by definition the one to act, so `isViewerTurn` is true whenever someone is to act.
  const isViewerTurn = view.turnId === viewerId && !viewer?.eliminated;
  const isViewerStarter = view.starterId === viewerId;

  const canCatch = phase === 'bidding' && isViewerTurn && view.claimHistory.length > 0;
  // A royal flush cannot be raised — the only legal reply is to call it.
  const mustCatch = view.currentClaim?.category === 'royalFlush';

  const caption = captionFor(view, {
    isViewerTurn,
    isViewerStarter,
    addressViewerAsYou,
    turnPlayer,
    starter,
  });

  return {
    handsPublic,
    orderedPlayers,
    viewer,
    turnPlayer,
    starter,
    winner,
    isViewerTurn,
    isViewerStarter,
    canCatch,
    mustCatch,
    caption,
  };
}

function captionFor(
  view: RedactedState,
  ctx: {
    isViewerTurn: boolean;
    isViewerStarter: boolean;
    addressViewerAsYou: boolean;
    turnPlayer: RedactedPlayer | null;
    starter: RedactedPlayer | null;
  },
): BluffCaption {
  const { phase } = view;
  if (phase === 'chooseBoard') {
    return ctx.addressViewerAsYou && ctx.isViewerStarter
      ? { kind: 'text', key: 'game.chooseBoardYou' }
      : { kind: 'text', key: 'game.chooseBoardOther', name: ctx.starter?.name };
  }
  if (phase === 'bidding') {
    if (view.currentClaim) return { kind: 'claim', claim: view.currentClaim };
    return ctx.addressViewerAsYou && ctx.isViewerTurn
      ? { kind: 'text', key: 'game.openBiddingYou' }
      : { kind: 'text', key: 'game.openBiddingOther', name: ctx.turnPlayer?.name };
  }
  return { kind: 'none' };
}

/** A seat as the table draws it. Structurally a `BluffSeatVM`, without importing one —
 *  src/lib must not depend on components. */
export interface BluffSeatData {
  id: string;
  name: string;
  cardCount: number;
  eliminated: boolean;
  hand?: Card[];
}

/**
 * The seats for the shared felt.
 *
 * This is the one function that must not be inlined again. `redactFor` hands the viewer
 * their OWN hand in every phase — that is the point of it, the device needs those cards to
 * draw the private zone — so forwarding `p.hand` straight into a seat puts the acting
 * player's cards face-up on the table everyone is looking at. The felt shows a hand only
 * once the round has been called, and never for an eliminated player.
 */
export function bluffSeatData(
  v: BluffPlayView,
  /** Online suffixes the viewer's own plate with "(you)"; a shared phone does not. */
  labelFor: (p: RedactedPlayer) => string = (p) => p.name,
): BluffSeatData[] {
  return v.orderedPlayers.map((p) => ({
    id: p.id,
    name: labelFor(p),
    cardCount: p.cardCount,
    eliminated: p.eliminated,
    hand: v.handsPublic && !p.eliminated ? p.hand : undefined,
  }));
}

/** Re-exported so a screen can type its state without reaching into the engine. */
export type { BluffState, RedactedState };
