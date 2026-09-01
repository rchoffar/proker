import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useKeepAwake } from 'expo-keep-awake';
import { TABLE } from '../../../src/components/hand/PokerTable';
import { WinCelebration } from '../../../src/components/hand/WinCelebration';
import { OfcActorPanel } from '../../../src/components/ofc/OfcActorPanel';
import { OfcTableFelt } from '../../../src/components/ofc/OfcTableFelt';
import { OfcSeatsStrip } from '../../../src/components/ofc/OfcSeatsStrip';
import type { OfcSeatVM } from '../../../src/components/ofc/OfcSeatsStrip';
import { PlacementBoard } from '../../../src/components/ofc/PlacementBoard';
import { DrawPlacement } from '../../../src/components/ofc/DrawPlacement';
import { ScoreSheet } from '../../../src/components/ofc/ScoreSheet';
import { useOfcDraft } from '../../../src/store/useOfcDraft';
import { useConfirmQuitGame } from '../../../src/hooks/useConfirmQuitGame';
import { useGameExit } from '../../../src/hooks/useGameExit';
import { useAppStore } from '../../../src/store/useAppStore';
import { recordOfcGameEnd, recordOfcHand } from '../../../src/lib/gameStats';
import { GRID_SIZE, createHandDeal, initGame, reduce, validateAction, variantConfig } from '../../../src/lib/ofc';
import type { OfcAction, OfcState } from '../../../src/lib/ofc';
import { redactFor } from '../../../src/lib/ofc/protocol';
import { TABLE_VIEWER, ofcLocalActorId, ofcPlayView, ofcSeatData } from '../../../src/lib/ofc/view';
import { SCREEN_BG } from '../../../src/components/games/gameSurface';
import { GamePlayHeader } from '../../../src/components/games/GamePlayHeader';
import { NoPlayersScreen } from '../../../src/components/games/NoPlayersScreen';
import { HandoffLock } from '../../../src/components/games/HandoffLock';
import { GameOverActions } from '../../../src/components/games/GameOverActions';
import { fontFamily, fontSize, radius, spacing } from '../../../src/design-system/theme';
import { useTheme } from '../../../src/design-system/ThemeProvider';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function OfcPlayScreen() {
  useKeepAwake(); // the shared phone must not lock mid-game
  const { t } = useTranslation('ofc');
  const { colors } = useTheme();
  const router = useRouter();
  const players = useOfcDraft((s) => s.players);
  const startingStack = useOfcDraft((s) => s.startingStack);
  const variant = useOfcDraft((s) => s.variant);
  const updateGameStats = useAppStore((s) => s.updateGameStats);

  // The engine leaves dealing to the controller (randomness stays out of reduce):
  // deal immediately whenever a hand enters the 'dealing' phase.
  const withAutoDeal = (s: OfcState): OfcState =>
    s.phase === 'dealing' ? reduce(s, createHandDeal(s)) : s;

  const [state, setState] = useState<OfcState | null>(() =>
    players.length >= 2 ? withAutoDeal(initGame(players, startingStack, variant)) : null,
  );
  const confirmQuit = useConfirmQuitGame(!!state && state.phase !== 'gameOver');
  const exit = useGameExit(confirmQuit);

  // Handoff lock: the phone must reach the right player before private cards can show.
  const [locked, setLocked] = useState(true);
  const [celebrating, setCelebrating] = useState(false);

  const dispatch = (action: OfcAction) => {
    setState((prev) => {
      if (!prev) return prev;
      const valid = validateAction(prev, action);
      if (!valid.ok) return prev;
      return reduce(prev, action);
    });
  };

  useEffect(() => {
    if (state?.phase !== 'gameOver') return;
    const timer = setTimeout(() => setCelebrating(true), 700);
    return () => clearTimeout(timer);
  }, [state?.phase]);

  // Per-hand stats (fouls, Fantasy Land entries): recorded once when the hand reaches
  // scoring, deduped by hand number. The ref clears while a hand is being played so a
  // replay whose game also ends at hand 1 still records.
  const statsHandRef = useRef<number | null>(null);
  useEffect(() => {
    if (!state) return;
    if (state.phase === 'dealing' || state.phase === 'placing') {
      statsHandRef.current = null;
      return;
    }
    if (!state.handResult || statsHandRef.current === state.handNumber) return;
    statsHandRef.current = state.handNumber;
    updateGameStats((s) =>
      recordOfcHand(s, {
        perPlayer: state.players
          .filter((p) => state.handResult!.perPlayer[p.id])
          .map((p) => ({
            name: p.name,
            fouled: state.handResult!.perPlayer[p.id].fouled,
            fantasyNext: state.handResult!.perPlayer[p.id].fantasyNext,
          })),
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
    const winnerPlayer = state.players.find((p) => p.id === state.winnerId);
    if (!winnerPlayer) return;
    updateGameStats((s) =>
      recordOfcGameEnd(s, { players: state.players.map((p) => p.name), winner: winnerPlayer.name })
    );
  }, [state, updateGameStats]);

  if (!state) {
    return <NoPlayersScreen message={t('games:play.noPlayers')} onBack={() => router.back()} onDark />;
  }

  const { phase } = state;
  const winner = state.winnerId ? state.players.find((p) => p.id === state.winnerId) : null;

  // Who holds the phone: Fantasy Land players arrange first (their look is private),
  // then the normal rotation. The engine accepts placeFantasy in any order — this
  // sequencing is a Pass & Play UI decision only.
  const actorId = ofcLocalActorId(state);
  // The actor still comes from the raw state: the placement panels below need their
  // actual cards, which is the one thing no redaction hands to a bystander.
  const actor = actorId ? state.players.find((p) => p.id === actorId) ?? null : null;

  // Two redactions, deliberately (see the note on ofcPlayView): the shared strip may only
  // show what the whole room may see, while the role and caption are decided by fields
  // that exist only in the actor's own view.
  const tableView = redactFor(state, TABLE_VIEWER);
  const v = ofcPlayView(redactFor(state, actorId ?? TABLE_VIEWER), {
    actorId,
    rotateToActor: false,
    addressActorAsYou: false,
  });
  const { fantasyArranging, arranging, nameById } = v;

  // While someone is acting their seat leaves the strip — their board renders once, big,
  // in the action zone.
  const seats: OfcSeatVM[] = ofcSeatData(v, tableView);

  const caption = v.caption.kind === 'none' ? '' : t(v.caption.key, v.caption.params);

  const handleNextHand = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setState((prev) => (prev ? withAutoDeal(reduce(prev, { type: 'nextHand', playerId: prev.players.find((p) => !p.eliminated)!.id })) : prev));
    setLocked(true);
  };

  const handleReplay = () => {
    setState(withAutoDeal(initGame(players, startingStack, variant)));
    setCelebrating(false);
    setLocked(true);
  };


  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <StatusBar style="light" />
      <GamePlayHeader
        title={t('title')}
        onClose={exit.back}
        onHome={exit.home}
        onDark
        right={
          <Text style={[styles.handBadge, { color: colors.onDarkTertiary }]}>{t('game.handBadge', { hand: state.handNumber })}</Text>
        }
      />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Animated.Text key={`caption-${state.version}`} entering={FadeInDown.duration(300)} style={styles.caption}>
          {caption}
        </Animated.Text>

        <OfcTableFelt>
          <OfcSeatsStrip seats={seats} activeId={actor?.id ?? null} />
        </OfcTableFelt>

        {/* Multi-card arrangement (initial 5 open, Fantasy Land 13 behind the lock). */}
        {phase === 'placing' && actor && arranging && (!fantasyArranging || !locked) && (
          <Animated.View entering={FadeIn.duration(200)}>
            <OfcActorPanel
              name={actor.name}
              chips={actor.chips}
              isButton={actor.id === state.buttonId}
              inFantasyLand={actor.inFantasyLand}
            >
              <PlacementBoard
                key={`${actor.id}-${state.handNumber}-${actor.inFantasyLand ? 'fl' : 'initial'}`}
                hand={actor.hand}
                discards={actor.inFantasyLand ? Math.max(0, actor.hand.length - GRID_SIZE) : 0}
                commitLabel={t('game.commit')}
                onCommit={(placements) => {
                  dispatch(
                    actor.inFantasyLand
                      ? { type: 'placeFantasy', playerId: actor.id, placements }
                      : { type: 'placeInitial', playerId: actor.id, placements },
                  );
                  setLocked(true);
                }}
              />
            </OfcActorPanel>
          </Animated.View>
        )}

        {/* Draw rounds — the acting player's board with the drawn card(s) to place.
            Pass & Play is open information, so the pineapple 3-card draw shows on the
            shared screen (secrecy only matters online, where redactFor enforces it). */}
        {phase === 'placing' && actor && !arranging && state.pending && (
          <OfcActorPanel name={actor.name} chips={actor.chips} isButton={actor.id === state.buttonId}>
            <DrawPlacement
              key={`${actor.id}-${state.handNumber}-${state.placeRound}`}
              cards={state.pending.cards}
              placeCount={variantConfig(state).placeCount}
              grid={actor.grid}
              discards={actor.discards}
              onCommit={(placements) => dispatch({ type: 'placeDraw', playerId: actor.id, placements })}
            />
          </OfcActorPanel>
        )}

        {(phase === 'scoring' || phase === 'gameOver') && state.handResult && (
          <Animated.View entering={FadeInDown.duration(300)}>
            <ScoreSheet result={state.handResult} nameById={nameById} />
          </Animated.View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

      <View style={styles.footer}>
        {phase === 'scoring' && (
          <TouchableOpacity style={[styles.primaryBtn, { backgroundColor: colors.accentBright }]} onPress={handleNextHand} activeOpacity={0.85}>
            <Text style={styles.primaryBtnText}>{t('game.nextHand')}</Text>
          </TouchableOpacity>
        )}
        {phase === 'gameOver' && (
          <GameOverActions
            finishLabel={t('games:play.finish')}
            replayLabel={t('games:game.replay')}
            onFinish={exit.home}
            onReplay={handleReplay}
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

      {/* Handoff lock — Fantasy Land only: those 13 cards stay secret until the reveal. */}
      {locked && phase === 'placing' && actor && fantasyArranging && (
        <HandoffLock
          name={actor.name}
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
  handBadge: {
    fontSize: fontSize.xs,
    fontFamily: fontFamily.bold,
  },
  content: {
    // flexGrow, so the felt's slot has leftover height to claim when the placement board is
    // not on screen. Without it a ScrollView sizes to its content and nothing can stretch.
    flexGrow: 1,
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
  primaryBtn: {
    borderRadius: radius.md,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    alignItems: 'center',
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
