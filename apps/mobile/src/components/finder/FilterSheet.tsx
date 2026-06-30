import { useState, useEffect } from 'react';
import { Modal, View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { BlurView } from 'expo-blur';
import { colors, fontFamily, fontSize, spacing, radius } from '../../design-system/theme';
import type { Festival, Country, Organizer } from '../../types';

export type BuyInRange = 'all' | 'low' | 'mid' | 'high' | 'vhigh';

export interface FilterState {
  buyIn: BuyInRange;
  countryId: string | null;
  organizerId: string | null;
  festivalId: string | null;
}

export const DEFAULT_FILTERS: FilterState = {
  buyIn: 'all',
  countryId: null,
  organizerId: null,
  festivalId: null,
};

export function countActiveFilters(filters: FilterState): number {
  let n = 0;
  if (filters.buyIn !== 'all') n++;
  if (filters.countryId !== null) n++;
  if (filters.organizerId !== null) n++;
  if (filters.festivalId !== null) n++;
  return n;
}

const BUY_IN_OPTIONS: { key: BuyInRange; label: string }[] = [
  { key: 'all',   label: 'All'            },
  { key: 'low',   label: '< 500 €'        },
  { key: 'mid',   label: '500 – 999 €'    },
  { key: 'high',  label: '1k – 2 999 €'   },
  { key: 'vhigh', label: '≥ 3 000 €'      },
];

interface ChipGroupProps {
  options: { key: string; label: string }[];
  selected: string;
  onSelect: (key: string) => void;
}

function ChipGroup({ options, selected, onSelect }: ChipGroupProps) {
  return (
    <View style={chipStyles.wrap}>
      {options.map((opt) => {
        const active = opt.key === selected;
        return (
          <TouchableOpacity
            key={opt.key}
            style={[chipStyles.chip, active && chipStyles.chipActive]}
            onPress={() => onSelect(opt.key)}
            activeOpacity={0.7}
          >
            <Text style={[chipStyles.label, active && chipStyles.labelActive]}>
              {opt.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={sectionStyles.container}>
      <Text style={sectionStyles.title}>{title}</Text>
      {children}
    </View>
  );
}

interface Props {
  visible: boolean;
  filters: FilterState;
  festivals: Festival[];
  countries: Country[];
  organizers: Organizer[];
  onApply: (filters: FilterState) => void;
  onClose: () => void;
}

export function FilterSheet({ visible, filters, festivals, countries, organizers, onApply, onClose }: Props) {
  const [draft, setDraft] = useState<FilterState>(filters);

  useEffect(() => {
    if (visible) setDraft(filters);
  }, [visible]);

  const activeCount = countActiveFilters(draft);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.root}>
        <BlurView intensity={90} tint="dark" style={StyleSheet.absoluteFill} />

        {/* Header */}
        <View style={styles.header}>
          <View style={styles.handle} />
          <View style={styles.headerRow}>
            <Text style={styles.headerTitle}>Filters</Text>
            <TouchableOpacity
              onPress={() => setDraft(DEFAULT_FILTERS)}
              activeOpacity={0.7}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={styles.resetText}>Reset</Text>
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView
          contentContainerStyle={styles.body}
          showsVerticalScrollIndicator={false}
        >
          {/* Buy-in */}
          <Section title="Buy-in">
            <ChipGroup
              options={BUY_IN_OPTIONS}
              selected={draft.buyIn}
              onSelect={(key) => setDraft((d) => ({ ...d, buyIn: key as BuyInRange }))}
            />
          </Section>

          {/* Country */}
          {countries.length > 0 && (
            <Section title="Country">
              <ChipGroup
                options={[
                  { key: '__all__', label: 'All' },
                  ...countries.map((c) => ({ key: c.id, label: c.name })),
                ]}
                selected={draft.countryId ?? '__all__'}
                onSelect={(key) => setDraft((d) => ({ ...d, countryId: key === '__all__' ? null : key }))}
              />
            </Section>
          )}

          {/* Organizer */}
          {organizers.length > 0 && (
            <Section title="Organizer">
              <ChipGroup
                options={[
                  { key: '__all__', label: 'All' },
                  ...organizers.map((o) => ({ key: o.id, label: o.name })),
                ]}
                selected={draft.organizerId ?? '__all__'}
                onSelect={(key) => setDraft((d) => ({ ...d, organizerId: key === '__all__' ? null : key }))}
              />
            </Section>
          )}

          {/* Festival */}
          <Section title="Festival">
            <ChipGroup
              options={[
                { key: '__all__', label: 'All' },
                ...festivals.map((f) => ({ key: f.id, label: f.name })),
              ]}
              selected={draft.festivalId ?? '__all__'}
              onSelect={(key) => setDraft((d) => ({ ...d, festivalId: key === '__all__' ? null : key }))}
            />
          </Section>

          <View style={{ height: 24 }} />
        </ScrollView>

        {/* Apply */}
        <View style={styles.footer}>
          <TouchableOpacity style={styles.applyButton} onPress={() => onApply(draft)} activeOpacity={0.8}>
            <Text style={styles.applyText}>
              Apply{activeCount > 0 ? ` · ${activeCount} filter${activeCount > 1 ? 's' : ''}` : ''}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const chipStyles = StyleSheet.create({
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
    borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  chipActive: {
    borderColor: colors.profit,
    backgroundColor: colors.profitBg,
  },
  label: {
    color: colors.textSecondary,
    fontSize: fontSize.sm,
    fontFamily: fontFamily.medium,
  },
  labelActive: {
    color: colors.profit,
    fontFamily: fontFamily.semibold,
  },
});

const sectionStyles = StyleSheet.create({
  container: {
    gap: spacing.md,
  },
  title: {
    color: colors.textTertiary,
    fontSize: fontSize.xs,
    fontFamily: fontFamily.semibold,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
});

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: 'rgba(8,8,14,0.97)',
  },
  header: {
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.07)',
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.20)',
    alignSelf: 'center',
    marginBottom: spacing.md,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.base,
  },
  headerTitle: {
    color: colors.textPrimary,
    fontSize: fontSize.md,
    fontFamily: fontFamily.bold,
  },
  resetText: {
    color: colors.textSecondary,
    fontSize: fontSize.sm,
    fontFamily: fontFamily.medium,
  },
  body: {
    paddingHorizontal: spacing.base,
    paddingTop: spacing.xl,
    gap: spacing['2xl'],
  },
  footer: {
    paddingHorizontal: spacing.base,
    paddingBottom: spacing['2xl'],
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.07)',
  },
  applyButton: {
    backgroundColor: colors.textPrimary,
    paddingVertical: spacing.base,
    borderRadius: radius.lg,
    alignItems: 'center',
  },
  applyText: {
    color: '#0A0A0F',
    fontSize: fontSize.base,
    fontFamily: fontFamily.bold,
    letterSpacing: 0.2,
  },
});
