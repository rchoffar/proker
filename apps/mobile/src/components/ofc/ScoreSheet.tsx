import { View, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Sparkles } from 'lucide-react-native';
import { TABLE } from '../hand/PokerTable';
import { fontFamily, fontSize, radius, spacing } from '../../design-system/theme';
import { useTheme } from '../../design-system/ThemeProvider';
import type { OfcHandResult } from '../../lib/ofc';

// Hand settlement recap: one line per player (royalties, foul, Fantasy Land, chip
// delta), then each pairwise duel with the actual chips moved (capped when a stack
// couldn't cover the points).

interface Props {
  result: OfcHandResult;
  nameById: Record<string, string>;
}

const DARK_CARD_BG = 'rgba(255, 255, 255, 0.05)';
const LOSS_ON_DARK = '#FF6B70';

function signed(n: number): string {
  return n > 0 ? `+${n}` : `${n}`;
}

export function ScoreSheet({ result, nameById }: Props) {
  const { t } = useTranslation('ofc');
  const { colors } = useTheme();

  return (
    <View style={[styles.sheet, { backgroundColor: DARK_CARD_BG, borderColor: colors.onDarkHairline }]}>
      {Object.values(result.perPlayer).map((p) => {
        const delta = result.chipDelta[p.playerId] ?? 0;
        return (
          <View key={p.playerId} style={styles.playerRow}>
            <View style={styles.playerNameCol}>
              <Text style={[styles.playerName, { color: colors.onDarkPrimary }]} numberOfLines={1}>
                {nameById[p.playerId] ?? p.playerId}
              </Text>
              {p.fouled && <Text style={[styles.badge, { color: LOSS_ON_DARK }]}>{t('score.foul')}</Text>}
              {p.fantasyNext && <Sparkles size={12} color={TABLE.gold} strokeWidth={2} />}
              {result.eliminatedIds.includes(p.playerId) && (
                <Text style={[styles.badge, { color: LOSS_ON_DARK }]}>{t('score.eliminated')}</Text>
              )}
            </View>
            {p.royalties.total > 0 && (
              <Text style={[styles.royalties, { color: TABLE.gold }]}>
                {t('score.royaltiesTotal', { points: p.royalties.total })}
              </Text>
            )}
            <Text
              style={[
                styles.delta,
                { color: delta > 0 ? TABLE.gold : delta < 0 ? LOSS_ON_DARK : colors.onDarkTertiary },
              ]}
            >
              {t('score.chipsDelta', { delta: signed(delta) })}
            </Text>
          </View>
        );
      })}

      <View style={[styles.divider, { backgroundColor: colors.onDarkHairline }]} />

      {result.pairs.map((pair) => (
        <View key={`${pair.aId}-${pair.bId}`} style={styles.pairRow}>
          <Text style={[styles.pairNames, { color: colors.onDarkSecondary }]} numberOfLines={1}>
            {t('score.duel', { a: nameById[pair.aId] ?? pair.aId, b: nameById[pair.bId] ?? pair.bId })}
          </Text>
          <View style={styles.pairFacts}>
            {pair.scoopBy && (
              <Text style={[styles.badge, { color: TABLE.gold }]}>{t('score.scoop')}</Text>
            )}
            <Text style={[styles.pairPoints, { color: colors.onDarkPrimary }]}>
              {t('score.pairChips', { chips: signed(pair.chips) })}
            </Text>
            {pair.capped && (
              <Text style={[styles.badge, { color: colors.onDarkTertiary }]}>
                {t('score.capped', { points: signed(pair.points) })}
              </Text>
            )}
          </View>
        </View>
      ))}

      {Object.values(result.perPlayer).some((p) => p.fouled) && (
        <Text style={[styles.foulHint, { color: colors.onDarkTertiary }]}>{t('score.foulHint')}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: {
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.sm,
    alignSelf: 'stretch',
  },
  playerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  playerNameCol: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1,
  },
  playerName: {
    fontSize: fontSize.base,
    fontFamily: fontFamily.semibold,
    flexShrink: 1,
  },
  badge: {
    fontSize: fontSize.xs,
    fontFamily: fontFamily.bold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  royalties: {
    fontSize: fontSize.sm,
    fontFamily: fontFamily.semibold,
  },
  delta: {
    fontSize: fontSize.base,
    fontFamily: fontFamily.bold,
    minWidth: 44,
    textAlign: 'right',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    alignSelf: 'stretch',
  },
  pairRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  pairNames: {
    fontSize: fontSize.sm,
    fontFamily: fontFamily.medium,
    flexShrink: 1,
  },
  pairFacts: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  pairPoints: {
    fontSize: fontSize.sm,
    fontFamily: fontFamily.bold,
  },
  foulHint: {
    fontSize: fontSize.xs,
    fontFamily: fontFamily.regular,
    lineHeight: 16,
  },
});
