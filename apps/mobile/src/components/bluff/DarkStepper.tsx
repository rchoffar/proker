import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Minus, Plus } from 'lucide-react-native';
import { fontFamily, fontSize, radius, spacing } from '../../design-system/theme';
import { useTheme } from '../../design-system/ThemeProvider';

interface Props {
  label: string;
  value: number;
  onDecrement: () => void;
  onIncrement: () => void;
  min?: number;
  max?: number;
}

// Dark-surface twin of ui/Stepper for the Bluff play modals, which sit on a black sheet
// in both themes — the shared Stepper's themed field colors turn milky white there.
export function DarkStepper({ label, value, onDecrement, onIncrement, min = 0, max = 100 }: Props) {
  const { colors } = useTheme();
  return (
    <View style={[styles.row, { borderColor: colors.onDarkHairline }]}>
      <Text style={[styles.label, { color: colors.onDarkSecondary }]}>{label}</Text>
      <View style={styles.controls}>
        <TouchableOpacity
          style={[styles.btn, { borderColor: colors.onDarkHairline }, value <= min && styles.btnDisabled]}
          onPress={onDecrement}
          disabled={value <= min}
          activeOpacity={0.7}
        >
          <Minus size={14} color={value <= min ? colors.onDarkTertiary : colors.onDarkPrimary} strokeWidth={2} />
        </TouchableOpacity>
        <Text style={[styles.value, { color: colors.onDarkPrimary }]}>{String(value)}</Text>
        <TouchableOpacity
          style={[styles.btn, { borderColor: colors.onDarkHairline }, value >= max && styles.btnDisabled]}
          onPress={onIncrement}
          disabled={value >= max}
          activeOpacity={0.7}
        >
          <Plus size={14} color={value >= max ? colors.onDarkTertiary : colors.onDarkPrimary} strokeWidth={2} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: radius.md,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.md,
    gap: spacing.md,
  },
  label: {
    flex: 1,
    fontSize: fontSize.sm,
    fontFamily: fontFamily.medium,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  btn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnDisabled: {
    opacity: 0.4,
  },
  value: {
    fontSize: fontSize.md,
    fontFamily: fontFamily.bold,
    minWidth: 56,
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },
});
