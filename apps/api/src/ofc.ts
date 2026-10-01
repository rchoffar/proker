import { BluffRepository } from './bluff.js';
import { randomInt, randomUUID } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';
import { RANKS, SUITS } from '../../../packages/ofc/cards.js';
import { createHandDeal, emptyGrid, initGame, nextAliveAfter, reduce, validateAction } from '../../../packages/ofc/engine.js';
import type { OfcAction, OfcState, OfcValidationError } from '../../../packages/ofc/engine.js';
import { ofcActorRole } from '../../../packages/ofc/view.js';
import { redactFor } from '../../../packages/ofc/protocol.js';
import type { OfcCreateInput, OfcGameDetail, OfcGameStatus, OfcGameSummary, OfcHistoryEntry, OfcMember, OfcMoveInput } from '../../../packages/ofc/http.js';

interface GameRow {
  id: string; code: string; variant: 'classic' | 'pineapple'; starting_stack: number;
  capacity: 2 | 3; visibility: 'public' | 'private'; status: OfcGameStatus;
  version: number; state: string | null; updated_at: string;
}
interface MemberRow { game_id: string; player_id: string; user_id: string | null; name: string | null; seat: number; status: 'active' | 'forfeited' }
interface User { id: string; pseudo: string | null }

export class OfcError extends Error {
  constructor(public status: number, public code: string, public params?: OfcValidationError['params']) { super(code); }
}
const rng = () => randomInt(0x100000000) / 0x100000000;

/** PostgreSQL row locks make moves and last-seat joins atomic across Vercel instances. */
export class OfcRepository {
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
  private async transaction<T>(operation: (repo: OfcRepository) => Promise<T>): Promise<T> {
    const client = await (this.db as Pool).connect();
    try {
      await client.query('BEGIN');
      const result = await operation(new OfcRepository(client));
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally { client.release(); }
  }
  private async row(id: string, lock = false): Promise<GameRow> {
    const row = await this.one(`SELECT * FROM ofc_games WHERE id = ?${lock ? ' FOR UPDATE' : ''}`, id) as GameRow | undefined;
    if (!row) throw new OfcError(404, 'not_found');
    return row;
  }
  private async members(id: string): Promise<MemberRow[]> {
    return await this.all('SELECT * FROM ofc_members WHERE game_id = ? ORDER BY seat', id) as MemberRow[];
  }
  private async member(id: string, userId: string): Promise<MemberRow> {
    const member = (await this.members(id)).find(m => m.user_id === userId);
    if (!member) throw new OfcError(404, 'not_found');
    return member;
  }
  private async summary(row: GameRow, userId: string, detail: boolean): Promise<OfcGameDetail> {
    const members = await this.members(row.id);
    const mine = members.find(m => m.user_id === userId);
    const full = row.state ? JSON.parse(row.state) as OfcState : null;
    const state = full && mine ? redactFor(full, mine.player_id) : null;
    const completed = await this.one("SELECT COUNT(*) AS n FROM ofc_hands WHERE game_id = ? AND status = 'completed'", row.id) as { n: number };
    return {
      id: row.id, code: row.code, variant: row.variant, startingStack: row.starting_stack,
      capacity: row.capacity, visibility: row.visibility, status: row.status, version: row.version,
      members: members.map(m => ({ playerId: m.player_id, name: m.name, status: m.status } satisfies OfcMember)),
      myPlayerId: mine?.player_id ?? null,
      canAct: row.status === 'playing' && mine?.status === 'active' && !!state && ofcActorRole(state, mine.player_id) !== null,
      handNumber: full?.handNumber ?? 0, completedHands: Number(completed.n), updatedAt: row.updated_at,
      state: detail ? state : null,
    };
  }
  async get(id: string, userId: string): Promise<OfcGameDetail> {
    const row = await this.row(id);
    await this.member(id, userId);
    return this.summary(row, userId, true);
  }
  async list(userId: string): Promise<OfcGameSummary[]> {
    const rows = await this.all(`SELECT g.* FROM ofc_games g JOIN ofc_members m ON g.id = m.game_id
      WHERE m.user_id = ? ORDER BY g.updated_at DESC`, userId) as GameRow[];
    return Promise.all(rows.map(async row => { const { state: _, ...summary } = await this.summary(row, userId, false); return summary; }));
  }
  async rooms(userId: string): Promise<OfcGameSummary[]> {
    const rows = await this.all(`SELECT g.* FROM ofc_games g WHERE status = 'waiting' AND visibility = 'public'
      AND NOT EXISTS (SELECT 1 FROM ofc_members m WHERE m.game_id = g.id AND m.user_id = ?)
      ORDER BY updated_at DESC`, userId) as GameRow[];
    return Promise.all(rows.map(async row => { const { state: _, ...summary } = await this.summary(row, userId, false); return summary; }));
  }
  async history(id: string, userId: string, afterHand = 0): Promise<OfcHistoryEntry[]> {
    await this.get(id, userId);
    const rows = await this.all(`SELECT hand_number, status, result, created_at FROM ofc_hands
      WHERE game_id = ? AND hand_number > ? ORDER BY hand_number LIMIT 50`, id, afterHand) as {
      hand_number: number; status: 'completed' | 'cancelled'; result: string | null; created_at: string;
    }[];
    return rows.map(r => ({ handNumber: r.hand_number, status: r.status, result: r.result ? JSON.parse(r.result) : null, createdAt: r.created_at }));
  }
  private async mutate(userId: string, requestId: string, fingerprint: string, operation: (repo: OfcRepository) => Promise<string | null>): Promise<string | null> {
    if (typeof requestId !== 'string' || !/^[a-zA-Z0-9-]{16,80}$/.test(requestId)) throw new OfcError(400, 'invalid_body');
    return this.transaction(async repo => {
      // Lock even before a receipt exists; duplicate HTTP requests can arrive simultaneously.
      await repo.run('SELECT pg_advisory_xact_lock(hashtextextended(?, 0))', userId);
      // A request authenticated just before deletion must not recreate a deleted account's seat.
      if (!await repo.one('SELECT id FROM users WHERE id = ? FOR UPDATE', userId)) throw new OfcError(401, 'unauthorized');
      const receipt = await repo.one('SELECT * FROM ofc_requests WHERE user_id = ? AND request_id = ?', userId, requestId) as { fingerprint: string; game_id: string | null } | undefined;
      if (receipt) {
        if (receipt.fingerprint !== fingerprint) throw new OfcError(409, 'request_reused');
        return receipt.game_id;
      }
      const gameId = await operation(repo);
      await repo.run('INSERT INTO ofc_requests VALUES (?, ?, ?, ?)', userId, requestId, fingerprint, gameId);
      return gameId;
    });
  }
  async create(user: User, input: OfcCreateInput): Promise<OfcGameDetail> {
    if (!user.pseudo) throw new OfcError(400, 'pseudo_required');
    if (!['classic', 'pineapple'].includes(input.variant) || ![2, 3].includes(input.capacity) ||
        !['public', 'private'].includes(input.visibility) || !Number.isSafeInteger(input.startingStack) || input.startingStack < 1 || input.startingStack > 1000000) throw new OfcError(400, 'invalid_body');
    const id = await this.mutate(user.id, input.requestId, JSON.stringify(['create', input.variant, input.startingStack, input.capacity, input.visibility]), async repo => {
      const id = randomUUID();
      // Persistent rooms do not expire: use a larger code space than the old relay.
      let inserted = false;
      for (let attempt = 0; attempt < 30 && !inserted; attempt++) {
        const code = String(randomInt(100000, 1000000));
        inserted = !!await repo.one('INSERT INTO ofc_games VALUES (?, ?, ?, ?, ?, ?, ?, 1, NULL, ?) ON CONFLICT (code) DO NOTHING RETURNING id',
          id, code, input.variant, input.startingStack, input.capacity, input.visibility, 'waiting', new Date().toISOString());
      }
      if (!inserted) throw new OfcError(503, 'unavailable');
      await repo.run('INSERT INTO ofc_members (game_id, player_id, user_id, name, seat) VALUES (?, ?, ?, ?, 0)', id, randomUUID(), user.id, user.pseudo);
      return id;
    });
    return this.get(id!, user.id);
  }
  async join(user: User, code: string, requestId: string): Promise<OfcGameDetail> {
    if (!user.pseudo) throw new OfcError(400, 'pseudo_required');
    if (typeof code !== 'string' || !/^\d{6}$/.test(code)) throw new OfcError(400, 'invalid_body');
    const id = await this.mutate(user.id, requestId, JSON.stringify(['join', code]), async repo => {
      const row = await repo.one('SELECT * FROM ofc_games WHERE code = ? FOR UPDATE', code) as GameRow | undefined;
      if (!row) throw new OfcError(404, 'not_found');
      const members = await repo.members(row.id);
      if (members.some(m => m.user_id === user.id)) return row.id;
      if (row.status !== 'waiting') throw new OfcError(409, 'started');
      if (members.length >= row.capacity) throw new OfcError(409, 'full');
      const seat = [0, 1, 2].find(s => !members.some(m => m.seat === s))!;
      await repo.run('INSERT INTO ofc_members (game_id, player_id, user_id, name, seat) VALUES (?, ?, ?, ?, ?)', row.id, randomUUID(), user.id, user.pseudo, seat);
      if (members.length + 1 === row.capacity) {
        const players = (await repo.members(row.id)).map(m => ({ id: m.player_id, name: m.name! }));
        const initial = initGame(players, row.starting_stack, row.variant, rng);
        await repo.save(row, reduce(initial, createHandDeal(initial, rng)));
      } else await repo.save(row, null);
      return row.id;
    });
    return this.get(id!, user.id);
  }
  private async save(row: GameRow, state: OfcState | null, status?: OfcGameStatus): Promise<void> {
    await this.run('UPDATE ofc_games SET state = ?, status = ?, version = version + 1, updated_at = ? WHERE id = ?', state ? JSON.stringify(state) : null, status ?? (state ? state.phase === 'gameOver' ? 'finished' : 'playing' : 'waiting'), new Date().toISOString(), row.id);
  }
  async move(userId: string, id: string, input: OfcMoveInput): Promise<OfcGameDetail> {
    if (!Number.isSafeInteger(input.expectedVersion) || !input.action ||
        !['placeInitial', 'placeDraw', 'placeFantasy'].includes(input.action.type) ||
        !Array.isArray(input.action.placements) || input.action.placements.length > 13 ||
        !input.action.placements.every(p => p && ['top', 'middle', 'bottom'].includes(p.row) && p.card && RANKS.includes(p.card.rank) && SUITS.includes(p.card.suit))) {
      throw new OfcError(400, 'invalid_body');
    }
    await this.mutate(userId, input.requestId, JSON.stringify(['move', id, input.expectedVersion, input.action]), async repo => {
      const row = await repo.row(id, true);
      const member = await repo.member(id, userId);
      if (row.version !== input.expectedVersion) throw new OfcError(409, 'stale_version');
      if (row.status !== 'playing' || !row.state || member.status !== 'active') throw new OfcError(409, 'not_playing');
      const action = { ...input.action, playerId: member.player_id } as OfcAction;
      let state = JSON.parse(row.state) as OfcState;
      const valid = validateAction(state, action);
      if (!valid.ok) throw new OfcError(422, valid.code, valid.params);
      state = reduce(state, action);
      if (state.phase === 'scoring') {
        await repo.run('INSERT INTO ofc_hands VALUES (?, ?, ?, ?, ?)', id, state.handNumber, 'completed', JSON.stringify(state.handResult), new Date().toISOString());
        state = reduce(state, { type: 'nextHand', playerId: member.player_id });
        if (state.phase === 'dealing') state = reduce(state, createHandDeal(state, rng));
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
      await this.run('DELETE FROM ofc_members WHERE game_id = ? AND user_id = ?', id, userId);
      if ((await this.members(id)).length === 0) await this.run('DELETE FROM ofc_games WHERE id = ?', id);
      else await this.save(row, null);
      return;
    }
    if (row.status !== 'playing' || member.status === 'forfeited') return;
    await this.run("UPDATE ofc_members SET status = 'forfeited' WHERE game_id = ? AND user_id = ?", id, userId);
    let state = JSON.parse(row.state!) as OfcState;
    if (state.players.find(p => p.id === member.player_id)?.eliminated) {
      await this.save(row, state);
      return;
    }
    await this.run('INSERT INTO ofc_hands VALUES (?, ?, ?, NULL, ?)', id, state.handNumber, 'cancelled', new Date().toISOString());
    state = { ...state, players: state.players.map(p => p.id === member.player_id ? { ...p, chips: 0, eliminated: true } : p), version: state.version + 1 };
    const alive = state.players.filter(p => !p.eliminated);
    if (alive.length <= 1) {
      state = { ...state, phase: 'gameOver', winnerId: alive[0]?.id ?? null, turnId: null, pending: null, deck: [], handResult: null,
        players: state.players.map(p => ({ ...p, hand: [], discards: [], grid: emptyGrid() })) };
    } else {
      // These flags were established by the last completed hand, not by the cancelled one.
      state = { ...state, phase: 'dealing', handNumber: state.handNumber + 1, turnId: null, pending: null, deck: [], handResult: null, placeRound: 0,
        buttonId: alive.some(p => p.id === state.buttonId) ? state.buttonId : nextAliveAfter(state, state.buttonId),
        players: state.players.map(p => ({ ...p, grid: emptyGrid(), hand: [], discards: [], fantasyPlaced: false, inFantasyLand: !p.eliminated && p.inFantasyLand })) };
      state = reduce(state, createHandDeal(state, rng));
    }
    await this.save(row, state, alive.length === 0 ? 'abandoned' : undefined);
  }
  async deleteAccount(userId: string, deleteUser: (client: PoolClient) => Promise<void>): Promise<void> {
    await this.transaction(async repo => {
      await repo.run('SELECT pg_advisory_xact_lock(hashtextextended(?, 0))', userId);
      const games = await repo.all('SELECT game_id FROM ofc_members WHERE user_id = ? ORDER BY game_id', userId) as { game_id: string }[];
      for (const { game_id } of games) {
        await repo.removeParticipant(userId, game_id);
        const row = await repo.one('SELECT * FROM ofc_games WHERE id = ?', game_id) as GameRow | undefined;
        if (!row) continue;
        const member = (await repo.members(game_id)).find(m => m.user_id === userId);
        if (!member) continue;
        if (row.state) {
          const state = JSON.parse(row.state) as OfcState;
          state.players = state.players.map(p => p.id === member.player_id ? { ...p, name: '' } : p);
          await repo.save(row, state, row.status);
        }
        await repo.run('UPDATE ofc_members SET user_id = NULL, name = NULL WHERE game_id = ? AND user_id = ?', game_id, userId);
      }
      await repo.run('DELETE FROM ofc_requests WHERE user_id = ?', userId);
      await new BluffRepository(repo.db).removeAccount(userId);
      await deleteUser(repo.db as PoolClient);
    });
  }
}
