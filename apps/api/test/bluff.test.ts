import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import pg from 'pg';
import { OfcRepository } from '../src/ofc.js';
import { BluffError, BluffRepository } from '../src/bluff.js';
import type { BluffState } from '../../../packages/bluff/engine.js';
import type { BluffGameDetail } from '../../../packages/bluff/http.js';

const requestId = () => randomUUID();
test('persistent server-authoritative Bluff', { skip: !process.env.PROKER_INTEGRATION_TEST, timeout: 90000 }, async t => {
  const admin = new pg.Client({ connectionString: process.env.DATABASE_URL_UNPOOLED! });
  await admin.connect();
  const schema = `bluff_test_${randomUUID().replaceAll('-', '')}`;
  await admin.query(`CREATE SCHEMA ${schema}`);
  const url = new URL(process.env.DATABASE_URL_UNPOOLED!);
  url.searchParams.set('options', `-c search_path=${schema}`);
  const pool = new pg.Pool({ connectionString: url.toString(), max: 6 });
  const repo = new BluffRepository(pool);
  t.after(async () => { await pool.end(); await admin.query(`DROP SCHEMA ${schema} CASCADE`); await admin.end(); });
  const migrations = new URL('../migrations/', import.meta.url);
  for (const file of (await readdir(migrations)).filter(f => f.endsWith('.sql')).sort()) await pool.query(await readFile(new URL(file, migrations), 'utf8'));
  const users = await Promise.all(['Alice', 'Bob', 'Chloé', 'Dan', 'Eve', 'Fred', 'Guest'].map(async pseudo => {
    const id = randomUUID();
    await pool.query('INSERT INTO users VALUES ($1, $2, $3, NULL, $4, $5, $5)', [id, 'google', id, pseudo, new Date().toISOString()]);
    return { id, pseudo };
  }));
  const create = (capacity = 2, visibility: 'public' | 'private' = 'public') => repo.create(users[0], {
    capacity, visibility, config: { variant: 'quick', jeuMax: true }, requestId: requestId(),
  });
  const full = async (id: string) => JSON.parse((await pool.query('SELECT state FROM bluff_games WHERE id = $1', [id])).rows[0].state) as BluffState;
  const userFor = async (id: string, playerId: string) => (await pool.query('SELECT user_id FROM bluff_members WHERE game_id = $1 AND player_id = $2', [id, playerId])).rows[0].user_id as string;
  const move = async (game: BluffGameDetail, action: { type: 'catch' } | { type: 'claim'; claim: { category: 'royalFlush' } } | { type: 'chooseBoard'; faceUpCount: number; faceDownCount: number }) => {
    const state = await full(game.id);
    const actor = action.type === 'chooseBoard' ? state.starterId : state.turnId;
    return repo.move(await userFor(game.id, actor), game.id, { requestId: requestId(), expectedVersion: game.version, action });
  };
  const advance = async (game: BluffGameDetail) => {
    await pool.query('UPDATE bluff_games SET updated_at = $1 WHERE id = $2', [new Date(Date.now() - 8000).toISOString(), game.id]);
    return repo.get(game.id, users[0].id);
  };
  await t.test('private rooms, membership, auto-start and persisted states', async () => {
    const room = await create(3, 'private');
    assert.equal(room.status, 'waiting');
    assert.ok(!(await repo.rooms(users[1].id)).some(r => r.id === room.id));
    assert.ok((await repo.list(users[0].id)).some(r => r.id === room.id));
    await assert.rejects(repo.get(room.id, users[1].id), (e: unknown) => e instanceof BluffError && e.status === 404);
    assert.equal((await repo.join(users[1], room.code, requestId())).status, 'waiting');
    const game = await repo.join(users[2], room.code, requestId());
    assert.equal(game.status, 'playing');
    assert.equal(game.state?.phase, 'chooseBoard');
    assert.equal(game.state?.players.find(p => p.id === game.myPlayerId)?.hand?.length, 1);
    assert.ok(game.state?.players.filter(p => p.id !== game.myPlayerId).every(p => p.hand === undefined));
    assert.ok(!Object.hasOwn(game.state!, 'boardStock'));
    assert.deepEqual(await new BluffRepository(pool).get(room.id, users[2].id), game);
    await assert.rejects(repo.join(users[3], room.code, requestId()), (e: unknown) => e instanceof BluffError && e.code === 'started');
  });
  await t.test('concurrent last seats start once and capacity is respected', async () => {
    const room = await create(2);
    const joins = await Promise.allSettled(users.slice(1, 5).map(user => repo.join(user, room.code, requestId())));
    assert.equal(joins.filter(r => r.status === 'fulfilled').length, 1);
    const game = await repo.get(room.id, users[0].id);
    assert.equal(game.members.length, 2);
    assert.equal(game.state?.round, 1);
  });
  await t.test('idempotent creation and moves, actor enforcement and stale requests', async () => {
    const input = { capacity: 2, visibility: 'public' as const, config: { variant: 'standard' as const, jeuMax: false }, requestId: requestId() };
    const [a, b] = await Promise.all([repo.create(users[0], input), repo.create(users[0], input)]);
    assert.equal(a.id, b.id);
    const game = await repo.join(users[1], a.code, requestId());
    const state = await full(game.id);
    const actor = await userFor(game.id, state.starterId);
    const other = users.slice(0, 2).find(u => u.id !== actor)!.id;
    const inputMove = { requestId: requestId(), expectedVersion: game.version, action: { type: 'chooseBoard' as const, faceUpCount: 0, faceDownCount: 2 } };
    await assert.rejects(repo.move(other, game.id, inputMove), (e: unknown) => e instanceof BluffError && e.status === 422);
    const [first, retry] = await Promise.all([repo.move(actor, game.id, inputMove), repo.move(actor, game.id, inputMove)]);
    assert.equal(first.version, retry.version);
    assert.equal(first.state?.hiddenBoardCount, 2);
    assert.equal(first.state?.hiddenBoard, undefined);
    await assert.rejects(repo.move(actor, game.id, { ...inputMove, requestId: requestId() }), (e: unknown) => e instanceof BluffError && e.code === 'stale_version');
    await assert.rejects(repo.move(actor, game.id, { ...inputMove, action: { type: 'deal' } } as never), (e: unknown) => e instanceof BluffError && e.status === 400);
  });
  await t.test('complete match advances without a host and keeps reveal history', async () => {
    const room = await create();
    let game = await repo.join(users[1], room.code, requestId());
    let completed = 0;
    while (game.status !== 'finished') {
      assert.ok(completed < 40);
      game = await move(game, { type: 'chooseBoard', faceUpCount: 0, faceDownCount: 0 });
      game = await move(game, { type: 'claim', claim: { category: 'royalFlush' } });
      game = await move(game, { type: 'catch' });
      assert.equal(game.state?.phase, 'reveal');
      assert.equal((await repo.get(game.id, users[0].id)).state?.phase, 'reveal');
      assert.ok(game.state?.players.every(p => Array.isArray(p.hand)));
      game = await advance(game);
      completed++;
    }
    assert.ok(game.state?.winnerId);
    assert.equal(game.completedRounds, completed);
    const rounds = await repo.history(game.id, users[0].id);
    assert.equal(rounds.length, completed);
    assert.ok(rounds.every(r => r.status === 'completed' && r.result));
  });
  await t.test('leaving persists a forfeit and re-deals for the remaining players', async () => {
    const room = await create(3);
    await repo.join(users[1], room.code, requestId());
    await repo.join(users[2], room.code, requestId());
    await repo.leave(users[0].id, room.id, requestId());
    const game = await repo.get(room.id, users[1].id);
    assert.equal(game.state?.round, 2);
    assert.equal(game.status, 'playing');
    assert.equal(game.members.find(m => m.name === users[0].pseudo)?.status, 'forfeited');
    assert.equal((await repo.history(room.id, users[1].id))[0].status, 'cancelled');
    await repo.leave(users[1].id, room.id, requestId());
    assert.equal((await repo.get(room.id, users[2].id)).status, 'finished');
  });
  await t.test('account deletion forfeits and anonymises active seats', async () => {
    const room = await create(3);
    await repo.join(users[1], room.code, requestId());
    await repo.join(users[2], room.code, requestId());
    await new OfcRepository(pool).deleteAccount(users[0].id, async client => { await client.query('DELETE FROM users WHERE id = $1', [users[0].id]); });
    const game = await repo.get(room.id, users[1].id);
    assert.equal(game.status, 'playing');
    assert.ok(game.members.some(m => m.name === null && m.status === 'forfeited'));
    assert.ok(!(await full(room.id)).players.some(p => p.name === 'Alice'));
    await assert.rejects(create(), (e: unknown) => e instanceof BluffError && e.status === 401);
  });
});
