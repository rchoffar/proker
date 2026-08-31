import { mmkvStorage } from '../../store/mmkvStorage';

// A seat at an online table, kept across a screen unmount so it can be reclaimed.
//
// The relay already had everything needed to come back: `room:rejoin` takes a session token,
// an unexpected drop keeps the seat with a null socket, and the host gets a 60s grace window.
// What was missing was entirely on this side. The session lived in a `useRef`, so leaving the
// screen threw it away, and the cleanup emitted `room:leave` unconditionally — which told the
// server to give the seat up too. Coming back therefore meant joining as a NEW member of a
// game whose player list the host had already snapshotted: you could see yourself at the
// table and not be able to act, which is exactly what Mathieu reported.
//
// Note what this is NOT for: backgrounding the app. The screen stays mounted there and
// socket.io reconnects on its own, so that path already worked.

export type OnlineGame = 'bluff' | 'ofc';

export interface OnlineSession {
  code: string;
  playerId: string;
  sessionToken: string;
  role: 'host' | 'guest';
}

/** Serialised host game state, stored beside the session so a remount can resume it. */
export interface HostSnapshot<S> {
  code: string;
  state: S;
}

const sessionKey = (game: OnlineGame) => `online-session:${game}`;
const snapshotKey = (game: OnlineGame) => `online-host-state:${game}`;

function read<T>(key: string): T | null {
  const raw = mmkvStorage.getItem(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    // A half-written or stale-shaped record is worth exactly as much as none.
    mmkvStorage.removeItem(key);
    return null;
  }
}

export function loadSession(game: OnlineGame): OnlineSession | null {
  const s = read<OnlineSession>(sessionKey(game));
  return s && s.code && s.playerId && s.sessionToken ? s : null;
}

export function saveSession(game: OnlineGame, session: OnlineSession): void {
  mmkvStorage.setItem(sessionKey(game), JSON.stringify(session));
}

/** Called when the player deliberately leaves, and whenever a rejoin is refused. */
export function clearSession(game: OnlineGame): void {
  mmkvStorage.removeItem(sessionKey(game));
  mmkvStorage.removeItem(snapshotKey(game));
}

/**
 * The host's engine state. Tagged with the room code so a snapshot can never be replayed
 * into a different table, and dropped wholesale rather than migrated if its shape moves —
 * a resumed game is a convenience, not something worth a migration path.
 */
export function loadHostSnapshot<S>(game: OnlineGame, code: string): S | null {
  const snap = read<HostSnapshot<S>>(snapshotKey(game));
  return snap && snap.code === code ? snap.state : null;
}

export function saveHostSnapshot<S>(game: OnlineGame, code: string, state: S): void {
  mmkvStorage.setItem(snapshotKey(game), JSON.stringify({ code, state }));
}
