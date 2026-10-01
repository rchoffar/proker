import { randomInt, randomUUID } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';
import { createRoundDeal, initGame, nextAliveAfter, reduce, validateAction } from '../../../packages/bluff/engine.js';
import type { BluffAction, BluffState, BluffValidationError, BluffConfig } from '../../../packages/bluff/engine.js';
import { enumerateAllClaims } from '../../../packages/bluff/claims.js';
import { redactFor } from '../../../packages/bluff/protocol.js';
import type { BluffCreateInput, BluffGameDetail, BluffStatus, BluffGameSummary, BluffMoveInput, BluffHistoryEntry } from '../../../packages/bluff/http.js';

interface GameRow {
  id: string; code: string; config: string; capacity: number; visibility: 'public' | 'private';
  status: BluffStatus; version: number; state: string | null; updated_at: string;
}
interface MemberRow { game_id: string; player_id: string; user_id: string | null; name: string | null; seat: number; status: 'active' | 'forfeited' }
interface User { id: string; pseudo: string | null }

export class BluffError extends Error {
  constructor(public status: number, public code: string, public params?: BluffValidationError['params']) { super(code); }
}
const rng = () => randomInt(0x100000000) / 0x100000000;

/** PostgreSQL row locks make moves and last-seat joins atomic across Vercel instances. */
export class BluffRepository {
  constructor(private db: Pool | PoolClient) {}
  private async one<T>(sql: string, ...params: unknown[]): Promise<T | undefined> {
    return (await this.db.query(this.sql(sql), params)).rows[0] as T | undefined;
  }
  private async all<T>(sql: string, ...params: unknown[]): Promise<T[]> {
    return (await this.db.query(this.sql(sql), params)).rows as T[];
  }
  private async run(sql: string, ...params: unknown[]): Promise<void> {
    await this.db.query(this.sql(sql), params);
  }
  private sql(sql: string): string { let n = 0; return sql.replace(/\?/g, () => `$${++n}`); }
  private async transaction<T>(operation: (repo: BluffRepository) => Promise<T>): Promise<T> {
    const client = await (this.db as Pool).connect();
    try {
      await client.query("BEGIN; SET LOCAL idle_in_transaction_session_timeout = '5s'; SET LOCAL lock_timeout = '3s'; SET LOCAL statement_timeout = '10s'");
      const result = await operation(new BluffRepository(client));
      await client.query('COMMIT');
      return result;
    } catch (error) {
      try { await client.query('ROLLBACK'); } catch { /* Connection may have ended. */ }
      throw error;
    } finally { client.release(); }
  }
  private async row(id: string, lock = false): Promise<GameRow> {
    const row = await this.one(`SELECT * FROM bluff_games WHERE id = ?${lock ? ' FOR UPDATE' : ''}`, id) as GameRow | undefined;
    if (!row) throw new BluffError(404, 'not_found');
    return row;
  }
  private async members(id: string): Promise<MemberRow[]> {
    return await this.all('SELECT * FROM bluff_members WHERE game_id = ? ORDER BY seat', id) as MemberRow[];
  }
  private async member(id: string, userId: string): Promise<MemberRow> {
    const member = (await this.members(id)).find(m => m.user_id === userId);
    if (!member) throw new BluffError(404, 'not_found');
    return member;
  }
  private async summary(row: GameRow, userId: string, detail: boolean): Promise<BluffGameDetail> {
    const members = await this.members(row.id);
    const mine = members.find(m => m.user_id === userId);
    const full = row.state ? JSON.parse(row.state) as BluffState : null;
    const state = full && mine ? redactFor(full, mine.player_id) : null;
    const completed = await this.one<{ n: string }>("SELECT COUNT(*) AS n FROM bluff_rounds WHERE game_id = ? AND status = 'completed'", row.id);
    return {
      completedRounds: Number(completed?.n ?? 0),
      id: row.id, code: row.code, config: JSON.parse(row.config) as BluffConfig,
      capacity: row.capacity, visibility: row.visibility, status: row.status, version: row.version,
      members: members.map(m => ({ playerId: m.player_id, name: m.name, status: m.status })),
      myPlayerId: mine?.player_id ?? null,
      canAct: row.status === 'playing' && mine?.status === 'active' && !!state &&
        (state.phase === 'chooseBoard' ? state.starterId === mine.player_id : state.phase === 'bidding' && state.turnId === mine.player_id),
      round: full?.round ?? 0, updatedAt: row.updated_at,
      state: detail ? state && { ...state, version: row.version } : null,
    };
  }
  /** Advance resolved rounds on any read; no connected host or background timer is needed. */
  private async advance(id: string): Promise<void> {
    const row = await this.row(id);
    if (row.status !== 'playing' || !row.state) return;
    const state = JSON.parse(row.state) as BluffState;
    if (!['reveal', 'roundEnd'].includes(state.phase) || Date.now() - Date.parse(row.updated_at) < 7000) return;
    await this.transaction(async repo => {
      const current = await repo.row(id, true);
      let next = current.state ? JSON.parse(current.state) as BluffState : null;
      if (!next || !['reveal', 'roundEnd'].includes(next.phase) || Date.now() - Date.parse(current.updated_at) < 7000) return;
      const playerId = next.players[0].id;
      if (next.phase === 'reveal') next = reduce(next, { type: 'confirmReveal', playerId });
      next = reduce(next, { type: 'nextRound', playerId });
      if (next.phase === 'dealing') next = reduce(next, createRoundDeal(next, rng));
      await repo.save(current, next);
    });
  }
  async get(id: string, userId: string): Promise<BluffGameDetail> {
    await this.member(id, userId);
    await this.advance(id);
    const row = await this.row(id);
    return this.summary(row, userId, true);
  }
  async list(userId: string): Promise<BluffGameSummary[]> {
    const rows = await this.all(`SELECT g.* FROM bluff_games g JOIN bluff_members m ON g.id = m.game_id
      WHERE m.user_id = ? ORDER BY g.updated_at DESC`, userId) as GameRow[];
    return Promise.all(rows.map(async row => { await this.advance(row.id); const { state: _, ...summary } = await this.summary(await this.row(row.id), userId, false); return summary; }));
  }
  async rooms(userId: string): Promise<BluffGameSummary[]> {
    const rows = await this.all(`SELECT g.* FROM bluff_games g WHERE status = 'waiting' AND visibility = 'public'
      AND NOT EXISTS (SELECT 1 FROM bluff_members m WHERE m.game_id = g.id AND m.user_id = ?)
      ORDER BY updated_at DESC`, userId) as GameRow[];
    return Promise.all(rows.map(async row => { const { state: _, ...summary } = await this.summary(row, userId, false); return summary; }));
  }
  async history(id: string, userId: string, afterRound = 0): Promise<BluffHistoryEntry[]> {
    await this.member(id, userId);
    const rows = await this.all<{ round: number; status: 'completed' | 'cancelled'; result: string | null }>(
      'SELECT round, status, result FROM bluff_rounds WHERE game_id = ? AND round > ? ORDER BY round LIMIT 50', id, afterRound);
    return rows.map(row => ({ round: row.round, status: row.status, result: row.result ? JSON.parse(row.result) : null }));
  }
  private async mutate(userId: string, requestId: string, fingerprint: string, operation: (repo: BluffRepository) => Promise<string | null>): Promise<string | null> {
    if (typeof requestId !== 'string' || !/^[a-zA-Z0-9-]{16,80}$/.test(requestId)) throw new BluffError(400, 'invalid_body');
    return this.transaction(async repo => {
      // Lock even before a receipt exists; duplicate HTTP requests can arrive simultaneously.
      await repo.run('SELECT pg_advisory_xact_lock(hashtextextended(?, 0))', userId);
      // A request authenticated just before deletion must not recreate a deleted account's seat.
      if (!await repo.one('SELECT id FROM users WHERE id = ? FOR UPDATE', userId)) throw new BluffError(401, 'unauthorized');
      const receipt = await repo.one('SELECT * FROM bluff_requests WHERE user_id = ? AND request_id = ?', userId, requestId) as { fingerprint: string; game_id: string | null } | undefined;
      if (receipt) {
        if (receipt.fingerprint !== fingerprint) throw new BluffError(409, 'request_reused');
        return receipt.game_id;
      }
      const gameId = await operation(repo);
      await repo.run('INSERT INTO bluff_requests VALUES (?, ?, ?, ?)', userId, requestId, fingerprint, gameId);
      return gameId;
    });
  }
  async create(user: User, input: BluffCreateInput): Promise<BluffGameDetail> {
    if (!user.pseudo) throw new BluffError(400, 'pseudo_required');
    if (!input.config || !['standard', 'quick'].includes(input.config.variant) || typeof input.config.jeuMax !== 'boolean' ||
        !Number.isInteger(input.capacity) || input.capacity < 2 || input.capacity > 6 ||
        !['public', 'private'].includes(input.visibility)) throw new BluffError(400, 'invalid_body');
    const id = await this.mutate(user.id, input.requestId, JSON.stringify(['create', input.config, input.capacity, input.visibility]), async repo => {
      const id = randomUUID();
      // Persistent rooms do not expire: use a larger code space than the old relay.
      let inserted = false;
      for (let attempt = 0; attempt < 30 && !inserted; attempt++) {
        const code = String(randomInt(100000, 1000000));
        inserted = !!await repo.one('INSERT INTO bluff_games VALUES (?, ?, ?, ?, ?, ?, 1, NULL, ?) ON CONFLICT (code) DO NOTHING RETURNING id',
          id, code, JSON.stringify(input.config), input.capacity, input.visibility, 'waiting', new Date().toISOString());
      }
      if (!inserted) throw new BluffError(503, 'unavailable');
      await repo.run('INSERT INTO bluff_members (game_id, player_id, user_id, name, seat) VALUES (?, ?, ?, ?, 0)', id, randomUUID(), user.id, user.pseudo);
      return id;
    });
    return this.get(id!, user.id);
  }
  async join(user: User, code: string, requestId: string): Promise<BluffGameDetail> {
    if (!user.pseudo) throw new BluffError(400, 'pseudo_required');
    if (typeof code !== 'string' || !/^\d{6}$/.test(code)) throw new BluffError(400, 'invalid_body');
    const id = await this.mutate(user.id, requestId, JSON.stringify(['join', code]), async repo => {
      const row = await repo.one('SELECT * FROM bluff_games WHERE code = ? FOR UPDATE', code) as GameRow | undefined;
      if (!row) throw new BluffError(404, 'not_found');
      const members = await repo.members(row.id);
      if (members.some(m => m.user_id === user.id)) return row.id;
      if (row.status !== 'waiting') throw new BluffError(409, 'started');
      if (members.length >= row.capacity) throw new BluffError(409, 'full');
      const seat = [0, 1, 2, 3, 4, 5].find(s => !members.some(m => m.seat === s))!;
      await repo.run('INSERT INTO bluff_members (game_id, player_id, user_id, name, seat) VALUES (?, ?, ?, ?, ?)', row.id, randomUUID(), user.id, user.pseudo, seat);
      if (members.length + 1 === row.capacity) {
        const players = (await repo.members(row.id)).map(m => ({ id: m.player_id, name: m.name! }));
        const initial = initGame(players, rng, JSON.parse(row.config) as BluffConfig);
        await repo.save(row, reduce(initial, createRoundDeal(initial, rng)));
      } else await repo.save(row, null);
      return row.id;
    });
    return this.get(id!, user.id);
  }
  private async save(row: GameRow, state: BluffState | null, status?: BluffStatus): Promise<void> {
    await this.run('UPDATE bluff_games SET state = ?, status = ?, version = version + 1, updated_at = ? WHERE id = ?', state ? JSON.stringify(state) : null, status ?? (state ? state.phase === 'gameOver' ? 'finished' : 'playing' : 'waiting'), new Date().toISOString(), row.id);
  }
  async move(userId: string, id: string, input: BluffMoveInput): Promise<BluffGameDetail> {
    const action = input.action;
    if (!Number.isSafeInteger(input.expectedVersion) || !action ||
        !['chooseBoard', 'claim', 'catch', 'jeuMax'].includes(action.type)) throw new BluffError(400, 'invalid_body');
    if (action.type === 'chooseBoard' && (!Number.isInteger(action.faceUpCount) || !Number.isInteger(action.faceDownCount))) throw new BluffError(400, 'invalid_body');
    if (action.type === 'claim' && !enumerateAllClaims().some(claim => Object.entries(claim).every(([key, value]) => action.claim && (action.claim as unknown as Record<string, unknown>)[key] === value) && Object.keys(claim).length === Object.keys(action.claim ?? {}).length)) {
      throw new BluffError(400, 'invalid_body');
    }
    await this.mutate(userId, input.requestId, JSON.stringify(['move', id, input.expectedVersion, input.action]), async repo => {
      const row = await repo.row(id, true);
      const member = await repo.member(id, userId);
      if (row.version !== input.expectedVersion) throw new BluffError(409, 'stale_version');
      if (row.status !== 'playing' || !row.state || member.status !== 'active') throw new BluffError(409, 'not_playing');
      const action = { ...input.action, playerId: member.player_id } as BluffAction;
      let state = JSON.parse(row.state) as BluffState;
      const valid = validateAction(state, action);
      if (!valid.ok) throw new BluffError(422, valid.code, valid.params);
      state = reduce(state, action);
      if (state.phase === 'reveal') {
        await repo.run('INSERT INTO bluff_rounds VALUES (?, ?, ?, ?, ?)', id, state.round, 'completed', JSON.stringify(state.reveal), new Date().toISOString());
      }
      await repo.save(row, state);
      return id;
    });
    return this.get(id, userId);
  }
  async leave(userId: string, id: string, requestId: string): Promise<void> {
    await this.mutate(userId, requestId, JSON.stringify(['leave', id]), async repo => { await repo.removeParticipant(userId, id); return null; });
  }
  private async removeParticipant(userId: string, id: string): Promise<void> {
    const row = await this.row(id, true);
    const member = await this.member(id, userId);
    if (row.status === 'waiting') {
      await this.run('DELETE FROM bluff_members WHERE game_id = ? AND user_id = ?', id, userId);
      if ((await this.members(id)).length === 0) await this.run('DELETE FROM bluff_games WHERE id = ?', id);
      else await this.save(row, null);
      return;
    }
    if (row.status !== 'playing' || member.status === 'forfeited') return;
    await this.run("UPDATE bluff_members SET status = 'forfeited' WHERE game_id = ? AND user_id = ?", id, userId);
    let state = JSON.parse(row.state!) as BluffState;
    if (state.players.find(p => p.id === member.player_id)?.eliminated) {
      await this.save(row, state);
      return;
    }
    await this.run('INSERT INTO bluff_rounds VALUES (?, ?, ?, NULL, ?) ON CONFLICT DO NOTHING', id, state.round, 'cancelled', new Date().toISOString());
    state = { ...state, players: state.players.map(p => p.id === member.player_id ? { ...p, hand: [], eliminated: true } : p), version: state.version + 1 };
    const alive = state.players.filter(p => !p.eliminated);
    if (alive.length <= 1) {
      state = { ...state, phase: 'gameOver', winnerId: alive[0]?.id ?? null, board: [], hiddenBoard: [], boardStock: [], reveal: null,
        players: state.players.map(p => ({ ...p, hand: [] })) };
    } else {
      const starterId = alive.some(p => p.id === state.starterId) ? state.starterId : nextAliveAfter(state, state.starterId);
      state = { ...state, phase: 'dealing', round: state.round + 1, starterId, turnId: starterId,
        board: [], hiddenBoard: [], boardStock: [], reveal: null, currentClaim: null, claimHistory: [], players: state.players.map(p => ({ ...p, hand: [] })) };
      state = reduce(state, createRoundDeal(state, rng));
    }
    await this.save(row, state, alive.length === 0 ? 'abandoned' : undefined);
  }
  async removeAccount(userId: string): Promise<void> {
    const repo = this;
      await repo.run('SELECT pg_advisory_xact_lock(hashtextextended(?, 0))', userId);
      const games = await repo.all('SELECT game_id FROM bluff_members WHERE user_id = ? ORDER BY game_id', userId) as { game_id: string }[];
      for (const { game_id } of games) {
        await repo.removeParticipant(userId, game_id);
        const row = await repo.one('SELECT * FROM bluff_games WHERE id = ?', game_id) as GameRow | undefined;
        if (!row) continue;
        const member = (await repo.members(game_id)).find(m => m.user_id === userId);
        if (!member) continue;
        if (row.state) {
          const state = JSON.parse(row.state) as BluffState;
          state.players = state.players.map(p => p.id === member.player_id ? { ...p, name: '' } : p);
          await repo.save(row, state, row.status);
        }
        await repo.run('UPDATE bluff_members SET user_id = NULL, name = NULL WHERE game_id = ? AND user_id = ?', game_id, userId);
      }
      await repo.run('DELETE FROM bluff_requests WHERE user_id = ?', userId);
  }
}
