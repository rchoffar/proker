import type { IncomingMessage, ServerResponse } from 'node:http';
import { deleteUser, getUserById, setPseudo, upsertUser, type UserRow } from './db.js';
import { signSession, verifySession } from './auth/session.js';
import { verifyAppleIdentityToken, verifyGoogleIdToken } from './auth/verify.js';

const MAX_BODY_BYTES = 16_384;
const PSEUDO_MIN = 2;
const PSEUDO_MAX = 20;

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { 'content-type': 'application/json' });
  res.end(JSON.stringify(body));
}

function readJson(req: IncomingMessage): Promise<Record<string, unknown> | null> {
  return new Promise((resolve) => {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on('data', (chunk: Buffer) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        req.destroy();
        resolve(null);
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      try {
        const parsed: unknown = JSON.parse(Buffer.concat(chunks).toString('utf8'));
        resolve(parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : null);
      } catch {
        resolve(null);
      }
    });
    req.on('error', () => resolve(null));
  });
}

function bearerToken(req: IncomingMessage): string | null {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return null;
  return header.slice('Bearer '.length) || null;
}

function publicUser(row: UserRow) {
  return { id: row.id, provider: row.provider, email: row.email, pseudo: row.pseudo };
}

async function authenticatedUser(req: IncomingMessage): Promise<UserRow | null> {
  const token = bearerToken(req);
  if (!token) return null;
  const userId = await verifySession(token);
  if (!userId) return null;
  return getUserById(userId) ?? null;
}

/** Returns true if the request matched a route (response already sent). */
export async function handleHttp(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
  const url = (req.url ?? '').split('?')[0];
  const method = req.method ?? 'GET';

  if (method === 'POST' && (url === '/auth/google' || url === '/auth/apple')) {
    const body = await readJson(req);
    if (!body) {
      sendJson(res, 400, { error: 'invalid_body' });
      return true;
    }
    try {
      let row: UserRow;
      if (url === '/auth/google') {
        const idToken = body.idToken;
        if (typeof idToken !== 'string' || !idToken) {
          sendJson(res, 400, { error: 'invalid_body' });
          return true;
        }
        const identity = await verifyGoogleIdToken(idToken);
        row = upsertUser('google', identity.sub, identity.email);
      } else {
        const identityToken = body.identityToken;
        if (typeof identityToken !== 'string' || !identityToken) {
          sendJson(res, 400, { error: 'invalid_body' });
          return true;
        }
        const identity = await verifyAppleIdentityToken(identityToken);
        // Apple only includes the email claim on first authorization; the
        // client forwards credential.email as a fallback for that first pass.
        const fallbackEmail = typeof body.email === 'string' && body.email ? body.email : undefined;
        row = upsertUser('apple', identity.sub, identity.email ?? fallbackEmail);
      }
      sendJson(res, 200, { token: await signSession(row.id), user: publicUser(row) });
    } catch {
      sendJson(res, 401, { error: 'invalid_token' });
    }
    return true;
  }

  if (url === '/me' && method === 'GET') {
    const user = await authenticatedUser(req);
    if (!user) {
      sendJson(res, 401, { error: 'unauthorized' });
      return true;
    }
    sendJson(res, 200, { user: publicUser(user) });
    return true;
  }

  if (url === '/me' && method === 'DELETE') {
    const user = await authenticatedUser(req);
    if (!user) {
      sendJson(res, 401, { error: 'unauthorized' });
      return true;
    }
    deleteUser(user.id);
    sendJson(res, 200, { ok: true });
    return true;
  }

  if (url === '/me' && method === 'PATCH') {
    const user = await authenticatedUser(req);
    if (!user) {
      sendJson(res, 401, { error: 'unauthorized' });
      return true;
    }
    const body = await readJson(req);
    const pseudo = typeof body?.pseudo === 'string' ? body.pseudo.trim() : '';
    if (pseudo.length < PSEUDO_MIN || pseudo.length > PSEUDO_MAX) {
      sendJson(res, 400, { error: 'invalid_pseudo' });
      return true;
    }
    const updated = setPseudo(user.id, pseudo);
    if (!updated) {
      sendJson(res, 500, { error: 'internal' });
      return true;
    }
    sendJson(res, 200, { user: publicUser(updated) });
    return true;
  }

  return false;
}
