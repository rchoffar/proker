import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useCallback, useMemo } from 'react';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { ChevronLeft } from 'lucide-react-native';
import { GlassCard } from '../src/components/ui/GlassCard';
import { StatBadge } from '../src/components/ui/StatBadge';
import { SectionLabel } from '../src/components/ui/SectionLabel';
import { SessionRow } from '../src/components/tracker/SessionRow';
import { StakeRow } from '../src/components/tracker/StakeRow';
import { SessionDetailModal } from '../src/components/tracker/SessionDetailModal';
import { StakeDetailModal } from '../src/components/tracker/StakeDetailModal';
import { AddSessionSheet } from '../src/components/tracker/AddSessionSheet';
import type { SaveRecord } from '../src/components/tracker/AddSessionSheet';
import { useAppStore } from '../src/store/useAppStore';
import { computeWindowedStats } from '../src/lib/stats';
import { formatAmount } from '../src/lib/format';
import { fontFamily, fontSize, spacing, radius } from '../src/design-system/theme';
import { useTheme } from '../src/design-system/ThemeProvider';
import type { Session, Stake } from '../src/types';

type Filter = 'all' | 'tournament' | 'cash' | 'stake';

type ListItem =
  | { kind: 'session'; data: Session }
  | { kind: 'stake'; data: Stake };

function formatMonth(key: string, language: string): string {
  const [year, month] = key.split('-');
  const date = new Date(parseInt(year, 10), parseInt(month, 10) - 1, 1);
  return date.toLocaleDateString(language, { month: 'long', year: 'numeric' });
}

function signedAmount(val: number): string {
  return `${val < 0 ? '-' : '+'}${formatAmount(val)}`;
}

export default function TrackerScreen() {
  const { colors } = useTheme();
  const { t, i18n } = useTranslation('tracker');
  const router = useRouter();
  const {
    sessions, stakes, stats, festivals, tournaments, players,
    updateSession, addFestival, addTournament, addPlayer,
  } = useAppStore();
  const [filter, setFilter] = useState<Filter>('all');
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  const [selectedStake, setSelectedStake] = useState<Stake | null>(null);
  const [editingSession, setEditingSession] = useState<Session | null>(null);

  const windowed90d = useMemo(() => computeWindowedStats(sessions, stakes, 90), [sessions, stakes]);

  const handleEditSave = useCallback(
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
      if (record.session) updateSession(record.session);
      setEditingSession(null);
    },
    [players, festivals, tournaments, addPlayer, addFestival, addTournament, updateSession]
  );

  // Build unified item list
  const items: ListItem[] = [
    ...(filter === 'all' || filter === 'tournament' || filter === 'cash'
      ? sessions
          .filter((s) => filter === 'all' || s.type === filter)
          .map((s): ListItem => ({ kind: 'session', data: s }))
      : []),
    ...(filter === 'all' || filter === 'stake'
      ? stakes.map((s): ListItem => ({ kind: 'stake', data: s }))
      : []),
  ];

  // Group by month
  const grouped = items.reduce((acc, item) => {
    const key = item.data.date.slice(0, 7);
    if (!acc[key]) acc[key] = [];
    acc[key].push(item);
    return acc;
  }, {} as Record<string, ListItem[]>);

  // Sort items within each month by date descending
  for (const key of Object.keys(grouped)) {
    grouped[key].sort((a, b) => b.data.date.localeCompare(a.data.date));
  }

  const months = Object.keys(grouped).sort().reverse();

  const isWindowPositive = windowed90d.totalProfit >= 0;

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.stack}>

          {/* Header */}
          <Animated.View
            entering={FadeInDown.delay(0).springify().damping(18).stiffness(140)}
            style={styles.header}
          >
            <TouchableOpacity
              style={[styles.backButton, { backgroundColor: colors.neutralTileBg }]}
              onPress={() => router.back()}
              activeOpacity={0.7}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <ChevronLeft size={18} color={colors.textSecondary} strokeWidth={2} />
            </TouchableOpacity>
            <Text style={[styles.title, { color: colors.textPrimary }]}>{t('screen.title')}</Text>
          </Animated.View>

          {/* Summary strip */}
          <Animated.View entering={FadeInDown.delay(60).springify().damping(18).stiffness(140)} style={styles.kpiCard}>
            <GlassCard padding={20}>
              <View style={styles.statsRow}>
                <View style={styles.statItem}>
                  <Text style={[styles.statValue, { color: colors.textPrimary }]}>{stats.totalSessions}</Text>
                  <Text style={[styles.statLabel, { color: colors.textTertiary }]}>{t('stats.sessions')}</Text>
                </View>
                <View style={[styles.statDivider, { backgroundColor: colors.hairline }]} />
                <View style={styles.statItem}>
                  <Text style={[styles.statValue, { color: colors.textPrimary }]}>{stats.itmRate.toFixed(0)}%</Text>
                  <Text style={[styles.statLabel, { color: colors.textTertiary }]}>{t('stats.itm')}</Text>
                </View>
                <View style={[styles.statDivider, { backgroundColor: colors.hairline }]} />
                <View style={styles.statItem}>
                  <StatBadge
                    value={signedAmount(windowed90d.totalProfit)}
                    trend={isWindowPositive ? 'up' : 'down'}
                  />
                  <Text style={[styles.statLabel, { color: colors.textTertiary }]}>{t('stats.window90d')}</Text>
                </View>
              </View>
            </GlassCard>
          </Animated.View>

          {/* Filters */}
          <Animated.View
            entering={FadeInDown.delay(120).springify().damping(18).stiffness(140)}
            style={[styles.filters, styles.filtersRow]}
          >
            {(['all', 'tournament', 'cash', 'stake'] as Filter[]).map((f) => {
              const active = filter === f;
              return (
                <TouchableOpacity
                  key={f}
                  style={[
                    styles.filterPill,
                    { borderColor: colors.hairline, backgroundColor: colors.surface.fieldBg },
                    active && { borderColor: colors.accent, backgroundColor: colors.accentTint },
                  ]}
                  onPress={() => setFilter(f)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.filterText, { color: active ? colors.accent : colors.textSecondary }, active && { fontFamily: fontFamily.semibold }]}>
                    {t(`filters.${f}`)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </Animated.View>

          {/* List grouped by month */}
          {months.length === 0 ? (
            <Animated.View
              entering={FadeInDown.delay(180).springify().damping(18).stiffness(140)}
              style={styles.empty}
            >
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>{t('empty.title')}</Text>
              <Text style={[styles.emptySubText, { color: colors.textTertiary }]}>{t('empty.subtitle')}</Text>
            </Animated.View>
          ) : (
            months.map((month, monthIdx) => (
              <Animated.View
                key={month}
                entering={FadeInDown.delay(180 + monthIdx * 60).springify().damping(18).stiffness(140)}
                style={styles.monthGroup}
              >
                <SectionLabel style={styles.monthLabel}>{formatMonth(month, i18n.language)}</SectionLabel>
                <View style={styles.monthSessions}>
                  {grouped[month].map((item) => {
                    if (item.kind === 'session') {
                      const session = item.data;
                      const tournament = session.type === 'tournament'
                        ? tournaments.find((t) => t.id === session.tournamentId)
                        : undefined;
                      const festival = tournament
                        ? festivals.find((f) => f.id === tournament.festivalId)
                        : undefined;
                      return (
                        <SessionRow
                          key={session.id}
                          session={session}
                          festival={festival}
                          tournament={tournament}
                          onPress={() => setSelectedSession(session)}
                        />
                      );
                    }
                    const stake = item.data;
                    const stakePlayer = players.find((p) => p.id === stake.playerId);
                    const stakeTournament = stake.tournamentId
                      ? tournaments.find((t) => t.id === stake.tournamentId)
                      : undefined;
                    const stakeFestival = stake.festivalId
                      ? festivals.find((f) => f.id === stake.festivalId)
                      : stakeTournament
                        ? festivals.find((f) => f.id === stakeTournament.festivalId)
                        : undefined;
                    return (
                      <StakeRow
                        key={stake.id}
                        stake={stake}
                        player={stakePlayer}
                        festival={stakeFestival}
                        tournament={stakeTournament}
                        onPress={() => setSelectedStake(stake)}
                      />
                    );
                  })}
                </View>
              </Animated.View>
            ))
          )}

          <View style={{ height: 120 }} />
        </View>
      </ScrollView>

      <SessionDetailModal
        session={selectedSession}
        festival={selectedSession?.type === 'tournament'
          ? festivals.find((f) => f.id === tournaments.find((t) => t.id === selectedSession.tournamentId)?.festivalId)
          : undefined}
        tournament={selectedSession?.type === 'tournament'
          ? tournaments.find((t) => t.id === selectedSession.tournamentId)
          : undefined}
        players={players}
        onClose={() => setSelectedSession(null)}
        onEdit={() => {
          const session = selectedSession;
          // Close the detail modal first, then open the edit sheet once its
          // dismiss animation has finished — opening both at once makes the
          // native Modal (detail) and the custom BottomSheet (edit) fight
          // each other instead of a clean close-then-open transition.
          setSelectedSession(null);
          setTimeout(() => setEditingSession(session), 350);
        }}
      />

      <AddSessionSheet
        visible={editingSession !== null}
        initialSession={editingSession}
        onClose={() => setEditingSession(null)}
        onSave={handleEditSave}
        festivals={festivals}
        tournaments={tournaments}
        players={players}
      />

      <StakeDetailModal
        stake={selectedStake}
        player={selectedStake ? players.find((p) => p.id === selectedStake.playerId) : undefined}
        festival={selectedStake
          ? selectedStake.festivalId
            ? festivals.find((f) => f.id === selectedStake.festivalId)
            : selectedStake.tournamentId
              ? festivals.find((f) => f.id === tournaments.find((t) => t.id === selectedStake.tournamentId)?.festivalId)
              : undefined
          : undefined}
        tournament={selectedStake?.tournamentId
          ? tournaments.find((t) => t.id === selectedStake.tournamentId)
          : undefined}
        onClose={() => setSelectedStake(null)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: spacing.base,
    paddingTop: spacing.md,
  },
  stack: {
    gap: spacing.sm,
  },
  kpiCard: {
    marginBottom: spacing.md,
  },
  filtersRow: {
    marginBottom: spacing.md,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  backButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: fontSize.display,
    fontFamily: fontFamily.display,
    letterSpacing: -1,
  },

  // Stats
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
    gap: 5,
  },
  statDivider: {
    width: 1,
    height: 32,
  },
  statValue: {
    fontSize: fontSize.lg,
    fontFamily: fontFamily.bold,
  },
  statLabel: {
    fontSize: fontSize.xs,
    fontFamily: fontFamily.medium,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  // Filters
  filters: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  filterPill: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    borderWidth: 1,
  },
  filterText: {
    fontSize: fontSize.sm,
    fontFamily: fontFamily.medium,
  },

  // Month groups
  monthGroup: {
    gap: spacing.sm,
  },
  monthLabel: {
    marginTop: spacing.sm,
    marginBottom: 2,
  },
  monthSessions: {
    gap: spacing.sm,
  },

  // Empty state
  empty: {
    alignItems: 'center',
    paddingVertical: spacing['4xl'],
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
