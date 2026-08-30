import type { HandAction, HandHistory, Street } from '../types';

// How a saved hand becomes a replay: the beats a tap walks through, and what the viewer has
// been shown at any point inside one. Pure — the screen owns the animations, this owns the
// truth about what is on the felt.

// The river is the money card — it flips in slow, after a suspense pause.
export const RIVER_FLIP_DELAY = 400;
export const RIVER_FLIP_DURATION = 1000;
// Readable gap between an action landing and the response to it — chained actions used to
// blur past at 200ms.
export const ACTION_STAGGER = 700;

export type Beat =
  | { kind: 'intro' }
  | { kind: 'street'; street: Street; revealsCards: boolean; actions: HandAction[] }
  | { kind: 'showdown' };

// One beat per street: a single tap reveals the street's card(s) AND its actions (the old
// two-tap card-then-actions rhythm doubled the clicks for nothing). Hero cards show from
// the intro — no dedicated beat. A full river hand is 7 beats: intro, 4 streets, showdown,
// result.
export function buildBeats(hand: HandHistory): Beat[] {
  const beats: Beat[] = [{ kind: 'intro' }];
  const streets: Street[] = ['preflop', 'flop', 'turn', 'river'];
  streets.forEach((street) => {
    const revealsCards =
      (street === 'flop' && !!hand.board.flop) ||
      (street === 'turn' && !!hand.board.turn) ||
      (street === 'river' && !!hand.board.river);
    const actions = hand.actions.filter((a) => a.street === street).sort((a, b) => a.order - b.order);
    if (revealsCards || actions.length > 0) beats.push({ kind: 'street', street, revealsCards, actions });
  });
  // A showdown moment on the table (villain reveal + winning-hand highlight) only when
  // there is something to show — a full run-out or at least one known villain hand;
  // pure fold-outs go straight to the recap.
  const hasShowdown =
    !!hand.board.river || hand.players.some((p) => !p.isHero && !p.isFolded && p.cardsKnown && !!p.holeCards);
  if (hasShowdown) beats.push({ kind: 'showdown' });
  return beats;
}

// The blinds are up before anyone acts, so they are not part of the street's animated
// sequence — they land with the beat's first frame and only show up in the pot.
const isPost = (a: HandAction) => a.type === 'post';

/** A street's actions in the order they play out on the felt, blinds excluded. */
export function animatedActions(beat: Beat | undefined): HandAction[] {
  return beat?.kind === 'street' ? beat.actions.filter((a) => !isPost(a)) : [];
}

/**
 * Everything the viewer has actually seen: every action of the beats already walked, plus
 * the current beat's up to `revealCount`.
 *
 * A street used to be folded in whole the instant its beat was reached, which is why stacks
 * emptied before the bet that emptied them and why the pot showed its end-of-street total
 * before any of the bets that made it.
 */
export function revealedActionsUpTo(beats: Beat[], index: number, revealCount: number): HandAction[] {
  const out: HandAction[] = [];
  beats.slice(0, index + 1).forEach((b, i) => {
    if (b.kind !== 'street') return;
    let seen = 0;
    for (const a of b.actions) {
      if (!isPost(a)) {
        if (i === index && seen >= revealCount) break;
        seen++;
      }
      out.push(a);
    }
  });
  return out;
}

/**
 * Latest contribution per player per street, over the actions revealed so far. Same
 * "raise to" convention as the builder — an amount is a player's total for the street, not
 * an increment — so summing gives the live pot and each player's committed total.
 */
export function contributionsFrom(actions: HandAction[]): Record<string, Record<string, number>> {
  const byStreet: Record<string, Record<string, number>> = {};
  actions.forEach((a) => {
    if (a.amount === undefined) return;
    const perPlayer = byStreet[a.street] ?? {};
    perPlayer[a.playerId] = a.amount;
    byStreet[a.street] = perPlayer;
  });
  return byStreet;
}

export function committedBy(contribs: Record<string, Record<string, number>>, playerId: string): number {
  return Object.values(contribs).reduce((sum, perPlayer) => sum + (perPlayer[playerId] ?? 0), 0);
}

export function totalContributed(contribs: Record<string, Record<string, number>>): number {
  return Object.values(contribs)
    .flatMap((perPlayer) => Object.values(perPlayer))
    .reduce((sum, v) => sum + v, 0);
}

// Within a merged street beat, the actions start writing only after the card flips land.
export function cardLeadMs(beat: Beat): number {
  if (beat.kind !== 'street' || !beat.revealsCards) return 0;
  return beat.street === 'river' ? RIVER_FLIP_DELAY + RIVER_FLIP_DURATION + 400 : 1000;
}

// How long a beat's entering animations run, in 1×-speed video time: card flips first
// (cardLeadMs), then the action bubbles staggered ACTION_STAGGER apart. Windows also cover
// the lagged stats refresh (delay + a render), so the settling frames include the updated
// numbers. The export captures continuously for the whole window.
export function animWindowMsFor(beat: Beat): number {
  if (beat.kind === 'street') {
    const count = animatedActions(beat).length;
    const actionsMs = count > 0 ? (count - 1) * ACTION_STAGGER + 220 + 100 : 0;
    return Math.max(cardLeadMs(beat) + actionsMs, 500);
  }
  // Villain fans flip in per seat (k*120 + 450) — cover a full 9-max table.
  if (beat.kind === 'showdown') return 1800;
  return 500;
}

// How long the settled frame then dwells on screen, in video time — mirrors the autoplay
// pacing; the river and the closing showdown breathe longer. Holds cost no wall time during
// an export: they are pure PTS bookkeeping.
export function holdMsFor(beat: Beat): number {
  // The intro is a title card, not a moment — it used to sit for a second before the preflop
  // action started writing, which read as the video failing to start.
  if (beat.kind === 'intro') return 400;
  if (beat.kind === 'street' && beat.street === 'river' && beat.revealsCards) return 1600;
  if (beat.kind === 'showdown') return 2600;
  return 900;
}
