import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { GlassCard } from '../ui/GlassCard';
import { fontFamily, fontSize, spacing, radius } from '../../design-system/theme';
import { useTheme } from '../../design-system/ThemeProvider';
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

export function TournamentCard({ tournament, festival, timesPlayed, onPress }: Props) {
  const { colors } = useTheme();
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.75}>
      <GlassCard padding={16}>
        <View style={styles.card}>
          <View style={styles.left}>
            {festival && (
              <View style={[styles.festivalPill, { backgroundColor: colors.neutralTileBg }]}>
                <Text style={[styles.festivalText, { color: colors.textTertiary }]} numberOfLines={1}>{festival.name}</Text>
              </View>
            )}
            <Text style={[styles.name, { color: colors.textPrimary }]} numberOfLines={2}>{tournament.name}</Text>
            <View style={styles.badgeRow}>
              <View style={[styles.buyInBadge, { backgroundColor: colors.accentTint }]}>
                <Text style={[styles.buyInText, { color: colors.accent }]}>{formatBuyIn(tournament.buyIn)}</Text>
              </View>
            </View>
          </View>
          <View style={styles.right}>
            {tournament.totalPlayers ? (
              <Text style={[styles.players, { color: colors.textTertiary }]}>
                {tournament.totalPlayers.toLocaleString('fr-FR')} joueurs
              </Text>
            ) : null}
            {timesPlayed > 0 ? (
              <View style={styles.playedBadge}>
                <View style={[styles.playedDot, { backgroundColor: colors.accent }]} />
                <Text style={[styles.playedText, { color: colors.accent }]}>Joué {timesPlayed}×</Text>
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
    alignItems: 'center',
    justifyContent: 'space-between',
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
    marginBottom: 2,
  },
  festivalText: {
    fontSize: fontSize.xs,
    fontFamily: fontFamily.medium,
  },
  name: {
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
  },
  playedText: {
    fontSize: fontSize.xs,
    fontFamily: fontFamily.semibold,
  },
});
