import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, ScrollView, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { WifiOff } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useKeepAwake } from 'expo-keep-awake';
import { TABLE } from '../../../src/components/hand/PokerTable';
import { WinCelebration } from '../../../src/components/hand/WinCelebration';
import { OfcActorPanel } from '../../../src/components/ofc/OfcActorPanel';
import { SeatTableBoard } from '../../../src/components/games/SeatTableBoard';
import { LobbyFelt } from '../../../src/components/games/LobbyFelt';
import { shareTableCode } from '../../../src/lib/shareTableCode';
import { OfcTableFelt } from '../../../src/components/ofc/OfcTableFelt';
import { OfcSeatsStrip } from '../../../src/components/ofc/OfcSeatsStrip';
import type { OfcSeatVM } from '../../../src/components/ofc/OfcSeatsStrip';
import { PlacementBoard } from '../../../src/components/ofc/PlacementBoard';
import { DrawPlacement } from '../../../src/components/ofc/DrawPlacement';
import { ScoreSheet } from '../../../src/components/ofc/ScoreSheet';
import { useOfcDraft } from '../../../src/store/useOfcDraft';
import { useConfirmQuitGame } from '../../../src/hooks/useConfirmQuitGame';
import { useAppStore } from '../../../src/store/useAppStore';
import { recordOfcGameEnd, recordOfcHand } from '../../../src/lib/gameStats';
import { useOfcGuest, useOfcHost } from '../../../src/hooks/useOfcOnline';
import type { OfcOnlineCommon } from '../../../src/hooks/useOfcOnline';
import { GRID_SIZE, MAX_OFC_PLAYERS, MIN_OFC_PLAYERS, VARIANT_CONFIG } from '../../../src/lib/ofc';
import { ofcPlayView, ofcSeatData } from '../../../src/lib/ofc/view';
import type { OfcVariant } from '../../../src/lib/ofc';
import { fontFamily, fontSize, radius, spacing } from '../../../src/design-system/theme';
import { useTheme } from '../../../src/design-system/ThemeProvider';
import { DARK_TILE, SCREEN_BG } from '../../../src/components/games/gameSurface';
import { GamePlayHeader } from '../../../src/components/games/GamePlayHeader';
import { GameOverActions } from '../../../src/components/games/GameOverActions';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// How long the scoresheet stays up before the host's device rolls the next hand on its
// own. Long enough to read a full foul + royalties breakdown without feeling stuck.
const SCORESHEET_HOLD_MS = 6000;

// Server/protocol disconnect enums → ofc namespace keys, translated at render.
const DISCONNECT_KEYS = {
  host_left: 'games:disconnect.host_left',
  expired: 'games:disconnect.expired',
  hostQuit: 'games:disconnect.hostQuit',
} as const;

export default function OfcOnlineScreen() {
  const mode = useOfcDraft((s) => s.mode);
  const pseudo = useOfcDraft((s) => s.pseudo);
  const joinCode = useOfcDraft((s) => s.joinCode);
  const startingStack = useOfcDraft((s) => s.startingStack);
  const variant = useOfcDraft((s) => s.variant);

  if (mode === 'guest' && joinCode) return <GuestFlow pseudo={pseudo} joinCode={joinCode} />;
  return <HostFlow pseudo={pseudo} startingStack={startingStack} variant={variant} />;
}

function HostFlow({ pseudo, startingStack, variant }: { pseudo: string; startingStack: number; variant: OfcVariant }) {
  const online = useOfcHost(pseudo);
  return (
    <OnlineView
      online={online}
      isHost
      hostVariant={variant}
      onStart={() => online.startGame(startingStack, variant)}
      onReplay={online.replay}
    />
  );
}

function GuestFlow({ pseudo, joinCode }: { pseudo: string; joinCode: string }) {
  const online = useOfcGuest(pseudo, joinCode);
  return <OnlineView online={online} isHost={false} />;
}

interface OnlineViewProps {
  online: OfcOnlineCommon;
  isHost: boolean;
  hostVariant?: OfcVariant; // the mode this host will start — shown in the lobby
  onStart?: () => void;
  onReplay?: () => void;
}

function OnlineView({ online, isHost, hostVariant, onStart, onReplay }: OnlineViewProps) {
  // Locking the phone suspends the socket — fatal for the host, disruptive for guests.
  useKeepAwake();
  const { t } = useTranslation('ofc');
  const { colors } = useTheme();
  const router = useRouter();
  const { status, code, myId, members, view, errorMsg, closedReason, sendAction } = online;

  // The host holds the room: their exit closes it for everyone, so it needs confirming in
  // the LOBBY too — that is where the ❌ used to kill a table with no dialog at all.
  const gameLive = status === 'playing' && view?.phase !== 'gameOver';
  const hostHoldsRoom = isHost && (status === 'lobby' || gameLive);
  const confirmQuit = useConfirmQuitGame(hostHoldsRoom || gameLive, hostHoldsRoom ? 'closesTable' : 'progress');

  const [celebrating, setCelebrating] = useState(false);
  const [dismissedError, setDismissedError] = useState<string | null>(null);

  // Action errors from the host surface as a transient toast (auto-dismissed).
  useEffect(() => {
    if (!errorMsg || status === 'error') return;
    const timer = setTimeout(() => setDismissedError(errorMsg), 3000);
    return () => clearTimeout(timer);
  }, [errorMsg, status]);
  const toast = errorMsg && errorMsg !== dismissedError && status !== 'error' ? errorMsg : null;

  useEffect(() => {
    if (view?.phase !== 'gameOver') return;
    const timer = setTimeout(() => setCelebrating(true), 700);
    return () => clearTimeout(timer);
  }, [view?.phase]);

  // Every device (host and guests) records local stats for all pseudos in the game.
  // Broadcasts repeat states, so both effects dedupe: hands by hand number (the ref
  // clears while a hand is being played), the game end by a latch reset when the phase
  // moves on. The scoring/gameOver condition also covers a guest reconnecting late.
  const updateGameStats = useAppStore((s) => s.updateGameStats);
  const statsHandRef = useRef<number | null>(null);
  useEffect(() => {
    if (!view) return;
    if (view.phase === 'dealing' || view.phase === 'placing') {
      statsHandRef.current = null;
      return;
    }
    if (!view.handResult || statsHandRef.current === view.handNumber) return;
    statsHandRef.current = view.handNumber;
    updateGameStats((s) =>
      recordOfcHand(s, {
        perPlayer: view.players
          .filter((p) => view.handResult!.perPlayer[p.id])
          .map((p) => ({
            name: p.name,
            fouled: view.handResult!.perPlayer[p.id].fouled,
            fantasyNext: view.handResult!.perPlayer[p.id].fantasyNext,
          })),
      })
    );
  }, [view, updateGameStats]);

  // The host used to have to press "next hand" for everyone. Nobody wants that button —
  // the scoresheet is the only reason to pause, so hold it long enough to read and move on.
  // It is also what declares a finished game over, so it must fire even when the host is
  // the player who just busted (the engine now accepts table actions from an eliminated
  // caller; without both halves a busted host froze the table for good).
  const autoAdvancedRef = useRef<number | null>(null);
  useEffect(() => {
    if (!isHost || view?.phase !== 'scoring') {
      if (view && view.phase !== 'scoring') autoAdvancedRef.current = null;
      return;
    }
    if (autoAdvancedRef.current === view.handNumber) return;
    const hand = view.handNumber;
    const timer = setTimeout(() => {
      autoAdvancedRef.current = hand;
      sendAction({ type: 'nextHand', playerId: myId! });
    }, SCORESHEET_HOLD_MS);
    return () => clearTimeout(timer);
  }, [isHost, view, myId, sendAction]);

  const gameOverRecordedRef = useRef(false);
  useEffect(() => {
    if (view?.phase !== 'gameOver') {
      gameOverRecordedRef.current = false;
      return;
    }
    if (gameOverRecordedRef.current || !view.winnerId) return;
    gameOverRecordedRef.current = true;
    const winnerPlayer = view.players.find((p) => p.id === view.winnerId);
    if (!winnerPlayer) return;
    updateGameStats((s) =>
      recordOfcGameEnd(s, { players: view.players.map((p) => p.name), winner: winnerPlayer.name })
    );
  }, [view, updateGameStats]);

  const quit = async () => {
    if (await confirmQuit()) router.dismissTo('/');
  };

  // ── Pre-game states ──────────────────────────────────────────────────────────

  if (status === 'connecting') {
    return (
      <SafeAreaView style={[styles.screen, styles.centered]}>
        <StatusBar style="light" />
        <ActivityIndicator color={colors.accentBright} />
        <Text style={[styles.mutedText, { color: colors.onDarkSecondary }]}>{t('games:online.connecting')}</Text>
        <TouchableOpacity onPress={quit} style={[styles.secondaryBtn, { backgroundColor: DARK_TILE }]}>
          <Text style={[styles.secondaryBtnText, { color: colors.onDarkPrimary }]}>{t('common:cancel')}</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  if (status === 'error' || status === 'closed') {
    const message =
      status === 'error'
        ? errorMsg
        : t(closedReason ? DISCONNECT_KEYS[closedReason] : 'games:disconnect.generic');
    return (
      <SafeAreaView style={[styles.screen, styles.centered]}>
        <StatusBar style="light" />
        <WifiOff size={28} color={colors.onDarkTertiary} strokeWidth={1.5} />
        <Text style={[styles.mutedText, { color: colors.onDarkPrimary }]}>{message}</Text>
        <TouchableOpacity onPress={quit} style={[styles.primaryBtn, { backgroundColor: colors.accentBright }]}>
          <Text style={styles.primaryBtnText}>{t('common:back')}</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  if (status === 'lobby') {
    const canStart = members.length >= MIN_OFC_PLAYERS && members.length <= MAX_OFC_PLAYERS;
    return (
      <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
        <StatusBar style="light" />
        <GamePlayHeader title={t('online.title')} onClose={quit} onDark />

        {/* The room IS the table: the code sits on the felt and the seats fill as people
            join, instead of a code card above a list of names. */}
        <View style={styles.lobbyContent}>
          <Animated.View entering={FadeInDown.delay(0).springify().damping(18).stiffness(140)}>
            <SeatTableBoard
              players={[]}
              selected={members.map((m) => ({
                id: m.playerId,
                name: m.playerId === myId ? t('games:online.youSuffix', { name: m.name }) : m.name,
              }))}
              onChange={() => {}}
              maxPlayers={MAX_OFC_PLAYERS}
              seatsInteractive={false}
              emptySeatLabel={t('games:online.waitingSeat')}
              dimmedIds={members.filter((m) => !m.connected).map((m) => m.playerId)}
              center={(feltWidth) => (
                <LobbyFelt
                  code={code ?? ''}
                  codeLabel={t('games:online.tableCode')}
                  caption={isHost ? t('games:online.shareCode') : t('games:online.waitingHostStart')}
                  inviteLabel={t('games:online.invite')}
                  onInvite={
                    isHost && code
                      ? () => shareTableCode(t('games:online.inviteMessage', { game: t('degen:names.ofc'), code }))
                      : undefined
                  }
                  rules={
                    isHost && hostVariant
                      ? [
                          t('online.variant', {
                            mode: t(hostVariant === 'classic' ? 'setup.variantClassic' : 'setup.variantPineapple'),
                          }),
                        ]
                      : []
                  }
                  width={feltWidth}
                />
              )}
            />
          </Animated.View>
          <Text style={[styles.mutedText, { color: colors.onDarkTertiary }]}>
            {t('games:online.players', { current: members.length, max: MAX_OFC_PLAYERS })}
          </Text>
        </View>

        <View style={styles.footer}>
          {isHost ? (
            <TouchableOpacity
              style={[styles.primaryBtn, { backgroundColor: colors.accentBright }, !canStart && styles.disabledBtn]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                onStart?.();
              }}
              disabled={!canStart}
              activeOpacity={0.85}
            >
              <Text style={styles.primaryBtnText}>{t('games:online.startGame')}</Text>
            </TouchableOpacity>
          ) : (
            <Text style={[styles.mutedText, styles.waitingText, { color: colors.onDarkTertiary }]}>
              {t('games:online.startsWhenHostLaunches')}
            </Text>
          )}
        </View>
      </SafeAreaView>
    );
  }

  // ── Playing ──────────────────────────────────────────────────────────────────

  // Playing, but this device has no state to draw yet — normally the beat between the host
  // dealing and its first broadcast reaching us. It used to `return null`, which is a fully
  // black screen with no way out, and a late joiner could sit in it indefinitely (the relay
  // now refuses them outright, but a silent hole is still the wrong thing to render).
  if (!view || !myId) {
    return (
      <SafeAreaView style={[styles.screen, styles.centered]}>
        <StatusBar style="light" />
        <ActivityIndicator color={colors.accentBright} />
        <Text style={[styles.mutedText, { color: colors.onDarkSecondary }]}>{t('games:online.joiningGame')}</Text>
        <TouchableOpacity onPress={quit} style={[styles.secondaryBtn, { backgroundColor: DARK_TILE }]}>
          <Text style={[styles.secondaryBtnText, { color: colors.onDarkPrimary }]}>{t('games:online.quit')}</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const { phase } = view;
  // Online, "the actor" and "the viewer" are the same person, so the one redacted state
  // this device already has serves both roles the shared view module distinguishes.
  const v = ofcPlayView(view, { actorId: myId, rotateToActor: true, addressActorAsYou: true });
  const { actor: me, winner, nameById } = v;

  // Seat 0 = me, first in the strip — and while I'm acting my seat leaves it, since my
  // board is already rendered once, big, in the action zone.
  const stripSeats: OfcSeatVM[] = ofcSeatData(v, view, (p) =>
    p.id === myId ? t('games:online.youSuffix', { name: p.name }) : p.name
  );

  const myFantasyTurn = v.role === 'fantasy';
  const myInitialTurn = v.role === 'initial';
  const myDraw = v.role === 'draw' ? view.pending : null;

  const caption = v.caption.kind === 'none' ? '' : t(v.caption.key, v.caption.params);

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <StatusBar style="light" />
      <GamePlayHeader
        title={t('online.headerCode', { code })}
        onClose={quit}
        onDark
        right={
          <Text style={[styles.handBadge, { color: colors.onDarkTertiary }]}>{t('game.handBadge', { hand: view.handNumber })}</Text>
        }
      />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Animated.Text key={`caption-${view.version}`} entering={FadeInDown.duration(300)} style={styles.caption}>
          {caption}
        </Animated.Text>

        <OfcTableFelt>
          <OfcSeatsStrip seats={stripSeats} activeId={phase === 'placing' ? view.turnId : null} />
        </OfcTableFelt>

        {(myFantasyTurn || myInitialTurn) && me?.hand && (
          <Animated.View entering={FadeIn.duration(200)}>
            <OfcActorPanel
              name={t('games:online.youSuffix', { name: me.name })}
              chips={me.chips}
              isButton={me.id === view.buttonId}
              inFantasyLand={me.inFantasyLand}
            >
              <PlacementBoard
                key={`${myId}-${view.handNumber}-${myFantasyTurn ? 'fl' : 'initial'}`}
                hand={me.hand}
                discards={myFantasyTurn ? Math.max(0, me.hand.length - GRID_SIZE) : 0}
                commitLabel={t('game.commit')}
                onCommit={(placements) => {
                  sendAction(
                    myFantasyTurn
                      ? { type: 'placeFantasy', playerId: myId, placements }
                      : { type: 'placeInitial', playerId: myId, placements },
                  );
                }}
              />
            </OfcActorPanel>
          </Animated.View>
        )}

        {!myFantasyTurn && myDraw && me?.grid && (
          <OfcActorPanel
            name={t('games:online.youSuffix', { name: me.name })}
            chips={me.chips}
            isButton={me.id === view.buttonId}
          >
            <DrawPlacement
              key={`${myId}-${view.handNumber}-${view.placeRound}`}
              cards={myDraw.cards!}
              placeCount={VARIANT_CONFIG[view.variant].placeCount}
              grid={me.grid}
              discards={me.discards}
              onCommit={(placements) => sendAction({ type: 'placeDraw', playerId: myId, placements })}
            />
          </OfcActorPanel>
        )}

        {(phase === 'scoring' || phase === 'gameOver') && view.handResult && (
          <Animated.View entering={FadeInDown.duration(300)}>
            <ScoreSheet result={view.handResult} nameById={nameById} />
          </Animated.View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

      <View style={styles.footer}>
        {toast && (
          <Animated.Text entering={FadeIn.duration(200)} style={[styles.toast, { color: '#FF6B70' }]}>
            {toast}
          </Animated.Text>
        )}

        {phase === 'scoring' && (
          <Text style={[styles.mutedText, styles.waitingText, { color: colors.onDarkTertiary }]}>
            {t('online.advancing')}
          </Text>
        )}

        {phase === 'gameOver' && (
          <GameOverActions
            finishLabel={t('games:online.quit')}
            replayLabel={t('games:game.replay')}
            waitingLabel={t('games:online.waitingHostReplay')}
            onFinish={quit}
            onReplay={
              isHost
                ? () => {
                    setCelebrating(false);
                    onReplay?.();
                  }
                : undefined
            }
          />
        )}
      </View>

      {celebrating && winner && (
        <View pointerEvents="none" style={styles.celebrationLayer}>
          <WinCelebration
            width={SCREEN_WIDTH}
            height={320}
            title={t('games:game.victory')}
            subtitle={t('game.winnerSub', { name: winner.name })}
            borderRadius={0}
            onDone={() => setCelebrating(false)}
          />
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: SCREEN_BG,
  },
  centered: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.base,
  },
  handBadge: {
    fontSize: fontSize.xs,
    fontFamily: fontFamily.bold,
  },
  lobbyContent: {
    flex: 1,
    paddingHorizontal: spacing.base,
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.base,
  },
  content: {
    paddingHorizontal: spacing.base,
    gap: spacing.md,
  },
  caption: {
    fontSize: fontSize.md,
    fontFamily: fontFamily.display,
    textAlign: 'center',
    color: TABLE.gold,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    minHeight: 22,
  },
  footer: {
    paddingHorizontal: spacing.base,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
    gap: spacing.sm,
  },
  toast: {
    fontSize: fontSize.sm,
    fontFamily: fontFamily.semibold,
    textAlign: 'center',
  },
  waitingText: {
    textAlign: 'center',
    paddingVertical: spacing.sm,
  },
  mutedText: {
    fontSize: fontSize.sm,
    fontFamily: fontFamily.medium,
  },
  primaryBtn: {
    borderRadius: radius.md,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  secondaryBtn: {
    borderRadius: radius.md,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  secondaryBtnText: {
    fontSize: fontSize.md,
    fontFamily: fontFamily.bold,
  },
  disabledBtn: {
    opacity: 0.4,
  },
  primaryBtnText: {
    color: '#0A0A0F',
    fontSize: fontSize.md,
    fontFamily: fontFamily.bold,
  },
  celebrationLayer: {
    position: 'absolute',
    top: '25%',
    left: 0,
    right: 0,
  },
});
