import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import { X, RotateCw, Lock } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useKeepAwake } from 'expo-keep-awake';
import { TABLE } from '../../../src/components/hand/PokerTable';
import { WinCelebration } from '../../../src/components/hand/WinCelebration';
import { OfcActorPanel } from '../../../src/components/ofc/OfcActorPanel';
import { OfcSeatsStrip } from '../../../src/components/ofc/OfcSeatsStrip';
import type { OfcSeatVM } from '../../../src/components/ofc/OfcSeatsStrip';
import { PlacementBoard } from '../../../src/components/ofc/PlacementBoard';
import { DrawPlacement } from '../../../src/components/ofc/DrawPlacement';
import { ScoreSheet } from '../../../src/components/ofc/ScoreSheet';
import { useOfcDraft } from '../../../src/store/useOfcDraft';
import { useConfirmQuitGame } from '../../../src/hooks/useConfirmQuitGame';
import { useAppStore } from '../../../src/store/useAppStore';
import { recordOfcGameEnd, recordOfcHand } from '../../../src/lib/gameStats';
import { GRID_SIZE, createHandDeal, initGame, reduce, validateAction, variantConfig } from '../../../src/lib/ofc';
import type { OfcAction, OfcState } from '../../../src/lib/ofc';
import { redactFor } from '../../../src/lib/ofc/protocol';
import { fontFamily, fontSize, radius, spacing } from '../../../src/design-system/theme';
import { useTheme } from '../../../src/design-system/ThemeProvider';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// A viewer id that matches no player: the shared table renders through the SAME
// redaction choke point as online, so a Fantasy Land grid stays face-down for the room.
const TABLE_VIEWER = '@table';

// The game surface is dark by design in BOTH themes — so use the theme-invariant
// onDark* text tokens plus these fixed dark surfaces, same convention as the bluff
// play screen.
const DARK_TILE = 'rgba(255, 255, 255, 0.08)';
const SCREEN_BG = '#101114';

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
  useConfirmQuitGame(!!state && state.phase !== 'gameOver');

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

  const { phase } = state;
  const winner = state.winnerId ? state.players.find((p) => p.id === state.winnerId) : null;

  // Who holds the phone: Fantasy Land players arrange first (their look is private),
  // then the normal rotation. The engine accepts placeFantasy in any order — this
  // sequencing is a Pass & Play UI decision only.
  const fantasyActor =
    phase === 'placing'
      ? state.players.find((p) => !p.eliminated && p.inFantasyLand && !p.fantasyPlaced) ?? null
      : null;
  const turnActor = phase === 'placing' ? state.players.find((p) => p.id === state.turnId) ?? null : null;
  const actor = fantasyActor ?? turnActor;
  // OFC is open information: the initial 5 are set face-up within the same turn, so
  // normal placement needs no handoff lock — the caption is just a turn indicator. Only
  // a Fantasy Land arrangement is genuinely secret (face-down until the scoring reveal).
  const fantasyArranging = !!actor && actor.inFantasyLand && !actor.fantasyPlaced;
  const arranging =
    !!actor && (fantasyArranging || (state.placeRound === 0 && actor.hand.length > 0));

  // The shared table shows only what the whole room may see. While someone is acting,
  // their seat leaves the strip — their board renders once, big, in the action zone.
  const tableView = redactFor(state, TABLE_VIEWER);
  const nameById = Object.fromEntries(state.players.map((p) => [p.id, p.name]));
  const seats: OfcSeatVM[] = tableView.players
    .filter((p) => !(phase === 'placing' && p.id === actor?.id))
    .map((p) => ({
    id: p.id,
    name: p.name,
    chips: p.chips,
    eliminated: p.eliminated,
    inFantasyLand: p.inFantasyLand,
    fantasyPlaced: p.fantasyPlaced,
    isButton: p.id === state.buttonId,
    gridCounts: p.gridCounts,
    grid: p.grid,
    fouled: phase === 'scoring' || phase === 'gameOver' ? state.handResult?.perPlayer[p.id]?.fouled : undefined,
  }));

  const caption = (() => {
    if (phase === 'placing' && actor) {
      if (actor.inFantasyLand && !actor.fantasyPlaced) return t('game.fantasyOther', { name: actor.name });
      if (state.placeRound === 0) return t('game.initialOther', { name: actor.name });
      return t(state.variant === 'pineapple' ? 'game.drawOtherPineapple' : 'game.drawOther', {
        name: actor.name,
      });
    }
    if (phase === 'placing') return t('game.waitingFantasy');
    if (phase === 'scoring') return t('game.handScored', { hand: state.handNumber });
    return '';
  })();

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

  const finish = () => router.dismissTo('/(tabs)/degen');

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <StatusBar style="light" />
      <View style={styles.header}>
        <TouchableOpacity style={[styles.iconBtn, { backgroundColor: DARK_TILE }]} onPress={finish} activeOpacity={0.7}>
          <X size={18} color={colors.onDarkSecondary} strokeWidth={2} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.onDarkPrimary }]}>{t('title')}</Text>
        <View style={styles.iconBtn}>
          <Text style={[styles.handBadge, { color: colors.onDarkTertiary }]}>{t('game.handBadge', { hand: state.handNumber })}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Animated.Text key={`caption-${state.version}`} entering={FadeInDown.duration(300)} style={styles.caption}>
          {caption}
        </Animated.Text>

        <OfcSeatsStrip seats={seats} activeId={actor?.id ?? null} />

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

      {celebrating && winner && (
        <View pointerEvents="none" style={styles.celebrationLayer}>
          <WinCelebration
            width={SCREEN_WIDTH}
            height={320}
            title={t('game.victory')}
            subtitle={t('game.winnerSub', { name: winner.name })}
            borderRadius={0}
            onDone={() => setCelebrating(false)}
          />
        </View>
      )}

      {/* Handoff lock — Fantasy Land only: those 13 cards stay secret until the reveal. */}
      {locked && phase === 'placing' && actor && fantasyArranging && (
        <Animated.View entering={FadeIn.duration(200)} style={StyleSheet.absoluteFill}>
          <BlurView intensity={50} tint="dark" style={StyleSheet.absoluteFill} />
          <View style={styles.lockOverlay}>
            <Lock size={28} color={TABLE.gold} strokeWidth={1.5} />
            <Text style={styles.lockTitle}>{t('play.passPhoneTo')}</Text>
            <Text style={[styles.lockName, { color: TABLE.gold }]}>{actor.name}</Text>
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
  handBadge: {
    fontSize: fontSize.xs,
    fontFamily: fontFamily.bold,
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
