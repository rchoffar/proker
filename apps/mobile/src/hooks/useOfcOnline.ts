import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import * as Crypto from 'expo-crypto';
import type { OfcAction } from '../lib/ofc';
import { getOfcGame, getOfcHistory, leaveOfcGame, moveOfcGame, OfcApiError } from '../lib/api/ofc';
import type { OfcGameDetail, OfcHistoryEntry, OfcMoveInput } from '../lib/api/ofc';
import { ofcErrorMessage } from '../lib/ofc/onlineErrors';
import { useForegroundPolling } from './useForegroundPolling';
import { useAppStore } from '../store/useAppStore';

export function useOfcGame(id: string) {
  const { t } = useTranslation('ofc');
  const [game, setGame] = useState<OfcGameDetail | null>(null);
  const gameRef = useRef<OfcGameDetail | null>(null);
  const [history, setHistory] = useState<OfcHistoryEntry[]>([]);
  const historyRef = useRef<OfcHistoryEntry[]>([]);
  const [pollError, setPollError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const sendingRef = useRef(false);
  const pendingRef = useRef<{ key: string; input: OfcMoveInput } | null>(null);
  const leaveId = useRef<string | null>(null);
  const recordStats = useAppStore(s => s.recordOfcOnlineStats);
  const accept = (next: OfcGameDetail) => {
    if (gameRef.current && gameRef.current.version > next.version) return;
    gameRef.current = next;
    setGame(next);
  };
  const refresh = useForegroundPolling(3000, async signal => {
    const { game: next } = await getOfcGame(id, signal);
    if (signal.aborted) return;
    accept(next);
    let entries = historyRef.current;
    const completed = entries.filter(h => h.status === 'completed').length;
    const last = entries.at(-1)?.handNumber ?? 0;
    if (next.completedHands > completed || next.handNumber > last + 1 ||
        (next.status === 'finished' && next.handNumber > last)) {
      let after = last;
      do {
        const { hands } = await getOfcHistory(id, after, signal);
        if (signal.aborted) return;
        entries = [...entries, ...hands];
        if (hands.length < 50) break;
        after = hands.at(-1)!.handNumber;
      } while (!signal.aborted);
      historyRef.current = entries;
      setHistory(entries);
    }
    recordStats(next, entries);
    setPollError(null);
  }, e => setPollError(ofcErrorMessage(e, t)));
  const sendAction = async (action: OfcAction) => {
    if (sendingRef.current || !gameRef.current || !('placements' in action)) return;
    const current = gameRef.current;
    const wireAction = { type: action.type, placements: action.placements };
    const key = JSON.stringify([current.handNumber, current.state?.placeRound, wireAction]);
    const input = pendingRef.current?.key === key ? pendingRef.current.input : {
      expectedVersion: current.version, requestId: Crypto.randomUUID(), action: wireAction,
    };
    pendingRef.current = { key, input };
    sendingRef.current = true;
    setSending(true);
    try {
      const { game: next } = await moveOfcGame(id, input);
      accept(next);
      pendingRef.current = null;
      setActionError(null);
    } catch (e) {
      if (e instanceof OfcApiError && e.status < 500) pendingRef.current = null;
      setActionError(ofcErrorMessage(e, t));
    } finally {
      sendingRef.current = false;
      setSending(false);
      refresh();
    }
  };
  const leave = async () => {
    if (sendingRef.current) return false;
    sendingRef.current = true;
    setSending(true);
    leaveId.current ??= Crypto.randomUUID();
    try { await leaveOfcGame(id, leaveId.current); return true; }
    catch (e) { setActionError(ofcErrorMessage(e, t)); return false; }
    finally { sendingRef.current = false; setSending(false); }
  };
  return { game, history, error: actionError ?? pollError, sending, sendAction, leave, refresh };
}
