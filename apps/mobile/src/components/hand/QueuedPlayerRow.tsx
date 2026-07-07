import { View, Text, StyleSheet } from 'react-native';
import { fontFamily, fontSize, spacing } from '../../design-system/theme';
import { useTheme } from '../../design-system/ThemeProvider';
import { initials } from '../../lib/format';
import type { HandPlayer } from '../../types';

interface Props {
  player: HandPlayer;
  position?: string;
}

export function QueuedPlayerRow({ player, position }: Props) {
  const { colors } = useTheme();
  return (
    <View style={styles.wrap}>
      <View style={[styles.avatar, { backgroundColor: colors.neutralTileBg }]}>
        <Text style={[styles.avatarText, { color: colors.textTertiary }]}>{initials(player.name)}</Text>
      </View>
      <Text style={[styles.name, { color: colors.textTertiary }]} numberOfLines={1}>
        {player.name}
        {position ? ` (${position})` : ''}
      </Text>
      <Text style={[styles.status, { color: colors.textTertiary }]}>en attente</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xs,
    opacity: 0.55,
  },
  avatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: fontSize.xs,
    fontFamily: fontFamily.bold,
  },
  name: {
    flex: 1,
    fontSize: fontSize.sm,
    fontFamily: fontFamily.medium,
  },
  status: {
    fontSize: fontSize.xs,
    fontFamily: fontFamily.medium,
    fontStyle: 'italic',
  },
});
