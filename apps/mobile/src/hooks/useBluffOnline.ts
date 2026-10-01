import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import * as Crypto from 'expo-crypto';
import type { BluffAction } from '../lib/bluff';
import { getBluffGame, getBluffHistory, leaveBluffGame, moveBluffGame, BluffApiError } from '../lib/api/bluff';
import type { BluffGameDetail, BluffMoveInput, BluffHistoryEntry } from '../lib/api/bluff';
import { bluffErrorMessage } from '../lib/bluff/onlineErrors';
import { useAppStore } from '../store/useAppStore';
import { useForegroundPolling } from './useForegroundPolling';

export function useBluffGame(id: string) {
  const { t } = useTranslation('bluff');
  const [game, setGame] = useState<BluffGameDetail | null>(null);
  const historyRef = useRef<BluffHistoryEntry[]>([]);
  const recordStats = useAppStore(s => s.recordBluffOnlineStats);
  const currentRef = useRef<BluffGameDetail | null>(null);
  const [pollError, setPollError] = useState<string | null>(null);
  const [actionError, setError] = useState<string | null>(null);
  const errorMsg = actionError ?? pollError;
  const [sending, setSending] = useState(false);
  const busyRef = useRef(false);
  const leaveId = useRef<string | null>(null);
  const pending = useRef<{ key: string; input: BluffMoveInput } | null>(null);
  const accept = (next: BluffGameDetail) => {
    if (currentRef.current && currentRef.current.version > next.version) return;
    currentRef.current = next;
    setGame(next);
  };
  const refresh = useForegroundPolling(3000, async signal => {
    const { game: next } = await getBluffGame(id, signal);
    if (signal.aborted) return;
    accept(next);
    let entries = historyRef.current;
    if (next.completedRounds > entries.filter(r => r.status === 'completed').length || next.round > (entries.at(-1)?.round ?? 0) + 1) {
      let after = entries.at(-1)?.round ?? 0;
      do {
        const { rounds } = await getBluffHistory(id, after, signal);
        if (signal.aborted) return;
        entries = [...entries, ...rounds];
        if (rounds.length < 50) break;
        after = rounds.at(-1)!.round;
      } while (!signal.aborted);
      historyRef.current = entries;
    }
    recordStats(next, entries);
    setPollError(null);
  }, e => setPollError(bluffErrorMessage(e, t)), !!id);
  const sendAction = async (action: BluffAction) => {
    if (busyRef.current || !currentRef.current || !['chooseBoard', 'claim', 'catch', 'jeuMax'].includes(action.type)) return;
    const current = currentRef.current;
    const { playerId: _, ...wireAction } = action;
    const key = JSON.stringify([current.state?.round, wireAction]);
    const input = pending.current?.key === key ? pending.current.input : {
      requestId: Crypto.randomUUID(), expectedVersion: current.version, action: wireAction as BluffMoveInput['action'],
    };
    pending.current = { key, input };
    busyRef.current = true;
    setSending(true);
    try {
      const { game: next } = await moveBluffGame(id, input);
      accept(next);
      pending.current = null;
      setError(null);
    } catch (e) {
      if (e instanceof BluffApiError && e.status < 500) pending.current = null;
      setError(bluffErrorMessage(e, t));
    } finally {
      busyRef.current = false;
      setSending(false);
      refresh();
    }
  };
  const leave = async () => {
    if (busyRef.current) return false;
    busyRef.current = true;
    setSending(true);
    leaveId.current ??= Crypto.randomUUID();
    try { await leaveBluffGame(id, leaveId.current); return true; }
    catch (e) { setError(bluffErrorMessage(e, t)); return false; }
    finally { busyRef.current = false; setSending(false); }
  };
  return {
    game, status: game ? game.status === 'waiting' ? 'lobby' as const : 'playing' as const : errorMsg ? 'error' as const : 'connecting' as const,
    code: game?.code ?? null, myId: game?.myPlayerId ?? null,
    members: game?.members.map(m => ({ playerId: m.playerId, name: m.name ?? t('online.deletedPlayer'), connected: m.status === 'active' })) ?? [],
    view: game?.state ?? null, errorMsg, reconnecting: !!pollError, sending, sendAction, refresh, leave,
  };
}
export type BluffOnlineCommon = ReturnType<typeof useBluffGame>;
