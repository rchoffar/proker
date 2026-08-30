import { useState } from 'react';
import { View, Text, TouchableOpacity, Pressable, StyleSheet, type LayoutChangeEvent } from 'react-native';
import { Info } from 'lucide-react-native';
import { TABLE } from '../hand/PokerTable';
import { TableWordmark } from '../table/TableWordmark';
import { fontFamily, fontSize, radius, spacing } from '../../design-system/theme';

// The game's name and its options, on the felt — Mathieu's setup mockup. They used to sit in
// stacked cards below the table, which pushed the CTA off the bottom of the screen while the
// felt held a decorative deck and a dealer chip.
//
// The felt is narrow (the betting line eats 38pt a side), so option labels have to be one
// word. The sentence each one used to carry moves behind the (!) beside the row, into a
// bubble anchored under it — same idea as the seat name bubble next door.

export interface FeltOption {
  key: string;
  label: string;
}

export interface FeltOptionRow {
  key: string;
  label: string;
  options: FeltOption[];
  value: string;
  onChange: (key: string) => void;
  /** Shown by the (!) beside the row label. Without it, no (!) appears. */
  info?: string;
}

interface Props {
  /** Proper noun, deliberately not translated — same rule as the wordmark. */
  gameName: string;
  rows: FeltOptionRow[];
  width: number;
}

export function FeltOptions({ gameName, rows, width }: Props) {
  // Row layouts are measured in this panel's own coordinates, which is all the bubble needs
  // to sit under the row that opened it.
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [rowBottoms, setRowBottoms] = useState<Record<string, number>>({});

  const measure = (key: string) => (e: LayoutChangeEvent) => {
    const { y, height } = e.nativeEvent.layout;
    setRowBottoms((prev) => (prev[key] === y + height ? prev : { ...prev, [key]: y + height }));
  };

  const openInfo = rows.find((r) => r.key === openKey)?.info;

  return (
    <View style={[styles.panel, { width }]}>
      <Text style={styles.gameName} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
        {gameName}
      </Text>
      <TableWordmark />

      {rows.map((row) => (
        <View key={row.key} style={styles.row} onLayout={measure(row.key)}>
          <View style={styles.rowHeader}>
            <Text style={styles.rowLabel}>{row.label}</Text>
            {row.info ? (
              <TouchableOpacity
                onPress={() => setOpenKey((k) => (k === row.key ? null : row.key))}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                activeOpacity={0.7}
              >
                <Info size={13} color={TABLE.gold} strokeWidth={2.2} />
              </TouchableOpacity>
            ) : null}
          </View>
          <View style={styles.chips}>
            {row.options.map((option) => {
              const active = option.key === row.value;
              return (
                <TouchableOpacity
                  key={option.key}
                  style={[styles.chip, active ? styles.chipActive : styles.chipIdle]}
                  onPress={() => row.onChange(option.key)}
                  activeOpacity={0.8}
                >
                  <Text
                    style={[styles.chipText, { color: active ? TABLE.gold : TABLE.plateText }]}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.8}
                  >
                    {option.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      ))}

      {openKey && openInfo ? (
        <>
          <Pressable style={styles.dismiss} onPress={() => setOpenKey(null)} />
          <View style={[styles.bubble, { top: (rowBottoms[openKey] ?? 0) + 4 }]}>
            <Text style={styles.bubbleText}>{openInfo}</Text>
          </View>
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    alignItems: 'stretch',
  },
  gameName: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.xl,
    color: TABLE.plateText,
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  row: {
    marginTop: spacing.base,
  },
  rowHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginBottom: 6,
  },
  rowLabel: {
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.xs,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.55)',
  },
  chips: {
    flexDirection: 'row',
    gap: 6,
  },
  chip: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 7,
    paddingHorizontal: 4,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  chipIdle: {
    borderColor: 'rgba(255,255,255,0.2)',
    backgroundColor: 'rgba(8,12,10,0.45)',
  },
  chipActive: {
    borderColor: TABLE.gold,
    backgroundColor: 'rgba(231,195,111,0.16)',
  },
  chipText: {
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.sm,
  },
  // Covers the panel so a tap anywhere off the bubble closes it; the bubble paints above.
  dismiss: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 10,
  },
  bubble: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 11,
    backgroundColor: 'rgba(8,12,10,0.96)',
    borderWidth: 1,
    borderColor: TABLE.goldDeep,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  bubbleText: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.xs,
    lineHeight: 15,
    color: TABLE.plateText,
  },
});
