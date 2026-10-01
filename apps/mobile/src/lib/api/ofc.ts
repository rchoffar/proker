import { API_URL } from './config';
import { ApiError } from './client';
import { getSessionToken } from '../../store/sessionToken';
import type { OfcCreateInput, OfcGameDetail, OfcGameSummary, OfcHistoryEntry, OfcMoveInput } from '../../../../../packages/ofc/http';
export type { OfcCreateInput, OfcGameDetail, OfcGameSummary, OfcHistoryEntry, OfcMoveInput, OfcVisibility } from '../../../../../packages/ofc/http';

export class OfcApiError extends ApiError {
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
    if (!token) throw new OfcApiError(401, 'unauthorized');
    const res = await fetch(`${API_URL}/ofc${path}`, {
      method: body === undefined ? 'GET' : 'POST',
      headers: { authorization: `Bearer ${token}`, ...(body === undefined ? {} : { 'content-type': 'application/json' }) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: controller.signal,
    });
    const payload = await res.json();
    if (!res.ok) throw new OfcApiError(res.status, payload.error ?? 'unknown', payload.params);
    return payload as T;
  } finally { clearTimeout(timeout); signal?.removeEventListener('abort', abort); }
}
export const getOfcGames = (signal?: AbortSignal) => request<{ games: OfcGameSummary[] }>('/games', undefined, signal);
export const getOfcRooms = (signal?: AbortSignal) => request<{ rooms: OfcGameSummary[] }>('/rooms', undefined, signal);
export const getOfcGame = (id: string, signal?: AbortSignal) => request<{ game: OfcGameDetail }>(`/games/${encodeURIComponent(id)}`, undefined, signal);
export const getOfcHistory = (id: string, afterHand = 0, signal?: AbortSignal) => request<{ hands: OfcHistoryEntry[] }>(`/games/${encodeURIComponent(id)}/history?afterHand=${afterHand}`, undefined, signal);
export const createOfcGame = (input: OfcCreateInput) => request<{ game: OfcGameDetail }>('/games', input);
export const joinOfcGame = (code: string, requestId: string) => request<{ game: OfcGameDetail }>('/join', { code, requestId });
export const moveOfcGame = (id: string, input: OfcMoveInput) => request<{ game: OfcGameDetail }>(`/games/${encodeURIComponent(id)}/moves`, input);
export const leaveOfcGame = (id: string, requestId: string) => request<{ ok: true }>(`/games/${encodeURIComponent(id)}/leave`, { requestId });
