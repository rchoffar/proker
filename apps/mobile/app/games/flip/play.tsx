import { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, InteractionManager } from 'react-native';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Animated, { FadeIn, FadeInDown, FlipInEasyY, LayoutAnimationConfig, ZoomIn } from 'react-native-reanimated';
import { RotateCw } from 'lucide-react-native';
import { PlayingCard } from '../../../src/components/hand/PlayingCard';
import { useConfirmQuitGame } from '../../../src/hooks/useConfirmQuitGame';
import { TABLE } from '../../../src/components/hand/PokerTable';
import { SeatedTable } from '../../../src/components/table/SeatedTable';
import { PLAY_TABLE } from '../../../src/components/table/tableSize';
import { GamePlayHeader } from '../../../src/components/games/GamePlayHeader';
import { NoPlayersScreen } from '../../../src/components/games/NoPlayersScreen';
import { TableWordmark } from '../../../src/components/table/TableWordmark';
import { WinCelebration } from '../../../src/components/hand/WinCelebration';
import { useFlipDraft } from '../../../src/store/useFlipDraft';
import { useAppStore } from '../../../src/store/useAppStore';
import { recordFlipRound } from '../../../src/lib/gameStats';
import { shuffleWithRng } from '../../../src/lib/rng';
import {
  createDeck,
  evaluateBestHand,
  compareHandScores,
  findWorstHands,
  findBestHands,
  type HandScore,
} from '../../../src/lib/pokerHandEvaluator';
import { strengthColor, winningCardKeys } from '../../../src/lib/handStrength';
import { estimateEquity } from '../../../src/lib/equity';
import { fontFamily, fontSize, radius, spacing } from '../../../src/design-system/theme';
import { useTheme } from '../../../src/design-system/ThemeProvider';
import { cardKey } from '../../../src/types';
import type { Card, Player } from '../../../src/types';

const TABLE_W = PLAY_TABLE.width;
const TABLE_H = PLAY_TABLE.height;
const POD_W = 84;
// Five community cards plus their gaps have to sit inside the betting line (inset 38 a side).
const BOARD_CARD_W = Math.min(46, Math.floor((TABLE_W - 76 - 24 - 16) / 5));

// Proper noun — on the do-not-translate glossary, like the wordmark.
const GAME_NAME = 'Flip';

// Suspense on the last card: the river hangs face-down for a beat, then flips slower than
// the other streets (which use 450ms). Same treatment as the hand replayer's river.
const RIVER_FLIP_DELAY = 400;
const RIVER_FLIP_DURATION = 1000;

// The deal: cards fly one by one from the table center to each seat, in real dealer order
// (one card per player, around the table, then the next card). DEAL_STEP is the gap
// between two throws, DEAL_FLIGHT_MS one card's flight time.
const DEAL_STEP = 100;
const DEAL_FLIGHT_MS = 320;

// The river reveal IS the result — no extra tap between seeing the last card and knowing
// who pays.
type Phase = 'dealt' | 'flop' | 'turn' | 'result';

const NEXT_PHASE: Record<Phase, Phase | null> = {
  dealt: 'flop',
  flop: 'turn',
  turn: 'result',
  result: null,
};

const BOARD_VISIBLE_COUNT: Record<Phase, number> = {
  dealt: 0,
  flop: 3,
  turn: 4,
  result: 5,
};

interface DealtHand {
  holeCards: Record<string, Card[]>;
  board: Card[];
}


function dealNewHand(players: Player[], holeCount: number): DealtHand {
  const deck = shuffleWithRng(createDeck(), Math.random);
  let idx = 0;
  const holeCards: Record<string, Card[]> = {};
  for (const p of players) {
    holeCards[p.id] = deck.slice(idx, idx + holeCount);
    idx += holeCount;
  }
  const board = deck.slice(idx, idx + 5);
  return { holeCards, board };
}

export default function FlipPlayScreen() {
  const { t } = useTranslation('games');
  const { colors } = useTheme();
  const router = useRouter();
  const players = useFlipDraft((s) => s.players);
  const gameType = useFlipDraft((s) => s.gameType);
  const updateGameStats = useAppStore((s) => s.updateGameStats);
  const holeCount = gameType === 'omaha' ? 4 : 2;

  const [phase, setPhase] = useState<Phase>('dealt');
  const [handToken, setHandToken] = useState(0);
  const [celebrating, setCelebrating] = useState(false);
  // Non-winning cards grey out a beat after the river flip lands, together with the
  // celebration — but sticky, unlike `celebrating` which resets via onDone.
  const [showdownDim, setShowdownDim] = useState(false);
  // The outcome (banners, winner ring, 100%/0% stats) stays hidden while the river is
  // still mid-flip — otherwise the reveal is spoiled before the card lands.
  const [outcomeShown, setOutcomeShown] = useState(false);
  // The % badges keep the previous street's numbers while new cards flip: statsPhase
  // trails `phase`, catching up only after the phase's flip animations are done (hole fans
  // stagger k*90+i*70 over a 400ms flip, board cards 100ms apart over 450ms), and the
  // equities are computed from it. Null until the deal's first flips land.
  const [statsPhase, setStatsPhase] = useState<Phase | null>(null);
  // The deal waits for the push transition to settle: entering animations scheduled while
  // the screen is still sliding in get dropped by Reanimated, leaving half-flipped frozen
  // cards (same bug the hand replayer had). Until then the table renders bare and the
  // pods paint instantly (skipEntering below).
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const handle = InteractionManager.runAfterInteractions(() => setReady(true));
    return () => handle.cancel();
  }, []);

  useEffect(() => {
    if (phase === 'result' || !ready) return;
    // The deal's length scales with the table (one throw per card per player), so its
    // badge delay is computed rather than fixed; the streets keep their flip windows.
    const dealMs = (players.length * holeCount - 1) * DEAL_STEP + DEAL_FLIGHT_MS + 150;
    const delays: Record<Phase, number> = { dealt: dealMs, flop: 750, turn: 600, result: 0 };
    const timer = setTimeout(() => setStatsPhase(phase), delays[phase]);
    return () => clearTimeout(timer);
  }, [phase, handToken, ready, players.length, holeCount]);

  const confirmQuit = useConfirmQuitGame(players.length >= 2 && phase !== 'result');

  // eslint-disable-next-line react-hooks/exhaustive-deps -- handToken is a cache-busting trigger for "Rejouer", not a data input
  const dealt = useMemo(() => dealNewHand(players, holeCount), [handToken, players, holeCount]);

  const results = useMemo(() => {
    if (phase !== 'result') return null;
    const scored = players.map((p) => ({
      playerId: p.id,
      score: evaluateBestHand(gameType, dealt.holeCards[p.id], dealt.board),
    }));
    const byId = new Map<string, HandScore>(scored.map((s) => [s.playerId, s.score]));
    const loserIds = new Set(findWorstHands(scored));
    const winnerIds = new Set(findBestHands(scored));
    const sorted = [...players].sort((a, b) => compareHandScores(byId.get(b.id)!, byId.get(a.id)!));
    const winningKeys = winningCardKeys(scored.filter((s) => winnerIds.has(s.playerId)).map((s) => s.score));
    return { byId, loserIds, winnerIds, sorted, winningKeys };
  }, [phase, dealt, players, gameType]);

  // Live chance of winning the pot, re-estimated on every street as cards are revealed.
  // Estimated on the lagged statsPhase, so the badges keep the previous street's numbers
  // while the new cards flip and refresh once they land (statsPhase never reaches result:
  // during the river's suspense flip the turn-board values stay up, then outcomeShown
  // swaps in the exact 100 / 0 / split from `results`).
  const equities = useMemo(() => {
    if (statsPhase === null || outcomeShown) return null;
    const board = dealt.board.slice(0, BOARD_VISIBLE_COUNT[statsPhase]);
    return estimateEquity(
      players.map((p) => ({ id: p.id, holeCards: dealt.holeCards[p.id] })),
      board,
      gameType
    );
  }, [statsPhase, outcomeShown, dealt, players, gameType]);

  const finish = async () => {
    if (await confirmQuit()) router.dismissTo('/');
  };

  // Street caption above the table; at result the winner/loser banner takes its place.
  const phaseButtonLabels: Record<Phase, string> = {
    dealt: t('flip.revealFlop'),
    flop: t('flip.revealTurn'),
    turn: t('flip.revealRiver'),
    result: t('flip.playAgain'),
  };
  // At result the caption reads "River" while the last card is mid-flip, then the
  // winner/loser banners take its place once the outcome shows.
  const captionLabels: Record<Phase, string> = {
    dealt: t('flip.dealing'),
    flop: t('poker:phases.flop'),
    turn: t('poker:phases.turn'),
    result: t('poker:phases.river'),
  };

  // Whole-sentence variants so verb agreement works in both languages (n=2 joins the
  // two names, n>2 falls back to a "N players" subject).
  const groupMessage = (names: string[], kind: 'wins' | 'loses'): string => {
    const subject =
      names.length === 1
        ? names[0]
        : names.length === 2
          ? t('flip.twoNames', { a: names[0], b: names[1] })
          : t('flip.playersCount', { count: names.length });
    return t(kind === 'wins' ? 'flip.winsHand' : 'flip.losesHand', { names: subject, count: names.length });
  };

  const handleButtonPress = () => {
    const next = NEXT_PHASE[phase];
    if (next) {
      setPhase(next);
    } else {
      setHandToken((t) => t + 1);
      setPhase('dealt');
      setCelebrating(false);
      setShowdownDim(false);
      setOutcomeShown(false);
      setStatsPhase(null);
    }
  };

  // Reveal in two steps: the outcome (banners, rings, stats) appears only once the river
  // flip has fully landed; the celebration and the non-winning-card grey-out burst a beat
  // after that, not on top of it.
  useEffect(() => {
    if (phase !== 'result') return;
    const outcomeTimer = setTimeout(() => setOutcomeShown(true), RIVER_FLIP_DELAY + RIVER_FLIP_DURATION);
    const celebrationTimer = setTimeout(() => {
      setCelebrating(true);
      setShowdownDim(true);
    }, RIVER_FLIP_DELAY + RIVER_FLIP_DURATION + 700);
    return () => {
      clearTimeout(outcomeTimer);
      clearTimeout(celebrationTimer);
    };
  }, [phase]);

  // `results` is null outside the result phase, so this records exactly once per hand.
  useEffect(() => {
    if (!results) return;
    updateGameStats((s) =>
      recordFlipRound(s, {
        players: players.map((p) => p.name),
        winners: players.filter((p) => results.winnerIds.has(p.id)).map((p) => p.name),
        losers: players.filter((p) => results.loserIds.has(p.id)).map((p) => p.name),
      })
    );
  }, [results, players, updateGameStats]);

  if (players.length < 2) {
    return <NoPlayersScreen message={t('play.noPlayers')} onBack={() => router.back()} />;
  }

  const boardVisibleCount = BOARD_VISIBLE_COUNT[phase];
  const loserNames = results ? players.filter((p) => results.loserIds.has(p.id)).map((p) => p.name) : [];
  const winnerNames = results ? players.filter((p) => results.winnerIds.has(p.id)).map((p) => p.name) : [];
  const firstWinner = results ? players.find((p) => results.winnerIds.has(p.id)) : undefined;
  const winnerCategoryId = firstWinner ? results?.byId.get(firstWinner.id)?.categoryId : undefined;

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <GamePlayHeader title={GAME_NAME} onClose={finish} />

      <View style={styles.tableArea}>
        <LayoutAnimationConfig skipEntering={!ready}>
        {results && outcomeShown ? (
          <Animated.View entering={FadeIn.duration(300)} style={styles.resultBanners}>
            <Text style={[styles.resultBanner, { color: TABLE.gold }]}>
              🏆 {groupMessage(winnerNames, 'wins')}
            </Text>
            <Text style={[styles.resultBanner, { color: colors.loss }]}>
              {groupMessage(loserNames, 'loses')}
            </Text>
          </Animated.View>
        ) : (
          <Animated.Text key={`caption-${phase}`} entering={FadeInDown.duration(300)} style={styles.caption}>
            {captionLabels[phase]}
          </Animated.Text>
        )}

        <SeatedTable
          width={TABLE_W}
          height={TABLE_H}
          style={styles.table}
          token={handToken}
          seatWidth={POD_W}
          seats={
            ready
              ? players.map((p, k) => {
                  const showOutcome = !!results && outcomeShown;
                  const isLoser = showOutcome && results!.loserIds.has(p.id);
                  const isWinner = showOutcome && results!.winnerIds.has(p.id);
                  const categoryId = showOutcome ? results!.byId.get(p.id)?.categoryId : undefined;
                  const equityPct = showOutcome
                    ? isWinner
                      ? Math.round(100 / results!.winnerIds.size)
                      : 0
                    : equities?.get(p.id);
                  const borderColor = isWinner ? TABLE.gold : isLoser ? colors.loss : TABLE.neutralBorder;
                  return {
                    id: p.id,
                    name: p.name,
                    ringColor: borderColor,
                    ringWidth: isWinner ? 2 : 1.5,
                    glow: isWinner,
                    plateBorderColor: isWinner || isLoser ? borderColor : undefined,
                    secondLine: categoryId
                      ? {
                          text: t(`poker:handCategories.${categoryId}`),
                          color: isWinner ? TABLE.gold : isLoser ? colors.loss : TABLE.plateText,
                          entering: ZoomIn.duration(250).delay(120),
                        }
                      : null,
                    fan: {
                      cards: dealt.holeCards[p.id].map((card) => ({
                        card,
                        dimmed: showdownDim && !!results && !results.winningKeys.has(cardKey(card)),
                      })),
                      // Round-robin like a live dealer: card i to every player, then card i+1.
                      deal: { ready, delayFor: (seatIdx: number, cardIdx: number) => (cardIdx * players.length + seatIdx) * DEAL_STEP },
                    },
                    // The win-chance % floats beside the fan (the plate's second line is
                    // reserved for the hand result at showdown). Keyed per street so it
                    // pops in again whenever the number changes.
                    badge:
                      equityPct === undefined ? undefined : (
                        <Animated.View
                          key={`equity-${handToken}-${statsPhase}-${showOutcome ? 'final' : 'live'}`}
                          entering={ZoomIn.duration(220).delay(k * 90 + 150)}
                          style={styles.equityBadge}
                        >
                          <Text style={[styles.equityBadgeText, { color: strengthColor(equityPct) }]}>
                            {t('poker:strengthPercent', { value: equityPct })}
                          </Text>
                        </Animated.View>
                      ),
                  };
                })
              : []
          }
          center={
            <View style={styles.feltStack}>
              <View style={styles.boardRow}>
                {[0, 1, 2, 3, 4].map((i) =>
                  i < boardVisibleCount ? (
                    <Animated.View
                      key={`board-${handToken}-${i}`}
                      entering={
                        i === 4
                          ? FlipInEasyY.duration(RIVER_FLIP_DURATION).delay(RIVER_FLIP_DELAY)
                          : FlipInEasyY.duration(450).delay((i < 3 ? i : 0) * 100)
                      }
                    >
                      <PlayingCard
                        card={dealt.board[i]}
                        width={BOARD_CARD_W}
                        dimmed={showdownDim && !!results && !results.winningKeys.has(cardKey(dealt.board[i]))}
                      />
                    </Animated.View>
                  ) : (
                    <PlayingCard key={`board-${handToken}-${i}-hidden`} faceDown width={BOARD_CARD_W} />
                  )
                )}
              </View>
              <TableWordmark />
            </View>
          }
        >
          {celebrating && results && (
            <WinCelebration
              width={TABLE_W}
              height={TABLE_H}
              title={t('flip.victory')}
              subtitle={groupMessage(winnerNames, 'wins')}
              detail={winnerCategoryId ? t(`poker:handCategories.${winnerCategoryId}`) : undefined}
              onDone={() => setCelebrating(false)}
            />
          )}
        </SeatedTable>
        </LayoutAnimationConfig>
      </View>

      <View style={styles.footer}>
        <TouchableOpacity style={[styles.primaryBtn, { backgroundColor: colors.accentBright }]} onPress={handleButtonPress} activeOpacity={0.85}>
          {phase === 'result' ? (
            <View style={styles.relancerContent}>
              <RotateCw size={16} color="#0A0A0F" strokeWidth={2} />
              <Text style={styles.primaryBtnText}>{t('flip.playAgain')}</Text>
            </View>
          ) : (
            <Text style={styles.primaryBtnText}>{phaseButtonLabels[phase]}</Text>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  tableArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.base,
  },
  caption: {
    fontSize: fontSize.lg,
    fontFamily: fontFamily.display,
    textAlign: 'center',
    color: TABLE.gold,
    letterSpacing: 2.5,
    textTransform: 'uppercase',
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
  table: {
    marginVertical: 46,
    alignSelf: 'center',
  },
  feltStack: {
    alignItems: 'center',
  },
  boardRow: {
    flexDirection: 'row',
    gap: 4,
    minHeight: 64,
    alignItems: 'center',
  },
  equityBadge: {
    position: 'absolute',
    left: '100%',
    marginLeft: 4,
    alignSelf: 'center',
    backgroundColor: TABLE.plateBg,
    borderWidth: 1,
    borderColor: TABLE.neutralBorder,
    borderRadius: radius.full,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  equityBadgeText: {
    fontSize: 9,
    fontFamily: fontFamily.bold,
  },
  footer: {
    paddingHorizontal: spacing.base,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
  },
  relancerContent: {
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
});
