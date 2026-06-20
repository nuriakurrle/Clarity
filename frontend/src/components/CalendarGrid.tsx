/**
 * Monatsgitter: Wochentage + Tageszellen mit Stimmungs-Punkt.
 * Rein darstellend – die Zellen (`cells`) und Stimmungsdaten kommen vom Screen.
 */
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors, MoodLevel } from '../theme/colors';
import { MoodDot } from './MoodDot';

type Props = {
  weekdays: string[];
  /** Zellen Mo-basiert; `null` = leere Zelle (Monatsrand). */
  cells: (number | null)[];
  /** Tag -> Stimmung, falls an dem Tag ein Eintrag existiert. */
  moodByDay: Record<number, MoodLevel>;
  selected: number | null;
  onSelect: (day: number) => void;
};

export function CalendarGrid({
  weekdays,
  cells,
  moodByDay,
  selected,
  onSelect,
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
          const mood = moodByDay[day];
          const isSelected = day === selected;
          return (
            <TouchableOpacity
              key={day}
              style={styles.cell}
              activeOpacity={mood ? 0.6 : 1}
              onPress={() => onSelect(day)}
            >
              <View style={[styles.circle, isSelected && styles.circleSelected]}>
                <Text style={[styles.dayText, isSelected && styles.dayTextSelected]}>
                  {day}
                </Text>
              </View>
              <View style={styles.dotSlot}>
                {mood ? <MoodDot level={mood} /> : null}
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
    borderRadius: 18,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
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
  circle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  circleSelected: { backgroundColor: colors.primary },
  dayText: { fontSize: 15, color: colors.text },
  dayTextSelected: { color: '#fff', fontWeight: '700' },
  dotSlot: { height: 8, marginTop: 2, justifyContent: 'center' },
});
