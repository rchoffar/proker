import { View, Text, FlatList, TextInput, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useMemo, useCallback } from 'react';
import { useFocusEffect } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Search, SlidersHorizontal } from 'lucide-react-native';
import { TournamentCard } from '../../src/components/finder/TournamentCard';
import { TournamentDetailModal } from '../../src/components/finder/TournamentDetailModal';
import { FilterSheet, DEFAULT_FILTERS, countActiveFilters } from '../../src/components/finder/FilterSheet';
import { CoupDeCoeurCard } from '../../src/components/tournaments/CoupDeCoeurCard';
import { SectionLabel } from '../../src/components/ui/SectionLabel';
import { AddSessionSheet } from '../../src/components/tracker/AddSessionSheet';
import { useAppStore } from '../../src/store/useAppStore';
import { fontFamily, fontSize, spacing, radius } from '../../src/design-system/theme';
import { useTheme } from '../../src/design-system/ThemeProvider';
import type { Tournament, TournamentSession } from '../../src/types';
import type { FilterState } from '../../src/components/finder/FilterSheet';
import type { SaveRecord } from '../../src/components/tracker/AddSessionSheet';

export default function FinderScreen() {
  const { colors } = useTheme();
  const { tournaments, festivals, sessions, players, countries, organizers, addSession, addStake, addFestival, addTournament, addPlayer } = useAppStore();
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const [filterSheetVisible, setFilterSheetVisible] = useState(false);
  const [selectedTournament, setSelectedTournament] = useState<Tournament | null>(null);
  const [addSessionTournament, setAddSessionTournament] = useState<Tournament | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [animKey, setAnimKey] = useState(0);

  useFocusEffect(
    useCallback(() => {
      setAnimKey((k) => k + 1);
    }, [])
  );

  const tournamentSessions = useMemo(
    () => sessions.filter((s): s is TournamentSession => s.type === 'tournament'),
    [sessions]
  );

  const timesPlayedMap = useMemo(() => {
    const map: Record<string, number> = {};
    for (const s of tournamentSessions) {
      map[s.tournamentId] = (map[s.tournamentId] ?? 0) + 1;
    }
    return map;
  }, [tournamentSessions]);

  const filteredTournaments = useMemo(() => {
    let list = tournaments;

    if (filters.festivalId) {
      list = list.filter((t) => t.festivalId === filters.festivalId);
    }

    if (filters.buyIn !== 'all') {
      list = list.filter((t) => {
        switch (filters.buyIn) {
          case 'low':   return t.buyIn < 500;
          case 'mid':   return t.buyIn >= 500 && t.buyIn < 1000;
          case 'high':  return t.buyIn >= 1000 && t.buyIn < 3000;
          case 'vhigh': return t.buyIn >= 3000;
          default:      return true;
        }
      });
    }

    if (filters.countryId) {
      const ids = new Set(festivals.filter((f) => f.countryId === filters.countryId).map((f) => f.id));
      list = list.filter((t) => ids.has(t.festivalId));
    }

    if (filters.organizerId) {
      const ids = new Set(festivals.filter((f) => f.organizerId === filters.organizerId).map((f) => f.id));
      list = list.filter((t) => ids.has(t.festivalId));
    }

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((t) => t.name.toLowerCase().includes(q));
    }

    return list;
  }, [tournaments, festivals, filters, search]);

  const activeFilterCount = countActiveFilters(filters);
  const showCoupDeCoeur = activeFilterCount === 0 && search.trim() === '';
  const featured = useMemo(() => tournaments.find((t) => t.featured) ?? null, [tournaments]);

  const selectedFestival = selectedTournament
    ? festivals.find((f) => f.id === selectedTournament.festivalId)
    : undefined;

  const selectedTournamentSessions = useMemo(
    () => selectedTournament
      ? tournamentSessions.filter((s) => s.tournamentId === selectedTournament.id)
      : [],
    [selectedTournament, tournamentSessions]
  );

  const handleSave = useCallback(
    (record: SaveRecord) => {
      for (const p of record.newPlayers ?? []) {
        if (!players.find((existing) => existing.id === p.id)) addPlayer(p);
      }
      if (record.newFestival && !festivals.find((f) => f.id === record.newFestival!.id)) {
        addFestival(record.newFestival);
      }
      if (record.newTournament && !tournaments.find((t) => t.id === record.newTournament!.id)) {
        addTournament(record.newTournament);
      }
      if (record.session) addSession(record.session);
      if (record.stake) addStake(record.stake);
      setShowAddModal(false);
      setAddSessionTournament(null);
    },
    [players, festivals, tournaments, addPlayer, addFestival, addTournament, addSession, addStake]
  );

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <View key={animKey} style={styles.stack}>
        {/* Header */}
        <Animated.View
          entering={FadeInDown.delay(0).springify().damping(18).stiffness(140)}
          style={styles.header}
        >
          <Text style={[styles.title, { color: colors.textPrimary }]}>Tournois</Text>
        </Animated.View>

        {/* Search + filter row */}
        <Animated.View
          entering={FadeInDown.delay(60).springify().damping(18).stiffness(140)}
          style={styles.searchRow}
        >
          <View style={[styles.searchContainer, { borderColor: colors.surface.fieldBorder, backgroundColor: colors.surface.fieldBg }]}>
            <Search size={16} color={colors.textTertiary} strokeWidth={1.5} />
            <TextInput
              style={[styles.searchInput, { color: colors.textPrimary }]}
              placeholder="Rechercher un tournoi..."
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

        {/* Tournament list */}
        <Animated.View
          entering={FadeInDown.delay(120).springify().damping(18).stiffness(140)}
          style={styles.listWrapper}
        >
          {filteredTournaments.length === 0 ? (
            <View style={styles.empty}>
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>Aucun tournoi</Text>
              <Text style={[styles.emptySubText, { color: colors.textTertiary }]}>Essayez de modifier vos filtres</Text>
            </View>
          ) : (
            <FlatList
              data={filteredTournaments}
              keyExtractor={(item) => item.id}
              style={styles.list}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
              ListHeaderComponent={
                showCoupDeCoeur && featured ? (
                  <View style={styles.coupDeCoeurWrap}>
                    <SectionLabel style={styles.coupDeCoeurLabel}>Coup de cœur</SectionLabel>
                    <CoupDeCoeurCard
                      tournament={featured}
                      festival={festivals.find((f) => f.id === featured.festivalId)}
                      onPress={() => setSelectedTournament(featured)}
                    />
                    <SectionLabel style={styles.allLabel}>Tous les tournois</SectionLabel>
                  </View>
                ) : null
              }
              renderItem={({ item }) => (
                <TournamentCard
                  tournament={item}
                  festival={festivals.find((f) => f.id === item.festivalId)}
                  timesPlayed={timesPlayedMap[item.id] ?? 0}
                  onPress={() => setSelectedTournament(item)}
                />
              )}
              ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
            />
          )}
        </Animated.View>
      </View>

      <FilterSheet
        visible={filterSheetVisible}
        filters={filters}
        festivals={festivals}
        countries={countries}
        organizers={organizers}
        onApply={(f) => {
          setFilters(f);
          setFilterSheetVisible(false);
        }}
        onClose={() => setFilterSheetVisible(false)}
      />

      <TournamentDetailModal
        tournament={selectedTournament}
        festival={selectedFestival}
        sessions={selectedTournamentSessions}
        onClose={() => setSelectedTournament(null)}
        onAddSession={() => {
          const tournament = selectedTournament;
          // Close the detail sheet first, then open the add-session sheet once its
          // dismiss animation has finished — opening both at once makes the two
          // BottomSheets fight each other instead of a clean close-then-open transition.
          setSelectedTournament(null);
          setTimeout(() => {
            setAddSessionTournament(tournament);
            setShowAddModal(true);
          }, 350);
        }}
      />

      <AddSessionSheet
        visible={showAddModal}
        onClose={() => { setShowAddModal(false); setAddSessionTournament(null); }}
        onSave={handleSave}
        festivals={festivals}
        tournaments={tournaments}
        players={players}
        initialTournament={addSessionTournament}
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
