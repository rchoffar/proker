import { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { fontFamily, fontSize, radius, spacing } from '../../design-system/theme';
import { useTheme } from '../../design-system/ThemeProvider';

export interface CalendarMarker {
  id: string;
  label: string;
  kind: 'festival' | 'tournament';
  startDate: string; // ISO yyyy-mm-dd
  endDate: string; // ISO yyyy-mm-dd; equals startDate for single-day markers
  color: string; // distinguishes overlapping/adjacent festivals in the grid and list
}

export type CalendarMode = 'month' | 'week';

interface PlanningCalendarProps {
  anchor: Date; // first-of-month (month mode) or the locale's week start (week mode)
  mode: CalendarMode;
  markers: CalendarMarker[];
  selectedDate: string | null;
  onSelectDate: (date: string) => void;
  onPressMarker?: (marker: CalendarMarker) => void; // week mode: tap on an event block
}

// Locale-dependent first day of the week, as a JS getDay() index (0=Sunday..6=Saturday):
// French calendars start on Monday, US-English ones on Sunday.
export const WEEK_START: Record<'fr' | 'en', number> = { fr: 1, en: 0 };

const LOCALE_TAGS: Record<'fr' | 'en', string> = { fr: 'fr-FR', en: 'en-US' };

function asAppLanguage(language: string): 'fr' | 'en' {
  return language === 'fr' ? 'fr' : 'en';
}

export function weekStartFor(language: string): number {
  return WEEK_START[asAppLanguage(language)];
}

export function toIso(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Start of the week containing `date`, in local time. `weekStart` is a getDay() index
// (see WEEK_START); defaults to Monday.
export function startOfWeek(date: Date, weekStart = 1): Date {
  const shift = (date.getDay() - weekStart + 7) % 7;
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() - shift);
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

function buildGrid(anchor: Date, mode: CalendarMode, weekStart: number): Date[] {
  if (mode === 'week') {
    const start = startOfWeek(anchor, weekStart);
    return Array.from({ length: 7 }, (_, i) => addDays(start, i));
  }
  const year = anchor.getFullYear();
  const monthIndex = anchor.getMonth();
  const firstOfMonth = new Date(year, monthIndex, 1);
  // Offset of the 1st within the locale's week (0 = the grid's first column).
  const firstWeekday = (firstOfMonth.getDay() - weekStart + 7) % 7;
  const gridStart = new Date(year, monthIndex, 1 - firstWeekday);

  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(gridStart);
    d.setDate(gridStart.getDate() + i);
    return d;
  });
}

// Month mode: thin stacked bars under each day.
const MAX_LANES = 3;
const LANE_HEIGHT = 4;
const LANE_GAP = 2;

// Week mode: tall labeled event blocks, Google Calendar style.
const WEEK_EVENT_HEIGHT = 30;
const WEEK_EVENT_GAP = 6;
const WEEK_MAX_LANES = 4;

// Greedy interval partitioning over the markers visible in the grid: each marker keeps
// one lane for its whole span, so its bar is continuous across cells and week rows.
function assignLanes(
  visible: CalendarMarker[],
  maxLanes: number
): { laneById: Map<string, number>; laneCount: number } {
  const sorted = [...visible]
    .sort((a, b) => (a.startDate < b.startDate ? -1 : a.startDate > b.startDate ? 1 : a.id.localeCompare(b.id)));
  const laneEnds: string[] = []; // endDate of the last marker placed in each lane
  const laneById = new Map<string, number>();
  for (const m of sorted) {
    let lane = laneEnds.findIndex((end) => end < m.startDate);
    if (lane === -1) lane = laneEnds.length;
    laneEnds[lane] = m.endDate;
    laneById.set(m.id, lane);
  }
  return { laneById, laneCount: Math.min(laneEnds.length, maxLanes) };
}

function overlapsRange(m: CalendarMarker, startIso: string, endIso: string): boolean {
  return m.startDate <= endIso && m.endDate >= startIso;
}

export function PlanningCalendar({ anchor, mode, markers, selectedDate, onSelectDate, onPressMarker }: PlanningCalendarProps) {
  const { colors } = useTheme();
  const { i18n } = useTranslation();
  const language = asAppLanguage(i18n.language);
  const weekStart = WEEK_START[language];
  const grid = useMemo(() => buildGrid(anchor, mode, weekStart), [anchor, mode, weekStart]);
  const todayIso = toIso(new Date());
  const monthIndex = anchor.getMonth();

  // Narrow weekday initials from Intl, in the locale's column order.
  // 2024-09-01 is a Sunday, so day (1 + weekStart + i) walks the week from its first column.
  const weekdayLabels = useMemo(() => {
    const fmt = new Intl.DateTimeFormat(LOCALE_TAGS[language], { weekday: 'narrow' });
    return Array.from({ length: 7 }, (_, i) => fmt.format(new Date(2024, 8, 1 + weekStart + i)).toUpperCase());
  }, [language, weekStart]);

  const festivalMarkers = useMemo(() => markers.filter((m) => m.kind === 'festival'), [markers]);
  const tournamentMarkers = useMemo(() => markers.filter((m) => m.kind === 'tournament'), [markers]);

  const gridStartIso = toIso(grid[0]);
  const gridEndIso = toIso(grid[grid.length - 1]);

  // Month mode lanes: festivals only (tournaments render as dots).
  const monthLanes = useMemo(
    () => assignLanes(festivalMarkers.filter((m) => overlapsRange(m, gridStartIso, gridEndIso)), MAX_LANES),
    [festivalMarkers, gridStartIso, gridEndIso]
  );

  // Week mode lanes: all markers become labeled blocks, festivals and tournaments alike.
  const weekMarkers = useMemo(
    () => markers.filter((m) => overlapsRange(m, gridStartIso, gridEndIso)),
    [markers, gridStartIso, gridEndIso]
  );
  const weekLanes = useMemo(() => assignLanes(weekMarkers, WEEK_MAX_LANES), [weekMarkers]);

  const weekdayHeader = (
    <View style={styles.weekdayRow}>
      {weekdayLabels.map((label, idx) => (
        <Text key={idx} style={[styles.weekdayLabel, { color: colors.textTertiary }]}>{label}</Text>
      ))}
    </View>
  );

  if (mode === 'week') {
    const isos = grid.map(toIso);
    const eventsHeight = weekLanes.laneCount > 0
      ? weekLanes.laneCount * (WEEK_EVENT_HEIGHT + WEEK_EVENT_GAP) - WEEK_EVENT_GAP
      : 0;

    return (
      <View>
        {weekdayHeader}
        <View style={styles.grid}>
          {grid.map((date) => {
            const iso = toIso(date);
            const isToday = iso === todayIso;
            const isSelected = iso === selectedDate;
            const hasEvents = markers.some((m) => m.startDate <= iso && iso <= m.endDate);

            return (
              <TouchableOpacity
                key={iso}
                style={[styles.cell, styles.weekCell]}
                onPress={() => onSelectDate(iso)}
                activeOpacity={0.7}
                disabled={!hasEvents}
              >
                <View
                  style={[
                    styles.dayCircle,
                    styles.weekDayCircle,
                    isSelected && { backgroundColor: colors.accent },
                    !isSelected && isToday && { borderWidth: 1, borderColor: colors.accent },
                  ]}
                >
                  <Text
                    style={[
                      styles.dayText,
                      styles.weekDayText,
                      { color: colors.textPrimary },
                      isSelected && { color: '#FFFFFF', fontFamily: fontFamily.bold },
                    ]}
                  >
                    {date.getDate()}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
        {eventsHeight > 0 && (
          <View style={[styles.weekEvents, { height: eventsHeight }]}>
            {weekMarkers.map((m) => {
              const lane = weekLanes.laneById.get(m.id);
              if (lane === undefined || lane >= WEEK_MAX_LANES) return null;
              const clippedStart = m.startDate < isos[0];
              const clippedEnd = m.endDate > isos[6];
              const startCol = clippedStart ? 0 : isos.indexOf(m.startDate);
              const endCol = clippedEnd ? 6 : isos.indexOf(m.endDate);
              const isFestival = m.kind === 'festival';

              return (
                <TouchableOpacity
                  key={`${m.kind}-${m.id}`}
                  onPress={() => onPressMarker?.(m)}
                  disabled={!onPressMarker}
                  activeOpacity={0.75}
                  style={[
                    styles.weekEventBar,
                    {
                      left: `${(startCol / 7) * 100}%`,
                      width: `${((endCol - startCol + 1) / 7) * 100}%`,
                      top: lane * (WEEK_EVENT_HEIGHT + WEEK_EVENT_GAP),
                      backgroundColor: isFestival ? `${m.color}22` : colors.neutralTileBg,
                    },
                    clippedStart && styles.weekEventClipStart,
                    clippedEnd && styles.weekEventClipEnd,
                  ]}
                >
                  <Text
                    numberOfLines={1}
                    style={[styles.weekEventText, { color: isFestival ? m.color : colors.textSecondary }]}
                  >
                    {m.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </View>
    );
  }

  const { laneById, laneCount } = monthLanes;
  const laneStackHeight = laneCount > 0 ? laneCount * (LANE_HEIGHT + LANE_GAP) - LANE_GAP : LANE_HEIGHT;

  return (
    <View>
      {weekdayHeader}
      <View style={styles.grid}>
        {grid.map((date) => {
          const iso = toIso(date);
          const inMonth = date.getMonth() === monthIndex;
          const isToday = iso === todayIso;
          const isSelected = iso === selectedDate;
          const dayFestivals = festivalMarkers.filter((m) => m.startDate <= iso && iso <= m.endDate);
          const dayTournaments = tournamentMarkers.filter((m) => m.startDate <= iso && iso <= m.endDate);

          return (
            <TouchableOpacity
              key={iso}
              style={styles.cell}
              onPress={() => onSelectDate(iso)}
              activeOpacity={0.7}
              disabled={dayFestivals.length === 0 && dayTournaments.length === 0}
            >
              <View
                style={[
                  styles.dayCircle,
                  isSelected && { backgroundColor: colors.accent },
                  !isSelected && isToday && { borderWidth: 1, borderColor: colors.accent },
                ]}
              >
                <Text
                  style={[
                    styles.dayText,
                    { color: inMonth ? colors.textPrimary : colors.textTertiary },
                    isSelected && { color: '#FFFFFF', fontFamily: fontFamily.bold },
                  ]}
                >
                  {date.getDate()}
                </Text>
              </View>
              <View style={[styles.laneStack, { height: laneStackHeight }]}>
                {Array.from({ length: laneCount }, (_, lane) => {
                  const m = dayFestivals.find((f) => laneById.get(f.id) === lane);
                  return (
                    <View
                      key={lane}
                      style={[
                        styles.laneSlot,
                        m && { backgroundColor: m.color },
                        m?.startDate === iso && styles.barStart,
                        m?.endDate === iso && styles.barEnd,
                      ]}
                    />
                  );
                })}
              </View>
              <View style={styles.dotsRow}>
                {dayTournaments.length > 0 && <View style={[styles.dot, { backgroundColor: colors.textSecondary }]} />}
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  weekdayRow: {
    flexDirection: 'row',
    marginBottom: spacing.sm,
  },
  weekdayLabel: {
    flex: 1,
    textAlign: 'center',
    fontSize: fontSize.xs,
    fontFamily: fontFamily.semibold,
    textTransform: 'uppercase',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  cell: {
    width: `${100 / 7}%`,
    alignItems: 'center',
    paddingVertical: 4,
    gap: 3,
  },
  weekCell: {
    paddingVertical: 6,
  },
  dayCircle: {
    width: 30,
    height: 30,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  weekDayCircle: {
    width: 38,
    height: 38,
  },
  dayText: {
    fontSize: fontSize.sm,
    fontFamily: fontFamily.medium,
    fontVariant: ['tabular-nums'],
  },
  weekDayText: {
    fontSize: fontSize.base,
  },
  laneStack: {
    width: '100%',
    gap: LANE_GAP,
  },
  laneSlot: {
    width: '100%',
    height: LANE_HEIGHT,
  },
  barStart: {
    borderTopLeftRadius: radius.full,
    borderBottomLeftRadius: radius.full,
  },
  barEnd: {
    borderTopRightRadius: radius.full,
    borderBottomRightRadius: radius.full,
  },
  weekEvents: {
    marginTop: spacing.sm,
    width: '100%',
  },
  weekEventBar: {
    position: 'absolute',
    height: WEEK_EVENT_HEIGHT,
    borderRadius: 8,
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
  },
  weekEventClipStart: {
    borderTopLeftRadius: 0,
    borderBottomLeftRadius: 0,
  },
  weekEventClipEnd: {
    borderTopRightRadius: 0,
    borderBottomRightRadius: 0,
  },
  weekEventText: {
    fontSize: fontSize.xs,
    fontFamily: fontFamily.semibold,
  },
  dotsRow: {
    flexDirection: 'row',
    gap: 3,
    height: 5,
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: radius.full,
  },
});
