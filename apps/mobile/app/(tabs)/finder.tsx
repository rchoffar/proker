import { View, Text, FlatList, TextInput, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useMemo, useCallback } from 'react';
import { useFocusEffect } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Search, SlidersHorizontal } from 'lucide-react-native';
import { BackgroundCanvas } from '../../src/components/ui/BackgroundCanvas';
import { TournamentCard } from '../../src/components/finder/TournamentCard';
import { TournamentDetailModal } from '../../src/components/finder/TournamentDetailModal';
import { FilterSheet, DEFAULT_FILTERS, countActiveFilters } from '../../src/components/finder/FilterSheet';
import { AddSessionModal } from '../../src/components/tracker/AddSessionModal';
import { useAppStore } from '../../src/store/useAppStore';
import { colors, fontFamily, fontSize, spacing, radius } from '../../src/design-system/theme';
import type { Tournament, TournamentSession } from '../../src/types';
import type { FilterState } from '../../src/components/finder/FilterSheet';
import type { SaveRecord } from '../../src/components/tracker/AddSessionModal';

export default function FinderScreen() {
  const { tournaments, festivals, sessions, players, countries, organizers, addSession, addStake, addFestival, addTournament, addPlayer } = useAppStore();
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const [filterSheetVisible, setFilterSheetVisible] = useState(false);
  const [selectedTournament, setSelectedTournament] = useState<Tournament | null>(null);
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
    },
    [players, festivals, tournaments, addPlayer, addFestival, addTournament, addSession, addStake]
  );

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <BackgroundCanvas />

      <View key={animKey} style={styles.stack}>
        {/* Header */}
        <Animated.View
          entering={FadeInDown.delay(0).springify().damping(18).stiffness(140)}
          style={styles.header}
        >
          <Text style={styles.title}>Tournois</Text>
        </Animated.View>

        {/* Search + filter row */}
        <Animated.View
          entering={FadeInDown.delay(60).springify().damping(18).stiffness(140)}
          style={styles.searchRow}
        >
          <View style={styles.searchContainer}>
            <Search size={16} color={colors.textOnLightTertiary} strokeWidth={1.5} />
            <TextInput
              style={styles.searchInput}
              placeholder="Rechercher un tournoi..."
              placeholderTextColor={colors.textOnLightTertiary}
              value={search}
              onChangeText={setSearch}
              clearButtonMode="while-editing"
              returnKeyType="search"
            />
          </View>

          <TouchableOpacity
            style={[styles.filterButton, activeFilterCount > 0 && styles.filterButtonActive]}
            onPress={() => setFilterSheetVisible(true)}
            activeOpacity={0.7}
          >
            <SlidersHorizontal
              size={15}
              color={activeFilterCount > 0 ? '#0A0A0F' : colors.textOnLightSecondary}
              strokeWidth={1.5}
            />
            {activeFilterCount > 0 && (
              <Text style={styles.filterCount}>{activeFilterCount}</Text>
            )}
          </TouchableOpacity>
        </Animated.View>

        {/* Tournament list */}
        <Animated.View
          entering={FadeInDown.delay(120).springify().damping(18).stiffness(140)}
          style={styles.listWrapper}
        >
          {filteredTournaments.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>Aucun tournoi trouvé</Text>
              <Text style={styles.emptySubText}>Essayez de modifier vos filtres</Text>
            </View>
          ) : (
            <FlatList
              data={filteredTournaments}
              keyExtractor={(item) => item.id}
              style={styles.list}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
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
          setSelectedTournament(null);
          setShowAddModal(true);
        }}
      />

      <AddSessionModal
        visible={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSave={handleSave}
        festivals={festivals}
        tournaments={tournaments}
        players={players}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bgBase,
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
    color: colors.textOnLight,
    fontSize: fontSize['2xl'],
    fontFamily: fontFamily.extrabold,
    letterSpacing: -0.5,
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
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.08)',
    backgroundColor: 'rgba(0,0,0,0.03)',
    gap: spacing.sm,
  },
  searchInput: {
    flex: 1,
    color: colors.textOnLight,
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
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.10)',
    backgroundColor: 'rgba(0,0,0,0.04)',
  },
  filterButtonActive: {
    borderColor: colors.profit,
    backgroundColor: colors.profit,
  },
  filterCount: {
    color: '#0A0A0F',
    fontSize: fontSize.sm,
    fontFamily: fontFamily.bold,
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
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  emptyText: {
    color: colors.textOnLightSecondary,
    fontSize: fontSize.md,
    fontFamily: fontFamily.semibold,
  },
  emptySubText: {
    color: colors.textOnLightTertiary,
    fontSize: fontSize.sm,
    fontFamily: fontFamily.regular,
  },
});
