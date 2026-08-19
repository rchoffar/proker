import { useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { ChevronDown, Check, Plus } from 'lucide-react-native';
import Animated, { useAnimatedStyle, withTiming, useSharedValue } from 'react-native-reanimated';
import { fontFamily, fontSize, radius, shadow, spacing } from '../../design-system/theme';
import { useTheme } from '../../design-system/ThemeProvider';

interface PickerFieldProps {
  label: string;
  value: string;
  placeholder: string;
  expanded: boolean;
  onToggleExpand: () => void;
  disabled?: boolean;
  children?: React.ReactNode;
}

export function PickerField({ label, value, placeholder, expanded, onToggleExpand, disabled, children }: PickerFieldProps) {
  const { colors } = useTheme();
  const rotation = useSharedValue(expanded ? 180 : 0);

  useEffect(() => {
    rotation.value = withTiming(expanded ? 180 : 0, { duration: 180 });
  }, [expanded, rotation]);

  const chevronStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  return (
    <View style={{ gap: spacing.sm }}>
      <TouchableOpacity
        style={[
          styles.row,
          { borderColor: colors.surface.fieldBorder, backgroundColor: colors.surface.fieldBg },
          disabled && styles.rowDisabled,
        ]}
        onPress={onToggleExpand}
        disabled={disabled}
        activeOpacity={0.7}
      >
        <View style={{ flex: 1 }}>
          <Text style={[styles.label, { color: colors.textTertiary }]}>{label}</Text>
          <Text style={[styles.value, { color: value ? colors.textPrimary : colors.textTertiary }]} numberOfLines={1}>
            {value || placeholder}
          </Text>
        </View>
        <Animated.View style={chevronStyle}>
          <ChevronDown size={18} color={colors.textTertiary} strokeWidth={2} />
        </Animated.View>
      </TouchableOpacity>
      {expanded && !disabled ? children : null}
    </View>
  );
}

interface SearchCreateListProps {
  items: string[];
  selected: string;
  query: string;
  onQueryChange: (v: string) => void;
  onSelect: (v: string) => void;
  onCreate?: (v: string) => void;
  placeholder: string;
}

export function SearchCreateList({
  items,
  selected,
  query,
  onQueryChange,
  onSelect,
  onCreate,
  placeholder,
}: SearchCreateListProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const trimmedQuery = query.trim();
  const filtered = items.filter((i) => i.toLowerCase().includes(query.toLowerCase()));
  const selectedIsNew = selected.length > 0 && !items.includes(selected);
  const showCreate = trimmedQuery.length > 0
    && !items.some((f) => f.toLowerCase() === trimmedQuery.toLowerCase())
    && trimmedQuery.toLowerCase() !== selected.toLowerCase();

  return (
    <View style={styles.searchWrap}>
      <TextInput
        style={[styles.searchInput, { borderColor: colors.surface.fieldBorder, backgroundColor: colors.surface.fieldBg, color: colors.textPrimary }]}
        value={query}
        onChangeText={onQueryChange}
        placeholder={placeholder}
        placeholderTextColor={colors.textTertiary}
      />
      <View style={styles.chipGrid}>
        {selectedIsNew && (
          <TouchableOpacity
            key={`__new__${selected}`}
            style={[styles.chip, { borderColor: colors.accent, backgroundColor: colors.accentTint }]}
            onPress={() => onSelect(selected)}
            activeOpacity={0.7}
          >
            <Check size={11} color={colors.accent} strokeWidth={2.5} />
            <Text style={[styles.chipText, { color: colors.accent, fontFamily: fontFamily.semibold }]}>{selected}</Text>
          </TouchableOpacity>
        )}
        {filtered.map((item) => {
          const isSelected = selected === item;
          return (
            <TouchableOpacity
              key={item}
              style={[
                styles.chip,
                { borderColor: colors.surface.fieldBorder, backgroundColor: colors.surface.fieldBg },
                isSelected && { borderColor: colors.accent, backgroundColor: colors.accentTint },
              ]}
              onPress={() => onSelect(item)}
              activeOpacity={0.7}
            >
              <Text style={[styles.chipText, { color: isSelected ? colors.accent : colors.textSecondary }, isSelected && { fontFamily: fontFamily.semibold }]}>
                {item}
              </Text>
            </TouchableOpacity>
          );
        })}
        {showCreate && onCreate && (
          <TouchableOpacity
            style={[styles.chip, styles.chipCreate, { borderColor: colors.accent }]}
            onPress={() => { onCreate(trimmedQuery); onQueryChange(''); }}
            activeOpacity={0.7}
          >
            <Plus size={11} color={colors.accent} strokeWidth={2.5} />
            <Text style={[styles.chipText, { color: colors.accent }]}>{t('common:createNamed', { name: trimmedQuery })}</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: radius.md,
    ...shadow.field,
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.md,
  },
  rowDisabled: {
    opacity: 0.5,
  },
  label: {
    fontSize: fontSize.xs,
    fontFamily: fontFamily.semibold,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 2,
  },
  value: {
    fontSize: fontSize.base,
    fontFamily: fontFamily.semibold,
  },
  searchWrap: {
    gap: spacing.sm,
    paddingLeft: spacing.sm,
  },
  searchInput: {
    borderWidth: 1,
    borderRadius: radius.md,
    fontFamily: fontFamily.regular,
    fontSize: fontSize.base,
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.sm + 2,
    // Explicit defaults: Fabric recycles native TextInputs across screens, and a recycled
    // instance keeps any letterSpacing/textAlign the previous owner set unless overridden.
    letterSpacing: 0,
    textAlign: 'left',
  },
  chipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    borderWidth: 1,
  },
  chipCreate: {
    borderStyle: 'dashed',
    backgroundColor: 'transparent',
  },
  chipText: {
    fontSize: fontSize.sm,
    fontFamily: fontFamily.medium,
  },
});
