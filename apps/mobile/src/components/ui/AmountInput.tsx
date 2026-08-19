import { View, Text, TextInput, StyleSheet } from 'react-native';
import { fontFamily, fontSize, radius, shadow, spacing } from '../../design-system/theme';
import { useTheme } from '../../design-system/ThemeProvider';

interface AmountInputProps {
  label?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  unit?: string;
  allowDecimal?: boolean;
}

// Keep digits plus at most one decimal separator; iOS decimal-pad offers "," or "." depending
// on locale, so both must survive sanitization or French keyboards can't type 0,5 at all.
function sanitizeDecimal(raw: string): string {
  const cleaned = raw.replace(/[^0-9.,]/g, '');
  const firstSep = cleaned.search(/[.,]/);
  if (firstSep === -1) return cleaned;
  return cleaned.slice(0, firstSep + 1) + cleaned.slice(firstSep + 1).replace(/[.,]/g, '');
}

export function AmountInput({ label, value, onChange, placeholder = '0', unit = '€', allowDecimal = false }: AmountInputProps) {
  const { colors } = useTheme();
  return (
    <View style={{ gap: 6 }}>
      {label ? <Text style={[styles.label, { color: colors.textSecondary }]}>{label}</Text> : null}
      <View style={[styles.row, { borderColor: colors.surface.fieldBorder, backgroundColor: colors.surface.fieldBg }]}>
        <TextInput
          style={[styles.input, { color: colors.textPrimary }]}
          value={value}
          onChangeText={(v) => onChange(allowDecimal ? sanitizeDecimal(v) : v)}
          placeholder={placeholder}
          placeholderTextColor={colors.textTertiary}
          keyboardType={allowDecimal ? 'decimal-pad' : 'numeric'}
        />
        <Text style={[styles.unit, { color: colors.textTertiary }]}>{unit}</Text>
      </View>
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
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: radius.md,
    ...shadow.field,
    paddingRight: spacing.base,
  },
  input: {
    flex: 1,
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.lg,
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.md,
  },
  unit: {
    fontSize: fontSize.md,
    fontFamily: fontFamily.semibold,
  },
});
