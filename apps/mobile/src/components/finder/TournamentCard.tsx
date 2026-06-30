import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { GlassCard } from '../ui/GlassCard';
import { colors, fontFamily, fontSize, spacing, radius } from '../../design-system/theme';
import type { Tournament, Festival } from '../../types';

interface Props {
  tournament: Tournament;
  festival?: Festival;
  timesPlayed: number;
  onPress: () => void;
}

function formatBuyIn(amount: number): string {
  return `${amount.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')} €`;
}

function getBuyInColor(amount: number): string {
  if (amount >= 1000) return colors.warning;
  if (amount <= 500) return colors.profit;
  return colors.neutral;
}

export function TournamentCard({ tournament, festival, timesPlayed, onPress }: Props) {
  const buyInColor = getBuyInColor(tournament.buyIn);

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.75}>
      <GlassCard padding={0} style={styles.card}>
        <View style={styles.bar} />
        <View style={styles.content}>
          <View style={styles.left}>
            {festival && (
              <View style={styles.festivalPill}>
                <Text style={styles.festivalText} numberOfLines={1}>{festival.name}</Text>
              </View>
            )}
            <Text style={styles.name} numberOfLines={2}>{tournament.name}</Text>
            <View style={styles.badgeRow}>
              <View style={[styles.buyInBadge, { backgroundColor: `${buyInColor}20` }]}>
                <Text style={[styles.buyInText, { color: buyInColor }]}>
                  {formatBuyIn(tournament.buyIn)}
                </Text>
              </View>
            </View>
          </View>
          <View style={styles.right}>
            {tournament.totalPlayers ? (
              <Text style={styles.players}>
                {tournament.totalPlayers.toLocaleString('fr-FR')} joueurs
              </Text>
            ) : null}
            {timesPlayed > 0 ? (
              <View style={styles.playedBadge}>
                <View style={styles.playedDot} />
                <Text style={styles.playedText}>Joué {timesPlayed}×</Text>
              </View>
            ) : null}
          </View>
        </View>
      </GlassCard>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
  },
  bar: {
    width: 3,
    backgroundColor: '#FFD700',
    borderTopLeftRadius: radius.xl,
    borderBottomLeftRadius: radius.xl,
  },
  content: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.md,
    gap: spacing.sm,
  },
  left: {
    flex: 1,
    gap: 4,
  },
  right: {
    alignItems: 'flex-end',
    gap: 6,
  },
  festivalPill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: radius.full,
    backgroundColor: 'rgba(255, 215, 0, 0.10)',
    marginBottom: 2,
  },
  festivalText: {
    color: colors.textTertiary,
    fontSize: fontSize.xs,
    fontFamily: fontFamily.medium,
  },
  name: {
    color: colors.textPrimary,
    fontSize: fontSize.base,
    fontFamily: fontFamily.semibold,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  buyInBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.full,
  },
  buyInText: {
    fontSize: fontSize.xs,
    fontFamily: fontFamily.semibold,
  },
  players: {
    color: colors.textTertiary,
    fontSize: fontSize.xs,
    fontFamily: fontFamily.regular,
  },
  playedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  playedDot: {
    width: 5,
    height: 5,
    borderRadius: 9999,
    backgroundColor: colors.profit,
  },
  playedText: {
    color: colors.profit,
    fontSize: fontSize.xs,
    fontFamily: fontFamily.semibold,
  },
});
