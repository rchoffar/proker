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

export function deleteUser(id: string): void {
  deleteUserStmt.run(id);
}

export function closeDb(): void {
  db.close();
}
