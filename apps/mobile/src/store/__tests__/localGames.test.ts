import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useOfcLocalGames } from '../useOfcLocalGames';
import { useBluffLocalGames } from '../useBluffLocalGames';
import { initGame as initOfc, createHandDeal, reduce as reduceOfc } from '../../lib/ofc';
import { initGame as initBluff, createRoundDeal, reduce as reduceBluff } from '../../lib/bluff';
const memory = vi.hoisted(() => new Map<string, string>());
vi.mock('../mmkvStorage', () => ({ mmkvStorage: {
  getItem: (key: string) => memory.get(key) ?? null,
  setItem: (key: string, value: string) => { memory.set(key, value); },
  removeItem: (key: string) => { memory.delete(key); },
} }));
const players = [{ id: 'alice', name: 'Alice' }, { id: 'bob', name: 'Bob' }];
beforeEach(() => {
  memory.clear();
  useOfcLocalGames.setState({ games: {}, activeId: null });
  useBluffLocalGames.setState({ games: {}, activeId: null });
});
describe('local game persistence', () => {
  it('restores multiple OFC games, exact dealt cards and stats markers after restarting', async () => {
    const initial = initOfc(players, 100, 'pineapple');
    const state = reduceOfc(initial, createHandDeal(initial));
    const store = useOfcLocalGames.getState();
    store.save('first', { state, startingStack: 100, statsHand: 1, gameOverRecorded: false });
    store.save('second', { state: { ...state, handNumber: 2 }, startingStack: 100, statsHand: null, gameOverRecorded: false });
    store.select('first');
    const raw = memory.get('ofc-local-games')!;
    expect(JSON.parse(raw).state.activeId).toBeUndefined();
    useOfcLocalGames.setState({ games: {}, activeId: null });
    memory.set('ofc-local-games', raw);
    await useOfcLocalGames.persist.rehydrate();
    expect(useOfcLocalGames.getState().games.first.state).toEqual(state);
    expect(useOfcLocalGames.getState().games.first.statsHand).toBe(1);
    expect(useOfcLocalGames.getState().games.second.state.handNumber).toBe(2);
  });
  it('restores Bluff hands and config without re-dealing or repeating recorded stats', async () => {
    const initial = initBluff(players, Math.random, { variant: 'quick', jeuMax: true });
    const state = reduceBluff(initial, createRoundDeal(initial));
    useBluffLocalGames.getState().save('game', { state, statsRound: 1, gameOverRecorded: true });
    const raw = memory.get('bluff-local-games')!;
    useBluffLocalGames.setState({ games: {}, activeId: null });
    memory.set('bluff-local-games', raw);
    await useBluffLocalGames.persist.rehydrate();
    expect(useBluffLocalGames.getState().games.game).toEqual({ state, statsRound: 1, gameOverRecorded: true });
  });
});
