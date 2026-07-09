/**
 * Monatsgitter im Bubble-Design: Tageszahl klein oben, darunter eine
 * Mini-Mood-Bubble, deren Größe die Intensität codiert (12–26 px) und
 * deren Farbe die Stimmung. Tage ohne Eintrag: kleiner blasser Punkt.
 * Rein darstellend – die Zellen (`cells`) und Tagesdaten kommen vom Screen.
 */
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors } from '../../theme/colors';
import { moodColor, MoodLevel, EMPTY_DAY_COLOR } from '../../theme/moodColors';
import { BubbleDay } from './BubbleDay';

type DayCellData = { level: MoodLevel; intensity: number };

type Props = {
  weekdays: string[];
  /** Zellen Mo-basiert; `null` = leere Zelle (Monatsrand). */
  cells: (number | null)[];
  /** Tag -> Stimmung + Intensität, falls an dem Tag Einträge existieren. */
  dayData: Record<number, DayCellData>;
  selected: number | null;
  onSelect: (day: number) => void;
  /** Heutige Tageszahl, falls der angezeigte Monat der aktuelle ist. */
  today?: number | null;
};

export function CalendarGrid({
  weekdays,
  cells,
  dayData,
  selected,
  onSelect,
  today = null,
}: Props) {
  return (
    <View style={styles.card}>
      <View style={styles.weekRow}>
        {weekdays.map((w) => (
          <Text key={w} style={styles.weekday}>
            {w}
          </Text>
        ))}
      </View>

      <View style={styles.grid}>
        {cells.map((day, i) => {
          if (day == null) {
            return <View key={`e-${i}`} style={styles.cell} />;
          }
          const data = dayData[day];
          const isSelected = day === selected;
          const size = data ? 12 + Math.min(1, Math.max(0, data.intensity)) * 14 : 0; // 12–26 px
          return (
            <TouchableOpacity
              key={day}
              style={styles.cell}
              activeOpacity={0.6}
              onPress={() => onSelect(day)}
              accessibilityRole="button"
              accessibilityLabel={`${day}.`}
            >
              <Text
                style={[
                  styles.dayText,
                  day === today && styles.dayTextToday,
                  isSelected && styles.dayTextSelected,
                ]}
              >
                {day}
              </Text>
              <View style={styles.bubbleSlot}>
                {data ? (
                  <BubbleDay
                    color={moodColor[data.level]}
                    size={size}
                    day={day}
                    selected={isSelected}
                    showLabel={false}
                    onPress={() => onSelect(day)}
                  />
                ) : (
                  <View style={styles.emptyDot} />
                )}
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: 22,
    padding: 12,
    shadowColor: colors.shadow,
    shadowOpacity: 0.06,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  weekRow: { flexDirection: 'row', marginBottom: 8 },
  weekday: {
    flex: 1,
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '600',
    color: colors.textFaint,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: {
    width: `${100 / 7}%`,
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayText: { fontSize: 12, color: colors.textMuted },
  dayTextToday: { fontWeight: '700', color: colors.text },
  dayTextSelected: { fontWeight: '700', color: colors.text },
  bubbleSlot: {
    height: 30,
    marginTop: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: EMPTY_DAY_COLOR,
  },
});
