import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { SectionLabel } from '../ui/SectionLabel';
import { fontFamily, fontSize, radius, spacing } from '../../design-system/theme';
import { useTheme } from '../../design-system/ThemeProvider';

interface MultiFilterChipGroupProps {
  title: string;
  options: { key: string; label: string }[];
  selected: string[];
  onToggle: (key: string) => void;
  onClear?: () => void;
}

export function MultiFilterChipGroup({ title, options, selected, onToggle, onClear }: MultiFilterChipGroupProps) {
  const { colors } = useTheme();
  const { t } = useTranslation('finder');
  const isAll = selected.length === 0;

  return (
    <View style={styles.container}>
      <SectionLabel>{title}</SectionLabel>
      <View style={styles.wrap}>
        <TouchableOpacity
          style={[
            styles.chip,
            { borderColor: colors.hairline, backgroundColor: colors.surface.fieldBg },
            isAll && { borderColor: colors.accent, backgroundColor: colors.accentTint },
          ]}
          onPress={() => onClear?.()}
          activeOpacity={0.7}
        >
          <Text style={[styles.label, { color: isAll ? colors.accent : colors.textSecondary }, isAll && { fontFamily: fontFamily.semibold }]}>
            {t('filters.all')}
          </Text>
        </TouchableOpacity>
        {options.map((opt) => {
          const active = selected.includes(opt.key);
          return (
            <TouchableOpacity
              key={opt.key}
              style={[
                styles.chip,
                { borderColor: colors.hairline, backgroundColor: colors.surface.fieldBg },
                active && { borderColor: colors.accent, backgroundColor: colors.accentTint },
              ]}
              onPress={() => onToggle(opt.key)}
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
