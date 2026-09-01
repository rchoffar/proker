import { describe, expect, it } from 'vitest';
import type { ActionType, HandAction, Position, Street } from '../../types/hand';
import {
  actionsBefore,
  availableActions,
  computeBlindPosts,
  maxToFor,
  remainingStackFor,
  replayActions,
  resolveActionInput,
} from '../handEngine';
import type { EngineConfig, EnginePlayer } from '../handEngine';

// Roster in preflop action order (the builder's invariant: array order IS action order).
function roster(positions: Position[]): EnginePlayer[] {
  return positions.map((position, i) => ({ id: `p${i}`, position }));
}

function cfg(players: EnginePlayer[], stack = 100, smallBlind = 0.5, bigBlind = 1): EngineConfig {
  return { smallBlind, bigBlind, stacks: Object.fromEntries(players.map((p) => [p.id, stack])) };
}

// Mirrors exactly how the screen records: posts appended once up front, then each action is
// resolved against the current derived state and appended with a per-street contiguous order.
function makeHand(players: EnginePlayer[], config: EngineConfig) {
  const actions: HandAction[] = [];
  let n = 0;
  computeBlindPosts(players, config).forEach((p, i) => {
    n += 1;
    actions.push({ id: `a${n}`, street: 'preflop', playerId: p.playerId, type: 'post', amount: p.amount, order: i });
  });
  return {
    actions,
    derived: () => replayActions(players, config, actions),
    record(playerId: string, type: ActionType, amount?: number): HandAction {
      const derived = replayActions(players, config, actions);
      const street = derived.round!.street;
      const resolved = resolveActionInput(derived, config, playerId, type, amount);
      n += 1;
      const action: HandAction = {
        id: `a${n}`,
        street,
        playerId,
        type: resolved.type,
        amount: resolved.amount,
        order: actions.filter((a) => a.street === street).length,
      };
      actions.push(action);
      return action;
    },
  };
}

describe('replayActions — blind posts', () => {
  it('consumes posts into contributions and sets currentBet to the BB post', () => {
    const players = roster(['BTN', 'SB', 'BB']);
    const hand = makeHand(players, cfg(players));
    const d = hand.derived();
    expect(d.round).not.toBeNull();
    expect(d.round!.street).toBe('preflop');
    expect(d.round!.toAct).toEqual(['p0', 'p1', 'p2']);
    expect(d.round!.currentBet).toBe(1);
    expect(d.round!.contributions).toEqual({ p1: 0.5, p2: 1 });
  });

  it('lets the unraised BB check while everyone else owes the blind', () => {
    const players = roster(['BTN', 'SB', 'BB']);
    const config = cfg(players);
    const hand = makeHand(players, config);
    expect(availableActions(hand.derived(), config, 'p0')).toEqual(['fold', 'call', 'raise', 'allin']);
    hand.record('p0', 'call');
    hand.record('p1', 'call');
    const d = hand.derived();
    expect(d.round!.toAct).toEqual(['p2']);
    expect(availableActions(d, config, 'p2')).toEqual(['fold', 'check', 'bet', 'allin']);
  });

  it('dead blinds: no SB/BB in the roster means no posts but entering still costs the BB', () => {
    const players = roster(['UTG', 'MP', 'CO']);
    const config = cfg(players);
    expect(computeBlindPosts(players, config)).toEqual([]);
    const hand = makeHand(players, config);
    const d = hand.derived();
    expect(d.round!.currentBet).toBe(1);
    expect(d.round!.contributions).toEqual({});
    const call = hand.record('p0', 'call');
    expect(call.amount).toBe(1);
  });

  it('heads-up: the button posts the small blind and acts first preflop, last postflop', () => {
    const players = roster(['BTN', 'BB']);
    const config = cfg(players);
    expect(computeBlindPosts(players, config)).toEqual([
      { playerId: 'p0', amount: 0.5 },
      { playerId: 'p1', amount: 1 },
    ]);
    const hand = makeHand(players, config);
    expect(hand.derived().round!.toAct).toEqual(['p0', 'p1']);
    hand.record('p0', 'call');
    hand.record('p1', 'check');
    const flop = hand.derived();
    expect(flop.completedStreets).toEqual(['preflop']);
    expect(flop.round!.street).toBe('flop');
    expect(flop.round!.toAct).toEqual(['p1', 'p0']);
  });
});

describe('replayActions — scripted 3-way hand parity', () => {
  const players = roster(['BTN', 'SB', 'BB']);
  const config = cfg(players);

  it('tracks toAct/currentBet/contributions through preflop raise, calls, flop bet and fold', () => {
    const hand = makeHand(players, config);

    hand.record('p0', 'raise', 3);
    let d = hand.derived();
    expect(d.round!.toAct).toEqual(['p1', 'p2']);
    expect(d.round!.currentBet).toBe(3);
    expect(d.round!.lastAggressorId).toBe('p0');

    hand.record('p1', 'call');
    hand.record('p2', 'call');
    d = hand.derived();
    expect(d.completedStreets).toEqual(['preflop']);
    expect(d.round!.street).toBe('flop');
    expect(d.round!.toAct).toEqual(['p1', 'p2', 'p0']);
    expect(d.round!.currentBet).toBe(0);
    expect(d.committed).toEqual({ p0: 3, p1: 3, p2: 3 });

    hand.record('p1', 'check');
    hand.record('p2', 'bet', 5);
    d = hand.derived();
    expect(d.round!.toAct).toEqual(['p0', 'p1']);
    expect(d.round!.currentBet).toBe(5);

    hand.record('p0', 'call');
    hand.record('p1', 'fold');
    d = hand.derived();
    expect(d.completedStreets).toEqual(['preflop', 'flop']);
    expect(d.foldedOnStreet).toEqual({ p1: 'flop' });
    expect(d.round!.street).toBe('turn');
    expect(d.round!.toAct).toEqual(['p2', 'p0']);
    expect(d.committed).toEqual({ p0: 8, p1: 3, p2: 8 });
    expect(d.handOver).toBe(false);
  });

  it('a re-raise supersedes the raiser\'s earlier street amount instead of summing with it', () => {
    const hand = makeHand(players, config);
    hand.record('p0', 'raise', 3);
    hand.record('p1', 'raise', 9);
    hand.record('p2', 'fold');
    hand.record('p0', 'call');
    const d = hand.derived();
    // p0's call of 9 replaces their raise-to 3, never adds to it.
    expect(d.committed).toEqual({ p0: 9, p1: 9, p2: 1 });
    expect(d.completedStreets).toEqual(['preflop']);
  });
});

describe('replayActions — reopen rules', () => {
  it('a raise resumes with the seat right after the aggressor, wrapping around', () => {
    const players = roster(['UTG', 'CO', 'BTN', 'SB', 'BB']);
    const config = cfg(players);
    const hand = makeHand(players, config);
    hand.record('p0', 'call');
    hand.record('p1', 'call');
    hand.record('p2', 'raise', 4);
    const d = hand.derived();
    // Seats after BTN: SB, BB, then wrap to UTG and CO.
    expect(d.round!.toAct).toEqual(['p3', 'p4', 'p0', 'p1']);
  });

  // Reported from a real hand: UTG opens to 2, UTG+1 shoves 100, and the builder asked UTG to
  // call the shove while MP through BB had not spoken. An all-in aggressor is already in the
  // all-in set when the queue is rebuilt, so anchoring the rotation on a list that excludes
  // them found nothing and left the order untouched — i.e. plain seat order from UTG.
  it('an all-in raise resumes after the shover, not back at the first seat', () => {
    const players = roster(['UTG', 'UTG+1', 'MP', 'LJ', 'HJ', 'CO', 'BTN', 'SB', 'BB']);
    const config = cfg(players);
    const hand = makeHand(players, config);
    hand.record('p0', 'raise', 2);
    hand.record('p1', 'allin', 100);
    const d = hand.derived();
    expect(d.allInIds).toEqual(new Set(['p1']));
    // MP, LJ, HJ, CO, BTN, SB, BB, and only then back round to UTG.
    expect(d.round!.toAct).toEqual(['p2', 'p3', 'p4', 'p5', 'p6', 'p7', 'p8', 'p0']);
  });

  it('a full-stack raise that is not all-in resumes after the aggressor too', () => {
    const players = roster(['UTG', 'UTG+1', 'MP', 'LJ', 'HJ', 'CO', 'BTN', 'SB', 'BB']);
    const config = cfg(players);
    const hand = makeHand(players, config);
    hand.record('p0', 'raise', 2);
    hand.record('p1', 'raise', 6);
    // The aggressor is still eligible here, so this path always worked — pinned so the fix
    // above cannot regress it.
    expect(hand.derived().round!.toAct).toEqual(['p2', 'p3', 'p4', 'p5', 'p6', 'p7', 'p8', 'p0']);
  });

  it('a short all-in at or below the current bet does not reopen the action', () => {
    const players = roster(['BTN', 'SB', 'BB']);
    const config: EngineConfig = { smallBlind: 0.5, bigBlind: 1, stacks: { p0: 100, p1: 100, p2: 17 } };
    const hand = makeHand(players, config);
    hand.record('p0', 'raise', 10);
    hand.record('p1', 'call');
    hand.record('p2', 'call');
    hand.record('p1', 'bet', 20);
    const shove = hand.record('p2', 'allin', maxToFor(hand.derived(), config, 'p2'));
    expect(shove.type).toBe('allin');
    expect(shove.amount).toBe(7); // 17 stack - 10 preflop
    const d = hand.derived();
    // p2's 7 is below the 20 bet: p0 still must respond to 20, but p1 is NOT re-queued.
    expect(d.round!.currentBet).toBe(20);
    expect(d.round!.toAct).toEqual(['p0']);
    expect(d.allInIds).toEqual(new Set(['p2']));
  });
});

describe('resolveActionInput — all-in coercion', () => {
  const players = roster(['BTN', 'SB', 'BB']);

  it('coerces a call above the remaining stack into a capped all-in', () => {
    const config: EngineConfig = { smallBlind: 0.5, bigBlind: 1, stacks: { p0: 100, p1: 100, p2: 5 } };
    const hand = makeHand(players, config);
    hand.record('p0', 'raise', 20);
    hand.record('p1', 'fold');
    const d = hand.derived();
    // The BB posted 1 and has 4 behind: "calling" 20 commits everything they have.
    const resolved = resolveActionInput(d, config, 'p2', 'call');
    expect(resolved).toEqual({ type: 'allin', amount: 5 });
  });

  it('coerces a raise to exactly maxTo into an all-in', () => {
    const config: EngineConfig = { smallBlind: 0.5, bigBlind: 1, stacks: { p0: 30, p1: 100, p2: 100 } };
    const hand = makeHand(players, config);
    const d = hand.derived();
    expect(maxToFor(d, config, 'p0')).toBe(30);
    expect(resolveActionInput(d, config, 'p0', 'raise', 30)).toEqual({ type: 'allin', amount: 30 });
    expect(resolveActionInput(d, config, 'p0', 'raise', 12)).toEqual({ type: 'raise', amount: 12 });
  });

  it('offers only fold/call/allin when too short to raise above the current bet', () => {
    const config: EngineConfig = { smallBlind: 0.5, bigBlind: 1, stacks: { p0: 100, p1: 100, p2: 8 } };
    const hand = makeHand(players, config);
    hand.record('p0', 'raise', 10);
    hand.record('p1', 'call');
    const d = hand.derived();
    expect(availableActions(d, config, 'p2')).toEqual(['fold', 'call', 'allin']);
  });
});

describe('replayActions — fold-out', () => {
  it('folding to one player mid-preflop ends the hand with that player as winner', () => {
    const players = roster(['BTN', 'SB', 'BB']);
    const config = cfg(players);
    const hand = makeHand(players, config);
    hand.record('p0', 'fold');
    hand.record('p1', 'fold');
    const d = hand.derived();
    expect(d.handOver).toBe(true);
    expect(d.foldWinnerId).toBe('p2');
    expect(d.round).toBeNull();
    expect(d.foldedOnStreet).toEqual({ p0: 'preflop', p1: 'preflop' });
  });

  it('folding to one player mid-flop ends the hand there', () => {
    const players = roster(['BTN', 'SB', 'BB']);
    const config = cfg(players);
    const hand = makeHand(players, config);
    hand.record('p0', 'call');
    hand.record('p1', 'call');
    hand.record('p2', 'check');
    hand.record('p1', 'bet', 4);
    hand.record('p2', 'fold');
    hand.record('p0', 'fold');
    const d = hand.derived();
    expect(d.handOver).toBe(true);
    expect(d.foldWinnerId).toBe('p1');
    expect(d.round).toBeNull();
    expect(d.completedStreets).toEqual(['preflop']);
  });
});

describe('replayActions — street advancement and run-out', () => {
  it('an all-in confrontation runs out every remaining street with empty queues', () => {
    const players = roster(['BTN', 'SB', 'BB']);
    const config = cfg(players);
    const hand = makeHand(players, config);
    hand.record('p0', 'allin', 100);
    const called = hand.record('p1', 'call');
    expect(called.type).toBe('allin'); // calling for the whole stack IS an all-in
    hand.record('p2', 'fold');
    const d = hand.derived();
    expect(d.handOver).toBe(false);
    expect(d.round).toBeNull();
    expect(d.completedStreets).toEqual(['preflop', 'flop', 'turn', 'river']);
    expect(d.allInIds).toEqual(new Set(['p0', 'p1']));
  });

  it('a closed river round means showdown: no live round, no fold-out', () => {
    const players = roster(['BTN', 'BB']);
    const config = cfg(players);
    const hand = makeHand(players, config);
    hand.record('p0', 'call');
    hand.record('p1', 'check');
    (['flop', 'turn', 'river'] as Street[]).forEach(() => {
      hand.record('p1', 'check');
      hand.record('p0', 'check');
    });
    const d = hand.derived();
    expect(d.completedStreets).toEqual(['preflop', 'flop', 'turn', 'river']);
    expect(d.round).toBeNull();
    expect(d.handOver).toBe(false);
  });
});

describe('actionsBefore & truncate-on-edit', () => {
  const players = roster(['BTN', 'SB', 'BB']);
  const config = cfg(players);

  function fullHand() {
    const hand = makeHand(players, config);
    hand.record('p0', 'raise', 3);
    hand.record('p1', 'call');
    hand.record('p2', 'call');
    const flopBet = hand.record('p1', 'bet', 5);
    hand.record('p2', 'call');
    hand.record('p0', 'call');
    hand.record('p1', 'check');
    hand.record('p2', 'bet', 12);
    return { hand, flopBet };
  }

  it('keeps posts and strictly-earlier actions, drops the target and everything after', () => {
    const { hand, flopBet } = fullHand();
    const kept = actionsBefore(hand.actions, flopBet.id);
    expect(kept.filter((a) => a.type === 'post')).toHaveLength(2);
    expect(kept.filter((a) => a.street === 'preflop')).toHaveLength(5); // 2 posts + 3 voluntary
    expect(kept.filter((a) => a.street === 'flop')).toHaveLength(0);
    expect(kept.filter((a) => a.street === 'turn')).toHaveLength(0);
  });

  it('edit-preview: the legal set and amounts the original actor saw are reproduced', () => {
    const { hand, flopBet } = fullHand();
    const before = replayActions(players, config, actionsBefore(hand.actions, flopBet.id));
    expect(before.round!.street).toBe('flop');
    expect(before.round!.toAct[0]).toBe('p1');
    expect(availableActions(before, config, 'p1')).toEqual(['fold', 'check', 'bet', 'allin']);
    expect(remainingStackFor(before, config, 'p1')).toBe(97);
  });

  it('replay of truncation + replacement equals a fresh recording of that line', () => {
    const { hand, flopBet } = fullHand();
    const before = replayActions(players, config, actionsBefore(hand.actions, flopBet.id));
    const resolved = resolveActionInput(before, config, 'p1', 'check');
    const replacement: HandAction = {
      id: 'edit1',
      street: flopBet.street,
      playerId: flopBet.playerId,
      type: resolved.type,
      amount: resolved.amount,
      order: flopBet.order,
    };
    const edited = replayActions(players, config, [...actionsBefore(hand.actions, flopBet.id), replacement]);

    const fresh = makeHand(players, config);
    fresh.record('p0', 'raise', 3);
    fresh.record('p1', 'call');
    fresh.record('p2', 'call');
    fresh.record('p1', 'check');
    const expected = fresh.derived();

    expect(edited.round).toEqual(expected.round);
    expect(edited.committed).toEqual(expected.committed);
    expect(edited.completedStreets).toEqual(expected.completedStreets);
    expect(edited.foldedOnStreet).toEqual(expected.foldedOnStreet);
    expect(edited.allInIds).toEqual(expected.allInIds);
    expect(edited.handOver).toBe(expected.handOver);
  });

  it('editing an action into a fold-out ends the hand', () => {
    const { hand } = fullHand();
    // Change p1's preflop call into a fold, then p2's call into a fold → p0 wins.
    const preflopCall = hand.actions.find((a) => a.playerId === 'p1' && a.street === 'preflop' && a.type === 'call')!;
    const before = replayActions(players, config, actionsBefore(hand.actions, preflopCall.id));
    const fold = resolveActionInput(before, config, 'p1', 'fold');
    const truncated = [
      ...actionsBefore(hand.actions, preflopCall.id),
      { id: 'e1', street: 'preflop' as Street, playerId: 'p1', type: fold.type, amount: fold.amount, order: preflopCall.order },
    ];
    const mid = replayActions(players, config, truncated);
    expect(mid.handOver).toBe(false);
    expect(mid.round!.toAct).toEqual(['p2']);
    const done = replayActions(players, config, [
      ...truncated,
      { id: 'e2', street: 'preflop', playerId: 'p2', type: 'fold', order: truncated.filter((a) => a.street === 'preflop').length },
    ]);
    expect(done.handOver).toBe(true);
    expect(done.foldWinnerId).toBe('p0');
  });

  it('returns the array untouched for an unknown action id', () => {
    const { hand } = fullHand();
    expect(actionsBefore(hand.actions, 'nope')).toEqual(hand.actions);
  });
});
