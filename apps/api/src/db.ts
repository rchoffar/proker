import { randomUUID } from 'node:crypto';
import Database from 'better-sqlite3';
import { DATABASE_PATH } from './config.js';

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

// Everything a hand-list view needs — payload deliberately excluded (blobs stay on disk
// until a single hand is requested; the VM only has 256 MB).
export type HandMetaRow = Omit<HandRow, 'payload'>;

const db = new Database(DATABASE_PATH);
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    provider TEXT NOT NULL CHECK (provider IN ('google', 'apple')),
    provider_user_id TEXT NOT NULL,
    email TEXT,
    pseudo TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE (provider, provider_user_id)
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS hands (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    title TEXT,
    stakes TEXT,
    game_type TEXT NOT NULL DEFAULT 'NLH',
    payload TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_hands_user_created ON hands (user_id, created_at DESC);
`);

const upsertStmt = db.prepare<[string, string, string, string | null, string, string], UserRow>(`
  INSERT INTO users (id, provider, provider_user_id, email, pseudo, created_at, updated_at)
  VALUES (?, ?, ?, ?, NULL, ?, ?)
  ON CONFLICT (provider, provider_user_id)
  DO UPDATE SET
    email = COALESCE(excluded.email, users.email),
    updated_at = excluded.updated_at
  RETURNING *
`);

const getByIdStmt = db.prepare<[string], UserRow>('SELECT * FROM users WHERE id = ?');

const setPseudoStmt = db.prepare<[string, string, string], UserRow>(`
  UPDATE users SET pseudo = ?, updated_at = ? WHERE id = ? RETURNING *
`);

const deleteUserStmt = db.prepare<[string]>('DELETE FROM users WHERE id = ?');

const upsertHandStmt = db.prepare<[string, string, string | null, string | null, string, string, string, string], HandRow>(`
  INSERT INTO hands (id, user_id, title, stakes, game_type, payload, created_at, updated_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  ON CONFLICT (id)
  DO UPDATE SET
    title = excluded.title,
    stakes = excluded.stakes,
    payload = excluded.payload,
    updated_at = excluded.updated_at
  RETURNING *
`);

// Per-user retention cap: keeps worst-case storage bounded (~200 × 30 KB ≈ 6 MB/user on the
// 1 GB volume) and keeps the metadata list small enough to skip pagination entirely.
const HANDS_PER_USER = 200;

const listHandsStmt = db.prepare<[string], HandMetaRow>(`
  SELECT id, user_id, title, stakes, game_type, created_at, updated_at
  FROM hands WHERE user_id = ? ORDER BY created_at DESC LIMIT ${HANDS_PER_USER}
`);

const getHandStmt = db.prepare<[string], HandRow>('SELECT * FROM hands WHERE id = ?');

const deleteHandStmt = db.prepare<[string, string]>('DELETE FROM hands WHERE id = ? AND user_id = ?');

const pruneHandsStmt = db.prepare<[string, string]>(`
  DELETE FROM hands
  WHERE user_id = ?
    AND id NOT IN (SELECT id FROM hands WHERE user_id = ? ORDER BY created_at DESC LIMIT ${HANDS_PER_USER})
`);

const deleteUserHandsStmt = db.prepare<[string]>('DELETE FROM hands WHERE user_id = ?');

export function upsertUser(provider: Provider, providerUserId: string, email?: string): UserRow {
  const now = new Date().toISOString();
  return upsertStmt.get(randomUUID(), provider, providerUserId, email ?? null, now, now) as UserRow;
}

export function getUserById(id: string): UserRow | undefined {
  return getByIdStmt.get(id);
}

export function setPseudo(id: string, pseudo: string): UserRow | undefined {
  return setPseudoStmt.get(pseudo, new Date().toISOString(), id);
}

// No FK pragma is enabled anywhere, so nothing cascades: the user's hands must be deleted
// explicitly or account deletion (an App Store requirement) would orphan their data.
const deleteUserTx = db.transaction((id: string) => {
  deleteUserHandsStmt.run(id);
  deleteUserStmt.run(id);
});

export function deleteUser(id: string): void {
  deleteUserTx(id);
}

export interface HandUpsertInput {
  id: string;
  title: string | null;
  stakes: string | null;
  gameType: string;
  createdAt: string;
}

export function upsertHand(userId: string, hand: HandUpsertInput, payload: string): HandRow {
  return upsertHandStmt.get(
    hand.id,
    userId,
    hand.title,
    hand.stakes,
    hand.gameType,
    payload,
    hand.createdAt,
    new Date().toISOString()
  ) as HandRow;
}

export function listHands(userId: string): HandMetaRow[] {
  return listHandsStmt.all(userId);
}

export function getHand(id: string): HandRow | undefined {
  return getHandStmt.get(id);
}

export function deleteHand(id: string, userId: string): void {
  deleteHandStmt.run(id, userId);
}

export function pruneHands(userId: string): void {
  pruneHandsStmt.run(userId, userId);
}

export function closeDb(): void {
  db.close();
}
