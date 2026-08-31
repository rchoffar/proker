import { useCallback, useEffect, useRef, useState } from 'react';

/** How long to wait for the state to move before assuming the action was lost. */
const IN_FLIGHT_TIMEOUT_MS = 8000;

/**
 * Tracks whether an online action is still on its way to the host.
 *
 * Online, committing does nothing visible until the host's new state comes back, so on a slow
 * connection the button just sits there — Mathieu read that as a freeze twice in one session
 * before working out it was his wifi ("ça reste bloqué avec le bouton valider le placement qui
 * ne s'enlève pas"). Nothing was broken; the screen simply never said it was waiting.
 *
 * `version` is the redacted state's monotonic version: the moment it moves, the host has
 * answered. The host's own actions apply locally and bump it synchronously, so this is a
 * no-op there, which is right. A lost action clears on the timeout rather than locking the
 * screen for good.
 */
export function useActionInFlight(version: number | undefined) {
  const [inFlight, setInFlight] = useState(false);
  const sentAtRef = useRef<number | null>(null);

  useEffect(() => {
    if (sentAtRef.current === null || version === undefined || version === sentAtRef.current) return;
    sentAtRef.current = null;
    setInFlight(false);
  }, [version]);

  useEffect(() => {
    if (!inFlight) return;
    const timer = setTimeout(() => {
      sentAtRef.current = null;
      setInFlight(false);
    }, IN_FLIGHT_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [inFlight]);

  /** Wraps a sender so it reports itself as in flight — and swallows double taps. */
  const send = useCallback(
    <A,>(sender: (action: A) => void) =>
      (action: A) => {
        if (inFlight) return;
        sentAtRef.current = version ?? null;
        setInFlight(true);
        sender(action);
      },
    [inFlight, version],
  );

  return { inFlight, send };
}
