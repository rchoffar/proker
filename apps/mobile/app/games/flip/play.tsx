import { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Animated, { FadeIn, FadeInDown, FlipInEasyY, ZoomIn } from 'react-native-reanimated';
import { X, RotateCw } from 'lucide-react-native';
import { PlayingCard } from '../../../src/components/hand/PlayingCard';
import { PokerTable, TABLE, seatPoint } from '../../../src/components/hand/PokerTable';
import { TableSeat } from '../../../src/components/hand/TableSeat';
import { WinCelebration } from '../../../src/components/hand/WinCelebration';
import { useFlipDraft } from '../../../src/store/useFlipDraft';
import {
  createDeck,
  shuffleDeck,
  evaluateBestHand,
  compareHandScores,
  findWorstHands,
  findBestHands,
  type HandScore,
} from '../../../src/lib/pokerHandEvaluator';
import { fontFamily, fontSize, radius, spacing } from '../../../src/design-system/theme';
import { useTheme } from '../../../src/design-system/ThemeProvider';
import type { Card, Player } from '../../../src/types';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const TABLE_W = SCREEN_WIDTH - 96;
const TABLE_H = Math.min(470, Math.max(340, Math.round(SCREEN_HEIGHT * 0.48)));
const POD_W = 84;

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
  const deck = shuffleDeck(createDeck());
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
  const holeCount = gameType === 'omaha' ? 4 : 2;

  const [phase, setPhase] = useState<Phase>('dealt');
  const [handToken, setHandToken] = useState(0);
  const [celebrating, setCelebrating] = useState(false);

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
    return { byId, loserIds, winnerIds, sorted };
  }, [phase, dealt, players, gameType]);

  const finish = () => router.dismissTo('/(tabs)/degen');

  // Street caption above the table; at result the winner/loser banner takes its place.
  const phaseButtonLabels: Record<Phase, string> = {
    dealt: t('flip.revealFlop'),
    flop: t('flip.revealTurn'),
    turn: t('flip.revealRiver'),
    result: t('flip.playAgain'),
  };
  const captionLabels: Record<Phase, string> = {
    dealt: t('flip.dealing'),
    flop: t('poker:phases.flop'),
    turn: t('poker:phases.turn'),
    result: '',
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
    }
  };

  // The celebration bursts a beat after the river flip lands, not on top of it.
  useEffect(() => {
    if (phase !== 'result') return;
    const timer = setTimeout(() => setCelebrating(true), 700);
    return () => clearTimeout(timer);
  }, [phase]);

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
        {results ? (
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
                  <Animated.View key={`board-${handToken}-${i}`} entering={FlipInEasyY.duration(450).delay((i < 3 ? i : 0) * 100)}>
                    <PlayingCard card={dealt.board[i]} size="md" />
                  </Animated.View>
                ) : (
                  <PlayingCard key={`board-${handToken}-${i}-hidden`} faceDown size="md" />
                )
              )}
            </View>
          </View>

          {players.map((p, k) => {
            const { x, y } = seatPoint(k, players.length, TABLE_W, TABLE_H);
            const isLoser = results?.loserIds.has(p.id) ?? false;
            const isWinner = results?.winnerIds.has(p.id) ?? false;
            const categoryId = results?.byId.get(p.id)?.categoryId;
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
                <PlayingCard card={card} size="md" />
              </Animated.View>
            ));
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
