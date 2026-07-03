import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
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

interface MonthCalendarProps {
  month: Date; // first-of-month anchor
  markers: CalendarMarker[];
  selectedDate: string | null;
  onSelectDate: (date: string) => void;
}

const WEEKDAY_LABELS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

export function toIso(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function buildGrid(month: Date): Date[] {
  const year = month.getFullYear();
  const monthIndex = month.getMonth();
  const firstOfMonth = new Date(year, monthIndex, 1);
  // Monday-first week: JS getDay() is 0=Sunday..6=Saturday, shift so Monday=0
  const firstWeekday = (firstOfMonth.getDay() + 6) % 7;
  const gridStart = new Date(year, monthIndex, 1 - firstWeekday);

  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(gridStart);
    d.setDate(gridStart.getDate() + i);
    return d;
  });
}

export function MonthCalendar({ month, markers, selectedDate, onSelectDate }: MonthCalendarProps) {
  const { colors } = useTheme();
  const grid = buildGrid(month);
  const todayIso = toIso(new Date());
  const monthIndex = month.getMonth();

  const festivalMarkers = markers.filter((m) => m.kind === 'festival');
  const tournamentsByDate = markers
    .filter((m) => m.kind === 'tournament')
    .reduce((acc, m) => {
      (acc[m.startDate] ??= []).push(m);
      return acc;
    }, {} as Record<string, CalendarMarker[]>);

  return (
    <View>
      <View style={styles.weekdayRow}>
        {WEEKDAY_LABELS.map((label, idx) => (
          <Text key={idx} style={[styles.weekdayLabel, { color: colors.textTertiary }]}>{label}</Text>
        ))}
      </View>
      <View style={styles.grid}>
        {grid.map((date) => {
          const iso = toIso(date);
          const inMonth = date.getMonth() === monthIndex;
          const isToday = iso === todayIso;
          const isSelected = iso === selectedDate;
          const dayFestival = festivalMarkers.find((m) => m.startDate <= iso && iso <= m.endDate);
          const dayTournaments = tournamentsByDate[iso] ?? [];

          return (
            <TouchableOpacity
              key={iso}
              style={styles.cell}
              onPress={() => onSelectDate(iso)}
              activeOpacity={0.7}
              disabled={!dayFestival && dayTournaments.length === 0}
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
              <View style={styles.barRow}>
                {dayFestival && (
                  <View
                    style={[
                      styles.bar,
                      { backgroundColor: dayFestival.color },
                      dayFestival.startDate === iso && styles.barStart,
                      dayFestival.endDate === iso && styles.barEnd,
                    ]}
                  />
                )}
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
  dayCircle: {
    width: 30,
    height: 30,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayText: {
    fontSize: fontSize.sm,
    fontFamily: fontFamily.medium,
    fontVariant: ['tabular-nums'],
  },
  barRow: {
    width: '100%',
    height: 5,
  },
  bar: {
    width: '100%',
    height: 5,
  },
  barStart: {
    borderTopLeftRadius: radius.full,
    borderBottomLeftRadius: radius.full,
  },
  barEnd: {
    borderTopRightRadius: radius.full,
    borderBottomRightRadius: radius.full,
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
