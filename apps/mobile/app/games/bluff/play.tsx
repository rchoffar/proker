import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View, Text, StyleSheet, TouchableOpacity, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import Animated, { FadeIn, FadeInDown, FlipInEasyY } from 'react-native-reanimated';
import { Eye } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useKeepAwake } from 'expo-keep-awake';
import { PlayingCard } from '../../../src/components/hand/PlayingCard';
import { TABLE } from '../../../src/components/hand/PokerTable';
import { WinCelebration } from '../../../src/components/hand/WinCelebration';
import { BluffTable } from '../../../src/components/bluff/BluffTable';
import { PLAY_TABLE } from '../../../src/components/table/tableSize';
import { DARK_CARD_BG, LOSS_ON_DARK, SCREEN_BG } from '../../../src/components/games/gameSurface';
import { GamePlayHeader } from '../../../src/components/games/GamePlayHeader';
import { NoPlayersScreen } from '../../../src/components/games/NoPlayersScreen';
import { HandoffLock } from '../../../src/components/games/HandoffLock';
import { GameOverActions } from '../../../src/components/games/GameOverActions';
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
import { redactFor } from '../../../src/lib/bluff/protocol';
import { bluffPlayView, bluffSeatData } from '../../../src/lib/bluff/view';
import { fontFamily, fontSize, radius, spacing } from '../../../src/design-system/theme';
import { useTheme } from '../../../src/design-system/ThemeProvider';

const TABLE_W = PLAY_TABLE.width;
const TABLE_H = PLAY_TABLE.height;

const HAND_FAN_ANGLES: Record<number, number[]> = {
  1: [0],
  2: [-6, 6],
  3: [-8, 0, 8],
  4: [-12, -4, 4, 12],
  5: [-14, -7, 0, 7, 14],
};

export default function BluffPlayScreen() {
  useKeepAwake(); // the shared phone must not lock mid-game
  const { t } = useTranslation('bluff');
  const { colors } = useTheme();
  const router = useRouter();
  const players = useBluffDraft((s) => s.players);
  const jeuMaxEnabled = useBluffDraft((s) => s.jeuMax);
  const variant = useBluffDraft((s) => s.variant);
  const updateGameStats = useAppStore((s) => s.updateGameStats);

  // The engine leaves dealing to the controller (randomness stays out of reduce):
  // deal immediately whenever a round enters the 'dealing' phase.
  const withAutoDeal = (s: BluffState): BluffState =>
    s.phase === 'dealing' ? reduce(s, createRoundDeal(s)) : s;

  const [state, setState] = useState<BluffState | null>(() =>
    players.length >= 2 ? withAutoDeal(initGame(players, Math.random, { jeuMax: jeuMaxEnabled, variant })) : null,
  );
  const confirmQuit = useConfirmQuitGame(!!state && state.phase !== 'gameOver');

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
    return <NoPlayersScreen message={t('games:play.noPlayers')} onBack={() => router.back()} onDark />;
  }

  const { phase, reveal } = state;
  // The shared phone renders through the SAME redaction choke point as the host and every
  // guest, with the player to act as the viewer — so the felt can only ever show what the
  // room may see, and the peek zone below gets its cards from the same place online does.
  // Seats keep their fixed order and nobody is addressed as "you": everyone is looking at
  // this screen, not just the person holding it.
  const view = redactFor(state, state.turnId);
  const v = bluffPlayView(view, {
    viewerId: state.turnId,
    rotateToViewer: false,
    addressViewerAsYou: false,
  });
  const { turnPlayer: currentPlayer, winner, canCatch, mustCatch } = v;
  const loser = reveal ? state.players.find((p) => p.id === reveal.loserId) : null;
  const catcher = reveal ? state.players.find((p) => p.id === reveal.catcherId) : null;
  const claimer = reveal ? state.players.find((p) => p.id === reveal.claimerId) : null;

  const seats: BluffSeatVM[] = bluffSeatData(v);

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
    setState(withAutoDeal(initGame(players, Math.random, { jeuMax: jeuMaxEnabled, variant })));
    setCelebrating(false);
    setPeeking(false);
    setFaceUpCount(3);
    setFaceDownCount(0);
    setLocked(true);
  };

  const finish = async () => {
    if (await confirmQuit()) router.dismissTo('/');
  };

  const caption =
    v.caption.kind === 'none'
      ? ''
      : v.caption.kind === 'claim'
        ? claimLabel(v.caption.claim, t)
        : t(v.caption.key, { name: v.caption.name });

  const handFan = v.viewer?.hand ?? [];
  const fanAngles = HAND_FAN_ANGLES[handFan.length] ?? HAND_FAN_ANGLES[2];

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <StatusBar style="light" />
      <GamePlayHeader
        title={t('title')}
        onClose={finish}
        onDark
        right={
          <Text style={[styles.roundBadge, { color: colors.onDarkTertiary }]}>{t('game.roundBadge', { round: state.round })}</Text>
        }
      />

      <View style={styles.tableArea}>
        {reveal ? (
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
          hiddenCount={view.hiddenBoardCount}
          hiddenBoard={view.hiddenBoard}
          turnId={phase === 'bidding' ? state.turnId : null}
          reveal={reveal}
          roundToken={state.round}
        >
          {celebrating && winner && (
            <WinCelebration
              width={TABLE_W}
              height={TABLE_H}
              title={t('games:game.victory')}
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
            // The starter sizes the middle BLIND — their cards only unlock once the board
            // split is validated (rule decision; the gating needs no explanatory sentence,
            // and the reveal button lives right here next to the steppers).
            <TouchableOpacity
              style={[styles.primaryBtn, { backgroundColor: colors.accentBright }]}
              onPress={handleChooseBoard}
              activeOpacity={0.85}
            >
              <Text style={styles.primaryBtnText}>{t('game.revealBoard')}</Text>
            </TouchableOpacity>
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
          <GameOverActions
            finishLabel={t('games:play.finish')}
            replayLabel={t('games:game.replay')}
            onFinish={finish}
            onReplay={handleReplay}
          />
        )}
      </View>

      <ClaimPickerSheet
        visible={pickerOpen}
        onClose={() => setPickerOpen(false)}
        currentClaim={state.currentClaim}
        board={state.board}
        onSubmit={handleClaim}
      />

      {/* Handoff lock — the next player unlocks their own turn. */}
      {locked && (phase === 'chooseBoard' || phase === 'bidding') && currentPlayer && (
        <HandoffLock
          name={currentPlayer.name}
          title={t('games:play.passPhoneTo')}
          ctaLabel={t('play.itsMe')}
          onUnlock={() => setLocked(false)}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: SCREEN_BG,
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
});
