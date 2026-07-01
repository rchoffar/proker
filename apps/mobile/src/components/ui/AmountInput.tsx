import { View, Text, TextInput, StyleSheet } from 'react-native';
import { fontFamily, fontSize, radius, shadow, spacing } from '../../design-system/theme';
import { useTheme } from '../../design-system/ThemeProvider';

interface AmountInputProps {
  label?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  unit?: string;
}

export function AmountInput({ label, value, onChange, placeholder = '0', unit = '€' }: AmountInputProps) {
  const { colors } = useTheme();
  return (
    <View style={{ gap: 6 }}>
      {label ? <Text style={[styles.label, { color: colors.textSecondary }]}>{label}</Text> : null}
      <View style={[styles.row, { borderColor: colors.surface.fieldBorder, backgroundColor: colors.surface.fieldBg }]}>
        <TextInput
          style={[styles.input, { color: colors.textPrimary }]}
          value={value}
          onChangeText={onChange}
          placeholder={placeholder}
          placeholderTextColor={colors.textTertiary}
          keyboardType="numeric"
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
