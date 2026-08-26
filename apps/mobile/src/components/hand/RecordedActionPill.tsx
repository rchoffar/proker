import { Text, TouchableOpacity, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { fontFamily, fontSize, radius, spacing } from '../../design-system/theme';
import { useTheme } from '../../design-system/ThemeProvider';
import { formatHandAmount } from '../../lib/format';
import type { HandAction, HandPlayer, UnitMode } from '../../types';

interface Props {
  action: HandAction;
  player?: HandPlayer;
  unitMode: UnitMode;
  // Recorded actions are never definitive: tapping one opens it for editing.
  onPress: () => void;
}

// A recorded (non-post) action in the builder, rendered with the app's selected-chip idiom
// so it reads as a choice that can still be changed, not a frozen log line.
export function RecordedActionPill({ action, player, unitMode, onPress }: Props) {
  const { t } = useTranslation('replayer');
  const { colors } = useTheme();
  const position = player?.position;

  return (
    <View style={styles.row}>
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.7}
        style={[styles.pill, { borderColor: colors.accent, backgroundColor: colors.accentTint }]}
      >
        <Text style={[styles.pillText, { color: colors.accent }]} numberOfLines={1}>
          {action.amount
            ? t('recordedAction.withAmount', {
                name: player?.name ?? '?',
                position: position ? ` (${position})` : '',
                action: t(`poker:actions.${action.type}`),
                amount: formatHandAmount(action.amount, unitMode),
              })
            : t('recordedAction.plain', {
                name: player?.name ?? '?',
                position: position ? ` (${position})` : '',
                action: t(`poker:actions.${action.type}`),
              })}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
  },
  pill: {
    borderWidth: 1,
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    maxWidth: '100%',
  },
  pillText: {
    fontSize: fontSize.sm,
    fontFamily: fontFamily.semibold,
  },
});
