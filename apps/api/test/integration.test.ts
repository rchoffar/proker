import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { once } from 'node:events';
import pg from 'pg';
import { io, type Socket } from 'socket.io-client';
import { databasePool, closeDb } from '../src/postgres.js';
import { upsertUser, upsertHand, deleteUser, listHands, getHand } from '../src/db.js';
import { createRoom, newMember, updateRoom, roomCount, HOST_GRACE_MS } from '../src/rooms.js';

test('PostgreSQL persistence, API ownership and two-instance relay', {
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
  process.env.SOCKET_IO_CHANNEL_PREFIX = schema;
  const relays: Awaited<ReturnType<typeof createRelay>>[] = [];
  const sockets: Socket[] = [];
  t.after(async () => {
    sockets.forEach((socket) => socket.disconnect());
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

  const created = await createRoom('Atomic host', 'atomic-host');
  assert.ok(created);
  await Promise.all(Array.from({ length: 10 }, (_, i) => updateRoom(created.room.code, room => {
    if (Object.keys(room.members).length < 6) {
      const member = newMember(`guest-${i}`, `atomic-${i}`);
      room.members[member.playerId] = member;
    }
  })));
  const checked = await updateRoom(created.room.code, room => Object.keys(room.members).length);
  assert.equal(checked.value, 6);
  // Simulate an invocation frozen after acquiring a row lock. PostgreSQL must
  // release that lock itself so a different instance can proceed.
  const frozen = await databasePool().connect();
  await frozen.query("BEGIN; SET LOCAL idle_in_transaction_session_timeout = '500ms'");
  await frozen.query('SELECT state FROM rooms WHERE code = $1 FOR UPDATE', [created.room.code]);
  const afterFreeze = await updateRoom(created.room.code, room => Object.keys(room.members).length);
  assert.equal(afterFreeze.value, 6);
  await databasePool().query('DELETE FROM rooms');

  for (let i = 0; i < 2; i++) {
    const relay = await createRelay();
    relay.httpServer.listen(0, '127.0.0.1');
    await once(relay.httpServer, 'listening');
    relays.push(relay);
    const address = relay.httpServer.address() as { port: number };
    const socket = io(`http://127.0.0.1:${address.port}`, { transports: ['websocket'], reconnection: false });
    await once(socket, 'connect');
    sockets.push(socket);
  }
  // Wait until PostgreSQL subscriptions have exchanged node-discovery heartbeats.
  const deadline = Date.now() + 10_000;
  while (await relays[0].io.of('/').adapter.serverCount() < 2) {
    assert.ok(Date.now() < deadline, 'The PostgreSQL relay must discover its second instance');
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  const host = sockets[0], guest = sockets[1];
  const ack = (socket: Socket, event: string, payload?: unknown): Promise<any> =>
    socket.timeout(5000).emitWithAck(event, ...(payload === undefined ? [] : [payload]));
  const hostSession = await ack(host, 'room:create', { name: 'Host' });
  assert.equal(hostSession.ok, true);
  const guestSession = await ack(guest, 'room:join', { name: 'Guest', code: hostSession.code });
  assert.equal(guestSession.ok, true);
  assert.equal((await ack(guest, 'room:rejoin', { code: hostSession.code, playerId: '__proto__' })).reason, 'not_found');
  const fromPlayer = once(host, 'game:fromPlayer');
  guest.emit('game:toHost', { payload: { kind: 'requestState' } });
  assert.deepEqual((await fromPlayer)[0], { fromPlayerId: guestSession.playerId, payload: { kind: 'requestState' } });
  const large = { kind: 'state', data: 'x'.repeat(12000) };
  const largeState = once(guest, 'game:fromHost');
  host.emit('game:toPlayer', { playerId: guestSession.playerId, payload: large });
  assert.deepEqual((await largeState)[0], { payload: large });
  const broadcast = once(guest, 'game:fromHost');
  host.emit('game:broadcast', { payload: { version: 2 } });
  assert.deepEqual((await broadcast)[0], { payload: { version: 2 } });

  // Rejoin before the old socket disconnects. Its delayed disconnect must not clear presence.
  const address = relays[1].httpServer.address() as { port: number };
  const replacement = io(`http://127.0.0.1:${address.port}`, { transports: ['websocket'], reconnection: false });
  sockets.push(replacement);
  await once(replacement, 'connect');
  assert.deepEqual(await ack(replacement, 'room:rejoin', hostSession), { ok: true });
  host.disconnect();
  const postRejoin = once(replacement, 'game:fromPlayer');
  guest.emit('game:toHost', { payload: { kind: 'requestState' } });
  assert.equal((await postRejoin)[0].fromPlayerId, guestSession.playerId);
  const state = await updateRoom(hostSession.code, room => room.members[room.hostPlayerId].socketId);
  assert.equal(state.value, replacement.id);
  await updateRoom(hostSession.code, room => { room.started = true; });
  assert.equal((await ack(host.connect(), 'room:join', { code: hostSession.code, name: 'Late' })).reason, 'started');
  const closed = once(guest, 'room:closed');
  await ack(replacement, 'room:leave');
  assert.deepEqual((await closed)[0], { reason: 'host_left' });
  assert.equal(await roomCount(), 0);

  // Same HTTP interface, with ownership enforced for token-authenticated users.
  const base = `http://127.0.0.1:${address.port}`;
  const token = await signSession(bob.id);
  const headers = { authorization: `Bearer ${token}`, 'content-type': 'application/json' };
  assert.equal((await fetch(`${base}/health`)).status, 200);
  for (const route of ['/privacy', '/support', '/account-deletion']) assert.equal((await fetch(base + route)).status, 200);
  assert.equal((await fetch(`${base}/me`)).status, 401);
  assert.equal((await fetch(`${base}/me`, { headers })).status, 200);
  assert.equal((await fetch(`${base}/me`, { method: 'PATCH', headers, body: '{"pseudo":"Player"}' })).status, 200);
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

  // Terminate only this test's checked-out LISTEN connections, never other users.
  const dropped = sockets.filter(socket => socket.connected).map(socket => once(socket, 'disconnect'));
  const killed = await admin.query(`SELECT pg_terminate_backend(pid) FROM pg_stat_activity
    WHERE application_name = $1 AND query LIKE 'LISTEN%'`, [schema]);
  assert.ok(killed.rowCount && killed.rowCount >= 2);
  await Promise.all(dropped);
  await new Promise(resolve => setTimeout(resolve, 4000));
  await Promise.all([host, guest].map(async socket => { socket.connect(); await once(socket, 'connect'); }));
  const afterOutage = await ack(host, 'room:create', { name: 'Recovered host' });
  assert.equal(afterOutage.ok, true);
  const afterOutageGuest = await ack(guest, 'room:join', { code: afterOutage.code, name: 'Recovered guest' });
  assert.equal(afterOutageGuest.ok, true);
  const delivered = once(guest, 'game:fromHost');
  host.emit('game:broadcast', { payload: { recovered: true } });
  assert.deepEqual((await delivered)[0], { payload: { recovered: true } });
  await ack(host, 'room:leave');
});
