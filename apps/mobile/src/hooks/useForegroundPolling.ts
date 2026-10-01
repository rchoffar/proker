import { useCallback, useLayoutEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { PollingController } from '../lib/online/polling';

export function useForegroundPolling(interval: number, fetch: (signal: AbortSignal) => Promise<void>, onError: (error: unknown) => void, enabled = true) {
  const fetchRef = useRef(fetch);
  const errorRef = useRef(onError);
  useLayoutEffect(() => { fetchRef.current = fetch; errorRef.current = onError; });
  const pollRef = useRef<PollingController | null>(null);
  useFocusEffect(useCallback(() => {
    if (!enabled) return;
    const poll = new PollingController(interval, signal => fetchRef.current(signal), error => errorRef.current(error));
    pollRef.current = poll;
    if (AppState.currentState === 'active') poll.start();
    const subscription = AppState.addEventListener('change', state => state === 'active' ? poll.start() : poll.stop());
    return () => { subscription.remove(); poll.stop(); pollRef.current = null; };
  }, [enabled, interval]));
  return useCallback(() => pollRef.current?.refresh(), []);
}
