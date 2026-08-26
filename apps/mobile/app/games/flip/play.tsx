import { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Animated, { FadeIn, FadeInDown, FlipInEasyY, ZoomIn } from 'react-native-reanimated';
import { X, RotateCw } from 'lucide-react-native';
import { PlayingCard } from '../../../src/components/hand/PlayingCard';
import { useConfirmQuitGame } from '../../../src/hooks/useConfirmQuitGame';
import { PokerTable, TABLE, seatPoint } from '../../../src/components/hand/PokerTable';
import { TableSeat } from '../../../src/components/hand/TableSeat';
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

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const TABLE_W = SCREEN_WIDTH - 96;
const TABLE_H = Math.min(470, Math.max(340, Math.round(SCREEN_HEIGHT * 0.48)));
const POD_W = 84;

// Suspense on the last card: the river hangs face-down for a beat, then flips slower than
// the other streets (which use 450ms). Same treatment as the hand replayer's river.
const RIVER_FLIP_DELAY = 400;
const RIVER_FLIP_DURATION = 1000;

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

// Fan angles per hand size — 2 cards for Hold'em, 4 for Omaha.
const FAN_ANGLES: Record<number, number[]> = {
  2: [-6, 6],
  4: [-12, -4, 4, 12],
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

  useEffect(() => {
    if (phase === 'result') return;
    const delays: Record<Phase, number> = { dealt: 1000, flop: 750, turn: 600, result: 0 };
    const timer = setTimeout(() => setStatsPhase(phase), delays[phase]);
    return () => clearTimeout(timer);
  }, [phase, handToken]);

  useConfirmQuitGame(players.length >= 2 && phase !== 'result');

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

  const finish = () => router.dismissTo('/(tabs)/degen');

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
    return (
      <SafeAreaView style={[styles.screen, styles.centered]}>
        <Text style={{ color: colors.textPrimary }}>{t('play.noPlayers')}</Text>
        <TouchableOpacity onPress={() => router.back()} style={[styles.primaryBtn, { backgroundColor: colors.accentBright, marginTop: spacing.base }]}>
          <Text style={styles.primaryBtnText}>{t('common:back')}</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const boardVisibleCount = BOARD_VISIBLE_COUNT[phase];
  const fanAngles = FAN_ANGLES[holeCount] ?? FAN_ANGLES[2];
  const loserNames = results ? players.filter((p) => results.loserIds.has(p.id)).map((p) => p.name) : [];
  const winnerNames = results ? players.filter((p) => results.winnerIds.has(p.id)).map((p) => p.name) : [];
  const firstWinner = results ? players.find((p) => results.winnerIds.has(p.id)) : undefined;
  const winnerCategoryId = firstWinner ? results?.byId.get(firstWinner.id)?.categoryId : undefined;

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity style={[styles.iconBtn, { backgroundColor: colors.neutralTileBg }]} onPress={finish} activeOpacity={0.7}>
          <X size={18} color={colors.textSecondary} strokeWidth={2} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Flip</Text>
        <View style={styles.iconBtn} />
      </View>

      <View style={styles.tableArea}>
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

        <PokerTable width={TABLE_W} height={TABLE_H} style={styles.table}>
          <View style={styles.feltCenter} pointerEvents="none">
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
                      size="md"
                      dimmed={showdownDim && !!results && !results.winningKeys.has(cardKey(dealt.board[i]))}
                    />
                  </Animated.View>
                ) : (
                  <PlayingCard key={`board-${handToken}-${i}-hidden`} faceDown size="md" />
                )
              )}
            </View>
          </View>

          {players.map((p, k) => {
            const { x, y } = seatPoint(k, players.length, TABLE_W, TABLE_H);
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
            // Bottom-half pods fan their cards above the avatar (toward the felt); top-half
            // pods fan them below, so cards never spill off the table.
            const cardsOnTop = y >= TABLE_H / 2;
            const fan = dealt.holeCards[p.id].map((card, i) => (
              <Animated.View
                key={`${handToken}-${i}`}
                entering={FlipInEasyY.duration(400).delay(k * 90 + i * 70)}
                style={[
                  { transform: [{ rotate: `${fanAngles[i] ?? 0}deg` }] },
                  i > 0 && styles.holeFanOverlap,
                  (fanAngles[i] ?? 0) !== 0 && { marginTop: Math.abs(fanAngles[i] ?? 0) * 0.4 },
                ]}
              >
                <PlayingCard
                  card={card}
                  size="md"
                  dimmed={showdownDim && !!results && !results.winningKeys.has(cardKey(card))}
                />
              </Animated.View>
            ));
            // The win-chance % sits to the right of the card fan (the plate's second line
            // is reserved for the hand result at showdown). Keyed per street so it pops
            // in again whenever the number changes.
            if (equityPct !== undefined) {
              fan.push(
                <Animated.View
                  key={`equity-${handToken}-${statsPhase}-${showOutcome ? 'final' : 'live'}`}
                  entering={ZoomIn.duration(220).delay(k * 90 + 150)}
                  style={styles.equityBadge}
                >
                  <Text style={[styles.equityBadgeText, { color: strengthColor(equityPct) }]}>
                    {t('poker:strengthPercent', { value: equityPct })}
                  </Text>
                </Animated.View>
              );
            }
            return (
              <TableSeat
                key={p.id}
                x={x}
                y={y}
                width={POD_W}
                name={p.name}
                ringColor={borderColor}
                ringWidth={isWinner ? 2 : 1.5}
                glow={isWinner}
                plateBorderColor={isWinner || isLoser ? borderColor : undefined}
                secondLine={
                  categoryId
                    ? {
                        text: t(`poker:handCategories.${categoryId}`),
                        color: isWinner ? TABLE.gold : isLoser ? colors.loss : TABLE.plateText,
                        entering: ZoomIn.duration(250).delay(120),
                      }
                    : null
                }
                cardsAbove={cardsOnTop ? fan : undefined}
                cardsBelow={cardsOnTop ? undefined : fan}
                cardsAboveOffset={56}
              />
            );
          })}

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
        </PokerTable>
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
  feltCenter: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boardRow: {
    flexDirection: 'row',
    gap: 4,
    minHeight: 64,
    alignItems: 'center',
  },
  holeFanOverlap: {
    marginLeft: -16,
  },
  // Absolutely positioned off the fan's right edge so the centered cards keep their
  // exact place — the badge floats beside them without affecting layout.
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
