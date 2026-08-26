import { View, Text, StyleSheet, Dimensions, LayoutChangeEvent } from 'react-native';
import { useTranslation } from 'react-i18next';
import { GlassCard } from '../ui/GlassCard';
import { PlayingCard } from './PlayingCard';
import { fontFamily, fontSize, spacing } from '../../design-system/theme';
import { useTheme } from '../../design-system/ThemeProvider';
import { formatHandAmount } from '../../lib/format';
import type { HandHistory } from '../../types';

const SCREEN_WIDTH = Dimensions.get('window').width;
// Give the card room to breathe on every device instead of a single guessed constant —
// a fixed width too close to its content width is what causes the board row to clip.
const CARD_WIDTH = Math.min(SCREEN_WIDTH - 32, 380);
// One size for the whole board, chosen so 5 cards + gaps always fit inside the card's
// padding — the row must never shrink between a 3-card and a 5-card board.
const BOARD_CARD_WIDTH = Math.min(46, Math.floor((CARD_WIDTH - 44 - 4 * spacing.sm) / 5));

interface Props {
  hand: HandHistory;
  // Fired once the card's native layout has settled, with its measured size — callers
  // that snapshot this view (react-native-view-shot) should wait for this and pass the
  // size through to the capture options, otherwise the capture can race the layout pass
  // or infer the wrong bounds and produce a small/cropped image.
  onReady?: (size: { width: number; height: number }) => void;
}

export function HandRecapCard({ hand, onReady }: Props) {
  const { t } = useTranslation('replayer');
  const { colors } = useTheme();
  const hero = hand.players.find((p) => p.isHero);
  const winners = hand.winnerIds?.length ? hand.players.filter((p) => hand.winnerIds!.includes(p.id)) : [];
  const finalPot = hand.pots[hand.pots.length - 1]?.amount;
  const boardCards = [...(hand.board.flop ?? []), hand.board.turn, hand.board.river].filter(Boolean);

  const handleLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    onReady?.({ width, height });
  };

  return (
    <View style={[styles.outer, { width: CARD_WIDTH }]} collapsable={false} onLayout={handleLayout}>
      <GlassCard variant="dark" padding={22} style={styles.card}>
        <Text style={[styles.title, { color: colors.onDarkPrimary }]}>{hand.title ?? t('untitledHand')}</Text>
        {hand.stakes ? <Text style={[styles.stakes, { color: colors.onDarkSecondary }]}>{hand.stakes}</Text> : null}

        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: colors.onDarkTertiary }]}>{t('steps.myCards')}</Text>
          <View style={styles.cardsRow}>
            {hero?.holeCards ? (
              hero.holeCards.map((c, i) => <PlayingCard key={i} card={c} size="lg" />)
            ) : (
              <PlayingCard faceDown size="lg" />
            )}
          </View>
        </View>

        {boardCards.length > 0 && (
          <View style={styles.section}>
            <Text style={[styles.sectionLabel, { color: colors.onDarkTertiary }]}>{t('steps.board')}</Text>
            <View style={styles.cardsRow}>
              {boardCards.map((c, i) => (
                <PlayingCard key={i} card={c!} width={BOARD_CARD_WIDTH} />
              ))}
            </View>
          </View>
        )}

        <View style={[styles.resultBox, { borderColor: colors.onDarkHairline }]}>
          {winners.length > 1 ? (
            <Text style={[styles.resultText, { color: colors.accentBright }]}>
              {finalPot
                ? t('splitWinsAmount', { names: winners.map((w) => w.name).join(', '), amount: formatHandAmount(finalPot, hand.unitMode) })
                : t('splitWins', { names: winners.map((w) => w.name).join(', ') })}
            </Text>
          ) : winners.length === 1 ? (
            <Text style={[styles.resultText, { color: colors.accentBright }]}>
              {finalPot
                ? t('winsAmount', { name: winners[0].name, amount: formatHandAmount(finalPot, hand.unitMode) })
                : t('winsHand', { name: winners[0].name })}
            </Text>
          ) : (
            <Text style={[styles.resultText, { color: colors.onDarkSecondary }]}>
              {finalPot ? t('finalPot', { amount: formatHandAmount(finalPot, hand.unitMode) }) : t('handOver')}
            </Text>
          )}
          {hand.winningHandDescription ? (
            <Text style={[styles.resultSub, { color: colors.onDarkTertiary }]}>{hand.winningHandDescription}</Text>
          ) : null}
        </View>

        <Text style={[styles.wordmark, { color: colors.onDarkTertiary }]}>Ultimate Poker Kit</Text>
      </GlassCard>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: {
    alignSelf: 'center',
  },
  card: {
    gap: spacing.md,
  },
  title: {
    fontSize: fontSize.xl,
    fontFamily: fontFamily.display,
  },
  stakes: {
    fontSize: fontSize.sm,
    fontFamily: fontFamily.medium,
    marginTop: -8,
  },
  section: {
    gap: spacing.sm,
  },
  sectionLabel: {
    fontSize: fontSize.xs,
    fontFamily: fontFamily.semibold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  cardsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  resultBox: {
    borderTopWidth: 1,
    paddingTop: spacing.md,
    gap: 4,
  },
  resultText: {
    fontSize: fontSize.md,
    fontFamily: fontFamily.bold,
  },
  resultSub: {
    fontSize: fontSize.sm,
    fontFamily: fontFamily.regular,
  },
  wordmark: {
    alignSelf: 'center',
    fontSize: fontSize.xs,
    fontFamily: fontFamily.semibold,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginTop: spacing.sm,
  },
});
