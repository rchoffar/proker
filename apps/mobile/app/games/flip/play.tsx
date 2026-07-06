import { useMemo, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Animated, { FadeIn, FadeInDown, FlipInEasyY } from 'react-native-reanimated';
import { X, RotateCw } from 'lucide-react-native';
import { PlayingCard } from '../../../src/components/hand/PlayingCard';
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
import { initials } from '../../../src/lib/format';
import type { Card, Player } from '../../../src/types';

type Phase = 'dealt' | 'flop' | 'turn' | 'river' | 'result';

const PHASE_LABELS: Record<Phase, string> = {
  dealt: 'Révéler le flop',
  flop: 'Révéler le turn',
  turn: 'Révéler la river',
  river: 'Voir le résultat',
  result: 'Rejouer',
};

const NEXT_PHASE: Record<Phase, Phase | null> = {
  dealt: 'flop',
  flop: 'turn',
  turn: 'river',
  river: 'result',
  result: null,
};

const BOARD_VISIBLE_COUNT: Record<Phase, number> = {
  dealt: 0,
  flop: 3,
  turn: 4,
  river: 5,
  result: 5,
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

function formatGroupMessage(names: string[], singular: string, plural: string): string {
  if (names.length === 1) return `${names[0]} ${singular}`;
  if (names.length === 2) return `${names[0]} et ${names[1]} ${plural}`;
  return `${names.length} joueurs ${plural}`;
}

export default function FlipPlayScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const players = useFlipDraft((s) => s.players);
  const gameType = useFlipDraft((s) => s.gameType);
  const holeCount = gameType === 'omaha' ? 4 : 2;

  const [phase, setPhase] = useState<Phase>('dealt');
  const [handToken, setHandToken] = useState(0);

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

  const handleButtonPress = () => {
    const next = NEXT_PHASE[phase];
    if (next) {
      setPhase(next);
    } else {
      setHandToken((t) => t + 1);
      setPhase('dealt');
    }
  };

  if (players.length < 2) {
    return (
      <SafeAreaView style={[styles.screen, styles.centered]}>
        <Text style={{ color: colors.textPrimary }}>Aucun joueur pour cette partie.</Text>
        <TouchableOpacity onPress={() => router.back()} style={[styles.primaryBtn, { backgroundColor: colors.accentBright, marginTop: spacing.base }]}>
          <Text style={styles.primaryBtnText}>Retour</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const boardVisibleCount = BOARD_VISIBLE_COUNT[phase];
  const cardSize = gameType === 'omaha' ? 'sm' : players.length >= 5 ? 'sm' : 'md';
  const loserNames = results ? players.filter((p) => results.loserIds.has(p.id)).map((p) => p.name) : [];
  const winnerNames = results ? players.filter((p) => results.winnerIds.has(p.id)).map((p) => p.name) : [];

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity style={[styles.iconBtn, { backgroundColor: colors.neutralTileBg }]} onPress={finish} activeOpacity={0.7}>
          <X size={18} color={colors.textSecondary} strokeWidth={2} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Flip</Text>
        <View style={styles.iconBtn} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.stack}>
          {results && (
            <Animated.View entering={FadeIn.duration(300)} style={styles.resultBanners}>
              <Text style={[styles.resultBanner, { color: colors.accent }]}>
                🏆 {formatGroupMessage(winnerNames, 'remporte la main', 'remportent la main')}
              </Text>
              <Text style={[styles.resultBanner, { color: colors.loss }]}>
                {formatGroupMessage(loserNames, 'perd la main', 'perdent la main')}
              </Text>
            </Animated.View>
          )}

          <View style={styles.boardRow}>
            {[0, 1, 2, 3, 4].map((i) =>
              i < boardVisibleCount ? (
                <Animated.View key={`board-${i}`} entering={FlipInEasyY.duration(450).delay((i < 3 ? i : 0) * 100)}>
                  <PlayingCard card={dealt.board[i]} size="md" />
                </Animated.View>
              ) : (
                <PlayingCard key={`board-${i}-hidden`} faceDown size="md" />
              )
            )}
          </View>

          <View style={styles.seats}>
            {(results ? results.sorted : players).map((p) => {
              const isLoser = results?.loserIds.has(p.id) ?? false;
              const isWinner = results?.winnerIds.has(p.id) ?? false;
              const categoryLabel = results?.byId.get(p.id)?.categoryLabel;
              return (
                <Animated.View
                  key={p.id}
                  entering={FadeInDown.delay(60).springify().damping(18).stiffness(140)}
                  style={[
                    styles.seat,
                    { borderColor: colors.hairline },
                    isWinner && { borderColor: colors.accent },
                    isLoser && { borderColor: colors.loss },
                  ]}
                >
                  <View style={[styles.avatar, { backgroundColor: colors.neutralTileBg }]}>
                    <Text style={[styles.avatarText, { color: colors.textSecondary }]}>{initials(p.name)}</Text>
                  </View>
                  <Text style={[styles.seatName, { color: colors.textSecondary }]} numberOfLines={1}>
                    {p.name}
                  </Text>
                  <View style={styles.holeCardsRow}>
                    {dealt.holeCards[p.id].map((card, i) => (
                      <Animated.View key={i} entering={FlipInEasyY.duration(400).delay(i * 80)}>
                        <PlayingCard card={card} size={cardSize} />
                      </Animated.View>
                    ))}
                  </View>
                  {categoryLabel && (
                    <Text
                      style={[
                        styles.categoryLabel,
                        { color: isLoser ? colors.loss : isWinner ? colors.accent : colors.textTertiary },
                      ]}
                    >
                      {categoryLabel}
                    </Text>
                  )}
                </Animated.View>
              );
            })}
          </View>

          <View style={{ height: 20 }} />
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity style={[styles.primaryBtn, { backgroundColor: colors.accentBright }]} onPress={handleButtonPress} activeOpacity={0.85}>
          {phase === 'result' ? (
            <View style={styles.relancerContent}>
              <RotateCw size={16} color="#0A0A0F" strokeWidth={2} />
              <Text style={styles.primaryBtnText}>Rejouer</Text>
            </View>
          ) : (
            <Text style={styles.primaryBtnText}>{PHASE_LABELS[phase]}</Text>
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
  content: {
    paddingHorizontal: spacing.base,
    paddingTop: spacing.md,
  },
  stack: {
    gap: spacing.lg,
    alignItems: 'center',
  },
  resultBanners: {
    gap: 4,
  },
  resultBanner: {
    fontSize: fontSize.md,
    fontFamily: fontFamily.bold,
    textAlign: 'center',
  },
  boardRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    minHeight: 64,
  },
  seats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: spacing.md,
  },
  seat: {
    alignItems: 'center',
    gap: 6,
    padding: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1.5,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: fontSize.xs,
    fontFamily: fontFamily.bold,
  },
  seatName: {
    fontSize: fontSize.xs,
    fontFamily: fontFamily.medium,
    maxWidth: 100,
  },
  holeCardsRow: {
    flexDirection: 'row',
    gap: 3,
  },
  categoryLabel: {
    fontSize: fontSize.xs,
    fontFamily: fontFamily.semibold,
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
