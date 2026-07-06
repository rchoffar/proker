import { View, Text, StyleSheet, Dimensions, LayoutChangeEvent } from 'react-native';
import { GlassCard } from '../ui/GlassCard';
import { PlayingCard } from './PlayingCard';
import { fontFamily, fontSize, spacing } from '../../design-system/theme';
import { useTheme } from '../../design-system/ThemeProvider';
import { formatAmount } from '../../lib/format';
import type { HandHistory, Street } from '../../types';

const SCREEN_WIDTH = Dimensions.get('window').width;
// Give the card room to breathe on every device instead of a single guessed constant —
// a fixed width too close to its content width is what causes the board row to clip.
const CARD_WIDTH = Math.min(SCREEN_WIDTH - 32, 380);

interface Props {
  hand: HandHistory;
  // Fired once the card's native layout has settled, with its measured size — callers
  // that snapshot this view (react-native-view-shot) should wait for this and pass the
  // size through to the capture options, otherwise the capture can race the layout pass
  // or infer the wrong bounds and produce a small/cropped image.
  onReady?: (size: { width: number; height: number }) => void;
}

const STREET_LABELS: Record<Street, string> = {
  preflop: 'Preflop',
  flop: 'Flop',
  turn: 'Turn',
  river: 'River',
};

const ACTION_LABELS: Record<string, string> = {
  fold: 'fold',
  check: 'check',
  call: 'call',
  bet: 'mise',
  raise: 'relance',
  allin: 'all-in',
};

function streetSummary(hand: HandHistory, street: Street): string {
  const streetActions = hand.actions.filter((a) => a.street === street).sort((a, b) => a.order - b.order);
  if (streetActions.length === 0) return '';
  return streetActions
    .map((a) => {
      const player = hand.players.find((p) => p.id === a.playerId);
      const label = ACTION_LABELS[a.type] ?? a.type;
      const amount = a.amount ? ` ${formatAmount(a.amount)}` : '';
      return `${player?.name ?? '?'} ${label}${amount}`;
    })
    .join(' · ');
}

export function HandRecapCard({ hand, onReady }: Props) {
  const { colors } = useTheme();
  const hero = hand.players.find((p) => p.isHero);
  const winner = hand.winnerId ? hand.players.find((p) => p.id === hand.winnerId) : undefined;
  const finalPot = hand.pots[hand.pots.length - 1]?.amount;
  const boardCards = [...(hand.board.flop ?? []), hand.board.turn, hand.board.river].filter(Boolean);

  const streets: Street[] = ['preflop', 'flop', 'turn', 'river'];
  const summaries = streets.map((s) => ({ street: s, text: streetSummary(hand, s) })).filter((s) => s.text);

  const handleLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    onReady?.({ width, height });
  };

  return (
    <View style={[styles.outer, { width: CARD_WIDTH }]} collapsable={false} onLayout={handleLayout}>
      <GlassCard variant="dark" padding={22} style={styles.card}>
        <Text style={[styles.title, { color: colors.onDarkPrimary }]}>{hand.title ?? 'Une main à raconter'}</Text>
        {hand.stakes ? <Text style={[styles.stakes, { color: colors.onDarkSecondary }]}>{hand.stakes}</Text> : null}

        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: colors.onDarkTertiary }]}>Mes cartes</Text>
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
            <Text style={[styles.sectionLabel, { color: colors.onDarkTertiary }]}>Board</Text>
            <View style={styles.cardsRow}>
              {boardCards.map((c, i) => (
                // Smaller once turn/river join the flop — keeps 5 cards + gaps comfortably
                // inside the card's padding on the narrowest supported screen widths.
                <PlayingCard key={i} card={c!} size={boardCards.length > 3 ? 'sm' : 'md'} />
              ))}
            </View>
          </View>
        )}

        {summaries.length > 0 && (
          <View style={styles.section}>
            {summaries.map(({ street, text }) => (
              <Text key={street} style={[styles.actionLine, { color: colors.onDarkSecondary }]} numberOfLines={2}>
                <Text style={{ color: colors.onDarkTertiary }}>{STREET_LABELS[street]} — </Text>
                {text}
              </Text>
            ))}
          </View>
        )}

        <View style={[styles.resultBox, { borderColor: colors.onDarkHairline }]}>
          {winner ? (
            <Text style={[styles.resultText, { color: colors.accentBright }]}>
              {winner.name} remporte {finalPot ? formatAmount(finalPot) : 'la main'}
            </Text>
          ) : (
            <Text style={[styles.resultText, { color: colors.onDarkSecondary }]}>
              {finalPot ? `Pot final : ${formatAmount(finalPot)}` : 'Main terminée'}
            </Text>
          )}
          {hand.winningHandDescription ? (
            <Text style={[styles.resultSub, { color: colors.onDarkTertiary }]}>{hand.winningHandDescription}</Text>
          ) : null}
        </View>

        <Text style={[styles.wordmark, { color: colors.onDarkTertiary }]}>Proker</Text>
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
  },
  actionLine: {
    fontSize: fontSize.sm,
    fontFamily: fontFamily.regular,
    lineHeight: 18,
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
