import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import * as Haptics from 'expo-haptics';
import { fontFamily, fontSize, radius, spacing } from '../../design-system/theme';
import { useTheme } from '../../design-system/ThemeProvider';
import { RANKS } from '../../types';
import type { Rank } from '../../types';

interface Props {
  label?: string;
  value: Rank | null;
  onChange: (rank: Rank) => void;
  // Ranks pressable right now (claim-ordering constraints + category domain). Ranks
  // outside `domain` are not rendered at all; ranks in domain but not allowed are dimmed.
  allowed: Set<Rank>;
  domain?: Rank[];
}

// Ascending 2 → A: picking "a height" reads naturally left-to-right.
const ASCENDING: Rank[] = [...RANKS].reverse();

export function RankGrid({ label, value, onChange, allowed, domain }: Props) {
  const { colors } = useTheme();
  const domainSet = domain ? new Set(domain) : null;
  const ranks = domainSet ? ASCENDING.filter((r) => domainSet.has(r)) : ASCENDING;

  return (
    <View style={styles.wrap}>
      {label ? <Text style={[styles.label, { color: colors.textSecondary }]}>{label}</Text> : null}
      <View style={styles.cells}>
        {ranks.map((rank) => {
          const isSelected = value === rank;
          const isDisabled = !allowed.has(rank);
          return (
            <TouchableOpacity
              key={rank}
              onPress={() => {
                Haptics.selectionAsync();
                onChange(rank);
              }}
              disabled={isDisabled}
              activeOpacity={0.7}
              style={[
                styles.cell,
                { backgroundColor: colors.surface.fieldBg, borderColor: colors.surface.fieldBorder },
                isSelected && { borderColor: colors.accent, backgroundColor: colors.accentTint, borderWidth: 1.5 },
                isDisabled && styles.disabled,
              ]}
            >
              <Text style={[styles.rankText, { color: isSelected ? colors.accent : colors.textPrimary }]}>
                {rank === 'T' ? '10' : rank}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: spacing.sm,
  },
  label: {
    fontSize: fontSize.sm,
    fontFamily: fontFamily.medium,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  cells: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  cell: {
    width: 40,
    height: 44,
    borderRadius: radius.sm,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankText: {
    fontSize: fontSize.md,
    fontFamily: fontFamily.extrabold,
  },
  disabled: {
    opacity: 0.25,
  },
});
