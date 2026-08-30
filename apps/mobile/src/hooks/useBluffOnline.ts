import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  DEFAULT_BLUFF_CONFIG,
  createRoundDeal,
  initGame,
  reduce,
  validateAction,
} from '../lib/bluff';
import type { BluffAction, BluffConfig, BluffState } from '../lib/bluff';
import { redactFor } from '../lib/bluff/protocol';
import type {
  GuestToHost,
  HostToGuest,
  MemberInfo,
  RedactedState,
} from '../lib/bluff/protocol';
import { getBluffSocket } from '../lib/bluff/socket';
import type { Player } from '../types';

export type OnlineStatus = 'connecting' | 'lobby' | 'playing' | 'closed' | 'error';

export interface BluffOnlineCommon {
  status: OnlineStatus;
  code: string | null;
  myId: string | null;
  members: MemberInfo[];
  hostId: string | null;
  // What this device is allowed to see — the host renders through redactFor too.
  view: RedactedState | null;
  errorMsg: string | null;
  closedReason: 'host_left' | 'expired' | 'hostQuit' | null;
  sendAction: (action: BluffAction) => void;
  leave: () => void;
}

// Server room-error enums → bluff namespace keys, translated on this device.
const JOIN_ERROR_KEYS = {
  not_found: 'games:connection.not_found',
  full: 'games:connection.full',
  unavailable: 'games:connection.unavailable',
  bad_token: 'games:connection.bad_token',
} as const;

function withAutoDeal(state: BluffState): BluffState {
  return state.phase === 'dealing' ? reduce(state, createRoundDeal(state)) : state;
}

// ── Host: runs the authoritative engine, the relay only transports ─────────────

export function useBluffHost(
  pseudo: string,
): BluffOnlineCommon & { startGame: (config: BluffConfig) => void; replay: () => void } {
  const { t } = useTranslation('bluff');
  const [status, setStatus] = useState<OnlineStatus>('connecting');
  const [code, setCode] = useState<string | null>(null);
  const [myId, setMyId] = useState<string | null>(null);
  const [members, setMembers] = useState<MemberInfo[]>([]);
  const [view, setView] = useState<RedactedState | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [closedReason, setClosedReason] = useState<BluffOnlineCommon['closedReason']>(null);

  const gameRef = useRef<BluffState | null>(null);
  const configRef = useRef<BluffConfig>(DEFAULT_BLUFF_CONFIG);
  const membersRef = useRef<MemberInfo[]>([]);
  const sessionRef = useRef<{ code: string; playerId: string; sessionToken: string } | null>(null);

  const broadcast = useCallback(() => {
    const state = gameRef.current;
    const session = sessionRef.current;
    if (!state || !session) return;
    const socket = getBluffSocket();
    const connected = new Map(membersRef.current.map((m) => [m.playerId, m.connected]));
    for (const member of membersRef.current) {
      if (member.playerId === session.playerId || !member.connected) continue;
      const payload: HostToGuest = { kind: 'state', state: redactFor(state, member.playerId, connected) };
      socket.emit('game:toPlayer', { playerId: member.playerId, payload });
    }
    setView(redactFor(state, session.playerId, connected));
  }, []);

  const apply = useCallback(
    (action: BluffAction, replyTo?: string) => {
      const state = gameRef.current;
      if (!state) return;
      const valid = validateAction(state, action);
      if (!valid.ok) {
        if (replyTo) {
          // Relay the language-neutral code + params — the guest translates locally.
          const payload: HostToGuest = { kind: 'error', error: { code: valid.code, params: valid.params } };
          getBluffSocket().emit('game:toPlayer', { playerId: replyTo, payload });
        }
        return;
      }
      gameRef.current = withAutoDeal(reduce(state, action));
      broadcast();
    },
    [broadcast],
  );

  useEffect(() => {
    const socket = getBluffSocket();

    const handleConnect = () => {
      const session = sessionRef.current;
      if (!session) {
        socket.emit('room:create', { name: pseudo }, (res) => {
          if (!res.ok) {
            setErrorMsg(t(JOIN_ERROR_KEYS[res.reason]));
            setStatus('error');
            return;
          }
          sessionRef.current = { code: res.code, playerId: res.playerId, sessionToken: res.sessionToken };
          setCode(res.code);
          setMyId(res.playerId);
          setStatus('lobby');
        });
      } else {
        socket.emit('room:rejoin', { ...session }, (res) => {
          if (res.ok) broadcast();
        });
      }
    };

    const handleMembers = ({ members: list }: { members: MemberInfo[] }) => {
      membersRef.current = list;
      setMembers(list);
      // Keep guests' connected dots fresh, and hand a rejoined guest the current state.
      if (gameRef.current) broadcast();
    };

    const handleFromPlayer = ({ fromPlayerId, payload }: { fromPlayerId: string; payload: unknown }) => {
      const msg = payload as GuestToHost;
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
      setClosedReason(reason);
      setStatus('closed');
    };

    socket.on('connect', handleConnect);
    socket.on('room:members', handleMembers);
    socket.on('game:fromPlayer', handleFromPlayer);
    socket.on('room:closed', handleClosed);
    socket.connect();

    return () => {
      const payload: HostToGuest = { kind: 'gameEnded', reason: 'hostQuit' };
      socket.emit('game:broadcast', { payload });
      socket.emit('room:leave');
      socket.off('connect', handleConnect);
      socket.off('room:members', handleMembers);
      socket.off('game:fromPlayer', handleFromPlayer);
      socket.off('room:closed', handleClosed);
      socket.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one socket lifecycle per screen mount
  }, []);

  const startGame = useCallback(
    (config: BluffConfig) => {
      configRef.current = config;
      const players: Player[] = membersRef.current.map((m) => ({ id: m.playerId, name: m.name }));
      const previousVersion = gameRef.current?.version ?? 0;
      const fresh = withAutoDeal(initGame(players, Math.random, config));
      // Keep versions monotonic across replays so guests' stale-drop never eats a fresh game.
      gameRef.current = { ...fresh, version: previousVersion + fresh.version + 1 };
      setStatus('playing');
      broadcast();
    },
    [broadcast],
  );

  const replay = useCallback(() => startGame(configRef.current), [startGame]);

  const sendAction = useCallback(
    (action: BluffAction) => {
      const session = sessionRef.current;
      if (!session) return;
      apply({ ...action, playerId: session.playerId });
    },
    [apply],
  );

  const leave = useCallback(() => {
    // Actual teardown happens in the effect cleanup on unmount.
    setStatus('closed');
  }, []);

  return {
    status,
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

export function useBluffGuest(pseudo: string, joinCode: string): BluffOnlineCommon {
  const { t } = useTranslation('bluff');
  const [status, setStatus] = useState<OnlineStatus>('connecting');
  const [myId, setMyId] = useState<string | null>(null);
  const [members, setMembers] = useState<MemberInfo[]>([]);
  const [hostId, setHostId] = useState<string | null>(null);
  const [view, setView] = useState<RedactedState | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [closedReason, setClosedReason] = useState<BluffOnlineCommon['closedReason']>(null);

  const sessionRef = useRef<{ code: string; playerId: string; sessionToken: string } | null>(null);
  const lastVersionRef = useRef(-1);

  useEffect(() => {
    const socket = getBluffSocket();

    const handleConnect = () => {
      const session = sessionRef.current;
      if (!session) {
        socket.emit('room:join', { code: joinCode, name: pseudo }, (res) => {
          if (!res.ok) {
            setErrorMsg(t(JOIN_ERROR_KEYS[res.reason]));
            setStatus('error');
            return;
          }
          sessionRef.current = { code: joinCode, playerId: res.playerId, sessionToken: res.sessionToken };
          setMyId(res.playerId);
          setHostId(res.hostPlayerId);
          setMembers(res.members);
          setStatus('lobby');
        });
      } else {
        socket.emit('room:rejoin', { ...session }, (res) => {
          if (res.ok) {
            const payload: GuestToHost = { kind: 'requestState' };
            socket.emit('game:toHost', { payload });
          } else {
            setErrorMsg(t(JOIN_ERROR_KEYS[res.reason]));
            setStatus('error');
          }
        });
      }
    };

    const handleMembers = ({ members: list, hostPlayerId }: { members: MemberInfo[]; hostPlayerId: string }) => {
      setMembers(list);
      setHostId(hostPlayerId);
    };

    const handleFromHost = ({ payload }: { payload: unknown }) => {
      const msg = payload as HostToGuest;
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
        setClosedReason('hostQuit');
        setStatus('closed');
      }
    };

    const handleClosed = ({ reason }: { reason: 'host_left' | 'expired' }) => {
      setClosedReason(reason);
      setStatus('closed');
    };

    socket.on('connect', handleConnect);
    socket.on('room:members', handleMembers);
    socket.on('game:fromHost', handleFromHost);
    socket.on('room:closed', handleClosed);
    socket.connect();

    return () => {
      socket.emit('room:leave');
      socket.off('connect', handleConnect);
      socket.off('room:members', handleMembers);
      socket.off('game:fromHost', handleFromHost);
      socket.off('room:closed', handleClosed);
      socket.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one socket lifecycle per screen mount
  }, []);

  const sendAction = useCallback((action: BluffAction) => {
    const payload: GuestToHost = { kind: 'action', action };
    getBluffSocket().emit('game:toHost', { payload });
  }, []);

  const leave = useCallback(() => {
    setStatus('closed');
  }, []);

  return { status, code: joinCode, myId, members, hostId, view, errorMsg, closedReason, sendAction, leave };
}
