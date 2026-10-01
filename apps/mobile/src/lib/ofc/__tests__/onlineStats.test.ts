import { describe, expect, it } from 'vitest';
import { applyOfcOnlineStats } from '../onlineStats';
import { initGame, createHandDeal, reduce, scoreHand } from '..';
import { redactFor } from '../protocol';
import { mulberry32 } from '../../rng';
import type { OfcGameDetail, OfcHistoryEntry } from '../../../../../../packages/ofc/http';

const state = reduce(initGame([{ id: 'a', name: 'Alice' }, { id: 'b', name: 'Bob' }], 100, 'classic', mulberry32(1)), createHandDeal(initGame([{ id: 'a', name: 'Alice' }, { id: 'b', name: 'Bob' }]), mulberry32(2)));
const game: OfcGameDetail = {
  id: 'persisted-game', code: '123456', variant: 'classic', startingStack: 100, capacity: 2, visibility: 'public', status: 'playing',
  version: 1, members: [{ playerId: 'a', name: 'Alice', status: 'active' }, { playerId: 'b', name: 'Bob', status: 'active' }],
  myPlayerId: 'a', canAct: true, handNumber: 1, completedHands: 0, updatedAt: '2026-09-30', state: redactFor(state, 'a'),
};
const deck = [...state.players.flatMap(p => p.hand), ...state.deck];
const result = scoreHand([{ id: 'a', grid: { top: deck.slice(0, 3), middle: deck.slice(3, 8), bottom: deck.slice(8, 13) }, inFantasyLand: false, chips: 100 },
  { id: 'b', grid: { top: deck.slice(13, 16), middle: deck.slice(16, 21), bottom: deck.slice(21, 26) }, inFantasyLand: false, chips: 100 }]);
const hand: OfcHistoryEntry = { handNumber: 1, status: 'completed', result, createdAt: '2026-09-30' };
describe('durable OFC statistics', () => {
  it('records each hand once across refreshes and rehydration', () => {
    const first = applyOfcOnlineStats({}, {}, game, [hand]);
    const persisted = JSON.parse(JSON.stringify(first));
    const repeated = applyOfcOnlineStats(persisted.gameStats, persisted.ofcRecordedEvents, game, [hand]);
    expect(repeated.gameStats).toEqual(first.gameStats);
    expect(Object.keys(repeated.ofcRecordedEvents)).toHaveLength(1);
  });
  it('does not count cancelled hands and separates games with identical hand numbers', () => {
    const first = applyOfcOnlineStats({}, {}, game, [{ ...hand, result: null, status: 'cancelled' }]);
    expect(first.gameStats).toEqual({});
    const one = applyOfcOnlineStats({}, {}, game, [hand]);
    const two = applyOfcOnlineStats(one.gameStats, one.ofcRecordedEvents, { ...game, id: 'another-game' }, [hand]);
    expect(Object.keys(two.ofcRecordedEvents)).toHaveLength(2);
    expect(two.gameStats).not.toEqual(one.gameStats);
  });
  it('records a victory once and ignores deleted player names', () => {
    const ended = { ...game, status: 'finished' as const, state: { ...game.state!, winnerId: 'a' }, members: [game.members[0], { ...game.members[1], name: null }] };
    const first = applyOfcOnlineStats({}, {}, ended, [hand]);
    const second = applyOfcOnlineStats(first.gameStats, first.ofcRecordedEvents, ended, [hand]);
    expect(second.gameStats).toEqual(first.gameStats);
    expect(Object.keys(second.ofcRecordedEvents)).toHaveLength(2);
    expect(Object.keys(second.gameStats)).toEqual(['alice']);
  });
});
