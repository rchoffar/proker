import { View, Text, FlatList, TextInput, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Search, SlidersHorizontal } from 'lucide-react-native';
import { FestivalCard } from '../../src/components/finder/FestivalCard';
import { CoupDeCoeurCard } from '../../src/components/tournaments/CoupDeCoeurCard';
import { SectionLabel } from '../../src/components/ui/SectionLabel';
import {
  FestivalFilterSheet,
  DEFAULT_FESTIVAL_FILTERS,
  countActiveFestivalFilters,
} from '../../src/components/finder/FestivalFilterSheet';
import type { FestivalFilterState, BuyInRange } from '../../src/components/finder/FestivalFilterSheet';
import { useAppStore } from '../../src/store/useAppStore';
import { useIsActiveTab } from '../../src/hooks/useIsActiveTab';
import { fontFamily, fontSize, spacing, radius } from '../../src/design-system/theme';
import { useTheme } from '../../src/design-system/ThemeProvider';

function matchesBuyInRange(buyIn: number, range: BuyInRange): boolean {
  switch (range) {
    case 'low':   return buyIn < 500;
    case 'mid':   return buyIn >= 500 && buyIn < 1000;
    case 'high':  return buyIn >= 1000 && buyIn < 3000;
    case 'vhigh': return buyIn >= 3000;
    default:      return true;
  }
}

export default function FestivalsScreen() {
  const { colors } = useTheme();
  const { t } = useTranslation('finder');
  const router = useRouter();
  const { festivals, tournaments, countries, organizers, likedFestivalIds, toggleLikedFestival } = useAppStore();
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<FestivalFilterState>(DEFAULT_FESTIVAL_FILTERS);
  const [filterSheetVisible, setFilterSheetVisible] = useState(false);
  const isActive = useIsActiveTab();

  const tournamentsByFestival = useMemo(() => {
    const map: Record<string, typeof tournaments> = {};
    for (const t of tournaments) {
      (map[t.festivalId] ??= []).push(t);
    }
    return map;
  }, [tournaments]);

  const countryById = useMemo(() => {
    const map: Record<string, (typeof countries)[number]> = {};
    for (const c of countries) map[c.id] = c;
    return map;
  }, [countries]);

  const organizerById = useMemo(() => {
    const map: Record<string, (typeof organizers)[number]> = {};
    for (const o of organizers) map[o.id] = o;
    return map;
  }, [organizers]);

  const filteredFestivals = useMemo(() => {
    let list = festivals;

    if (filters.continents.length > 0) {
      list = list.filter((f) => {
        const country = f.countryId ? countryById[f.countryId] : undefined;
        return country ? filters.continents.includes(country.continent) : false;
      });
    }

    if (filters.countryIds.length > 0) {
      list = list.filter((f) => f.countryId && filters.countryIds.includes(f.countryId));
    }

    if (filters.organizerId) {
      list = list.filter((f) => f.organizerId === filters.organizerId);
    }

    if (filters.buyInRanges.length > 0) {
      list = list.filter((f) => {
        const fTournaments = tournamentsByFestival[f.id] ?? [];
        return fTournaments.some((t) => filters.buyInRanges.some((range) => matchesBuyInRange(t.buyIn, range)));
      });
    }

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((f) => f.name.toLowerCase().includes(q) || (f.location ?? '').toLowerCase().includes(q));
    }

    return list;
  }, [festivals, filters, search, countryById, tournamentsByFestival]);

  const activeFilterCount = countActiveFestivalFilters(filters);
  const showCoupDeCoeur = activeFilterCount === 0 && search.trim() === '';
  const featured = useMemo(() => festivals.find((f) => f.featured) ?? null, [festivals]);
  const featuredTournaments = featured ? tournamentsByFestival[featured.id] ?? [] : [];
  const featuredBuyIns = featuredTournaments.map((t) => t.buyIn);

  if (!isActive) return <View style={styles.screen} />;

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <View style={styles.stack}>
        <Animated.View
          entering={FadeInDown.delay(0).springify().damping(18).stiffness(140)}
          style={styles.header}
        >
          <Text style={[styles.title, { color: colors.textPrimary }]}>{t('title')}</Text>
        </Animated.View>

        <Animated.View
          entering={FadeInDown.delay(60).springify().damping(18).stiffness(140)}
          style={styles.searchRow}
        >
          <View style={[styles.searchContainer, { borderColor: colors.surface.fieldBorder, backgroundColor: colors.surface.fieldBg }]}>
            <Search size={16} color={colors.textTertiary} strokeWidth={1.5} />
            <TextInput
              style={[styles.searchInput, { color: colors.textPrimary }]}
              placeholder={t('searchPlaceholder')}
              placeholderTextColor={colors.textTertiary}
              value={search}
              onChangeText={setSearch}
              clearButtonMode="while-editing"
              returnKeyType="search"
            />
          </View>

          <TouchableOpacity
            style={[
              styles.filterButton,
              { borderColor: colors.surface.fieldBorder, backgroundColor: colors.surface.fieldBg },
              activeFilterCount > 0 && { borderColor: colors.accent, backgroundColor: colors.accentTint },
            ]}
            onPress={() => setFilterSheetVisible(true)}
            activeOpacity={0.7}
          >
            <SlidersHorizontal
              size={15}
              color={activeFilterCount > 0 ? colors.accent : colors.textSecondary}
              strokeWidth={1.5}
            />
            {activeFilterCount > 0 && <View style={[styles.filterDot, { backgroundColor: colors.accent }]} />}
          </TouchableOpacity>
        </Animated.View>

        <Animated.View
          entering={FadeInDown.delay(120).springify().damping(18).stiffness(140)}
          style={styles.listWrapper}
        >
          {filteredFestivals.length === 0 ? (
            <View style={styles.empty}>
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>{t('empty.title')}</Text>
              <Text style={[styles.emptySubText, { color: colors.textTertiary }]}>{t('empty.subtitle')}</Text>
            </View>
          ) : (
            <FlatList
              data={filteredFestivals}
              keyExtractor={(item) => item.id}
              style={styles.list}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
              ListHeaderComponent={
                showCoupDeCoeur && featured ? (
                  <View style={styles.coupDeCoeurWrap}>
                    <SectionLabel style={styles.coupDeCoeurLabel}>{t('featured')}</SectionLabel>
                    <CoupDeCoeurCard
                      festival={featured}
                      organizer={featured.organizerId ? organizerById[featured.organizerId] : undefined}
                      tournamentCount={featuredTournaments.length}
                      buyInRange={featuredBuyIns.length > 0 ? { min: Math.min(...featuredBuyIns), max: Math.max(...featuredBuyIns) } : undefined}
                      onPress={() => router.push(`/festival/${featured.id}`)}
                    />
                    <SectionLabel style={styles.allLabel}>{t('allFestivals')}</SectionLabel>
                  </View>
                ) : null
              }
              renderItem={({ item }) => {
                const fTournaments = tournamentsByFestival[item.id] ?? [];
                const buyIns = fTournaments.map((t) => t.buyIn);
                return (
                  <FestivalCard
                    festival={item}
                    organizer={item.organizerId ? organizerById[item.organizerId] : undefined}
                    tournamentCount={fTournaments.length}
                    buyInRange={buyIns.length > 0 ? { min: Math.min(...buyIns), max: Math.max(...buyIns) } : undefined}
                    liked={likedFestivalIds.includes(item.id)}
                    onPress={() => router.push(`/festival/${item.id}`)}
                    onToggleLike={() => toggleLikedFestival(item.id)}
                  />
                );
              }}
              ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
            />
          )}
        </Animated.View>
      </View>

      <FestivalFilterSheet
        visible={filterSheetVisible}
        filters={filters}
        countries={countries}
        organizers={organizers}
        onApply={(f) => {
          setFilters(f);
          setFilterSheetVisible(false);
        }}
        onClose={() => setFilterSheetVisible(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  stack: {
    flex: 1,
    gap: spacing.sm,
  },
  header: {
    paddingHorizontal: spacing.base,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
  },
  title: {
    fontSize: fontSize.display,
    fontFamily: fontFamily.display,
    letterSpacing: -1,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.base,
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  searchContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    borderRadius: radius.md,
    borderWidth: 1,
    gap: spacing.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: fontSize.base,
    fontFamily: fontFamily.regular,
    padding: 0,
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  filterDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  listWrapper: {
    flex: 1,
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: spacing.base,
    paddingBottom: 120,
  },
  coupDeCoeurWrap: {
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  coupDeCoeurLabel: {
    marginBottom: 2,
  },
  allLabel: {
    marginTop: spacing.md,
    marginBottom: 2,
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  emptyText: {
    fontSize: fontSize.md,
    fontFamily: fontFamily.semibold,
  },
  emptySubText: {
    fontSize: fontSize.sm,
    fontFamily: fontFamily.regular,
  },
});
