import test from 'node:test';
import assert from 'node:assert/strict';
import { expirePresence, newMember, currentMember, HOST_GRACE_MS, ROOM_IDLE_TTL_MS, type Room } from '../src/rooms.js';

function fixture(now: number): Room {
  const host = newMember('Host', 'socket-old', now);
  return { code: '0123', hostPlayerId: host.playerId, members: { [host.playerId]: host },
    createdAt: now, lastActivity: now, started: false, hostGraceUntil: null };
}
test('an abruptly stopped instance gets a persisted host grace deadline', () => {
  const room = fixture(1000);
  const host = room.members[room.hostPlayerId];
  const expiredAt = host.leaseUntil;
  expirePresence(room, expiredAt + 1);
  assert.equal(host.socketId, null);
  assert.equal(room.hostGraceUntil, expiredAt + HOST_GRACE_MS);
  assert.equal(room.closed, undefined);
  expirePresence(room, expiredAt + HOST_GRACE_MS);
  assert.equal(room.closed, 'host_left');
});
test('old socket is no longer allowed to act after a rejoin', () => {
  const room = fixture(Date.now());
  room.members[room.hostPlayerId].socketId = 'socket-new';
  assert.equal(currentMember(room, room.hostPlayerId, 'socket-old'), undefined);
  assert.ok(currentMember(room, room.hostPlayerId, 'socket-new'));
  assert.equal(currentMember(room, '__proto__', 'socket-new'), undefined);
});
test('presence renewals cannot prevent the inactivity expiry', () => {
  const room = fixture(1000);
  room.members[room.hostPlayerId].leaseUntil = 1000 + ROOM_IDLE_TTL_MS + 100000;
  expirePresence(room, 1000 + ROOM_IDLE_TTL_MS);
  assert.equal(room.closed, 'expired');
});
