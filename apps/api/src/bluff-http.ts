import type { IncomingMessage, ServerResponse } from 'node:http';
import type { UserRow } from './db.js';
import { databasePool } from './postgres.js';
import { BluffError, BluffRepository } from './bluff.js';
import type { BluffCreateInput, BluffMoveInput } from '../../../packages/bluff/http.js';

function json(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'no-store' });
  res.end(JSON.stringify(body));
}
export async function handleBluffHttp(req: IncomingMessage, res: ServerResponse, user: UserRow,
  readJson: (req: IncomingMessage) => Promise<Record<string, unknown> | null>): Promise<boolean> {
  const url = new URL(req.url ?? '/', 'http://localhost');
  const method = req.method ?? 'GET';
  const repo = new BluffRepository(databasePool());
  try {
    if (url.pathname === '/bluff/games' && method === 'GET') {
      json(res, 200, { games: await repo.list(user.id) }); return true;
    }
    if (url.pathname === '/bluff/rooms' && method === 'GET') {
      json(res, 200, { rooms: await repo.rooms(user.id) }); return true;
    }
    if (url.pathname === '/bluff/games' && method === 'POST') {
      const body = await readJson(req);
      if (!body) throw new BluffError(400, 'invalid_body');
      json(res, 200, { game: await repo.create(user, body as unknown as BluffCreateInput) }); return true;
    }
    if (url.pathname === '/bluff/join' && method === 'POST') {
      const body = await readJson(req);
      if (!body) throw new BluffError(400, 'invalid_body');
      json(res, 200, { game: await repo.join(user, body.code as string, body.requestId as string) }); return true;
    }
    const match = /^\/bluff\/games\/([a-f0-9-]{36})(?:\/(moves|leave|history))?$/.exec(url.pathname);
    if (!match) return false;
    const [, id, operation] = match;
    if (!operation && method === 'GET') {
      json(res, 200, { game: await repo.get(id, user.id) }); return true;
    }
    if (operation === 'history' && method === 'GET') {
      const after = Number(url.searchParams.get('afterRound') ?? 0);
      if (!Number.isSafeInteger(after) || after < 0) throw new BluffError(400, 'invalid_body');
      json(res, 200, { rounds: await repo.history(id, user.id, after) }); return true;
    }
    if (method === 'POST' && (operation === 'moves' || operation === 'leave')) {
      const body = await readJson(req);
      if (!body) throw new BluffError(400, 'invalid_body');
      if (operation === 'moves') json(res, 200, { game: await repo.move(user.id, id, body as unknown as BluffMoveInput) });
      else { await repo.leave(user.id, id, body.requestId as string); json(res, 200, { ok: true }); }
      return true;
    }
    return false;
  } catch (error) {
    if (!(error instanceof BluffError)) throw error;
    json(res, error.status, { error: error.code, ...(error.params ? { params: error.params } : {}) });
    return true;
  }
}
