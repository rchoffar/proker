import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator , type LayoutChangeEvent } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { WifiOff } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useKeepAwake } from 'expo-keep-awake';
import { PlayingCard } from '../../../src/components/hand/PlayingCard';
import { TABLE } from '../../../src/components/hand/PokerTable';
import { WinCelebration } from '../../../src/components/hand/WinCelebration';
import { BluffTable, BLUFF_TABLE_MARGIN_Y } from '../../../src/components/bluff/BluffTable';
import { SeatTableBoard } from '../../../src/components/games/SeatTableBoard';
import { LobbyFelt } from '../../../src/components/games/LobbyFelt';
import { PLAY_TABLE, playTableHeight } from '../../../src/components/table/tableSize';
import { DARK_CARD_BG, DARK_TILE, LOSS_ON_DARK, SCREEN_BG } from '../../../src/components/games/gameSurface';
import { GamePlayHeader } from '../../../src/components/games/GamePlayHeader';
import { GameOverActions } from '../../../src/components/games/GameOverActions';
import type { BluffSeatVM } from '../../../src/components/bluff/BluffTable';
import { ClaimPickerSheet } from '../../../src/components/bluff/ClaimPickerSheet';
import { DarkStepper } from '../../../src/components/bluff/DarkStepper';
import { useBluffDraft } from '../../../src/store/useBluffDraft';
import { useConfirmQuitGame } from '../../../src/hooks/useConfirmQuitGame';
import { useAppStore } from '../../../src/store/useAppStore';
import { recordBluffGameEnd, recordBluffReveal } from '../../../src/lib/gameStats';
import { useBluffGuest, useBluffHost } from '../../../src/hooks/useBluffOnline';
import type { BluffOnlineCommon } from '../../../src/hooks/useBluffOnline';
import { MAX_BLUFF_PLAYERS, MAX_BOARD_CARDS, MIN_BLUFF_PLAYERS, claimLabel } from '../../../src/lib/bluff';
import { bluffPlayView, bluffSeatData } from '../../../src/lib/bluff/view';
import type { BluffVariant, Claim } from '../../../src/lib/bluff';
import { fontFamily, fontSize, radius, spacing } from '../../../src/design-system/theme';
import { useTheme } from '../../../src/design-system/ThemeProvider';

// How long a reveal stays up before the host's device rolls the next round on its own.
// Longer than OFC's scoresheet hold: a reveal has the caught hand and the pool to read.
const REVEAL_HOLD_MS = 7000;

const TABLE_W = PLAY_TABLE.width;

const HAND_FAN_ANGLES: Record<number, number[]> = {
  1: [0],
  2: [-6, 6],
  3: [-8, 0, 8],
  4: [-12, -4, 4, 12],
  5: [-14, -7, 0, 7, 14],
};

// Server/protocol disconnect enums → bluff namespace keys, translated at render.
const DISCONNECT_KEYS = {
  host_left: 'games:disconnect.host_left',
  expired: 'games:disconnect.expired',
  hostQuit: 'games:disconnect.hostQuit',
} as const;

export default function BluffOnlineScreen() {
  const mode = useBluffDraft((s) => s.mode);
  const pseudo = useBluffDraft((s) => s.pseudo);
  const joinCode = useBluffDraft((s) => s.joinCode);

  if (mode === 'guest' && joinCode) return <GuestFlow pseudo={pseudo} joinCode={joinCode} />;
  return <HostFlow pseudo={pseudo} />;
}

function HostFlow({ pseudo }: { pseudo: string }) {
  const jeuMax = useBluffDraft((s) => s.jeuMax);
  const variant = useBluffDraft((s) => s.variant);
  const online = useBluffHost(pseudo);
  return (
    <OnlineView
      online={online}
      isHost
      hostJeuMax={jeuMax}
      hostVariant={variant}
      onStart={() => online.startGame({ jeuMax, variant })}
      onReplay={online.replay}
    />
  );
}

function GuestFlow({ pseudo, joinCode }: { pseudo: string; joinCode: string }) {
  const online = useBluffGuest(pseudo, joinCode);
  return <OnlineView online={online} isHost={false} />;
}

interface OnlineViewProps {
  online: BluffOnlineCommon;
  isHost: boolean;
  // Lobby-only display of the host's chosen rules — guests learn them from the first
  // state broadcast once the game starts.
  hostJeuMax?: boolean;
  hostVariant?: BluffVariant;
  onStart?: () => void;
  onReplay?: () => void;
}

function OnlineView({ online, isHost, hostJeuMax, hostVariant, onStart, onReplay }: OnlineViewProps) {
  // Locking the phone suspends the socket — fatal for the host, disruptive for guests.
  useKeepAwake();
  const { t } = useTranslation('bluff');
  const { colors } = useTheme();
  const router = useRouter();
  const { status, code, myId, members, view, errorMsg, closedReason, sendAction } = online;

  // The host holds the room: their exit closes it for everyone, so it needs confirming in
  // the LOBBY too — that is where the ❌ used to kill a table with no dialog at all.
  const gameLive = status === 'playing' && view?.phase !== 'gameOver';
  const hostHoldsRoom = isHost && (status === 'lobby' || gameLive);
  const confirmQuit = useConfirmQuitGame(hostHoldsRoom || gameLive, hostHoldsRoom ? 'closesTable' : 'progress');

  const [pickerOpen, setPickerOpen] = useState(false);
  const [faceUpCount, setFaceUpCount] = useState(3);
  const [faceDownCount, setFaceDownCount] = useState(0);
  const [celebrating, setCelebrating] = useState(false);

  // The felt is fitted to the room this screen actually has, not to a fraction of the window:
  // with a fixed height inside a `flex: 1` container the overflow went into the felt's own
  // top and bottom and sliced the seat pods off. BluffTable's own vertical margin (pod
  // clearance) is not room the felt can use, so it comes off the measurement.
  const [areaH, setAreaH] = useState<number | null>(null);
  const onTableAreaLayout = (e: LayoutChangeEvent) => {
    const next = Math.round(e.nativeEvent.layout.height) - BLUFF_TABLE_MARGIN_Y * 2;
    if (next > 0 && next !== areaH) setAreaH(next);
  };
  const tableH = playTableHeight(areaH);

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
  // Broadcasts repeat states, so both effects dedupe: reveals by round number (reveal is
  // cleared by the next deal), the game end by a latch reset when the phase moves on.
  // Jeu Max reveals are a different mechanic and stay out of the catch counters.
  const updateGameStats = useAppStore((s) => s.updateGameStats);
  const revealRoundRef = useRef<number | null>(null);
  useEffect(() => {
    if (!view?.reveal) {
      revealRoundRef.current = null;
      return;
    }
    if (view.reveal.kind !== 'catch' || revealRoundRef.current === view.round) return;
    revealRoundRef.current = view.round;
    const nameOf = (id: string) => view.players.find((p) => p.id === id)?.name ?? '';
    updateGameStats((s) =>
      recordBluffReveal(s, {
        catcher: nameOf(view.reveal!.catcherId),
        claimer: nameOf(view.reveal!.claimerId),
        holds: view.reveal!.holds,
      })
    );
  }, [view, updateGameStats]);

  // Nobody wants to press "next round" for the whole table — the reveal is the only reason
  // to pause, so hold it long enough to read and move on. It is also what declares a
  // finished game over, so it must fire even when the host is the player who just got
  // knocked out (the engine now accepts table actions from an eliminated caller).
  const autoAdvancedRef = useRef<number | null>(null);
  useEffect(() => {
    const phase = view?.phase;
    if (!isHost || !view || (phase !== 'reveal' && phase !== 'roundEnd')) {
      if (view && phase !== 'reveal' && phase !== 'roundEnd') autoAdvancedRef.current = null;
      return;
    }
    if (autoAdvancedRef.current === view.round) return;
    const round = view.round;
    const timer = setTimeout(() => {
      autoAdvancedRef.current = round;
      if (phase === 'reveal') sendAction({ type: 'confirmReveal', playerId: myId! });
      sendAction({ type: 'nextRound', playerId: myId! });
    }, REVEAL_HOLD_MS);
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
      recordBluffGameEnd(s, { players: view.players.map((p) => p.name), winner: winnerPlayer.name })
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
    const canStart = members.length >= MIN_BLUFF_PLAYERS && members.length <= MAX_BLUFF_PLAYERS;
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
              maxPlayers={MAX_BLUFF_PLAYERS}
              seatsInteractive={false}
              emptySeatLabel={t('games:online.waitingSeat')}
              dimmedIds={members.filter((m) => !m.connected).map((m) => m.playerId)}
              center={(feltWidth) => (
                <LobbyFelt
                  code={code ?? ''}
                  codeLabel={t('games:online.tableCode')}
                  caption={isHost ? t('games:online.shareCode') : t('games:online.waitingHostStart')}
                  rules={
                    isHost
                      ? [
                          t(hostJeuMax ? 'online.jeuMaxEnabled' : 'online.jeuMaxDisabledLobby'),
                          t(hostVariant === 'quick' ? 'online.variantQuick' : 'online.variantStandard'),
                        ]
                      : []
                  }
                  width={feltWidth}
                />
              )}
            />
          </Animated.View>
          <Text style={[styles.mutedText, { color: colors.onDarkTertiary }]}>
            {t('games:online.players', { current: members.length, max: MAX_BLUFF_PLAYERS })}
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

  if (!view || !myId) return null;

  const { phase, reveal } = view;
  // Seat 0 = me, at bottom center, and my plate says "(you)" — the two things that make
  // this an online table rather than a shared phone. Everything else about the felt is
  // the same rules for both modes, so it comes out of the shared view module.
  const v = bluffPlayView(view, { viewerId: myId, rotateToViewer: true, addressViewerAsYou: true });
  const { turnPlayer, starter, winner, isViewerTurn: myTurn, isViewerStarter: isStarter, canCatch, mustCatch } = v;
  const loser = reveal ? view.players.find((p) => p.id === reveal.loserId) : null;
  const catcher = reveal ? view.players.find((p) => p.id === reveal.catcherId) : null;
  const claimer = reveal ? view.players.find((p) => p.id === reveal.claimerId) : null;

  // No "(you)" suffix on the felt: online seats you at the bottom of the table, so the seat
  // is already unmistakably yours. It also fed a decorated name to the pod's avatar, whose
  // initials are the first letter of the first two words — "mathieuchfd (toi)" came out as
  // "M(", which is what Mathieu was asking about.
  const seats: BluffSeatVM[] = bluffSeatData(v, (p) => p.name);

  const myHand = v.viewer?.hand ?? [];
  const fanAngles = HAND_FAN_ANGLES[myHand.length] ?? HAND_FAN_ANGLES[2];

  const caption =
    v.caption.kind === 'none'
      ? ''
      : v.caption.kind === 'claim'
        ? claimLabel(v.caption.claim, t)
        : t(v.caption.key, { name: v.caption.name });

  const handleClaim = (claim: Claim) => {
    setPickerOpen(false);
    sendAction({ type: 'claim', playerId: myId, claim });
  };

  const handleCatch = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    sendAction({ type: 'catch', playerId: myId });
  };

  const handleJeuMax = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    sendAction({ type: 'jeuMax', playerId: myId });
  };

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <StatusBar style="light" />
      <GamePlayHeader
        title={t('online.headerCode', { code })}
        onClose={quit}
        onDark
        right={
          <Text style={[styles.roundBadge, { color: colors.onDarkTertiary }]}>{t('game.roundBadge', { round: view.round })}</Text>
        }
      />

      <View style={styles.tableArea} onLayout={onTableAreaLayout}>
        <BluffTable
          width={TABLE_W}
          height={tableH}
          players={seats}
          board={view.board}
          hiddenCount={view.hiddenBoardCount}
          hiddenBoard={view.hiddenBoard}
          turnId={phase === 'bidding' ? view.turnId : null}
          reveal={reveal}
          roundToken={view.round}
          announcement={
            reveal ? (
            <Animated.View entering={FadeIn.duration(300)} style={styles.resultBanners}>
              {reveal.kind === 'jeuMax' ? (
                <Text style={[styles.resultBanner, { color: reveal.jeuMaxSuccess ? TABLE.gold : LOSS_ON_DARK }]}>
                  {reveal.jeuMaxSuccess
                    ? t(reveal.jeuMaxShedsLast ? 'game.jeuMaxLastCard' : 'game.jeuMaxSuccess', { name: catcher?.name })
                    : reveal.holds
                      ? t('game.jeuMaxFailHigher', {
                          name: catcher?.name,
                          best: reveal.bestClaim ? claimLabel(reveal.bestClaim, t) : '',
                        })
                      : t('game.jeuMaxFailNotHeld', { name: catcher?.name })}
                </Text>
              ) : (
                <Text style={[styles.resultBanner, { color: reveal.holds ? TABLE.gold : LOSS_ON_DARK }]}>
                  {reveal.holds
                    ? t('game.revealHolds', { name: catcher?.name })
                    : t('game.revealBluff', { name: claimer?.name })}
                </Text>
              )}
              <Text style={[styles.resultSub, { color: colors.onDarkTertiary }]}>
                {reveal.eliminatesLoser
                  ? t('game.revealSubEliminated', { claim: claimLabel(reveal.claim, t), name: loser?.name })
                  : claimLabel(reveal.claim, t)}
              </Text>
              {reveal.kind === 'jeuMax' && catcher && phase !== 'gameOver' && (
                <Text style={[styles.resultSub, { color: colors.onDarkTertiary }]}>
                  {t('game.jeuMaxStatLine', {
                    name: catcher.name,
                    successes: catcher.jeuMaxSuccesses,
                    attempts: catcher.jeuMaxAttempts,
                  })}
                </Text>
              )}
              {phase === 'gameOver' &&
                view.players
                  .filter((p) => p.jeuMaxAttempts > 0)
                  .map((p) => (
                    <Text key={p.id} style={[styles.resultSub, { color: colors.onDarkTertiary }]}>
                      {t('game.jeuMaxStatLine', {
                        name: p.name,
                        successes: p.jeuMaxSuccesses,
                        attempts: p.jeuMaxAttempts,
                      })}
                    </Text>
                  ))}
            </Animated.View>
          ) : (
            <Animated.Text key={`caption-${view.version}`} entering={FadeInDown.duration(300)} style={styles.caption}>
              {caption}
            </Animated.Text>
            )
          }
        >
          {celebrating && winner && (
            <WinCelebration
              width={TABLE_W}
              height={tableH}
              title={t('games:game.victory')}
              subtitle={t('game.winnerSub', { name: winner.name })}
              onDone={() => setCelebrating(false)}
            />
          )}
        </BluffTable>
      </View>

      {/* Own hand — always visible, it's my device. */}
      {!v.handsPublic && myHand.length > 0 && !v.viewer?.eliminated && (
        <View style={[styles.handZone, { borderColor: colors.onDarkHairline, backgroundColor: DARK_CARD_BG }]}>
          {phase === 'chooseBoard' && isStarter && (
            <View style={styles.boardChoice}>
              <DarkStepper
                label={t('game.faceUpStepper')}
                value={faceUpCount}
                min={0}
                max={MAX_BOARD_CARDS - faceDownCount}
                onDecrement={() => setFaceUpCount((v) => Math.max(0, v - 1))}
                onIncrement={() =>
                  setFaceUpCount((v) => Math.min(MAX_BOARD_CARDS - faceDownCount, v + 1))
                }
              />
              <DarkStepper
                label={t('game.faceDownStepper')}
                value={faceDownCount}
                min={0}
                max={MAX_BOARD_CARDS - faceUpCount}
                onDecrement={() => setFaceDownCount((v) => Math.max(0, v - 1))}
                onIncrement={() =>
                  setFaceDownCount((v) => Math.min(MAX_BOARD_CARDS - faceUpCount, v + 1))
                }
              />
            </View>
          )}
          {phase === 'chooseBoard' && isStarter ? (
            // The starter sizes the middle BLIND — their own fan only unlocks once the board
            // split is validated (rule decision; no explanatory sentence, the reveal button
            // sits right here next to the steppers). Other players keep their hand.
            <TouchableOpacity
              style={[styles.primaryBtn, { backgroundColor: colors.accentBright }]}
              onPress={() => sendAction({ type: 'chooseBoard', playerId: myId, faceUpCount, faceDownCount })}
              activeOpacity={0.85}
            >
              <Text style={styles.primaryBtnText}>{t('game.revealBoard')}</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.ownFan}>
              {myHand.map((card, i) => (
                <View
                  key={`own-${view.round}-${i}`}
                  style={[
                    // Pin the fan stacking left→right so overlapped cards layer predictably.
                    { zIndex: i + 1, elevation: i + 1 },
                    { transform: [{ rotate: `${fanAngles[i] ?? 0}deg` }] },
                    i > 0 && styles.ownFanOverlap,
                  ]}
                >
                  <PlayingCard card={card} size="md" />
                </View>
              ))}
            </View>
          )}
        </View>
      )}

      <View style={styles.footer}>
        {toast && (
          <Animated.Text entering={FadeIn.duration(200)} style={[styles.toast, { color: LOSS_ON_DARK }]}>
            {toast}
          </Animated.Text>
        )}

        {phase === 'chooseBoard' && !isStarter && (
          <Text style={[styles.mutedText, styles.waitingText, { color: colors.onDarkTertiary }]}>
            {t('online.waitingBoard', { name: starter?.name })}
          </Text>
        )}

        {phase === 'bidding' &&
          (myTurn ? (
            <>
              {mustCatch && (
                <Text style={[styles.mutedText, styles.waitingText, { color: colors.onDarkTertiary }]}>
                  {t(view.config.jeuMax ? 'game.royalFlushHintJeuMax' : 'game.royalFlushHint')}
                </Text>
              )}
              <View style={styles.actionRow}>
                <TouchableOpacity
                  style={[styles.actionBtn, { backgroundColor: colors.loss }, !canCatch && styles.disabledBtn]}
                  onPress={handleCatch}
                  disabled={!canCatch}
                  activeOpacity={0.85}
                >
                  <Text style={styles.actionBtnText}>{t('game.liar')}</Text>
                </TouchableOpacity>
                {view.config.jeuMax && (
                  <TouchableOpacity
                    style={[styles.actionBtn, { backgroundColor: TABLE.gold }, !canCatch && styles.disabledBtn]}
                    onPress={handleJeuMax}
                    disabled={!canCatch}
                    activeOpacity={0.85}
                  >
                    <Text style={styles.primaryBtnText}>{t('game.jeuMax')}</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  style={[styles.actionBtn, { backgroundColor: colors.accentBright }, mustCatch && styles.disabledBtn]}
                  onPress={() => setPickerOpen(true)}
                  disabled={mustCatch}
                  activeOpacity={0.85}
                >
                  <Text style={styles.primaryBtnText}>{t('game.announce')}</Text>
                </TouchableOpacity>
              </View>
            </>
          ) : (
            <Text style={[styles.mutedText, styles.waitingText, { color: colors.onDarkTertiary }]}>
              {t('online.waitingTurn', { name: turnPlayer?.name })}
            </Text>
          ))}

        {(phase === 'reveal' || phase === 'roundEnd') && (
          <Text style={[styles.mutedText, styles.waitingText, { color: colors.onDarkTertiary }]}>
            {t('online.advancing')}
          </Text>
        )}

        {phase === 'gameOver' && (
          <GameOverActions
            finishLabel={t('games:online.quit')}
            replayLabel={t('games:game.replay')}
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

      <ClaimPickerSheet
        visible={pickerOpen}
        onClose={() => setPickerOpen(false)}
        currentClaim={view.currentClaim}
        board={view.board}
        onSubmit={handleClaim}
      />
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
  roundBadge: {
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
  tableArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.base,
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
  resultBanners: {
    gap: 2,
    alignItems: 'center',
  },
  resultBanner: {
    fontSize: fontSize.md,
    fontFamily: fontFamily.bold,
    textAlign: 'center',
  },
  resultSub: {
    fontSize: fontSize.sm,
    fontFamily: fontFamily.medium,
    textAlign: 'center',
  },
  handZone: {
    marginHorizontal: spacing.base,
    borderWidth: 1,
    borderRadius: radius.md,
    minHeight: 88,
    justifyContent: 'center',
    paddingVertical: spacing.sm,
  },
  boardChoice: {
    paddingHorizontal: spacing.sm,
    paddingBottom: spacing.sm,
    gap: spacing.sm,
  },
  ownFan: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ownFanOverlap: {
    marginLeft: -18,
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
  actionRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  actionBtn: {
    flex: 1,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  actionBtnText: {
    color: '#FFFFFF',
    fontSize: fontSize.md,
    fontFamily: fontFamily.bold,
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
});
