import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View, Text, StyleSheet, TouchableOpacity, Pressable, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import Animated, { FadeIn, FadeInDown, FlipInEasyY } from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import { X, RotateCw, Eye, EyeOff, Lock } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useKeepAwake } from 'expo-keep-awake';
import { PlayingCard } from '../../../src/components/hand/PlayingCard';
import { TABLE } from '../../../src/components/hand/PokerTable';
import { WinCelebration } from '../../../src/components/hand/WinCelebration';
import { BluffTable } from '../../../src/components/bluff/BluffTable';
import type { BluffSeatVM } from '../../../src/components/bluff/BluffTable';
import { ClaimPickerSheet } from '../../../src/components/bluff/ClaimPickerSheet';
import { DarkStepper } from '../../../src/components/bluff/DarkStepper';
import { useBluffDraft } from '../../../src/store/useBluffDraft';
import { useConfirmQuitGame } from '../../../src/hooks/useConfirmQuitGame';
import { useAppStore } from '../../../src/store/useAppStore';
import { recordBluffGameEnd, recordBluffReveal } from '../../../src/lib/gameStats';
import {
  MAX_BOARD_CARDS,
  claimLabel,
  createRoundDeal,
  initGame,
  reduce,
  validateAction,
} from '../../../src/lib/bluff';
import type { BluffAction, BluffState, Claim } from '../../../src/lib/bluff';
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

// The game surface is dark by design in BOTH themes — so use the theme-invariant
// onDark* text tokens plus these fixed dark surfaces.
const DARK_TILE = 'rgba(255, 255, 255, 0.08)';
const DARK_CARD_BG = 'rgba(255, 255, 255, 0.05)';
const LOSS_ON_DARK = '#FF6B70';
// Full-screen game surface: the felt is dark by design, in both themes — matches the
// dark EnvironmentBackground mid-tone.
const SCREEN_BG = '#101114';

export default function BluffPlayScreen() {
  useKeepAwake(); // the shared phone must not lock mid-game
  const { t } = useTranslation('bluff');
  const { colors } = useTheme();
  const router = useRouter();
  const players = useBluffDraft((s) => s.players);
  const jeuMaxEnabled = useBluffDraft((s) => s.jeuMax);
  const updateGameStats = useAppStore((s) => s.updateGameStats);

  // The engine leaves dealing to the controller (randomness stays out of reduce):
  // deal immediately whenever a round enters the 'dealing' phase.
  const withAutoDeal = (s: BluffState): BluffState =>
    s.phase === 'dealing' ? reduce(s, createRoundDeal(s)) : s;

  const [state, setState] = useState<BluffState | null>(() =>
    players.length >= 2 ? withAutoDeal(initGame(players, Math.random, { jeuMax: jeuMaxEnabled })) : null,
  );
  useConfirmQuitGame(!!state && state.phase !== 'gameOver');

  // Handoff lock: the phone must reach the right player before their cards can be peeked.
  const [locked, setLocked] = useState(true);
  const [peeking, setPeeking] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [faceUpCount, setFaceUpCount] = useState(3);
  const [faceDownCount, setFaceDownCount] = useState(0);
  const [celebrating, setCelebrating] = useState(false);

  const dispatch = (action: BluffAction) => {
    setPeeking(false); // never leave cards exposed past the action that ends the look
    setState((prev) => {
      if (!prev) return prev;
      const valid = validateAction(prev, action);
      if (!valid.ok) return prev;
      return reduce(prev, action);
    });
  };

  const currentPlayer = useMemo(
    () => state?.players.find((p) => p.id === state.turnId) ?? null,
    [state],
  );
  const starter = useMemo(
    () => state?.players.find((p) => p.id === state.starterId) ?? null,
    [state],
  );

  // Celebration bursts shortly after the final reveal settles.
  useEffect(() => {
    if (state?.phase !== 'gameOver') return;
    const timer = setTimeout(() => setCelebrating(true), 700);
    return () => clearTimeout(timer);
  }, [state?.phase]);

  // Per-round bluff-catch stats: one reveal max per round, and `reveal` is cleared by the
  // next deal, so the round-number ref dedupes re-renders and resets across replays.
  // Jeu Max reveals are a different mechanic and stay out of the catch counters.
  const revealRoundRef = useRef<number | null>(null);
  useEffect(() => {
    if (!state?.reveal) {
      revealRoundRef.current = null;
      return;
    }
    if (state.reveal.kind !== 'catch' || revealRoundRef.current === state.round) return;
    revealRoundRef.current = state.round;
    const nameOf = (id: string) => state.players.find((p) => p.id === id)?.name ?? '';
    updateGameStats((s) =>
      recordBluffReveal(s, {
        catcher: nameOf(state.reveal!.catcherId),
        claimer: nameOf(state.reveal!.claimerId),
        holds: state.reveal!.holds,
      })
    );
  }, [state, updateGameStats]);

  const gameOverRecordedRef = useRef(false);
  useEffect(() => {
    if (state?.phase !== 'gameOver') {
      gameOverRecordedRef.current = false;
      return;
    }
    if (gameOverRecordedRef.current || !state.winnerId) return;
    gameOverRecordedRef.current = true;
    const winner = state.players.find((p) => p.id === state.winnerId);
    if (!winner) return;
    updateGameStats((s) =>
      recordBluffGameEnd(s, { players: state.players.map((p) => p.name), winner: winner.name })
    );
  }, [state, updateGameStats]);


  if (!state) {
    return (
      <SafeAreaView style={[styles.screen, styles.centered]}>
        <StatusBar style="light" />
        <Text style={{ color: colors.onDarkPrimary }}>{t('play.noPlayers')}</Text>
        <TouchableOpacity onPress={() => router.back()} style={[styles.primaryBtn, { backgroundColor: colors.accentBright, marginTop: spacing.base }]}>
          <Text style={styles.primaryBtnText}>{t('common:back')}</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const { phase, reveal } = state;
  const winner = state.winnerId ? state.players.find((p) => p.id === state.winnerId) : null;
  const loser = reveal ? state.players.find((p) => p.id === reveal.loserId) : null;
  const catcher = reveal ? state.players.find((p) => p.id === reveal.catcherId) : null;
  const claimer = reveal ? state.players.find((p) => p.id === reveal.claimerId) : null;
  const showAllHands = phase === 'reveal' || phase === 'roundEnd' || phase === 'gameOver';

  const seats: BluffSeatVM[] = state.players.map((p) => ({
    id: p.id,
    name: p.name,
    cardCount: p.cardCount,
    eliminated: p.eliminated,
    hand: showAllHands && !p.eliminated ? p.hand : undefined,
  }));

  const handleChooseBoard = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    dispatch({ type: 'chooseBoard', playerId: state.starterId, faceUpCount, faceDownCount });
  };

  const handleClaim = (claim: Claim) => {
    setPickerOpen(false);
    dispatch({ type: 'claim', playerId: state.turnId, claim });
    setLocked(true);
  };

  const handleCatch = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    dispatch({ type: 'catch', playerId: state.turnId });
  };

  const handleJeuMax = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    dispatch({ type: 'jeuMax', playerId: state.turnId });
  };

  const handleNextRound = () => {
    const afterConfirm = reduce(state, { type: 'confirmReveal', playerId: state.turnId });
    setState(withAutoDeal(reduce(afterConfirm, { type: 'nextRound', playerId: afterConfirm.turnId })));
    setPeeking(false);
    setFaceUpCount(3);
    setFaceDownCount(0);
    setLocked(true);
  };

  const handleReplay = () => {
    setState(withAutoDeal(initGame(players, Math.random, { jeuMax: jeuMaxEnabled })));
    setCelebrating(false);
    setPeeking(false);
    setFaceUpCount(3);
    setFaceDownCount(0);
    setLocked(true);
  };

  const finish = () => router.dismissTo('/(tabs)/degen');

  const canCatch = phase === 'bidding' && state.claimHistory.length > 0;
  const mustCatch = state.currentClaim?.category === 'royalFlush';

  const caption = (() => {
    if (phase === 'chooseBoard') return t('game.chooseBoardOther', { name: starter?.name });
    if (phase === 'bidding') {
      return state.currentClaim
        ? claimLabel(state.currentClaim, t)
        : t('game.openBiddingOther', { name: currentPlayer?.name });
    }
    return '';
  })();

  const handFan = currentPlayer?.hand ?? [];
  const fanAngles = HAND_FAN_ANGLES[handFan.length] ?? HAND_FAN_ANGLES[2];

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <StatusBar style="light" />
      <View style={styles.header}>
        <TouchableOpacity style={[styles.iconBtn, { backgroundColor: DARK_TILE }]} onPress={finish} activeOpacity={0.7}>
          <X size={18} color={colors.onDarkSecondary} strokeWidth={2} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.onDarkPrimary }]}>{t('title')}</Text>
        <View style={styles.iconBtn}>
          <Text style={[styles.roundBadge, { color: colors.onDarkTertiary }]}>{t('game.roundBadge', { round: state.round })}</Text>
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
                        higher: reveal.higherClaim ? claimLabel(reveal.higherClaim, t) : '',
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
              state.players
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
          <Animated.Text key={`caption-${state.version}`} entering={FadeInDown.duration(300)} style={styles.caption}>
            {caption}
          </Animated.Text>
        )}

        <BluffTable
          width={TABLE_W}
          height={TABLE_H}
          players={seats}
          board={state.board}
          hiddenCount={state.hiddenBoard.length}
          hiddenBoard={showAllHands ? state.hiddenBoard : undefined}
          turnId={phase === 'bidding' ? state.turnId : null}
          reveal={reveal}
          roundToken={state.round}
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

      {/* Private hand zone — hold to peek, only for the player whose turn it is. */}
      {(phase === 'chooseBoard' || phase === 'bidding') && currentPlayer && (
        <View style={[styles.handZone, { borderColor: colors.onDarkHairline, backgroundColor: DARK_CARD_BG }]}>
          {phase === 'chooseBoard' && (
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
          {phase === 'chooseBoard' ? (
            // The starter sizes the middle BLIND — their cards only unlock once the
            // board split is validated (rule decision).
            <View style={styles.peekZone}>
              <View style={styles.peekHint}>
                <EyeOff size={16} color={colors.onDarkSecondary} strokeWidth={2} />
                <Text style={[styles.peekHintText, { color: colors.onDarkSecondary }]}>
                  {t('play.peekAfterBoard')}
                </Text>
              </View>
            </View>
          ) : (
            <Pressable
              onPressIn={() => setPeeking(true)}
              onPressOut={() => setPeeking(false)}
              style={styles.peekZone}
            >
              {peeking && handFan.length > 0 ? (
                <View style={styles.peekFan}>
                  {handFan.map((card, i) => (
                    <Animated.View
                      key={`peek-${i}`}
                      entering={FlipInEasyY.duration(200).delay(i * 40)}
                      style={[
                        // Staggered entering animations make sibling paint order unreliable —
                        // pin the fan stacking left→right.
                        { zIndex: i + 1, elevation: i + 1 },
                        { transform: [{ rotate: `${fanAngles[i] ?? 0}deg` }] },
                        i > 0 && styles.peekOverlap,
                      ]}
                    >
                      <PlayingCard card={card} size="lg" />
                    </Animated.View>
                  ))}
                </View>
              ) : (
                <View style={styles.peekHint}>
                  <Eye size={16} color={colors.onDarkSecondary} strokeWidth={2} />
                  <Text style={[styles.peekHintText, { color: colors.onDarkSecondary }]}>
                    {t('play.peekHint', { name: currentPlayer.name })}
                  </Text>
                </View>
              )}
            </Pressable>
          )}
        </View>
      )}

      <View style={styles.footer}>
        {phase === 'chooseBoard' && (
          <TouchableOpacity style={[styles.primaryBtn, { backgroundColor: colors.accentBright }]} onPress={handleChooseBoard} activeOpacity={0.85}>
            <Text style={styles.primaryBtnText}>{t('game.revealBoard')}</Text>
          </TouchableOpacity>
        )}

        {phase === 'bidding' && (
          <>
            {mustCatch && (
              <Text style={[styles.mustCatchHint, { color: colors.onDarkTertiary }]}>
                {t(state.config.jeuMax ? 'game.royalFlushHintJeuMax' : 'game.royalFlushHint')}
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
              {state.config.jeuMax && (
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
        )}

        {(phase === 'reveal' || phase === 'roundEnd') && (
          <TouchableOpacity style={[styles.primaryBtn, { backgroundColor: colors.accentBright }]} onPress={handleNextRound} activeOpacity={0.85}>
            <Text style={styles.primaryBtnText}>{t('game.nextRound')}</Text>
          </TouchableOpacity>
        )}

        {phase === 'gameOver' && (
          <View style={styles.actionRow}>
            <TouchableOpacity style={[styles.actionBtn, { backgroundColor: DARK_TILE }]} onPress={finish} activeOpacity={0.85}>
              <Text style={[styles.actionBtnText, { color: colors.onDarkPrimary }]}>{t('play.finish')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.actionBtn, { backgroundColor: colors.accentBright }]} onPress={handleReplay} activeOpacity={0.85}>
              <View style={styles.replayContent}>
                <RotateCw size={16} color="#0A0A0F" strokeWidth={2} />
                <Text style={styles.primaryBtnText}>{t('game.replay')}</Text>
              </View>
            </TouchableOpacity>
          </View>
        )}
      </View>

      <ClaimPickerSheet
        visible={pickerOpen}
        onClose={() => setPickerOpen(false)}
        currentClaim={state.currentClaim}
        onSubmit={handleClaim}
      />

      {/* Handoff lock — the next player unlocks their own turn. */}
      {locked && (phase === 'chooseBoard' || phase === 'bidding') && currentPlayer && (
        <Animated.View entering={FadeIn.duration(200)} style={StyleSheet.absoluteFill}>
          <BlurView intensity={50} tint="dark" style={StyleSheet.absoluteFill} />
          <View style={styles.lockOverlay}>
            <Lock size={28} color={TABLE.gold} strokeWidth={1.5} />
            <Text style={styles.lockTitle}>{t('play.passPhoneTo')}</Text>
            <Text style={[styles.lockName, { color: TABLE.gold }]}>{currentPlayer.name}</Text>
            <TouchableOpacity
              style={[styles.primaryBtn, styles.lockBtn, { backgroundColor: colors.accentBright }]}
              onPress={() => {
                Haptics.selectionAsync();
                setLocked(false);
              }}
              activeOpacity={0.85}
            >
              <Text style={styles.primaryBtnText}>{t('play.itsMe')}</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
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
    gap: spacing.sm,
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
  },
  roundBadge: {
    fontSize: fontSize.xs,
    fontFamily: fontFamily.bold,
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
    minHeight: 96,
    justifyContent: 'center',
  },
  boardChoice: {
    padding: spacing.sm,
    gap: spacing.sm,
  },
  peekZone: {
    minHeight: 96,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.sm,
  },
  peekFan: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  peekOverlap: {
    marginLeft: -22,
  },
  peekHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  peekHintText: {
    fontSize: fontSize.sm,
    fontFamily: fontFamily.medium,
  },
  footer: {
    paddingHorizontal: spacing.base,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
    gap: spacing.sm,
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
  mustCatchHint: {
    fontSize: fontSize.xs,
    fontFamily: fontFamily.regular,
    textAlign: 'center',
  },
  replayContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  primaryBtn: {
    borderRadius: radius.md,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  disabledBtn: {
    opacity: 0.4,
  },
  primaryBtnText: {
    color: '#0A0A0F',
    fontSize: fontSize.md,
    fontFamily: fontFamily.bold,
  },
  lockOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(10, 12, 16, 0.72)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    padding: spacing.xl,
  },
  lockTitle: {
    fontSize: fontSize.base,
    fontFamily: fontFamily.medium,
    color: 'rgba(255,255,255,0.7)',
    marginTop: spacing.sm,
  },
  lockName: {
    fontSize: fontSize.display,
    fontFamily: fontFamily.display,
    textAlign: 'center',
  },
  lockBtn: {
    marginTop: spacing.lg,
  },
});
