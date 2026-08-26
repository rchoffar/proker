import type { IncomingMessage, ServerResponse } from 'node:http';
import {
  deleteHand,
  deleteUser,
  getHand,
  getUserById,
  listHands,
  pruneHands,
  setPseudo,
  upsertHand,
  upsertUser,
  type HandMetaRow,
  type UserRow,
} from './db.js';
import { signSession, verifySession } from './auth/session.js';
import { verifyAppleIdentityToken, verifyGoogleIdToken } from './auth/verify.js';
import { privacyHtml, supportHtml } from './pages.js';

const MAX_BODY_BYTES = 16_384;
// A full HandHistory payload (9 players, long action list) can approach ~30 KB — well past
// the default cap, so hand upserts get their own bounded budget.
const HAND_BODY_BYTES = 65_536;
const HAND_ID_MAX = 64;
const PSEUDO_MIN = 2;
const PSEUDO_MAX = 20;

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { 'content-type': 'application/json' });
  res.end(JSON.stringify(body));
}

function readJson(req: IncomingMessage, maxBytes = MAX_BODY_BYTES): Promise<Record<string, unknown> | null> {
  return new Promise((resolve) => {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on('data', (chunk: Buffer) => {
      size += chunk.length;
      if (size > maxBytes) {
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

function publicHandMeta(row: HandMetaRow) {
  return {
    id: row.id,
    title: row.title,
    stakes: row.stakes,
    gameType: row.game_type,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
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

  if (method === 'GET' && (url === '/privacy' || url === '/support')) {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    res.end(url === '/privacy' ? privacyHtml : supportHtml);
    return true;
  }

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

  if (url === '/hands' && method === 'GET') {
    const user = await authenticatedUser(req);
    if (!user) {
      sendJson(res, 401, { error: 'unauthorized' });
      return true;
    }
    sendJson(res, 200, { hands: listHands(user.id).map(publicHandMeta) });
    return true;
  }

  if (url.startsWith('/hands/')) {
    const handId = url.slice('/hands/'.length);
    if (!handId || handId.includes('/') || handId.length > HAND_ID_MAX) return false;
    const user = await authenticatedUser(req);
    if (!user) {
      sendJson(res, 401, { error: 'unauthorized' });
      return true;
    }

    if (method === 'GET') {
      const row = getHand(handId);
      // A missing hand and someone else's hand answer identically — don't leak existence.
      if (!row || row.user_id !== user.id) {
        sendJson(res, 404, { error: 'not_found' });
        return true;
      }
      sendJson(res, 200, { hand: JSON.parse(row.payload) as unknown });
      return true;
    }

    if (method === 'PUT') {
      const body = await readJson(req, HAND_BODY_BYTES);
      // The payload is opaque client data replayed only by the client that wrote it —
      // validate identity shallowly, cap the size, store the rest verbatim.
      if (
        !body ||
        body.id !== handId ||
        typeof body.createdAt !== 'string' ||
        (body.title !== undefined && typeof body.title !== 'string') ||
        (body.stakes !== undefined && typeof body.stakes !== 'string')
      ) {
        sendJson(res, 400, { error: 'invalid_body' });
        return true;
      }
      const existing = getHand(handId);
      if (existing && existing.user_id !== user.id) {
        sendJson(res, 404, { error: 'not_found' });
        return true;
      }
      const row = upsertHand(
        user.id,
        {
          id: handId,
          title: typeof body.title === 'string' && body.title ? body.title : null,
          stakes: typeof body.stakes === 'string' && body.stakes ? body.stakes : null,
          gameType: typeof body.gameType === 'string' && body.gameType ? body.gameType : 'NLH',
          createdAt: body.createdAt,
        },
        JSON.stringify(body)
      );
      pruneHands(user.id);
      sendJson(res, 200, { hand: publicHandMeta(row) });
      return true;
    }

    if (method === 'DELETE') {
      // Idempotent: deleting an already-gone hand still succeeds (offline retries re-send).
      deleteHand(handId, user.id);
      sendJson(res, 200, { ok: true });
      return true;
    }

    return false;
  }

  return false;
}
