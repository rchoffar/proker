import { useState, useMemo, useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { ChevronLeft, ChevronRight, PartyPopper, Trophy } from 'lucide-react-native';
import { GlassCard } from '../../src/components/ui/GlassCard';
import { SectionLabel } from '../../src/components/ui/SectionLabel';
import { PlanningCalendar, toIso, startOfWeek, addDays, weekStartFor } from '../../src/components/planning/MonthCalendar';
import type { CalendarMarker, CalendarMode } from '../../src/components/planning/MonthCalendar';
import { SegmentedControl } from '../../src/components/ui/SegmentedControl';
import { TournamentDetailModal } from '../../src/components/finder/TournamentDetailModal';
import { AddSessionSheet } from '../../src/components/tracker/AddSessionSheet';
import type { SaveRecord } from '../../src/components/tracker/AddSessionSheet';
import { useAppStore } from '../../src/store/useAppStore';
import { useIsActiveTab } from '../../src/hooks/useIsActiveTab';
import { formatAmount, formatDateRangeShort, formatDateShort, parseIsoDate } from '../../src/lib/format';
import { fontFamily, fontSize, spacing, radius } from '../../src/design-system/theme';
import { useTheme } from '../../src/design-system/ThemeProvider';
import type { Tournament, TournamentSession } from '../../src/types';

export default function PlanningScreen() {
  const { t, i18n } = useTranslation('planning');
  const { colors } = useTheme();
  const router = useRouter();
  const weekStart = weekStartFor(i18n.language);
  const {
    festivals, tournaments, sessions, players,
    likedFestivalIds, likedTournamentIds,
    addSession, addStake, addFestival, addTournament, addPlayer,
  } = useAppStore();

  const isActive = useIsActiveTab();
  const [viewMode, setViewMode] = useState<CalendarMode>('month');
  const [anchor, setAnchor] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedTournament, setSelectedTournament] = useState<Tournament | null>(null);
  const [addSessionTournament, setAddSessionTournament] = useState<Tournament | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);

  const likedFestivals = useMemo(() => festivals.filter((f) => likedFestivalIds.includes(f.id)), [festivals, likedFestivalIds]);
  const likedTournaments = useMemo(() => tournaments.filter((tn) => likedTournamentIds.includes(tn.id)), [tournaments, likedTournamentIds]);
  const undatedLikedTournaments = useMemo(() => likedTournaments.filter((tn) => !tn.startDate), [likedTournaments]);

  const markers = useMemo<CalendarMarker[]>(() => {
    const result: CalendarMarker[] = [];
    likedFestivals.forEach((f, index) => {
      if (f.startDate) {
        const color = colors.calendarPalette[index % colors.calendarPalette.length];
        result.push({ id: f.id, label: f.name, kind: 'festival', startDate: f.startDate, endDate: f.endDate ?? f.startDate, color });
      }
    });
    for (const tn of likedTournaments) {
      if (tn.startDate) result.push({ id: tn.id, label: tn.name, kind: 'tournament', startDate: tn.startDate, endDate: tn.endDate ?? tn.startDate, color: colors.textSecondary });
    }
    return result;
  }, [likedFestivals, likedTournaments, colors]);

  const rangeStartIso = viewMode === 'month'
    ? toIso(new Date(anchor.getFullYear(), anchor.getMonth(), 1))
    : toIso(startOfWeek(anchor, weekStart));
  const rangeEndIso = viewMode === 'month'
    ? toIso(new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0))
    : toIso(addDays(startOfWeek(anchor, weekStart), 6));

  const listMarkers = useMemo(() => {
    const source = selectedDate
      ? markers.filter((m) => m.startDate <= selectedDate && selectedDate <= m.endDate)
      : markers.filter((m) => m.startDate <= rangeEndIso && m.endDate >= rangeStartIso);
    return [...source].sort((a, b) => (a.startDate < b.startDate ? -1 : 1));
  }, [markers, selectedDate, rangeStartIso, rangeEndIso]);

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
        const tournament = tournaments.find((tn) => tn.id === marker.id);
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
      if (record.newTournament && !tournaments.find((tn) => tn.id === record.newTournament!.id)) {
        addTournament(record.newTournament);
      }
      if (record.session) addSession(record.session);
      if (record.stake) addStake(record.stake);
      setShowAddModal(false);
      setAddSessionTournament(null);
    },
    [players, festivals, tournaments, addPlayer, addFestival, addTournament, addSession, addStake]
  );

  const navigate = (dir: 1 | -1) => {
    setAnchor((a) => (viewMode === 'month'
      ? new Date(a.getFullYear(), a.getMonth() + dir, 1)
      : addDays(a, dir * 7)));
    setSelectedDate(null);
  };

  const handleModeChange = (mode: CalendarMode) => {
    setViewMode(mode);
    setAnchor((a) => {
      const today = new Date();
      const ref = selectedDate
        ? parseIsoDate(selectedDate)
        : today.getFullYear() === a.getFullYear() && today.getMonth() === a.getMonth()
          ? today
          : a;
      return mode === 'week' ? startOfWeek(ref, weekStart) : new Date(ref.getFullYear(), ref.getMonth(), 1);
    });
  };

  const headerLabel = viewMode === 'month'
    ? new Intl.DateTimeFormat(i18n.language === 'fr' ? 'fr-FR' : 'en-US', { month: 'long', year: 'numeric' }).format(anchor)
    : `${formatDateRangeShort(rangeStartIso, rangeEndIso)} ${anchor.getFullYear()}`;

  if (!isActive) return <View style={styles.screen} />;

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.stack}>

          <Animated.View entering={FadeInDown.delay(0).springify().damping(18).stiffness(140)} style={styles.header}>
            <Text style={[styles.title, { color: colors.textPrimary }]}>{t('title')}</Text>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(60).springify().damping(18).stiffness(140)}>
            <GlassCard padding={18}>
              <View style={styles.modeToggle}>
                <SegmentedControl
                  options={[{ key: 'month' as const, label: t('month') }, { key: 'week' as const, label: t('week') }]}
                  value={viewMode}
                  onChange={handleModeChange}
                />
              </View>
              <View style={styles.monthRow}>
                <TouchableOpacity
                  style={[styles.monthNav, { backgroundColor: colors.neutralTileBg }]}
                  onPress={() => navigate(-1)}
                  activeOpacity={0.7}
                >
                  <ChevronLeft size={16} color={colors.textSecondary} strokeWidth={2} />
                </TouchableOpacity>
                <Text style={[styles.monthLabel, { color: colors.textPrimary }]}>{headerLabel}</Text>
                <TouchableOpacity
                  style={[styles.monthNav, { backgroundColor: colors.neutralTileBg }]}
                  onPress={() => navigate(1)}
                  activeOpacity={0.7}
                >
                  <ChevronRight size={16} color={colors.textSecondary} strokeWidth={2} />
                </TouchableOpacity>
              </View>
              <PlanningCalendar
                anchor={anchor}
                mode={viewMode}
                markers={markers}
                selectedDate={selectedDate}
                onSelectDate={(date) => setSelectedDate((d) => (d === date ? null : date))}
                onPressMarker={handleMarkerPress}
              />
            </GlassCard>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(120).springify().damping(18).stiffness(140)} style={styles.section}>
            <SectionLabel style={styles.sectionLabel}>
              {selectedDate ? formatDateShort(selectedDate) : viewMode === 'week' ? t('thisWeek') : t('thisMonth')}
            </SectionLabel>
            {listMarkers.length === 0 ? (
              <View style={styles.empty}>
                <Text style={[styles.emptyText, { color: colors.textTertiary }]}>
                  {selectedDate ? t('emptyDay') : viewMode === 'week' ? t('emptyWeek') : t('emptyMonth')}
                </Text>
              </View>
            ) : (
              <View style={styles.list}>
                {listMarkers.map((marker) => {
                  const tournament = marker.kind === 'tournament' ? tournaments.find((tn) => tn.id === marker.id) : undefined;
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
                              {formatDateRangeShort(marker.startDate, marker.endDate)}
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
              <SectionLabel style={styles.sectionLabel}>{t('dateTbc')}</SectionLabel>
              <View style={styles.list}>
                {undatedLikedTournaments.map((tn) => {
                  const festival = festivals.find((f) => f.id === tn.festivalId);
                  return (
                    <TouchableOpacity key={`undated-${tn.id}`} onPress={() => setSelectedTournament(tn)} activeOpacity={0.75}>
                      <GlassCard padding={14}>
                        <View style={styles.markerRow}>
                          <View style={[styles.markerIcon, { backgroundColor: colors.neutralTileBg }]}>
                            <Trophy size={15} color={colors.textSecondary} strokeWidth={1.5} />
                          </View>
                          <View style={styles.markerInfo}>
                            <Text style={[styles.markerName, { color: colors.textPrimary }]} numberOfLines={1}>{tn.name}</Text>
                            <Text style={[styles.markerMeta, { color: colors.textTertiary }]}>
                              {festival ? `${festival.name} · ` : ''}{formatAmount(tn.buyIn)}
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
  modeToggle: {
    marginBottom: spacing.md,
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
