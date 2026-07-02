import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { fontFamily, fontSize, radius, spacing } from '../../design-system/theme';
import { useTheme } from '../../design-system/ThemeProvider';

export interface CalendarMarker {
  date: string; // ISO yyyy-mm-dd
  kind: 'festival-start' | 'festival-end' | 'tournament';
  id: string;
  label: string;
}

interface MonthCalendarProps {
  month: Date; // first-of-month anchor
  markers: CalendarMarker[];
  selectedDate: string | null;
  onSelectDate: (date: string) => void;
}

const WEEKDAY_LABELS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

function toIso(date: Date): string {
  return date.toISOString().slice(0, 10);
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

  const markersByDate = markers.reduce((acc, m) => {
    (acc[m.date] ??= []).push(m);
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
          const dayMarkers = markersByDate[iso] ?? [];
          const festivalCount = dayMarkers.filter((m) => m.kind !== 'tournament').length;
          const tournamentCount = dayMarkers.filter((m) => m.kind === 'tournament').length;

          return (
            <TouchableOpacity
              key={iso}
              style={styles.cell}
              onPress={() => onSelectDate(iso)}
              activeOpacity={0.7}
              disabled={dayMarkers.length === 0}
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
              <View style={styles.dotsRow}>
                {festivalCount > 0 && <View style={[styles.dot, { backgroundColor: isSelected ? colors.accent : colors.accent }]} />}
                {tournamentCount > 0 && <View style={[styles.dot, { backgroundColor: colors.neutralChart }]} />}
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
