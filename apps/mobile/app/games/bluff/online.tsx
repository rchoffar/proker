import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { X, RotateCw, Users, WifiOff } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useKeepAwake } from 'expo-keep-awake';
import { PlayingCard } from '../../../src/components/hand/PlayingCard';
import { TABLE } from '../../../src/components/hand/PokerTable';
import { WinCelebration } from '../../../src/components/hand/WinCelebration';
import { BluffTable } from '../../../src/components/bluff/BluffTable';
import type { BluffSeatVM } from '../../../src/components/bluff/BluffTable';
import { ClaimPickerSheet } from '../../../src/components/bluff/ClaimPickerSheet';
import { GlassCard } from '../../../src/components/ui/GlassCard';
import { DarkStepper } from '../../../src/components/bluff/DarkStepper';
import { useBluffDraft } from '../../../src/store/useBluffDraft';
import { useConfirmQuitGame } from '../../../src/hooks/useConfirmQuitGame';
import { useAppStore } from '../../../src/store/useAppStore';
import { recordBluffGameEnd, recordBluffReveal } from '../../../src/lib/gameStats';
import { useBluffGuest, useBluffHost } from '../../../src/hooks/useBluffOnline';
import type { BluffOnlineCommon } from '../../../src/hooks/useBluffOnline';
import { MAX_BLUFF_PLAYERS, MAX_BOARD_CARDS, MIN_BLUFF_PLAYERS, claimLabel } from '../../../src/lib/bluff';
import type { Claim } from '../../../src/lib/bluff';
import { fontFamily, fontSize, radius, spacing } from '../../../src/design-system/theme';
import { useTheme } from '../../../src/design-system/ThemeProvider';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const TABLE_W = SCREEN_WIDTH - 96;
const TABLE_H = Math.min(420, Math.max(320, Math.round(SCREEN_HEIGHT * 0.42)));

const HAND_FAN_ANGLES: Record<number, number[]> = {
  1: [0],
  2: [-6, 6],
  3: [-8, 0, 8],
  4: [-12, -4, 4, 12],
  5: [-14, -7, 0, 7, 14],
};

// Server/protocol disconnect enums → bluff namespace keys, translated at render.
const DISCONNECT_KEYS = {
  host_left: 'disconnect.host_left',
  expired: 'disconnect.expired',
  hostQuit: 'disconnect.hostQuit',
} as const;

// Modal screens sit on a black sheet in BOTH themes (EnvironmentBackground lives in the
// root layout and doesn't follow modals) — so use the theme-invariant onDark* text tokens
// plus these fixed dark surfaces, same convention as the roulette play modal.
const DARK_TILE = 'rgba(255, 255, 255, 0.08)';
const DARK_CARD_BG = 'rgba(255, 255, 255, 0.05)';
const LOSS_ON_DARK = '#FF6B70';
// Full-screen game surface: the felt is dark by design, in both themes — matches the
// dark EnvironmentBackground mid-tone.
const SCREEN_BG = '#101114';

export default function BluffOnlineScreen() {
  const mode = useBluffDraft((s) => s.mode);
  const pseudo = useBluffDraft((s) => s.pseudo);
  const joinCode = useBluffDraft((s) => s.joinCode);

  if (mode === 'guest' && joinCode) return <GuestFlow pseudo={pseudo} joinCode={joinCode} />;
  return <HostFlow pseudo={pseudo} />;
}

function HostFlow({ pseudo }: { pseudo: string }) {
  const jeuMax = useBluffDraft((s) => s.jeuMax);
  const online = useBluffHost(pseudo);
  return (
    <OnlineView
      online={online}
      isHost
      hostJeuMax={jeuMax}
      onStart={() => online.startGame({ jeuMax })}
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
  onStart?: () => void;
  onReplay?: () => void;
}

function OnlineView({ online, isHost, hostJeuMax, onStart, onReplay }: OnlineViewProps) {
  // Locking the phone suspends the socket — fatal for the host, disruptive for guests.
  useKeepAwake();
  const { t } = useTranslation('bluff');
  const { colors } = useTheme();
  const router = useRouter();
  const { status, code, myId, members, view, errorMsg, closedReason, sendAction } = online;

  useConfirmQuitGame(status === 'playing' && view?.phase !== 'gameOver');

  const [pickerOpen, setPickerOpen] = useState(false);
  const [faceUpCount, setFaceUpCount] = useState(3);
  const [faceDownCount, setFaceDownCount] = useState(0);
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

  const quit = () => router.dismissTo('/(tabs)/degen');

  // ── Pre-game states ──────────────────────────────────────────────────────────

  if (status === 'connecting') {
    return (
      <SafeAreaView style={[styles.screen, styles.centered]}>
        <StatusBar style="light" />
        <ActivityIndicator color={colors.accentBright} />
        <Text style={[styles.mutedText, { color: colors.onDarkSecondary }]}>{t('online.connecting')}</Text>
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
        : t(closedReason ? DISCONNECT_KEYS[closedReason] : 'disconnect.generic');
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
        <View style={styles.header}>
          <TouchableOpacity style={[styles.iconBtn, { backgroundColor: DARK_TILE }]} onPress={quit} activeOpacity={0.7}>
            <X size={18} color={colors.onDarkSecondary} strokeWidth={2} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.onDarkPrimary }]}>{t('online.title')}</Text>
          <View style={styles.iconBtn} />
        </View>

        <View style={styles.lobbyContent}>
          <Animated.View entering={FadeInDown.delay(0).springify().damping(18).stiffness(140)} style={styles.codeBlock}>
            <Text style={[styles.codeLabel, { color: colors.onDarkTertiary }]}>{t('online.tableCode')}</Text>
            <Text style={[styles.codeValue, { color: TABLE.gold }]}>{code}</Text>
            <Text style={[styles.mutedText, { color: colors.onDarkTertiary }]}>
              {isHost ? t('online.shareCode') : t('online.waitingHostStart')}
            </Text>
            {isHost && (
              <Text style={[styles.mutedText, { color: hostJeuMax ? TABLE.gold : colors.onDarkTertiary }]}>
                {t(hostJeuMax ? 'online.jeuMaxEnabled' : 'online.jeuMaxDisabledLobby')}
              </Text>
            )}
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(60).springify().damping(18).stiffness(140)}>
            <GlassCard padding={16} variant="dark">
              <View style={styles.membersHeader}>
                <Users size={16} color={colors.onDarkSecondary} strokeWidth={2} />
                <Text style={[styles.membersTitle, { color: colors.onDarkSecondary }]}>
                  {t('online.players', { current: members.length, max: MAX_BLUFF_PLAYERS })}
                </Text>
              </View>
              {members.map((m) => (
                <View key={m.playerId} style={styles.memberRow}>
                  <View style={[styles.dot, { backgroundColor: m.connected ? colors.accentBright : colors.onDarkTertiary }]} />
                  <Text style={[styles.memberName, { color: colors.onDarkPrimary }]}>
                    {m.playerId === myId ? t('online.youSuffix', { name: m.name }) : m.name}
                  </Text>
                </View>
              ))}
            </GlassCard>
          </Animated.View>
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
              <Text style={styles.primaryBtnText}>{t('online.startGame')}</Text>
            </TouchableOpacity>
          ) : (
            <Text style={[styles.mutedText, styles.waitingText, { color: colors.onDarkTertiary }]}>
              {t('online.startsWhenHostLaunches')}
            </Text>
          )}
        </View>
      </SafeAreaView>
    );
  }

  // ── Playing ──────────────────────────────────────────────────────────────────

  if (!view || !myId) return null;

  const { phase, reveal } = view;
  const me = view.players.find((p) => p.id === myId);
  const myTurn = view.turnId === myId && !me?.eliminated;
  const isStarter = view.starterId === myId;
  const turnPlayer = view.players.find((p) => p.id === view.turnId);
  const starter = view.players.find((p) => p.id === view.starterId);
  const winner = view.winnerId ? view.players.find((p) => p.id === view.winnerId) : null;
  const loser = reveal ? view.players.find((p) => p.id === reveal.loserId) : null;
  const catcher = reveal ? view.players.find((p) => p.id === reveal.catcherId) : null;
  const claimer = reveal ? view.players.find((p) => p.id === reveal.claimerId) : null;

  // Seat 0 = me, at bottom center — same rotation trick as the hand replayer.
  const myIdx = view.players.findIndex((p) => p.id === myId);
  const ordered = myIdx <= 0 ? view.players : [...view.players.slice(myIdx), ...view.players.slice(0, myIdx)];
  const showAll = phase === 'reveal' || phase === 'roundEnd' || phase === 'gameOver';
  const seats: BluffSeatVM[] = ordered.map((p) => ({
    id: p.id,
    name: p.id === myId ? t('online.youSuffix', { name: p.name }) : p.name,
    cardCount: p.cardCount,
    eliminated: p.eliminated,
    hand: showAll ? p.hand : undefined,
  }));

  const myHand = me?.hand ?? [];
  const fanAngles = HAND_FAN_ANGLES[myHand.length] ?? HAND_FAN_ANGLES[2];
  const canCatch = phase === 'bidding' && myTurn && view.claimHistory.length > 0;
  const mustCatch = view.currentClaim?.category === 'royalFlush';

  const caption = (() => {
    if (phase === 'chooseBoard') {
      return isStarter ? t('game.chooseBoardYou') : t('game.chooseBoardOther', { name: starter?.name });
    }
    if (phase === 'bidding') {
      if (view.currentClaim) return claimLabel(view.currentClaim, t);
      return myTurn ? t('game.openBiddingYou') : t('game.openBiddingOther', { name: turnPlayer?.name });
    }
    return '';
  })();

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

  const handleNextRound = () => {
    sendAction({ type: 'confirmReveal', playerId: myId });
    sendAction({ type: 'nextRound', playerId: myId });
  };

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <StatusBar style="light" />
      <View style={styles.header}>
        <TouchableOpacity style={[styles.iconBtn, { backgroundColor: DARK_TILE }]} onPress={quit} activeOpacity={0.7}>
          <X size={18} color={colors.onDarkSecondary} strokeWidth={2} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.onDarkPrimary }]} numberOfLines={1}>
          {t('online.headerCode', { code })}
        </Text>
        <View style={styles.headerRight}>
          <Text style={[styles.roundBadge, { color: colors.onDarkTertiary }]}>{t('game.roundBadge', { round: view.round })}</Text>
        </View>
      </View>

      <View style={styles.tableArea}>
        {reveal ? (
          <Animated.View entering={FadeIn.duration(300)} style={styles.resultBanners}>
            {reveal.kind === 'jeuMax' ? (
              <Text style={[styles.resultBanner, { color: reveal.jeuMaxSuccess ? TABLE.gold : LOSS_ON_DARK }]}>
                {reveal.jeuMaxSuccess
                  ? t(reveal.jeuMaxWinsGame ? 'game.jeuMaxWin' : 'game.jeuMaxSuccess', { name: catcher?.name })
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
        )}

        <BluffTable
          width={TABLE_W}
          height={TABLE_H}
          players={seats}
          board={view.board}
          hiddenCount={view.hiddenBoardCount}
          hiddenBoard={view.hiddenBoard}
          turnId={phase === 'bidding' ? view.turnId : null}
          reveal={reveal}
          roundToken={view.round}
        >
          {celebrating && winner && (
            <WinCelebration
              width={TABLE_W}
              height={TABLE_H}
              title={t('game.victory')}
              subtitle={t('game.winnerSub', { name: winner.name })}
              onDone={() => setCelebrating(false)}
            />
          )}
        </BluffTable>
      </View>

      {/* Own hand — always visible, it's my device. */}
      {!showAll && myHand.length > 0 && !me?.eliminated && (
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

        {(phase === 'reveal' || phase === 'roundEnd') &&
          (isHost ? (
            <TouchableOpacity style={[styles.primaryBtn, { backgroundColor: colors.accentBright }]} onPress={handleNextRound} activeOpacity={0.85}>
              <Text style={styles.primaryBtnText}>{t('game.nextRound')}</Text>
            </TouchableOpacity>
          ) : (
            <Text style={[styles.mutedText, styles.waitingText, { color: colors.onDarkTertiary }]}>
              {t('online.waitingNextRound')}
            </Text>
          ))}

        {phase === 'gameOver' && (
          <View style={styles.actionRow}>
            <TouchableOpacity style={[styles.actionBtn, { backgroundColor: DARK_TILE }]} onPress={quit} activeOpacity={0.85}>
              <Text style={[styles.actionBtnText, { color: colors.onDarkPrimary }]}>{t('online.quit')}</Text>
            </TouchableOpacity>
            {isHost && (
              <TouchableOpacity
                style={[styles.actionBtn, { backgroundColor: colors.accentBright }]}
                onPress={() => {
                  setCelebrating(false);
                  onReplay?.();
                }}
                activeOpacity={0.85}
              >
                <View style={styles.replayContent}>
                  <RotateCw size={16} color="#0A0A0F" strokeWidth={2} />
                  <Text style={styles.primaryBtnText}>{t('game.replay')}</Text>
                </View>
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>

      <ClaimPickerSheet
        visible={pickerOpen}
        onClose={() => setPickerOpen(false)}
        currentClaim={view.currentClaim}
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.sm,
  },
  iconBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: fontSize.lg,
    fontFamily: fontFamily.bold,
    // Constrained + centered — see play.tsx headerTitle.
    flex: 1,
    textAlign: 'center',
  },
  headerRight: {
    minWidth: 32,
    alignItems: 'flex-end',
  },
  roundBadge: {
    fontSize: fontSize.xs,
    fontFamily: fontFamily.bold,
  },
  lobbyContent: {
    flex: 1,
    paddingHorizontal: spacing.base,
    paddingTop: spacing.xl,
    gap: spacing.lg,
  },
  codeBlock: {
    alignItems: 'center',
    gap: spacing.xs,
  },
  codeLabel: {
    fontSize: fontSize.sm,
    fontFamily: fontFamily.medium,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  codeValue: {
    fontSize: 56,
    fontFamily: fontFamily.display,
    letterSpacing: 12,
  },
  membersHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  membersTitle: {
    fontSize: fontSize.sm,
    fontFamily: fontFamily.semibold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  memberName: {
    fontSize: fontSize.base,
    fontFamily: fontFamily.medium,
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
  replayContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
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
