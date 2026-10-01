import { API_URL } from './config';
import { ApiError } from './client';
import type { BluffCreateInput, BluffGameDetail, BluffGameSummary, BluffMoveInput, BluffHistoryEntry } from '../../../../../packages/bluff/http';
import { getSessionToken } from '../../store/sessionToken';
export type { BluffCreateInput, BluffGameDetail, BluffGameSummary, BluffMoveInput, BluffHistoryEntry } from '../../../../../packages/bluff/http';

export class BluffApiError extends ApiError {
  constructor(status: number, code: string, public params?: Record<string, number | string>) { super(status, code); }
}
async function request<T>(path: string, body?: unknown, signal?: AbortSignal): Promise<T> {
  const controller = new AbortController();
  const abort = () => controller.abort();
  signal?.addEventListener('abort', abort);
  if (signal?.aborted) controller.abort();
  const timeout = setTimeout(abort, 15000);
  try {
    const token = await getSessionToken();
    if (!token) throw new BluffApiError(401, 'unauthorized');
    const res = await fetch(`${API_URL}/bluff${path}`, {
      method: body === undefined ? 'GET' : 'POST',
      headers: { authorization: `Bearer ${token}`, ...(body === undefined ? {} : { 'content-type': 'application/json' }) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: controller.signal,
    });
    const payload = await res.json();
    if (!res.ok) throw new BluffApiError(res.status, payload.error ?? 'unknown', payload.params);
    return payload as T;
  } finally { clearTimeout(timeout); signal?.removeEventListener('abort', abort); }
}
export const getBluffGames = (signal?: AbortSignal) => request<{ games: BluffGameSummary[] }>('/games', undefined, signal);
export const getBluffRooms = (signal?: AbortSignal) => request<{ rooms: BluffGameSummary[] }>('/rooms', undefined, signal);
export const getBluffGame = (id: string, signal?: AbortSignal) => request<{ game: BluffGameDetail }>(`/games/${encodeURIComponent(id)}`, undefined, signal);
export const createBluffGame = (input: BluffCreateInput) => request<{ game: BluffGameDetail }>('/games', input);
export const joinBluffGame = (code: string, requestId: string) => request<{ game: BluffGameDetail }>('/join', { code, requestId });
export const moveBluffGame = (id: string, input: BluffMoveInput) => request<{ game: BluffGameDetail }>(`/games/${encodeURIComponent(id)}/moves`, input);
export const leaveBluffGame = (id: string, requestId: string) => request<{ ok: true }>(`/games/${encodeURIComponent(id)}/leave`, { requestId });
export const getBluffHistory = (id: string, afterRound = 0, signal?: AbortSignal) => request<{ rounds: BluffHistoryEntry[] }>(`/games/${encodeURIComponent(id)}/history?afterRound=${afterRound}`, undefined, signal);
