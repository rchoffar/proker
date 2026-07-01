import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { SectionLabel } from '../ui/SectionLabel';
import { fontFamily, fontSize, radius, spacing } from '../../design-system/theme';
import { useTheme } from '../../design-system/ThemeProvider';

interface FilterChipGroupProps {
  title: string;
  options: { key: string; label: string }[];
  selected: string;
  onSelect: (key: string) => void;
}

export function FilterChipGroup({ title, options, selected, onSelect }: FilterChipGroupProps) {
  const { colors } = useTheme();
  return (
    <View style={styles.container}>
      <SectionLabel>{title}</SectionLabel>
      <View style={styles.wrap}>
        {options.map((opt) => {
          const active = opt.key === selected;
          return (
            <TouchableOpacity
              key={opt.key}
              style={[
                styles.chip,
                { borderColor: colors.hairline, backgroundColor: colors.surface.fieldBg },
                active && { borderColor: colors.accent, backgroundColor: colors.accentTint },
              ]}
              onPress={() => onSelect(opt.key)}
              activeOpacity={0.7}
            >
              <Text style={[styles.label, { color: active ? colors.accent : colors.textSecondary }, active && { fontFamily: fontFamily.semibold }]}>
                {opt.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.md,
  },
  wrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    borderWidth: 1,
  },
  label: {
    fontSize: fontSize.sm,
    fontFamily: fontFamily.medium,
  },
});
