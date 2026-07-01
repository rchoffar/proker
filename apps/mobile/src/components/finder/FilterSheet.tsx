import { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { BottomSheet } from '../ui/BottomSheet';
import { FilterChipGroup } from './FilterChipGroup';
import { fontFamily, fontSize, spacing, radius } from '../../design-system/theme';
import { useTheme } from '../../design-system/ThemeProvider';
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
  { key: 'all',   label: 'Tout'           },
  { key: 'low',   label: '< 500 €'        },
  { key: 'mid',   label: '500 – 999 €'    },
  { key: 'high',  label: '1k – 2 999 €'   },
  { key: 'vhigh', label: '≥ 3 000 €'      },
];

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
  const { colors } = useTheme();
  const [draft, setDraft] = useState<FilterState>(filters);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reseed the draft each time the sheet opens
    if (visible) setDraft(filters);
  }, [visible, filters]);

  const activeCount = countActiveFilters(draft);

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title="Filtres"
      footer={
        <TouchableOpacity style={[styles.applyButton, { backgroundColor: colors.accent }]} onPress={() => onApply(draft)} activeOpacity={0.85}>
          <Text style={styles.applyText}>
            Appliquer{activeCount > 0 ? ` · ${activeCount} filtre${activeCount > 1 ? 's' : ''}` : ''}
          </Text>
        </TouchableOpacity>
      }
    >
      <View style={styles.resetRow}>
        <TouchableOpacity onPress={() => setDraft(DEFAULT_FILTERS)} activeOpacity={0.7} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={[styles.resetText, { color: colors.textSecondary }]}>Réinitialiser</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.body}>
        <FilterChipGroup
          title="Buy-in"
          options={BUY_IN_OPTIONS}
          selected={draft.buyIn}
          onSelect={(key) => setDraft((d) => ({ ...d, buyIn: key as BuyInRange }))}
        />

        {countries.length > 0 && (
          <FilterChipGroup
            title="Pays"
            options={[{ key: '__all__', label: 'Tout' }, ...countries.map((c) => ({ key: c.id, label: c.name }))]}
            selected={draft.countryId ?? '__all__'}
            onSelect={(key) => setDraft((d) => ({ ...d, countryId: key === '__all__' ? null : key }))}
          />
        )}

        {organizers.length > 0 && (
          <FilterChipGroup
            title="Organisateur"
            options={[{ key: '__all__', label: 'Tout' }, ...organizers.map((o) => ({ key: o.id, label: o.name }))]}
            selected={draft.organizerId ?? '__all__'}
            onSelect={(key) => setDraft((d) => ({ ...d, organizerId: key === '__all__' ? null : key }))}
          />
        )}

        <FilterChipGroup
          title="Festival"
          options={[{ key: '__all__', label: 'Tout' }, ...festivals.map((f) => ({ key: f.id, label: f.name }))]}
          selected={draft.festivalId ?? '__all__'}
          onSelect={(key) => setDraft((d) => ({ ...d, festivalId: key === '__all__' ? null : key }))}
        />
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  resetRow: {
    alignItems: 'flex-end',
    marginBottom: spacing.sm,
  },
  resetText: {
    fontSize: fontSize.sm,
    fontFamily: fontFamily.medium,
  },
  body: {
    gap: spacing.xl,
  },
  applyButton: {
    paddingVertical: spacing.base,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  applyText: {
    color: '#FFFFFF',
    fontSize: fontSize.base,
    fontFamily: fontFamily.bold,
    letterSpacing: 0.2,
  },
});
