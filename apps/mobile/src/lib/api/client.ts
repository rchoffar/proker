import type { AuthUser, HandHistory } from '../../types';
import { API_URL } from './config';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
  ) {
    super(`API ${status}: ${code}`);
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  token?: string;
}

async function apiFetch<T>(path: string, { method = 'GET', body, token }: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = {};
  if (body !== undefined) headers['content-type'] = 'application/json';
  if (token) headers.authorization = `Bearer ${token}`;

  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    let code = 'unknown';
    try {
      const payload = (await res.json()) as { error?: string };
      if (payload.error) code = payload.error;
    } catch {
      // Corps non-JSON (proxy, 502…) : on garde 'unknown'.
    }
    throw new ApiError(res.status, code);
  }
  return (await res.json()) as T;
}

interface AuthResponse {
  token: string;
  user: AuthUser;
}

export function postAuthGoogle(idToken: string): Promise<AuthResponse> {
  return apiFetch('/auth/google', { method: 'POST', body: { idToken } });
}

export function postAuthApple(identityToken: string, email?: string | null): Promise<AuthResponse> {
  return apiFetch('/auth/apple', { method: 'POST', body: { identityToken, email: email ?? undefined } });
}

export function getMe(token: string): Promise<{ user: AuthUser }> {
  return apiFetch('/me', { token });
}

export function patchMe(token: string, patch: { pseudo: string }): Promise<{ user: AuthUser }> {
  return apiFetch('/me', { method: 'PATCH', body: patch, token });
}

export function deleteMe(token: string): Promise<{ ok: true }> {
  return apiFetch('/me', { method: 'DELETE', token });
}

// Ce que le serveur renvoie pour une main sans son payload — les listes ne transportent
// jamais les mains complètes, seulement de quoi afficher une ligne.
export interface HandMeta {
  id: string;
  title: string | null;
  stakes: string | null;
  gameType: string;
  createdAt: string;
  updatedAt: string;
}

export function getHands(token: string): Promise<{ hands: HandMeta[] }> {
  return apiFetch('/hands', { token });
}

export function getHand(token: string, id: string): Promise<{ hand: HandHistory }> {
  return apiFetch(`/hands/${encodeURIComponent(id)}`, { token });
}

export function putHand(token: string, hand: HandHistory): Promise<{ hand: HandMeta }> {
  return apiFetch(`/hands/${encodeURIComponent(hand.id)}`, { method: 'PUT', body: hand, token });
}

export function deleteHand(token: string, id: string): Promise<{ ok: true }> {
  return apiFetch(`/hands/${encodeURIComponent(id)}`, { method: 'DELETE', token });
}
