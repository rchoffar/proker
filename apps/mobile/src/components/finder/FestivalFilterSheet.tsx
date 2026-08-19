import { useState, useEffect, useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import i18n from '../../i18n';
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

const CONTINENT_KEYS = {
  'Europe': 'europe',
  'North America': 'northAmerica',
  'South America': 'southAmerica',
  'Asia': 'asia',
  'Africa': 'africa',
  'Oceania': 'oceania',
} as const satisfies Record<Continent, string>;

const CONTINENT_ORDER: Continent[] = ['Europe', 'North America', 'South America', 'Asia', 'Africa', 'Oceania'];

const BUY_IN_RANGE_KEYS: BuyInRange[] = ['low', 'mid', 'high', 'vhigh'];

// Countries are user-extensible: mock countries resolve through finder:countries.<ISO>,
// user-added ones have no key and fall back to their stored name.
export function countryDisplayName(country: Country): string {
  const key = `finder:countries.${country.code}`;
  return i18n.exists(key) ? (i18n.t as (k: string) => string)(key) : country.name;
}

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
  const { t } = useTranslation('finder');
  const [draft, setDraft] = useState<FestivalFilterState>(filters);

  const continentOptions = useMemo(
    () => CONTINENT_ORDER.map((key) => ({ key, label: t(`continents.${CONTINENT_KEYS[key]}`) })),
    [t]
  );

  const buyInOptions = useMemo(
    () => BUY_IN_RANGE_KEYS.map((key) => ({ key, label: t(`filters.buyInRanges.${key}`) })),
    [t]
  );

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
      title={t('filters.title')}
      footer={
        <TouchableOpacity style={[styles.applyButton, { backgroundColor: colors.accent }]} onPress={() => onApply(draft)} activeOpacity={0.85}>
          <Text style={styles.applyText}>
            {activeCount > 0 ? t('filters.applyWithCount', { count: activeCount }) : t('filters.apply')}
          </Text>
        </TouchableOpacity>
      }
    >
      <View style={styles.resetRow}>
        <TouchableOpacity onPress={() => setDraft(DEFAULT_FESTIVAL_FILTERS)} activeOpacity={0.7} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={[styles.resetText, { color: colors.textSecondary }]}>{t('filters.reset')}</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.body}>
        <MultiFilterChipGroup
          title={t('filters.continent')}
          options={continentOptions}
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
            title={t('filters.country')}
            options={availableCountries.map((c) => ({ key: c.id, label: countryDisplayName(c) }))}
            selected={draft.countryIds}
            onToggle={(key) => setDraft((d) => ({ ...d, countryIds: toggleInArray(d.countryIds, key) }))}
            onClear={() => setDraft((d) => ({ ...d, countryIds: [] }))}
          />
        )}

        <MultiFilterChipGroup
          title={t('filters.buyIn')}
          options={buyInOptions}
          selected={draft.buyInRanges}
          onToggle={(key) => setDraft((d) => ({ ...d, buyInRanges: toggleInArray(d.buyInRanges, key as BuyInRange) }))}
          onClear={() => setDraft((d) => ({ ...d, buyInRanges: [] }))}
        />

        {organizers.length > 0 && (
          <FilterChipGroup
            title={t('filters.organizer')}
            options={[{ key: '__all__', label: t('filters.all') }, ...organizers.map((o) => ({ key: o.id, label: o.name }))]}
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
