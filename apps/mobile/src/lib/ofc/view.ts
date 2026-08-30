import type { OfcPhase, OfcState } from './engine';
import type { RedactedOfcPlayer, RedactedOfcState } from './protocol';
import type { OfcGrid } from './evaluator';

// Everything the two OFC screens derive from a game state, in one react-free place —
// the sibling of lib/bluff/view.ts, and the same reason for existing: Pass & Play and
// online worked out "who is acting", "what are they placing", "which seats go in the
// strip" and "what does the caption say" separately, from two sources.
//
// The two modes ask the same question about a different player. On a shared phone it is
// "who acts next" (and the phone is handed to them); online it is "am I acting". So the
// shared primitive is `ofcActorRole(view, playerId)`, and each mode supplies the id.
//
// Captions come back as key + params, never as a translated string: src/lib is free of
// react and i18n by convention (see bluff/labels.ts).

/** A viewer id matching no player: the shared table shows only what the room may see. */
export const TABLE_VIEWER = '@table';

const REVEAL_PHASES = new Set<OfcPhase>(['scoring', 'gameOver']);

/** What a player is being asked to place right now, if anything. */
export type OfcActorRole = 'fantasy' | 'initial' | 'draw' | null;

export function ofcActorRole(view: RedactedOfcState, playerId: string | null): OfcActorRole {
  if (!playerId || view.phase !== 'placing') return null;
  const p = view.players.find((x) => x.id === playerId);
  if (!p || p.eliminated) return null;
  if (p.inFantasyLand && !p.fantasyPlaced && (p.hand?.length ?? 0) > 0) return 'fantasy';
  // The owner-only `cards` field doubles as the type guard: without it there is nothing
  // to place, only a count to show the room.
  if (view.pending?.playerId === playerId && view.pending.cards) return 'draw';
  if (!p.inFantasyLand && view.placeRound === 0 && view.turnId === playerId && (p.hand?.length ?? 0) > 0) {
    return 'initial';
  }
  return null;
}

/**
 * Whose turn it is to hold the phone in Pass & Play: Fantasy Land players arrange first
 * (their look is private, so it wants the handoff lock), then the normal rotation.
 *
 * Takes the full state rather than a redacted one, because the redaction depends on the
 * answer — this is what decides which viewer to redact for.
 */
export function ofcLocalActorId(state: OfcState): string | null {
  if (state.phase !== 'placing') return null;
  const fantasy = state.players.find((p) => !p.eliminated && p.inFantasyLand && !p.fantasyPlaced);
  return fantasy?.id ?? state.turnId;
}

export type OfcCaption =
  | { kind: 'none' }
  | {
      kind: 'text';
      key:
        | 'game.fantasyYou'
        | 'game.fantasyYouPineapple'
        | 'game.fantasyOther'
        | 'game.initialYou'
        | 'game.initialOther'
        | 'game.drawYou'
        | 'game.drawYouPineapple'
        | 'game.drawOther'
        | 'game.drawOtherPineapple'
        | 'game.waitingFantasy'
        | 'game.handScored';
      params?: { name?: string; hand?: number; count?: number };
    };

export interface OfcPlayView {
  actorId: string | null;
  role: OfcActorRole;
  /** Only a Fantasy Land arrangement is genuinely secret — the initial five are set
   *  face-up in the same turn, so normal placement needs no handoff lock. */
  fantasyArranging: boolean;
  /** True whenever a multi-card placement board is on screen. */
  arranging: boolean;
  orderedPlayers: RedactedOfcPlayer[];
  actor: RedactedOfcPlayer | null;
  winner: RedactedOfcPlayer | null;
  nameById: Record<string, string>;
  caption: OfcCaption;
}

export interface OfcViewOptions {
  /** Who this view is "about": the next player to act locally, this device online. */
  actorId: string | null;
  rotateToActor: boolean;
  /** Online says "your turn"; a shared phone names the player out loud instead. */
  addressActorAsYou: boolean;
}

/**
 * OFC needs TWO redactions on a shared phone, and conflating them is the bug this note
 * exists to prevent:
 *
 * - `ofcPlayView` takes the view redacted FOR THE ACTOR. The role ("are they placing an
 *   initial five, a draw, a Fantasy Land arrangement?") is decided by fields `redactFor`
 *   strips from everyone else — an actor's `hand` and, in pineapple, `pending.cards` — so
 *   asking a table-redacted view always answers "nobody is acting".
 * - `ofcSeatData` takes the view redacted for the TABLE (`TABLE_VIEWER` locally), because
 *   the strip must show only what the room may see.
 *
 * Online those two are the same object: the device is both the actor and the viewer.
 */
export function ofcPlayView(view: RedactedOfcState, opts: OfcViewOptions): OfcPlayView {
  const { actorId, rotateToActor, addressActorAsYou } = opts;
  const { players } = view;

  const role = ofcActorRole(view, actorId);
  const actor = actorId ? players.find((p) => p.id === actorId) ?? null : null;
  const winner = view.winnerId ? players.find((p) => p.id === view.winnerId) ?? null : null;

  const actorIdx = actorId ? players.findIndex((p) => p.id === actorId) : -1;
  const orderedPlayers =
    rotateToActor && actorIdx > 0
      ? [...players.slice(actorIdx), ...players.slice(0, actorIdx)]
      : players;

  const fantasyArranging = role === 'fantasy';
  const arranging = role === 'fantasy' || role === 'initial';

  return {
    actorId,
    role,
    fantasyArranging,
    arranging,
    orderedPlayers,
    actor,
    winner,
    nameById: Object.fromEntries(players.map((p) => [p.id, p.name])),
    caption: captionFor(view, { role, actor, addressActorAsYou }),
  };
}

function captionFor(
  view: RedactedOfcState,
  ctx: { role: OfcActorRole; actor: RedactedOfcPlayer | null; addressActorAsYou: boolean },
): OfcCaption {
  const { phase } = view;
  if (phase === 'scoring') return { kind: 'text', key: 'game.handScored', params: { hand: view.handNumber } };
  if (phase !== 'placing') return { kind: 'none' };

  const pineapple = view.variant === 'pineapple';
  const { role, actor, addressActorAsYou } = ctx;
  if (!role || !actor) {
    // Nobody in the normal rotation can act — the table is waiting on a Fantasy Land
    // player to finish arranging.
    const turnPlayer = view.turnId ? view.players.find((p) => p.id === view.turnId) : null;
    if (!turnPlayer) return { kind: 'text', key: 'game.waitingFantasy' };
    return view.placeRound === 0
      ? { kind: 'text', key: 'game.initialOther', params: { name: turnPlayer.name } }
      : {
          kind: 'text',
          key: pineapple ? 'game.drawOtherPineapple' : 'game.drawOther',
          params: { name: turnPlayer.name },
        };
  }

  if (addressActorAsYou) {
    if (role === 'fantasy') {
      return pineapple
        ? { kind: 'text', key: 'game.fantasyYouPineapple', params: { count: actor.hand?.length ?? 14 } }
        : { kind: 'text', key: 'game.fantasyYou' };
    }
    if (role === 'initial') return { kind: 'text', key: 'game.initialYou' };
    return { kind: 'text', key: pineapple ? 'game.drawYouPineapple' : 'game.drawYou' };
  }

  if (role === 'fantasy') return { kind: 'text', key: 'game.fantasyOther', params: { name: actor.name } };
  if (role === 'initial') return { kind: 'text', key: 'game.initialOther', params: { name: actor.name } };
  return {
    kind: 'text',
    key: pineapple ? 'game.drawOtherPineapple' : 'game.drawOther',
    params: { name: actor.name },
  };
}

/** A seat as the strip draws it. Structurally an `OfcSeatVM`, without importing one —
 *  src/lib must not depend on components. */
export interface OfcSeatData {
  id: string;
  name: string;
  chips: number;
  eliminated: boolean;
  inFantasyLand: boolean;
  fantasyPlaced: boolean;
  isButton: boolean;
  gridCounts: { top: number; middle: number; bottom: number };
  grid?: OfcGrid;
  fouled?: boolean;
  connected?: boolean;
}

/**
 * The seats for the strip.
 *
 * The acting player's seat leaves it while they act: their board is already rendered
 * once, big, in the action zone, and a shared phone would otherwise show a Fantasy Land
 * arrangement twice. Grids arrive already redacted — `gridVisibleTo` in protocol.ts is
 * the single rule, and it is why the local table redacts for `TABLE_VIEWER` rather than
 * for the actor.
 */
export function ofcSeatData(
  v: OfcPlayView,
  /** The TABLE-redacted state — every card the strip draws comes from here, never from
   *  `v.orderedPlayers`, which is redacted for the actor and would leak their own grid
   *  back onto the shared strip in any phase where they are not filtered out. */
  view: RedactedOfcState,
  labelFor: (p: RedactedOfcPlayer) => string = (p) => p.name,
): OfcSeatData[] {
  const revealed = REVEAL_PHASES.has(view.phase);
  const byId = new Map(view.players.map((p) => [p.id, p]));
  return v.orderedPlayers
    .filter((seat) => !(v.role !== null && seat.id === v.actorId))
    .map((seat) => byId.get(seat.id) ?? seat)
    .map((p) => ({
      id: p.id,
      name: labelFor(p),
      chips: p.chips,
      eliminated: p.eliminated,
      inFantasyLand: p.inFantasyLand,
      fantasyPlaced: p.fantasyPlaced,
      isButton: p.id === view.buttonId,
      gridCounts: p.gridCounts,
      grid: p.grid,
      fouled: revealed ? view.handResult?.perPlayer[p.id]?.fouled : undefined,
      connected: p.connected,
    }));
}
