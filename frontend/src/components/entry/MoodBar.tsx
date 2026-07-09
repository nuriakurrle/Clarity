/**
 * MoodBar – Stimmungsauswahl oben im Eintrag („Wie fühlst du dich?").
 *
 * Zeigt die fünf Stimmungsfarben der App-Skala mit Namen (Schwer … Sehr gut)
 * direkt unter dem Datum – transparent auf dem Seiten-Hintergrund (EntryAura),
 * ohne eigene Karte. Nach der Auswahl klappt die Reihe zu einem kleinen Chip
 * zusammen; Antippen des Chips öffnet sie wieder. Erneutes Antippen der
 * aktiven Farbe hebt die Auswahl auf.
 */
import React, { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, moodColor, moodLabel, MoodLevel } from '../../theme/colors';

// Reihenfolge: negativ → positiv (wie eine Skala von links nach rechts)
const MOODS: MoodLevel[] = ['bad', 'low', 'neutral', 'good', 'great'];

type Props = {
  value: MoodLevel | null;
  onChange: (mood: MoodLevel | null) => void;
};

export function MoodBar({ value, onChange }: Props) {
  const [expanded, setExpanded] = useState(true);

  if (!expanded && value) {
    return (
      <TouchableOpacity
        style={styles.chip}
        onPress={() => setExpanded(true)}
        activeOpacity={0.7}
        accessibilityLabel={`Stimmung ändern (aktuell: ${moodLabel[value]})`}
      >
        <View style={[styles.chipDot, { backgroundColor: moodColor[value] }]} />
        <Text style={styles.chipLabel}>{moodLabel[value]}</Text>
        <Ionicons name="chevron-down" size={12} color={colors.textMuted} />
      </TouchableOpacity>
    );
  }

  return (
    <View style={styles.card}>
      <Text style={styles.question}>Wie fühlst du dich?</Text>
      <View style={styles.row}>
        {MOODS.map((level) => {
          const active = level === value;
          return (
            <TouchableOpacity
              key={level}
              style={styles.option}
              onPress={() => {
                if (active) {
                  onChange(null); // Auswahl aufheben, Karte bleibt offen
                } else {
                  onChange(level);
                  setExpanded(false);
                }
              }}
              activeOpacity={0.7}
              accessibilityLabel={`Stimmung: ${moodLabel[level]}`}
            >
              <View
                style={[
                  styles.dot,
                  { backgroundColor: moodColor[level] },
                  active && styles.dotActive,
                ]}
              />
              <Text style={[styles.optionLabel, active && styles.optionLabelActive]}>
                {moodLabel[level]}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // Transparent auf dem Seiten-Hintergrund, keine eigene Karte
  card: {
    marginTop: 12,
  },
  question: { fontSize: 12, fontWeight: '600', color: colors.textMuted, marginBottom: 10 },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  option: { alignItems: 'center', gap: 6, minWidth: 52 },
  dot: { width: 22, height: 22, borderRadius: 11, opacity: 0.85 },
  dotActive: {
    opacity: 1,
    borderWidth: 2,
    borderColor: colors.surface,
    // weicher Ring, damit die Auswahl klar erkennbar ist
    boxShadow: '0px 0px 0px 2px rgba(31,36,33,0.25)',
  },
  optionLabel: { fontSize: 10, color: colors.textFaint },
  optionLabelActive: { color: colors.text, fontWeight: '600' },
  // Eingeklappter Zustand: kleiner Chip unterm Datum (ebenfalls transparent)
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    marginTop: 12,
    paddingVertical: 4,
  },
  chipDot: { width: 12, height: 12, borderRadius: 6 },
  chipLabel: { fontSize: 12, fontWeight: '600', color: colors.text },
});
