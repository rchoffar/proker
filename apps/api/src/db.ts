import { randomUUID } from 'node:crypto';
import { databasePool, transaction } from './postgres.js';
export { closeDb } from './postgres.js';

export type Provider = 'google' | 'apple';
export interface UserRow {
  id: string;
  provider: Provider;
  provider_user_id: string;
  email: string | null;
  pseudo: string | null;
  created_at: string;
  updated_at: string;
}
export interface HandRow {
  id: string;
  user_id: string;
  title: string | null;
  stakes: string | null;
  game_type: string;
  payload: string;
  created_at: string;
  updated_at: string;
}
export type HandMetaRow = Omit<HandRow, 'payload'>;
const HANDS_PER_USER = 200;

export async function upsertUser(provider: Provider, providerUserId: string, email?: string): Promise<UserRow> {
  const now = new Date().toISOString();
  const { rows } = await databasePool().query<UserRow>(`
    INSERT INTO users (id, provider, provider_user_id, email, created_at, updated_at)
    VALUES ($1, $2, $3, $4, $5, $5)
    ON CONFLICT (provider, provider_user_id) DO UPDATE SET
      email = COALESCE(excluded.email, users.email), updated_at = excluded.updated_at
    RETURNING *`, [randomUUID(), provider, providerUserId, email ?? null, now]);
  return rows[0];
}
export async function getUserById(id: string): Promise<UserRow | undefined> {
  return (await databasePool().query<UserRow>('SELECT * FROM users WHERE id = $1', [id])).rows[0];
}
export async function setPseudo(id: string, pseudo: string): Promise<UserRow | undefined> {
  return (await databasePool().query<UserRow>('UPDATE users SET pseudo = $2, updated_at = $3 WHERE id = $1 RETURNING *',
    [id, pseudo, new Date().toISOString()])).rows[0];
}
export async function deleteUser(id: string): Promise<void> {
  await databasePool().query('DELETE FROM users WHERE id = $1', [id]);
}
export interface HandUpsertInput {
  id: string;
  title: string | null;
  stakes: string | null;
  gameType: string;
  createdAt: string;
}
export async function upsertHand(userId: string, hand: HandUpsertInput, payload: string): Promise<HandRow | undefined> {
  return transaction(async (client) => {
    // Serialise this account's saves and retention pruning with account deletion.
    const user = await client.query('SELECT id FROM users WHERE id = $1 FOR UPDATE', [userId]);
    if (!user.rowCount) return undefined;
    const { rows } = await client.query<HandRow>(`
      INSERT INTO hands (id, user_id, title, stakes, game_type, payload, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT (id) DO UPDATE SET title = excluded.title, stakes = excluded.stakes,
        payload = excluded.payload, updated_at = excluded.updated_at
      WHERE hands.user_id = excluded.user_id
      RETURNING *`, [hand.id, userId, hand.title, hand.stakes, hand.gameType, payload, hand.createdAt, new Date().toISOString()]);
    if (!rows[0]) return undefined;
    await client.query(`DELETE FROM hands WHERE user_id = $1 AND id NOT IN (
      SELECT id FROM hands WHERE user_id = $1 ORDER BY created_at DESC, id DESC LIMIT $2
    )`, [userId, HANDS_PER_USER]);
    return rows[0];
  });
}
export async function listHands(userId: string): Promise<HandMetaRow[]> {
  return (await databasePool().query<HandMetaRow>(`
    SELECT id, user_id, title, stakes, game_type, created_at, updated_at
    FROM hands WHERE user_id = $1 ORDER BY created_at DESC, id DESC LIMIT $2`, [userId, HANDS_PER_USER])).rows;
}
export async function getHand(id: string): Promise<HandRow | undefined> {
  return (await databasePool().query<HandRow>('SELECT * FROM hands WHERE id = $1', [id])).rows[0];
}
export async function deleteHand(id: string, userId: string): Promise<void> {
  await databasePool().query('DELETE FROM hands WHERE id = $1 AND user_id = $2', [id, userId]);
}
