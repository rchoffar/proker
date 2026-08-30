import { describe, expect, it } from 'vitest';
import { redactFor } from '../protocol';
import { ofcActorRole, ofcLocalActorId, ofcPlayView, ofcSeatData, TABLE_VIEWER } from '../view';
import { playScriptedHand, playScriptedPineappleHand } from './fixtures';

/**
 * How Pass & Play renders: the strip is redacted for the table, but the actor's role has
 * to be read from their own redaction — the fields that decide it are exactly the ones
 * the table view strips.
 */
function localView(state: ReturnType<typeof playScriptedHand>[number]) {
  const actorId = ofcLocalActorId(state);
  const table = redactFor(state, TABLE_VIEWER);
  const forActor = redactFor(state, actorId ?? TABLE_VIEWER);
  return {
    table,
    actorId,
    v: ofcPlayView(forActor, { actorId, rotateToActor: false, addressActorAsYou: false }),
  };
}

describe('ofcLocalActorId — who the phone goes to next', () => {
  it('is nobody once the hand is scored', () => {
    const states = playScriptedHand();
    const final = states[states.length - 1];
    expect(final.phase).not.toBe('placing');
    expect(ofcLocalActorId(final)).toBeNull();
  });

  it('follows the normal rotation while nobody is in Fantasy Land', () => {
    const states = playScriptedHand();
    const placing = states.filter((s) => s.phase === 'placing');
    expect(placing.length).toBeGreaterThan(0);
    for (const s of placing) expect(ofcLocalActorId(s)).toBe(s.turnId);
  });

  it('puts a Fantasy Land arranger ahead of the rotation', () => {
    const states = playScriptedHand();
    const placing = states.find((s) => s.phase === 'placing')!;
    // Force the situation the sequencing exists for: someone else is in Fantasy Land and
    // has not arranged yet, while the normal turn belongs to another player.
    const other = placing.players.find((p) => p.id !== placing.turnId)!;
    const withFantasy = {
      ...placing,
      players: placing.players.map((p) =>
        p.id === other.id ? { ...p, inFantasyLand: true, fantasyPlaced: false } : p
      ),
    };
    expect(ofcLocalActorId(withFantasy)).toBe(other.id);
  });
});

describe('ofcSeatData — what the shared strip may show', () => {
  it('drops the acting player’s seat while they act, and keeps everyone otherwise', () => {
    const states = playScriptedHand();
    const placing = states.find((s) => s.phase === 'placing')!;
    const { table, v } = localView(placing);
    const seats = ofcSeatData(v, table);
    expect(v.role).not.toBeNull();
    expect(seats.map((s) => s.id)).not.toContain(v.actorId);
    expect(seats).toHaveLength(placing.players.length - 1);

    const scored = states[states.length - 1];
    const scoredLocal = localView(scored);
    expect(ofcSeatData(scoredLocal.v, scoredLocal.table)).toHaveLength(scored.players.length);
  });

  it('keeps a Fantasy Land grid off the shared table until the reveal', () => {
    const states = playScriptedHand();
    const placing = states.find((s) => s.phase === 'placing')!;
    const inFantasy = {
      ...placing,
      players: placing.players.map((p) => ({ ...p, inFantasyLand: true, fantasyPlaced: true })),
    };
    const table = redactFor(inFantasy, TABLE_VIEWER);
    const v = ofcPlayView(table, { actorId: null, rotateToActor: false, addressActorAsYou: false });
    for (const seat of ofcSeatData(v, table)) expect(seat.grid).toBeUndefined();
  });

  it('never draws a seat from the actor’s own redaction', () => {
    // The leak this guards: a Fantasy Land player whose turn it is but who has nothing
    // left to place has role null, so their seat stays in the strip. If the strip read
    // its cards from the actor-redacted view, that seat would show their hidden grid.
    const states = playScriptedHand();
    const placing = states.find((s) => s.phase === 'placing')!;
    const actorId = placing.turnId!;
    const inFantasy = {
      ...placing,
      players: placing.players.map((p) =>
        p.id === actorId ? { ...p, inFantasyLand: true, fantasyPlaced: true, hand: [] } : p
      ),
    };
    const table = redactFor(inFantasy, TABLE_VIEWER);
    const forActor = redactFor(inFantasy, actorId);
    const v = ofcPlayView(forActor, { actorId, rotateToActor: false, addressActorAsYou: false });

    expect(v.role).toBeNull(); // nothing to place → the seat is NOT filtered out
    const seat = ofcSeatData(v, table).find((s) => s.id === actorId);
    expect(seat).toBeDefined();
    expect(seat!.grid).toBeUndefined();
    // …while their own device still sees it.
    expect(forActor.players.find((p) => p.id === actorId)!.grid).toBeDefined();
  });

  it('shows every grid once the hand is scored', () => {
    const states = playScriptedHand();
    const scored = states[states.length - 1];
    const { table, v } = localView(scored);
    for (const seat of ofcSeatData(v, table)) expect(seat.grid).toBeDefined();
  });

  it('reports fouls only from the scoring reveal onward', () => {
    const states = playScriptedHand();
    const placing = states.find((s) => s.phase === 'placing')!;
    const early = localView(placing);
    for (const seat of ofcSeatData(early.v, early.table)) expect(seat.fouled).toBeUndefined();

    const scored = states[states.length - 1];
    const late = localView(scored);
    for (const seat of ofcSeatData(late.v, late.table)) expect(seat.fouled).toBeDefined();
  });
});

describe('ofcActorRole — pineapple secrecy', () => {
  it('gives the drawn cards to the actor and only a count to everyone else', () => {
    const states = playScriptedPineappleHand();
    const drawing = states.find((s) => s.phase === 'placing' && s.pending && s.pending.cards.length === 3);
    expect(drawing).toBeDefined();
    const actorId = drawing!.pending!.playerId;

    // The actor's own device: three cards to place.
    const mine = redactFor(drawing!, actorId);
    expect(ofcActorRole(mine, actorId)).toBe('draw');
    expect(mine.pending?.cards).toHaveLength(3);

    // Anyone else, and the shared table: a count, no cards, and no placement role.
    const theirs = redactFor(drawing!, TABLE_VIEWER);
    expect(theirs.pending?.cards).toBeUndefined();
    expect(theirs.pending?.count).toBe(3);
    expect(ofcActorRole(theirs, actorId)).toBeNull();
  });
});

describe('ofcPlayView — captions', () => {
  it('names the player on a shared phone and says "you" online', () => {
    const states = playScriptedHand();
    const placing = states.find((s) => s.phase === 'placing')!;
    const actorId = ofcLocalActorId(placing)!;
    const forActor = redactFor(placing, actorId);

    const shared = ofcPlayView(forActor, { actorId, rotateToActor: false, addressActorAsYou: false });
    expect(shared.caption).toMatchObject({ kind: 'text' });
    expect(shared.caption.kind === 'text' && shared.caption.key).toMatch(/Other$/);

    const online = ofcPlayView(forActor, { actorId, rotateToActor: true, addressActorAsYou: true });
    expect(online.caption.kind === 'text' && online.caption.key).toMatch(/You$/);
  });

  it('reports the scored hand number', () => {
    const states = playScriptedHand();
    const scored = states.find((s) => s.phase === 'scoring');
    if (!scored) return;
    const { v } = localView(scored);
    expect(v.caption).toEqual({ kind: 'text', key: 'game.handScored', params: { hand: scored.handNumber } });
  });
});
