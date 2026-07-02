import { useState, useEffect, useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { BottomSheet } from '../ui/BottomSheet';
import { FilterChipGroup } from './FilterChipGroup';
import { MultiFilterChipGroup } from './MultiFilterChipGroup';
import { fontFamily, fontSize, spacing, radius } from '../../design-system/theme';
import { useTheme } from '../../design-system/ThemeProvider';
import type { Continent, Country, Organizer } from '../../types';

export type BuyInRange = 'low' | 'mid' | 'high' | 'vhigh';

export interface FestivalFilterState {
  continents: Continent[];
  countryIds: string[];
  buyInRanges: BuyInRange[];
  organizerId: string | null;
}

export const DEFAULT_FESTIVAL_FILTERS: FestivalFilterState = {
  continents: [],
  countryIds: [],
  buyInRanges: [],
  organizerId: null,
};

export function countActiveFestivalFilters(filters: FestivalFilterState): number {
  return (
    filters.continents.length +
    filters.countryIds.length +
    filters.buyInRanges.length +
    (filters.organizerId ? 1 : 0)
  );
}

const CONTINENTS: { key: Continent; label: string }[] = [
  { key: 'Europe', label: 'Europe' },
  { key: 'North America', label: 'Amérique du Nord' },
  { key: 'South America', label: 'Amérique du Sud' },
  { key: 'Asia', label: 'Asie' },
  { key: 'Africa', label: 'Afrique' },
  { key: 'Oceania', label: 'Océanie' },
];

const BUY_IN_OPTIONS: { key: BuyInRange; label: string }[] = [
  { key: 'low',   label: '< 500 €'        },
  { key: 'mid',   label: '500 – 999 €'    },
  { key: 'high',  label: '1k – 2 999 €'   },
  { key: 'vhigh', label: '≥ 3 000 €'      },
];

function toggleInArray<T>(arr: T[], value: T): T[] {
  return arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value];
}

interface Props {
  visible: boolean;
  filters: FestivalFilterState;
  countries: Country[];
  organizers: Organizer[];
  onApply: (filters: FestivalFilterState) => void;
  onClose: () => void;
}

export function FestivalFilterSheet({ visible, filters, countries, organizers, onApply, onClose }: Props) {
  const { colors } = useTheme();
  const [draft, setDraft] = useState<FestivalFilterState>(filters);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reseed the draft each time the sheet opens
    if (visible) setDraft(filters);
  }, [visible, filters]);

  const activeCount = countActiveFestivalFilters(draft);

  const availableCountries = useMemo(
    () => (draft.continents.length === 0 ? countries : countries.filter((c) => draft.continents.includes(c.continent))),
    [countries, draft.continents]
  );

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
        <TouchableOpacity onPress={() => setDraft(DEFAULT_FESTIVAL_FILTERS)} activeOpacity={0.7} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={[styles.resetText, { color: colors.textSecondary }]}>Réinitialiser</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.body}>
        <MultiFilterChipGroup
          title="Continent"
          options={CONTINENTS}
          selected={draft.continents}
          onToggle={(key) =>
            setDraft((d) => ({
              ...d,
              continents: toggleInArray(d.continents, key as Continent),
              countryIds: [],
            }))
          }
          onClear={() => setDraft((d) => ({ ...d, continents: [], countryIds: [] }))}
        />

        {availableCountries.length > 0 && (
          <MultiFilterChipGroup
            title="Pays"
            options={availableCountries.map((c) => ({ key: c.id, label: c.name }))}
            selected={draft.countryIds}
            onToggle={(key) => setDraft((d) => ({ ...d, countryIds: toggleInArray(d.countryIds, key) }))}
            onClear={() => setDraft((d) => ({ ...d, countryIds: [] }))}
          />
        )}

        <MultiFilterChipGroup
          title="Buy-in"
          options={BUY_IN_OPTIONS}
          selected={draft.buyInRanges}
          onToggle={(key) => setDraft((d) => ({ ...d, buyInRanges: toggleInArray(d.buyInRanges, key as BuyInRange) }))}
          onClear={() => setDraft((d) => ({ ...d, buyInRanges: [] }))}
        />

        {organizers.length > 0 && (
          <FilterChipGroup
            title="Organisateur"
            options={[{ key: '__all__', label: 'Tout' }, ...organizers.map((o) => ({ key: o.id, label: o.name }))]}
            selected={draft.organizerId ?? '__all__'}
            onSelect={(key) => setDraft((d) => ({ ...d, organizerId: key === '__all__' ? null : key }))}
          />
        )}
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
