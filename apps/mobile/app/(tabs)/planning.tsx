import { useState, useMemo, useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { ChevronLeft, ChevronRight, PartyPopper, Trophy } from 'lucide-react-native';
import { GlassCard } from '../../src/components/ui/GlassCard';
import { SectionLabel } from '../../src/components/ui/SectionLabel';
import { MonthCalendar, toIso } from '../../src/components/planning/MonthCalendar';
import type { CalendarMarker } from '../../src/components/planning/MonthCalendar';
import { TournamentDetailModal } from '../../src/components/finder/TournamentDetailModal';
import { AddSessionSheet } from '../../src/components/tracker/AddSessionSheet';
import type { SaveRecord } from '../../src/components/tracker/AddSessionSheet';
import { useAppStore } from '../../src/store/useAppStore';
import { useFocusAnimKey } from '../../src/hooks/useFocusAnimKey';
import { formatAmount, formatDateRangeShort, formatDateShort } from '../../src/lib/format';
import { fontFamily, fontSize, spacing, radius } from '../../src/design-system/theme';
import { useTheme } from '../../src/design-system/ThemeProvider';
import type { Tournament, TournamentSession } from '../../src/types';

export default function PlanningScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const {
    festivals, tournaments, sessions, players,
    likedFestivalIds, likedTournamentIds,
    addSession, addStake, addFestival, addTournament, addPlayer,
  } = useAppStore();

  const animKey = useFocusAnimKey();
  const [month, setMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedTournament, setSelectedTournament] = useState<Tournament | null>(null);
  const [addSessionTournament, setAddSessionTournament] = useState<Tournament | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);

  const likedFestivals = useMemo(() => festivals.filter((f) => likedFestivalIds.includes(f.id)), [festivals, likedFestivalIds]);
  const likedTournaments = useMemo(() => tournaments.filter((t) => likedTournamentIds.includes(t.id)), [tournaments, likedTournamentIds]);
  const undatedLikedTournaments = useMemo(() => likedTournaments.filter((t) => !t.startDate), [likedTournaments]);

  const markers = useMemo<CalendarMarker[]>(() => {
    const result: CalendarMarker[] = [];
    likedFestivals.forEach((f, index) => {
      if (f.startDate) {
        const color = colors.calendarPalette[index % colors.calendarPalette.length];
        result.push({ id: f.id, label: f.name, kind: 'festival', startDate: f.startDate, endDate: f.endDate ?? f.startDate, color });
      }
    });
    for (const t of likedTournaments) {
      if (t.startDate) result.push({ id: t.id, label: t.name, kind: 'tournament', startDate: t.startDate, endDate: t.startDate, color: colors.textSecondary });
    }
    return result;
  }, [likedFestivals, likedTournaments, colors]);

  const monthStartIso = toIso(new Date(month.getFullYear(), month.getMonth(), 1));
  const monthEndIso = toIso(new Date(month.getFullYear(), month.getMonth() + 1, 0));

  const listMarkers = useMemo(() => {
    const source = selectedDate
      ? markers.filter((m) => m.startDate <= selectedDate && selectedDate <= m.endDate)
      : markers.filter((m) => m.startDate <= monthEndIso && m.endDate >= monthStartIso);
    return [...source].sort((a, b) => (a.startDate < b.startDate ? -1 : 1));
  }, [markers, selectedDate, monthStartIso, monthEndIso]);

  const tournamentSessions = useMemo(
    () => sessions.filter((s): s is TournamentSession => s.type === 'tournament'),
    [sessions]
  );

  const selectedTournamentSessions = useMemo(
    () => (selectedTournament ? tournamentSessions.filter((s) => s.tournamentId === selectedTournament.id) : []),
    [selectedTournament, tournamentSessions]
  );

  const handleMarkerPress = useCallback(
    (marker: CalendarMarker) => {
      if (marker.kind === 'tournament') {
        const tournament = tournaments.find((t) => t.id === marker.id);
        if (tournament) setSelectedTournament(tournament);
      } else {
        router.push(`/festival/${marker.id}`);
      }
    },
    [tournaments, router]
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

  const monthLabel = month.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View key={animKey} style={styles.stack}>

          <Animated.View entering={FadeInDown.delay(0).springify().damping(18).stiffness(140)} style={styles.header}>
            <Text style={[styles.title, { color: colors.textPrimary }]}>Planning</Text>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(60).springify().damping(18).stiffness(140)}>
            <GlassCard padding={18}>
              <View style={styles.monthRow}>
                <TouchableOpacity
                  style={[styles.monthNav, { backgroundColor: colors.neutralTileBg }]}
                  onPress={() => { setMonth((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1)); setSelectedDate(null); }}
                  activeOpacity={0.7}
                >
                  <ChevronLeft size={16} color={colors.textSecondary} strokeWidth={2} />
                </TouchableOpacity>
                <Text style={[styles.monthLabel, { color: colors.textPrimary }]}>{monthLabel}</Text>
                <TouchableOpacity
                  style={[styles.monthNav, { backgroundColor: colors.neutralTileBg }]}
                  onPress={() => { setMonth((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1)); setSelectedDate(null); }}
                  activeOpacity={0.7}
                >
                  <ChevronRight size={16} color={colors.textSecondary} strokeWidth={2} />
                </TouchableOpacity>
              </View>
              <MonthCalendar
                month={month}
                markers={markers}
                selectedDate={selectedDate}
                onSelectDate={(date) => setSelectedDate((d) => (d === date ? null : date))}
              />
            </GlassCard>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(120).springify().damping(18).stiffness(140)} style={styles.section}>
            <SectionLabel style={styles.sectionLabel}>
              {selectedDate ? formatDateShort(selectedDate) : 'Ce mois-ci'}
            </SectionLabel>
            {listMarkers.length === 0 ? (
              <View style={styles.empty}>
                <Text style={[styles.emptyText, { color: colors.textTertiary }]}>
                  Aucun festival ou tournoi liké {selectedDate ? 'ce jour-là' : 'ce mois-ci'}
                </Text>
              </View>
            ) : (
              <View style={styles.list}>
                {listMarkers.map((marker) => {
                  const tournament = marker.kind === 'tournament' ? tournaments.find((t) => t.id === marker.id) : undefined;
                  return (
                    <TouchableOpacity key={`${marker.kind}-${marker.id}`} onPress={() => handleMarkerPress(marker)} activeOpacity={0.75}>
                      <GlassCard padding={14}>
                        <View style={styles.markerRow}>
                          <View style={[styles.markerIcon, { backgroundColor: marker.kind === 'festival' ? `${marker.color}22` : colors.neutralTileBg }]}>
                            {marker.kind === 'tournament' ? (
                              <Trophy size={15} color={colors.textSecondary} strokeWidth={1.5} />
                            ) : (
                              <PartyPopper size={15} color={marker.color} strokeWidth={1.5} />
                            )}
                          </View>
                          <View style={styles.markerInfo}>
                            <Text style={[styles.markerName, { color: colors.textPrimary }]} numberOfLines={1}>{marker.label}</Text>
                            <Text style={[styles.markerMeta, { color: colors.textTertiary }]}>
                              {marker.kind === 'festival' ? formatDateRangeShort(marker.startDate, marker.endDate) : formatDateShort(marker.startDate)}
                              {tournament ? ` · ${formatAmount(tournament.buyIn)}` : ''}
                            </Text>
                          </View>
                        </View>
                      </GlassCard>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </Animated.View>

          {undatedLikedTournaments.length > 0 && (
            <Animated.View entering={FadeInDown.delay(160).springify().damping(18).stiffness(140)} style={styles.section}>
              <SectionLabel style={styles.sectionLabel}>Date à confirmer</SectionLabel>
              <View style={styles.list}>
                {undatedLikedTournaments.map((t) => {
                  const festival = festivals.find((f) => f.id === t.festivalId);
                  return (
                    <TouchableOpacity key={`undated-${t.id}`} onPress={() => setSelectedTournament(t)} activeOpacity={0.75}>
                      <GlassCard padding={14}>
                        <View style={styles.markerRow}>
                          <View style={[styles.markerIcon, { backgroundColor: colors.neutralTileBg }]}>
                            <Trophy size={15} color={colors.textSecondary} strokeWidth={1.5} />
                          </View>
                          <View style={styles.markerInfo}>
                            <Text style={[styles.markerName, { color: colors.textPrimary }]} numberOfLines={1}>{t.name}</Text>
                            <Text style={[styles.markerMeta, { color: colors.textTertiary }]}>
                              {festival ? `${festival.name} · ` : ''}{formatAmount(t.buyIn)}
                            </Text>
                          </View>
                        </View>
                      </GlassCard>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </Animated.View>
          )}

          <View style={{ height: 120 }} />
        </View>
      </ScrollView>

      <TournamentDetailModal
        tournament={selectedTournament}
        festival={selectedTournament ? festivals.find((f) => f.id === selectedTournament.festivalId) : undefined}
        sessions={selectedTournamentSessions}
        onClose={() => setSelectedTournament(null)}
        onAddSession={() => {
          const tournament = selectedTournament;
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
  content: {
    paddingHorizontal: spacing.base,
    paddingTop: spacing.md,
  },
  stack: {
    gap: spacing.md,
  },
  header: {
    paddingVertical: spacing.sm,
  },
  title: {
    fontSize: fontSize.display,
    fontFamily: fontFamily.display,
    letterSpacing: -1,
  },
  monthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  monthNav: {
    width: 30,
    height: 30,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthLabel: {
    fontSize: fontSize.base,
    fontFamily: fontFamily.bold,
    textTransform: 'capitalize',
  },
  section: {
    gap: spacing.sm,
  },
  sectionLabel: {
    marginLeft: 4,
  },
  list: {
    gap: spacing.sm,
  },
  empty: {
    paddingVertical: spacing.xl,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: fontSize.sm,
    fontFamily: fontFamily.regular,
  },
  markerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  markerIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  markerInfo: {
    flex: 1,
    gap: 2,
  },
  markerName: {
    fontSize: fontSize.base,
    fontFamily: fontFamily.semibold,
  },
  markerMeta: {
    fontSize: fontSize.xs,
    fontFamily: fontFamily.regular,
  },
});
