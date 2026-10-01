import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { once } from 'node:events';
import pg from 'pg';
import { databasePool, closeDb } from '../src/postgres.js';
import { upsertUser, upsertHand, deleteUser, listHands, getHand } from '../src/db.js';

test('PostgreSQL persistence and HTTP API ownership', {
  skip: !process.env.PROKER_INTEGRATION_TEST, timeout: 90_000,
}, async (t) => {
  const { createRelay } = await import('../src/server.js');
  const { signSession } = await import('../src/auth/session.js');
  const original = process.env.DATABASE_URL_UNPOOLED!;
  assert.ok(original, 'Use the isolated .env.test.local database');
  const admin = new pg.Client({ connectionString: original });
  await admin.connect();
  const schema = `migration_test_${randomUUID().replaceAll('-', '')}`;
  await admin.query(`CREATE SCHEMA ${schema}`);
  for (const key of ['DATABASE_URL', 'DATABASE_URL_UNPOOLED']) {
    const url = new URL(original);
    url.searchParams.set('options', `-c search_path=${schema}`);
    url.searchParams.set('application_name', schema);
    process.env[key] = url.toString();
  }
  const relays: Awaited<ReturnType<typeof createRelay>>[] = [];
  t.after(async () => {
    await Promise.all(relays.map((relay) => relay.close()));
    await closeDb();
    await admin.query(`DROP SCHEMA ${schema} CASCADE`);
    await admin.end();
  });
  const migrations = new URL('../migrations/', import.meta.url);
  for (const file of (await readdir(migrations)).filter(f => f.endsWith('.sql')).sort()) {
    await databasePool().query(await readFile(new URL(file, migrations), 'utf8'));
  }
  const alice = await upsertUser('apple', 'test-alice', 'alice@example.test');
  const sameAlice = await upsertUser('apple', 'test-alice');
  assert.equal(sameAlice.id, alice.id);
  assert.equal(sameAlice.email, alice.email);
  const bob = await upsertUser('google', 'test-bob');
  const hand = (id: string, date = new Date().toISOString()) => ({ id, title: null, stakes: null, gameType: 'NLH', createdAt: date });
  await upsertHand(alice.id, hand('shared-id'), '{}');
  assert.equal(await upsertHand(bob.id, hand('shared-id'), '"attack"'), undefined);
  assert.equal((await getHand('shared-id'))?.user_id, alice.id);
  for (let i = 0; i < 205; i++) await upsertHand(alice.id, hand(`hand-${i}`, new Date(Date.now() + i * 1000).toISOString()), '{}');
  assert.equal((await listHands(alice.id)).length, 200);
  const retainedId = (await listHands(alice.id))[0].id;
  await deleteUser(alice.id);
  assert.equal(await getHand(retainedId), undefined);
  assert.equal((await listHands(alice.id)).length, 0);

  for (let i = 0; i < 2; i++) {
    const relay = await createRelay();
    relay.httpServer.listen(0, '127.0.0.1');
    await once(relay.httpServer, 'listening');
    relays.push(relay);
  }
  const address = relays[1].httpServer.address() as { port: number };
  // Same HTTP interface, with ownership enforced for token-authenticated users.
  const base = `http://127.0.0.1:${address.port}`;
  const token = await signSession(bob.id);
  const headers = { authorization: `Bearer ${token}`, 'content-type': 'application/json' };
  assert.equal((await fetch(`${base}/health`)).status, 200);
  for (const route of ['/privacy', '/support', '/account-deletion']) assert.equal((await fetch(base + route)).status, 200);
  assert.equal((await fetch(`${base}/me`)).status, 401);
  assert.equal((await fetch(`${base}/me`, { headers })).status, 200);
  assert.equal((await fetch(`${base}/me`, { method: 'PATCH', headers, body: '{"pseudo":"Player"}' })).status, 200);
  const firstAddress = relays[0].httpServer.address() as { port: number };
  const firstBase = `http://127.0.0.1:${firstAddress.port}`;
  for (const game of ['ofc', 'bluff']) {
    assert.equal((await fetch(`${base}/${game}/games`)).status, 401);
    const creation = game === 'ofc' ? { variant: 'classic', startingStack: 100 } : { config: { variant: 'standard', jeuMax: false } };
    const response = await fetch(`${firstBase}/${game}/games`, { method: 'POST', headers, body: JSON.stringify({ ...creation, capacity: 2, visibility: 'public', requestId: randomUUID() }) });
    assert.equal(response.status, 200);
    const { game: room } = await response.json();
    const read = await fetch(`${base}/${game}/games/${room.id}`, { headers });
    assert.equal(read.status, 200);
    assert.equal(read.headers.get('cache-control'), 'no-store');
    assert.equal((await read.json()).game.id, room.id);
    assert.equal((await fetch(`${base}/${game}/games`, { headers })).status, 200);
    assert.equal((await fetch(`${base}/${game}/rooms`, { headers })).status, 200);
    assert.equal((await fetch(`${base}/${game}/games/${room.id}/history`, { headers })).status, 200);
    assert.equal((await fetch(`${base}/${game}/games/${room.id}/moves`, { method: 'POST', headers, body: '{"action":{"type":"deal"}}' })).status, 400);
  }
  assert.equal((await fetch(`${base}/socket.io/?EIO=4&transport=polling`)).status, 404);
  const response = await fetch(`${base}/hands/api-hand`, { method: 'PUT', headers, body: JSON.stringify({ id: 'api-hand', createdAt: new Date().toISOString() }) });
  assert.equal(response.status, 200);
  assert.equal((await fetch(`${base}/hands`, { headers })).status, 200);
  const other = await upsertUser('google', 'test-other');
  const otherHeaders = { authorization: `Bearer ${await signSession(other.id)}` };
  assert.equal((await fetch(`${base}/hands/api-hand`, { headers: otherHeaders })).status, 404);
  assert.equal((await fetch(`${base}/auth/google`, { method: 'POST', headers, body: '{"idToken":"invalid"}' })).status, 401);
  assert.equal((await fetch(`${base}/auth/apple`, { method: 'POST', headers, body: '{"identityToken":"invalid"}' })).status, 401);
  assert.equal((await fetch(`${base}/me`, { method: 'DELETE', headers })).status, 200);
  assert.equal((await fetch(`${base}/me`, { headers })).status, 401);

});
