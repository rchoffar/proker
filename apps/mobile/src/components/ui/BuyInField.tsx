import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Info } from 'lucide-react-native';
import { fontFamily, fontSize, radius, shadow, spacing } from '../../design-system/theme';
import { useTheme } from '../../design-system/ThemeProvider';
import { AmountInput } from './AmountInput';

const DEFAULT_PRESETS = [50, 100, 200, 500, 1000, 1500];

interface BuyInFieldProps {
  label?: string;
  value: string;
  onChange: (v: string) => void;
  presets?: number[];
  inferred?: boolean;
  /** Shown when `inferred` — pass a translated string (no default: this UI component stays i18n-agnostic). */
  inferredNote?: string;
}

export function BuyInField({
  label = 'Buy-in',
  value,
  onChange,
  presets = DEFAULT_PRESETS,
  inferred = false,
  inferredNote,
}: BuyInFieldProps) {
  const { colors } = useTheme();

  if (inferred) {
    return (
      <View style={[styles.inferredCard, { borderColor: colors.surface.fieldBorder, backgroundColor: colors.surface.fieldBg }]}>
        <View style={styles.inferredHeaderRow}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>{label}</Text>
          <Text style={[styles.inferredValue, { color: colors.textPrimary }]}>{value || '0'} €</Text>
        </View>
        {inferredNote ? (
          <View style={styles.noteRow}>
            <Info size={12} color={colors.textTertiary} strokeWidth={1.8} />
            <Text style={[styles.note, { color: colors.textTertiary }]}>{inferredNote}</Text>
          </View>
        ) : null}
      </View>
    );
  }

  return (
    <View style={{ gap: spacing.sm }}>
      <View style={styles.presetsRow}>
        {presets.map((p) => {
          const active = value === String(p);
          return (
            <TouchableOpacity
              key={p}
              style={[
                styles.preset,
                { borderColor: colors.hairline, backgroundColor: colors.surface.fieldBg },
                active && { borderColor: colors.accent, backgroundColor: colors.accentTint },
              ]}
              onPress={() => onChange(String(p))}
              activeOpacity={0.7}
            >
              <Text style={[styles.presetText, { color: active ? colors.accent : colors.textSecondary }, active && { fontFamily: fontFamily.semibold }]}>
                {p} €
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
      <AmountInput label={label} value={value} onChange={onChange} placeholder="500" />
    </View>
  );
}

const styles = StyleSheet.create({
  label: {
    fontSize: fontSize.sm,
    fontFamily: fontFamily.medium,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  inferredCard: {
    borderWidth: 1,
    borderRadius: radius.md,
    ...shadow.field,
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.md,
    gap: spacing.sm,
  },
  inferredHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  inferredValue: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.lg,
  },
  noteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  note: {
    fontSize: fontSize.xs,
    fontFamily: fontFamily.regular,
  },
  presetsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  preset: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    borderWidth: 1,
    ...shadow.field,
  },
  presetText: {
    fontSize: fontSize.sm,
    fontFamily: fontFamily.medium,
  },
});
