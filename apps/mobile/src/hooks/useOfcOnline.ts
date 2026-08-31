import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { createHandDeal, initGame, reduce, validateAction } from '../lib/ofc';
import type { OfcAction, OfcState, OfcVariant } from '../lib/ofc';
import { redactFor } from '../lib/ofc/protocol';
import type { OfcGuestToHost, OfcHostToGuest, RedactedOfcState } from '../lib/ofc/protocol';
import type { MemberInfo } from '../lib/bluff/protocol';
import { getBluffSocket, leaveRoomAndDisconnect } from '../lib/bluff/socket';
import { clearSession, loadHostSnapshot, loadSession, saveHostSnapshot, saveSession } from '../lib/online/session';
import type { Player } from '../types';

// Host-authoritative OFC over the same game-agnostic relay as Bluff (rooms, 4-digit
// codes, opaque payloads) — the shared socket singleton and envelope types live in
// lib/bluff; only the game payloads differ.

export type OnlineStatus = 'connecting' | 'lobby' | 'playing' | 'closed' | 'error';

export interface OfcOnlineCommon {
  status: OnlineStatus;
  code: string | null;
  myId: string | null;
  members: MemberInfo[];
  hostId: string | null;
  // What this device is allowed to see — the host renders through redactFor too.
  view: RedactedOfcState | null;
  errorMsg: string | null;
  closedReason: 'host_left' | 'expired' | 'hostQuit' | null;
  /** Socket is down and retrying. The table stays on screen, but nothing is getting through. */
  reconnecting: boolean;
  sendAction: (action: OfcAction) => void;
  /** Deliberate exit: gives the seat up, closes the room if we are the host, forgets the
   *  session. Leaving the screen any other way keeps the seat so it can be reclaimed. */
  leave: () => void;
}

// Server room-error enums → ofc namespace keys, translated on this device.
const JOIN_ERROR_KEYS = {
  not_found: 'games:connection.not_found',
  full: 'games:connection.full',
  unavailable: 'games:connection.unavailable',
  bad_token: 'games:connection.bad_token',
  started: 'games:connection.started',
} as const;

function withAutoDeal(state: OfcState): OfcState {
  return state.phase === 'dealing' ? reduce(state, createHandDeal(state)) : state;
}

// ── Host: runs the authoritative engine, the relay only transports ─────────────

export function useOfcHost(
  pseudo: string,
): OfcOnlineCommon & { startGame: (startingStack: number, variant: OfcVariant) => void; replay: () => void } {
  const { t } = useTranslation('ofc');
  // Read once, before any state exists: a table we were hosting and did not deliberately
  // leave is resumed rather than replaced by a new one. Seeding the initial state beats
  // setting it from inside the socket effect, which is a cascading render.
  const resumed = useMemo(() => {
    const session = loadSession('ofc');
    if (session?.role !== 'host') return null;
    return { session, snapshot: loadHostSnapshot<OfcState>('ofc', session.code) };
  }, []);

  const [status, setStatus] = useState<OnlineStatus>(resumed?.snapshot ? 'playing' : 'connecting');
  const [code, setCode] = useState<string | null>(resumed?.session.code ?? null);
  const [myId, setMyId] = useState<string | null>(resumed?.session.playerId ?? null);
  const [members, setMembers] = useState<MemberInfo[]>([]);
  const [view, setView] = useState<RedactedOfcState | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [closedReason, setClosedReason] = useState<OfcOnlineCommon['closedReason']>(null);

  const [reconnecting, setReconnecting] = useState(false);

  const gameRef = useRef<OfcState | null>(resumed?.snapshot ?? null);
  const membersRef = useRef<MemberInfo[]>([]);
  const sessionRef = useRef<{ code: string; playerId: string; sessionToken: string } | null>(resumed?.session ?? null);
  const stackRef = useRef(100);
  const variantRef = useRef<OfcVariant>('classic');
  /** Set by `leave()`: tells the unmount cleanup to give the seat up rather than keep it. */
  const leavingRef = useRef(false);

  // The engine state is the room, so it outlives a screen unmount alongside the session.
  const remember = useCallback((state: OfcState) => {
    gameRef.current = state;
    const session = sessionRef.current;
    if (session) saveHostSnapshot('ofc', session.code, state);
  }, []);

  const broadcast = useCallback(() => {
    const state = gameRef.current;
    const session = sessionRef.current;
    if (!state || !session) return;
    const socket = getBluffSocket();
    const connected = new Map(membersRef.current.map((m) => [m.playerId, m.connected]));
    for (const member of membersRef.current) {
      if (member.playerId === session.playerId || !member.connected) continue;
      const payload: OfcHostToGuest = { kind: 'state', state: redactFor(state, member.playerId, connected) };
      socket.emit('game:toPlayer', { playerId: member.playerId, payload });
    }
    setView(redactFor(state, session.playerId, connected));
  }, []);

  const apply = useCallback(
    (action: OfcAction, replyTo?: string) => {
      const state = gameRef.current;
      if (!state) return;
      const valid = validateAction(state, action);
      if (!valid.ok) {
        if (replyTo) {
          // Relay the language-neutral code + params — the guest translates locally.
          const payload: OfcHostToGuest = { kind: 'error', error: { code: valid.code, params: valid.params } };
          getBluffSocket().emit('game:toPlayer', { playerId: replyTo, payload });
        }
        return;
      }
      remember(withAutoDeal(reduce(state, action)));
      broadcast();
    },
    [broadcast, remember],
  );

  useEffect(() => {
    const socket = getBluffSocket();
    const handleConnect = () => {
      setReconnecting(false);
      const session = sessionRef.current;
      if (!session) {
        socket.emit('room:create', { name: pseudo }, (res) => {
          if (!res.ok) {
            setErrorMsg(t(JOIN_ERROR_KEYS[res.reason]));
            setStatus('error');
            return;
          }
          sessionRef.current = { code: res.code, playerId: res.playerId, sessionToken: res.sessionToken };
          saveSession('ofc', { ...sessionRef.current, role: 'host' });
          setCode(res.code);
          setMyId(res.playerId);
          setStatus('lobby');
        });
      } else {
        socket.emit('room:rejoin', { ...session }, (res) => {
          if (res.ok) {
            broadcast();
            return;
          }
          // Used to be silent: a host whose room had expired sat on a live-looking table
          // forever while its guests were correctly told the room was gone.
          clearSession('ofc');
          sessionRef.current = null;
          setErrorMsg(t(JOIN_ERROR_KEYS[res.reason]));
          setStatus('error');
        });
      }
    };

    const handleDisconnect = () => setReconnecting(true);

    const handleMembers = ({ members: list }: { members: MemberInfo[] }) => {
      membersRef.current = list;
      setMembers(list);
      // Keep guests' connected dots fresh, and hand a rejoined guest the current state.
      if (gameRef.current) broadcast();
    };

    const handleFromPlayer = ({ fromPlayerId, payload }: { fromPlayerId: string; payload: unknown }) => {
      const msg = payload as OfcGuestToHost;
      if (msg?.kind === 'requestState') {
        broadcast();
        return;
      }
      if (msg?.kind === 'action') {
        // Deals are host-generated only, and the sender identity comes from the relay —
        // never from the payload.
        if (msg.action.type === 'deal') return;
        apply({ ...msg.action, playerId: fromPlayerId }, fromPlayerId);
      }
    };

    const handleClosed = ({ reason }: { reason: 'host_left' | 'expired' }) => {
      // The room is gone for good, so the seat is not worth keeping: without this the next
      // mount would try to resume a dead table and only find out from a failed rejoin.
      clearSession('ofc');
      setClosedReason(reason);
      setStatus('closed');
    };

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('connect_error', handleDisconnect);
    socket.on('room:members', handleMembers);
    socket.on('game:fromPlayer', handleFromPlayer);
    socket.on('room:closed', handleClosed);
    socket.connect();

    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('connect_error', handleDisconnect);
      socket.off('room:members', handleMembers);
      socket.off('game:fromPlayer', handleFromPlayer);
      socket.off('room:closed', handleClosed);
      // Leaving the screen is NOT leaving the table. This used to end the game for everyone
      // and give the seat up, so coming back meant joining as a new member of a game whose
      // player list had already been snapshotted — visible at the table, unable to act. The
      // server keeps a disconnected host's room for its grace window, which is the whole
      // point. `leave()` is the deliberate exit.
      if (leavingRef.current) {
        const payload: OfcHostToGuest = { kind: 'gameEnded', reason: 'hostQuit' };
        socket.emit('game:broadcast', { payload });
        leaveRoomAndDisconnect(socket);
      } else {
        socket.disconnect();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one socket lifecycle per screen mount
  }, []);

  const startGame = useCallback(
    (startingStack: number, variant: OfcVariant) => {
      stackRef.current = startingStack;
      variantRef.current = variant;
      const players: Player[] = membersRef.current.map((m) => ({ id: m.playerId, name: m.name }));
      const previousVersion = gameRef.current?.version ?? 0;
      const fresh = withAutoDeal(initGame(players, startingStack, variant));
      // Keep versions monotonic across replays so guests' stale-drop never eats a fresh game.
      remember({ ...fresh, version: previousVersion + fresh.version + 1 });
      setStatus('playing');
      // Tell the relay to stop admitting newcomers: this snapshotted the member list, so
      // anybody let in now would hold a seat in the room and none in the game.
      getBluffSocket().emit('room:lock');
      broadcast();
    },
    [broadcast, remember],
  );

  const replay = useCallback(() => startGame(stackRef.current, variantRef.current), [startGame]);

  const sendAction = useCallback(
    (action: OfcAction) => {
      const session = sessionRef.current;
      if (!session) return;
      apply({ ...action, playerId: session.playerId });
    },
    [apply],
  );

  const leave = useCallback(() => {
    // Deliberate: forget the seat so the unmount cleanup gives it up and closes the room.
    leavingRef.current = true;
    clearSession('ofc');
    setStatus('closed');
  }, []);

  return {
    status,
    reconnecting,
    code,
    myId,
    members,
    hostId: myId,
    view,
    errorMsg,
    closedReason,
    sendAction,
    leave,
    startGame,
    replay,
  };
}

// ── Guest: renders whatever redacted state the host sends ──────────────────────

export function useOfcGuest(pseudo: string, joinCode: string): OfcOnlineCommon {
  const { t } = useTranslation('ofc');
  const [status, setStatus] = useState<OnlineStatus>('connecting');
  const [myId, setMyId] = useState<string | null>(null);
  const [members, setMembers] = useState<MemberInfo[]>([]);
  const [hostId, setHostId] = useState<string | null>(null);
  const [view, setView] = useState<RedactedOfcState | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [closedReason, setClosedReason] = useState<OfcOnlineCommon['closedReason']>(null);

  const [reconnecting, setReconnecting] = useState(false);

  const sessionRef = useRef<{ code: string; playerId: string; sessionToken: string } | null>(null);
  const lastVersionRef = useRef(-1);
  const leavingRef = useRef(false);

  useEffect(() => {
    const socket = getBluffSocket();
    // Typing the code of a table we already have a seat at reclaims THAT seat instead of
    // taking a new one — the difference between playing and watching yourself at the table.
    const resumed = loadSession('ofc');
    if (resumed?.role === 'guest' && resumed.code === joinCode) sessionRef.current = resumed;

    const handleConnect = () => {
      setReconnecting(false);
      const session = sessionRef.current;
      if (!session) {
        socket.emit('room:join', { code: joinCode, name: pseudo }, (res) => {
          if (!res.ok) {
            setErrorMsg(t(JOIN_ERROR_KEYS[res.reason]));
            setStatus('error');
            return;
          }
          sessionRef.current = { code: joinCode, playerId: res.playerId, sessionToken: res.sessionToken };
          saveSession('ofc', { ...sessionRef.current, role: 'guest' });
          setMyId(res.playerId);
          setHostId(res.hostPlayerId);
          setMembers(res.members);
          setStatus('lobby');
        });
      } else {
        socket.emit('room:rejoin', { ...session }, (res) => {
          if (res.ok) {
            setMyId(session.playerId);
            const payload: OfcGuestToHost = { kind: 'requestState' };
            socket.emit('game:toHost', { payload });
          } else {
            // The seat is gone (room closed, or expired) — forget it so the next attempt
            // joins fresh instead of retrying a dead token forever.
            clearSession('ofc');
            sessionRef.current = null;
            setErrorMsg(t(JOIN_ERROR_KEYS[res.reason]));
            setStatus('error');
          }
        });
      }
    };

    const handleDisconnect = () => setReconnecting(true);

    const handleMembers = ({ members: list, hostPlayerId }: { members: MemberInfo[]; hostPlayerId: string }) => {
      setMembers(list);
      setHostId(hostPlayerId);
    };

    const handleFromHost = ({ payload }: { payload: unknown }) => {
      const msg = payload as OfcHostToGuest;
      if (msg?.kind === 'state') {
        if (msg.state.version < lastVersionRef.current) return; // stale after reconnect race
        lastVersionRef.current = msg.state.version;
        setView(msg.state);
        setStatus('playing');
        return;
      }
      if (msg?.kind === 'error') {
        setErrorMsg(t(`errors.${msg.error.code}`, msg.error.params));
        return;
      }
      if (msg?.kind === 'gameEnded') {
        clearSession('ofc');
        setClosedReason('hostQuit');
        setStatus('closed');
      }
    };

    const handleClosed = ({ reason }: { reason: 'host_left' | 'expired' }) => {
      // The room is gone for good, so the seat is not worth keeping: without this the next
      // mount would try to resume a dead table and only find out from a failed rejoin.
      clearSession('ofc');
      setClosedReason(reason);
      setStatus('closed');
    };

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('connect_error', handleDisconnect);
    socket.on('room:members', handleMembers);
    socket.on('game:fromHost', handleFromHost);
    socket.on('room:closed', handleClosed);
    socket.connect();

    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('connect_error', handleDisconnect);
      socket.off('room:members', handleMembers);
      socket.off('game:fromHost', handleFromHost);
      socket.off('room:closed', handleClosed);
      // Keep the seat unless the exit was deliberate — see the host's cleanup.
      if (leavingRef.current) leaveRoomAndDisconnect(socket);
      else socket.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one socket lifecycle per screen mount
  }, []);

  const sendAction = useCallback((action: OfcAction) => {
    const payload: OfcGuestToHost = { kind: 'action', action };
    getBluffSocket().emit('game:toHost', { payload });
  }, []);

  const leave = useCallback(() => {
    leavingRef.current = true;
    clearSession('ofc');
    setStatus('closed');
  }, []);

  return { status, reconnecting, code: joinCode, myId, members, hostId, view, errorMsg, closedReason, sendAction, leave };
}
