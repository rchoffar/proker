import { View, Text, StyleSheet } from 'react-native';
import { fontFamily, fontSize, spacing, radius } from '../../design-system/theme';
import { useTheme } from '../../design-system/ThemeProvider';
import type { BlindStructure } from '../../types';

interface Props {
  structure: BlindStructure;
}

function Cell({ text, flex = 1, color }: { text: string; flex?: number; color: string }) {
  return (
    <Text style={[styles.cell, { flex, color }]} numberOfLines={1}>
      {text}
    </Text>
  );
}

export function BlindStructureTable({ structure }: Props) {
  const { colors } = useTheme();

  return (
    <View>
      <View style={styles.summaryRow}>
        <View style={styles.summaryItem}>
          <Text style={[styles.summaryLabel, { color: colors.textTertiary }]}>Stack de départ</Text>
          <Text style={[styles.summaryValue, { color: colors.textPrimary }]}>{structure.startingStack.toLocaleString('fr-FR')}</Text>
        </View>
        <View style={styles.summaryItem}>
          <Text style={[styles.summaryLabel, { color: colors.textTertiary }]}>Durée niveau</Text>
          <Text style={[styles.summaryValue, { color: colors.textPrimary }]}>{structure.levelDurationMinutes} min</Text>
        </View>
        <View style={styles.summaryItem}>
          <Text style={[styles.summaryLabel, { color: colors.textTertiary }]}>Niveaux</Text>
          <Text style={[styles.summaryValue, { color: colors.textPrimary }]}>{structure.levels.length}</Text>
        </View>
      </View>

      <View style={[styles.table, { borderColor: colors.surface.fieldBorder }]}>
        <View style={[styles.row, styles.headerRow, { borderColor: colors.surface.fieldBorder }]}>
          <Cell text="Niv." flex={0.6} color={colors.textTertiary} />
          <Cell text="SB" color={colors.textTertiary} />
          <Cell text="BB" color={colors.textTertiary} />
          <Cell text="Ante" color={colors.textTertiary} />
          <Cell text="Durée" flex={0.8} color={colors.textTertiary} />
        </View>
        {structure.levels.map((lvl, idx) => (
          <View
            key={lvl.level}
            style={[
              styles.row,
              { borderColor: colors.surface.fieldBorder },
              idx % 2 === 1 && { backgroundColor: colors.neutralTileBg },
            ]}
          >
            <Cell text={`${lvl.level}`} flex={0.6} color={colors.textSecondary} />
            <Cell text={lvl.smallBlind.toLocaleString('fr-FR')} color={colors.textPrimary} />
            <Cell text={lvl.bigBlind.toLocaleString('fr-FR')} color={colors.textPrimary} />
            <Cell text={lvl.ante > 0 ? lvl.ante.toLocaleString('fr-FR') : '—'} color={colors.textSecondary} />
            <Cell text={`${lvl.durationMinutes} min`} flex={0.8} color={colors.textSecondary} />
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  summaryRow: {
    flexDirection: 'row',
    marginBottom: spacing.md,
  },
  summaryItem: {
    flex: 1,
    gap: 3,
  },
  summaryLabel: {
    fontSize: fontSize.xs,
    fontFamily: fontFamily.medium,
  },
  summaryValue: {
    fontSize: fontSize.base,
    fontFamily: fontFamily.bold,
    fontVariant: ['tabular-nums'],
  },
  table: {
    borderWidth: 1,
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
  },
  headerRow: {
    paddingVertical: spacing.xs + 2,
  },
  cell: {
    fontSize: fontSize.xs,
    fontFamily: fontFamily.semibold,
    fontVariant: ['tabular-nums'],
  },
});
