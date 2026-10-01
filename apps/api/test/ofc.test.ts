import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { once } from 'node:events';
import pg from 'pg';
import { OfcError, OfcRepository } from '../src/ofc.js';
import { createHandDeal, initGame, reduce, ROW_CAPACITY } from '../../../packages/ofc/index.js';
import type { OfcState, OfcPlacement, RowId } from '../../../packages/ofc/index.js';
import type { OfcGameDetail } from '../../../packages/ofc/http.js';
import { mulberry32 } from '../../../packages/ofc/rng.js';

const requestId = () => randomUUID();
test('persistent OFC over PostgreSQL and HTTP', { skip: !process.env.PROKER_INTEGRATION_TEST, timeout: 90000 }, async t => {
  const connectionString = process.env.DATABASE_URL_UNPOOLED!;
  const admin = new pg.Client({ connectionString });
  await admin.connect();
  const schema = `ofc_test_${randomUUID().replaceAll('-', '')}`;
  await admin.query(`CREATE SCHEMA ${schema}`);
  const url = new URL(connectionString);
  url.searchParams.set('options', `-c search_path=${schema}`);
  let pool = new pg.Pool({ connectionString: url.toString(), max: 6 });
  let repo = new OfcRepository(pool);
  t.after(async () => { await pool.end(); await admin.query(`DROP SCHEMA ${schema} CASCADE`); await admin.end(); });
  const migrations = new URL('../migrations/', import.meta.url);
  for (const name of (await readdir(migrations)).filter(f => f.endsWith('.sql')).sort()) await pool.query(await readFile(new URL(name, migrations), 'utf8'));
  const user = async (pseudo: string) => {
    const id = randomUUID();
    await pool.query('INSERT INTO users VALUES ($1, $2, $3, NULL, $4, $5, $5)', [id, 'google', id, pseudo, new Date().toISOString()]);
    return { id, pseudo };
  };
  const a = await user('Alice'), b = await user('Bob'), c = await user('Chloé'), d = await user('Dan');
  const create = (capacity: 2 | 3 = 2, visibility: 'public' | 'private' = 'public', variant: 'classic' | 'pineapple' = 'classic') =>
    repo.create(a, { variant, capacity, visibility, startingStack: 100, requestId: requestId() });
  const start = async (capacity: 2 | 3 = 2, variant: 'classic' | 'pineapple' = 'classic') => {
    const room = await create(capacity, 'public', variant);
    let game = await repo.join(b, room.code, requestId());
    if (capacity === 3) game = await repo.join(c, room.code, requestId());
    return game;
  };
  const full = async (id: string) => JSON.parse((await pool.query('SELECT state FROM ofc_games WHERE id = $1', [id])).rows[0].state) as OfcState;
  const place = (cards: OfcState['players'][number]['hand'], grid = { top: [], middle: [], bottom: [] } as OfcState['players'][number]['grid']) => {
    const counts = { top: grid.top.length, middle: grid.middle.length, bottom: grid.bottom.length };
    return cards.map(card => {
      const row = (['bottom', 'middle', 'top'] as RowId[]).find(r => counts[r] < ROW_CAPACITY[r])!;
      counts[row]++;
      return { card, row } satisfies OfcPlacement;
    });
  };
  const actor = async (game: OfcGameDetail) => {
    const state = await full(game.id);
    const player = state.players.find(p => p.id === state.turnId)!;
    const member = (await pool.query('SELECT user_id FROM ofc_members WHERE game_id = $1 AND player_id = $2', [game.id, player.id])).rows[0];
    const initial = state.placeRound === 0;
    const cards = initial ? player.hand : state.pending!.cards.slice(0, state.variant === 'classic' ? 1 : 2);
    return { userId: member.user_id as string, input: { expectedVersion: game.version, requestId: requestId(), action: {
      type: initial ? 'placeInitial' as const : 'placeDraw' as const, placements: place(cards, player.grid),
    } } };
  };
  await t.test('multiple rooms, private visibility, idempotent create/join and automatic exact-capacity start', async () => {
    const input = { variant: 'classic' as const, capacity: 3 as const, visibility: 'private' as const, startingStack: 100, requestId: requestId() };
    const [room, duplicate] = await Promise.all([repo.create(a, input), repo.create(a, input)]);
    assert.equal(room.id, duplicate.id);
    assert.equal(room.code.length, 6);
    assert.ok(!(await repo.rooms(b.id)).some(r => r.id === room.id));
    await create();
    assert.ok((await repo.list(a.id)).length >= 2);
    const joined = await repo.join(b, room.code, requestId());
    assert.equal(joined.status, 'waiting');
    assert.equal(joined.members.length, 2);
    const lastId = requestId();
    const [last, lastAgain] = await Promise.all([repo.join(c, room.code, lastId), repo.join(c, room.code, lastId)]);
    assert.equal(last.status, 'playing');
    assert.equal(last.handNumber, 1);
    assert.equal(last.version, lastAgain.version);
    assert.equal(last.members.length, 3);
    await assert.rejects(repo.join(d, room.code, requestId()), (e: unknown) => e instanceof OfcError && e.code === 'started');
    await assert.rejects(repo.get(room.id, d.id), (e: unknown) => e instanceof OfcError && e.status === 404);
  });
  await t.test('concurrent last-seat joins start once and reject the other player', async () => {
    const room = await create();
    const results = await Promise.allSettled([repo.join(b, room.code, requestId()), repo.join(c, room.code, requestId())]);
    assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
    const game = await repo.get(room.id, a.id);
    assert.equal(game.members.length, 2);
    assert.equal(game.version, 2);
    assert.equal(game.state?.phase, 'placing');
  });
  await t.test('duplicate moves commit once; stale, out-of-turn and malformed moves are rejected', async () => {
    let game = await start();
    const { userId, input } = await actor(game);
    const other = userId === a.id ? b.id : a.id;
    await assert.rejects(repo.move(other, game.id, input), (e: unknown) => e instanceof OfcError && e.code === 'notYourTurn');
    const [one, two] = await Promise.all([repo.move(userId, game.id, input), repo.move(userId, game.id, input)]);
    assert.equal(one.version, game.version + 1);
    assert.equal(two.version, one.version);
    await assert.rejects(repo.move(userId, game.id, { ...input, requestId: requestId() }), (e: unknown) => e instanceof OfcError && e.code === 'stale_version');
    await assert.rejects(repo.move(userId, game.id, { ...input, expectedVersion: one.version, requestId: requestId(), action: { type: 'deal' } } as any), (e: unknown) => e instanceof OfcError && e.code === 'invalid_body');
    await assert.rejects(repo.move(userId, game.id, { ...input, expectedVersion: one.version }), (e: unknown) => e instanceof OfcError && e.code === 'request_reused');
    game = await repo.get(game.id, userId);
    assert.ok(!('deck' in game.state!));
    assert.ok(game.state!.players.filter(p => p.id !== game.myPlayerId).every(p => !p.hand && !p.discards));
  });
  await t.test('completed hands are archived and the next hand is dealt without a connected host', async () => {
    let game = await start(2, 'pineapple');
    for (let i = 0; i < 20 && game.handNumber === 1; i++) {
      const { userId, input } = await actor(game);
      game = await repo.move(userId, game.id, input);
    }
    assert.equal(game.handNumber, 2);
    assert.equal(game.state?.phase, 'placing');
    const history = await repo.history(game.id, a.id);
    assert.equal(history.length, 1);
    assert.equal(history[0].status, 'completed');
    assert.equal(Object.keys(history[0].result!.perPlayer).length, 2);
    assert.equal(game.completedHands, 1);
    assert.equal((await repo.history(game.id, a.id, 1)).length, 0);
    await pool.end();
    pool = new pg.Pool({ connectionString: url.toString() });
    repo = new OfcRepository(pool);
    const resumed = await repo.get(game.id, a.id);
    assert.equal(resumed.version, game.version);
    assert.equal(resumed.handNumber, 2);
    assert.deepEqual(await repo.history(game.id, a.id), history);
  });
  await t.test('normal scoring declares a winner immediately and stale activity does not expire a game', async () => {
    let game = await start();
    const players = game.members.map(m => ({ id: m.playerId, name: m.name! }));
    // Pick a reproducible non-tie deal while retaining the production placement path.
    let deal!: OfcState;
    for (let seed = 0; seed < 1000; seed++) {
      const initial = initGame(players, 1, 'classic', mulberry32(seed));
      const candidate = reduce(initial, createHandDeal(initial, mulberry32(seed + 1000)));
      let trial = candidate;
      while (trial.phase === 'placing') {
        const p = trial.players.find(p => p.id === trial.turnId)!;
        trial = reduce(trial, { type: trial.placeRound === 0 ? 'placeInitial' : 'placeDraw', playerId: p.id,
          placements: place(trial.placeRound === 0 ? p.hand : trial.pending!.cards, p.grid) });
      }
      if (trial.players.some(p => p.eliminated)) { deal = candidate; break; }
    }
    assert.ok(deal);
    await pool.query("UPDATE ofc_games SET state = $2, updated_at = '2000-01-01' WHERE id = $1", [game.id, JSON.stringify(deal)]);
    game = await repo.get(game.id, a.id);
    assert.equal(game.status, 'playing');
    for (let i = 0; i < 18 && game.status === 'playing'; i++) {
      const next = await actor(game); game = await repo.move(next.userId, game.id, next.input);
    }
    assert.equal(game.status, 'finished');
    assert.ok(game.state?.winnerId);
    assert.equal(game.completedHands, 1);
    assert.equal((await repo.history(game.id, a.id))[0].status, 'completed');
  });
  await t.test('pineapple draws remain private to their actor', async () => {
    let game = await start(2, 'pineapple');
    for (let i = 0; i < 2; i++) { const next = await actor(game); game = await repo.move(next.userId, game.id, next.input); }
    const state = await full(game.id);
    for (const u of [a, b]) {
      const v = await repo.get(game.id, u.id);
      assert.equal(!!v.state!.pending!.cards, v.myPlayerId === state.turnId);
    }
  });
  await t.test('Fantasy Land acts in parallel and both directions of secrecy are preserved', async () => {
    const game = await start(3, 'pineapple');
    let state = initGame(game.members.map(m => ({ id: m.playerId, name: m.name! })), 100, 'pineapple', mulberry32(12));
    state.players[0].inFantasyLand = true; state.players[0].fantasyCardCount = 14;
    state.players[1].inFantasyLand = true; state.players[1].fantasyCardCount = 15;
    state = reduce(state, createHandDeal(state, mulberry32(14)));
    await pool.query('UPDATE ofc_games SET state = $2, version = version + 1 WHERE id = $1', [game.id, JSON.stringify(state)]);
    const views = await Promise.all([a, b, c].map(u => repo.get(game.id, u.id)));
    assert.ok(views.every(v => v.canAct));
    assert.ok(!views[2].state!.players[0].grid);
    assert.ok(!views[0].state!.players[2].grid);
    const placed = await repo.move(a.id, game.id, { expectedVersion: views[0].version, requestId: requestId(), action: { type: 'placeFantasy', placements: place(state.players[0].hand.slice(0, 13)) } });
    assert.ok(placed.state!.players[2].grid);
    assert.ok(!(await repo.get(game.id, c.id)).state!.players[0].grid);
    assert.ok((await repo.get(game.id, b.id)).canAct);
  });
  await t.test('forfeit cancels an unfinished hand, removes chips and keeps surviving Fantasy Land rights', async () => {
    const game = await start(3, 'pineapple');
    const state = await full(game.id);
    state.players[0].inFantasyLand = true; state.players[0].fantasyCardCount = 14;
    await pool.query('UPDATE ofc_games SET state = $2 WHERE id = $1', [game.id, JSON.stringify(state)]);
    const before = state.players.filter(p => p.id !== game.myPlayerId).map(p => p.chips);
    const leaveId = requestId();
    await Promise.all([repo.leave(c.id, game.id, leaveId), repo.leave(c.id, game.id, leaveId)]);
    const next = await repo.get(game.id, a.id);
    assert.equal(next.handNumber, 2);
    assert.equal(next.status, 'playing');
    assert.deepEqual(next.state!.players.filter(p => !p.eliminated).map(p => p.chips), before);
    assert.equal(next.state!.players.find(p => p.id === state.players[0].id)?.inFantasyLand, true);
    const history = await repo.history(game.id, a.id);
    assert.equal(history[0].status, 'cancelled');
    assert.equal(history[0].result, null);
    assert.equal(next.completedHands, 0);
    await repo.leave(b.id, game.id, requestId());
    const finished = await repo.get(game.id, a.id);
    assert.equal(finished.status, 'finished');
    assert.equal(finished.state?.winnerId, finished.myPlayerId);
    assert.ok(finished.state!.players.every(p => !p.hand?.length && !p.grid?.top.length));
  });
  await t.test('waiting players can leave, including the creator, and the last departure deletes the room', async () => {
    const room = await create(3);
    await repo.join(b, room.code, requestId());
    await repo.leave(a.id, room.id, requestId());
    assert.equal((await repo.get(room.id, b.id)).status, 'waiting');
    await repo.join(c, room.code, requestId());
    const started = await repo.join(d, room.code, requestId());
    assert.equal(started.members.length, 3);
    const empty = await create();
    const id = requestId();
    await repo.leave(a.id, empty.id, id);
    await repo.leave(a.id, empty.id, id);
    await assert.rejects(repo.get(empty.id, a.id), (e: unknown) => e instanceof OfcError && e.status === 404);
  });
  await t.test('account deletion forfeits and anonymises the seat and prevents new actions', async () => {
    const deleted = await user('Delete me');
    const room = await create();
    await repo.join(deleted, room.code, requestId());
    const waiting = await repo.create(deleted, { variant: 'classic', capacity: 3, visibility: 'public', startingStack: 100, requestId: requestId() });
    await repo.join(a, waiting.code, requestId());
    await repo.deleteAccount(deleted.id, async client => { await client.query('DELETE FROM users WHERE id = $1', [deleted.id]); });
    const waitingAfter = await repo.get(waiting.id, a.id);
    assert.equal(waitingAfter.status, 'waiting');
    assert.equal(waitingAfter.members.length, 1);
    const game = await repo.get(room.id, a.id);
    assert.equal(game.status, 'finished');
    const removed = game.members.find(m => m.playerId !== game.myPlayerId)!;
    assert.equal(removed.name, null);
    assert.equal(removed.status, 'forfeited');
    assert.ok(!JSON.stringify(game).includes('Delete me'));
    await assert.rejects(repo.create(deleted, { variant: 'classic', capacity: 2, visibility: 'public', startingStack: 100, requestId: requestId() }), (e: unknown) => e instanceof OfcError && e.status === 401);
  });
  await t.test('HTTP authentication, hidden state, validation errors and no-store responses', async () => {
    const originalUrl = process.env.DATABASE_URL;
    process.env.DATABASE_URL = url.toString();
    const { closeDb } = await import('../src/postgres.js');
    await closeDb();
    const { handleHttp } = await import('../src/http.js');
    const { signSession } = await import('../src/auth/session.js');
    const server = createServer((req, res) => { void handleHttp(req, res).then(matched => { if (!matched) { res.statusCode = 404; res.end(); } }); });
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    try {
      const base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
      assert.equal((await fetch(`${base}/ofc/games`)).status, 401);
      const headers = { authorization: `Bearer ${await signSession(a.id)}`, 'content-type': 'application/json' };
      const res = await fetch(`${base}/ofc/games`, { method: 'POST', headers, body: JSON.stringify({ variant: 'classic', capacity: 2, visibility: 'private', startingStack: 100, requestId: requestId() }) });
      assert.equal(res.status, 200);
      assert.equal(res.headers.get('cache-control'), 'no-store');
      const { game } = await res.json() as { game: OfcGameDetail };
      const started = await repo.join(b, game.code, requestId());
      const read = await fetch(`${base}/ofc/games/${game.id}`, { headers });
      const body = await read.json() as { game: OfcGameDetail };
      assert.ok(!('deck' in body.game.state!));
      const bad = await fetch(`${base}/ofc/games/${game.id}/moves`, { method: 'POST', headers, body: JSON.stringify({ expectedVersion: started.version, requestId: requestId(), action: { type: 'deal' } }) });
      assert.equal(bad.status, 400);
      const outsider = { authorization: `Bearer ${await signSession(d.id)}` };
      assert.equal((await fetch(`${base}/ofc/games/${game.id}`, { headers: outsider })).status, 404);
      assert.equal((await fetch(`${base}/ofc/games/${game.id}/history?afterHand=-1`, { headers })).status, 400);
    } finally { await new Promise<void>(resolve => server.close(() => resolve())); await closeDb(); process.env.DATABASE_URL = originalUrl; }
  });
});
