import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { RotateCw } from 'lucide-react-native';
import { fontFamily, fontSize, radius, spacing } from '../../design-system/theme';
import { useTheme } from '../../design-system/ThemeProvider';
import { DARK_TILE } from './gameSurface';

// The two buttons a finished game offers: leave, or run it back. Bluff and OFC had this
// row byte-for-byte identical in both their Pass & Play and online screens — four copies,
// down to the same 16pt RotateCw — and each named the replay button's inner row
// differently (`replayContent` here, `relancerContent` in flip and roulette).
//
// Online gates the replay on being the host, so `onReplay` is optional. A guest used to get
// a lone "Quit" button with nothing saying the host could still run it back, so they might
// leave a beat before the rematch — hence the optional `waitingLabel` that takes its place.

interface Props {
  finishLabel: string;
  replayLabel: string;
  onFinish: () => void;
  /** Omitted for a guest — only the host may restart an online table. */
  onReplay?: () => void;
  /** Shown to a guest in place of the replay button, so "Quit" is not the only thing on the
   *  screen when the host may still be about to run it back. */
  waitingLabel?: string;
}

export function GameOverActions({ finishLabel, replayLabel, onFinish, onReplay, waitingLabel }: Props) {
  const { colors } = useTheme();
  return (
    <View style={styles.actionRow}>
      <TouchableOpacity style={[styles.actionBtn, { backgroundColor: DARK_TILE }]} onPress={onFinish} activeOpacity={0.85}>
        <Text style={[styles.actionBtnText, { color: colors.onDarkPrimary }]}>{finishLabel}</Text>
      </TouchableOpacity>
      {!onReplay && waitingLabel && (
        <View style={styles.waiting}>
          <Text style={[styles.waitingText, { color: colors.onDarkTertiary }]} numberOfLines={2}>
            {waitingLabel}
          </Text>
        </View>
      )}
      {onReplay && (
        <TouchableOpacity
          style={[styles.actionBtn, { backgroundColor: colors.accentBright }]}
          onPress={onReplay}
          activeOpacity={0.85}
        >
          <View style={styles.replayContent}>
            <RotateCw size={16} color="#0A0A0F" strokeWidth={2} />
            <Text style={styles.replayText}>{replayLabel}</Text>
          </View>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  actionRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  actionBtn: {
    flex: 1,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  actionBtnText: {
    fontSize: fontSize.md,
    fontFamily: fontFamily.bold,
  },
  replayContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  replayText: {
    color: '#0A0A0F',
    fontSize: fontSize.md,
    fontFamily: fontFamily.bold,
  },
  waiting: {
    flex: 1,
    justifyContent: 'center',
  },
  waitingText: {
    fontSize: fontSize.sm,
    fontFamily: fontFamily.medium,
    textAlign: 'center',
  },
});
