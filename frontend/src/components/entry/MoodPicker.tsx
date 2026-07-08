/**
 * Stimmungsauswahl für den Eintrag (Eintrag schreiben).
 *
 * Fünf Farbpunkte entlang der App-Stimmungsskala (Schwer → Sehr gut), passend
 * zur Valence-Skala des Sentiment-Agenten – bewusst reduzierter als Emojis,
 * damit der Footer ruhig bleibt. Die Auswahl ist optional und wird beim
 * Speichern als Zusatz-Kontext an die Analyse übergeben.
 * Erneutes Antippen hebt die Auswahl wieder auf.
 */
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors, moodColor, moodLabel, MoodLevel } from '../../theme/colors';

// Reihenfolge: negativ → positiv (wie eine Skala von links nach rechts)
const MOODS: MoodLevel[] = ['bad', 'low', 'neutral', 'good', 'great'];

type Props = {
  label?: string;
  value: MoodLevel | null;
  onChange: (mood: MoodLevel | null) => void;
};

export function MoodPicker({ label, value, onChange }: Props) {
  return (
    <View style={styles.row}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      {MOODS.map((level) => {
        const active = level === value;
        return (
          <TouchableOpacity
            key={level}
            style={styles.dotHit}
            onPress={() => onChange(active ? null : level)}
            activeOpacity={0.7}
            accessibilityLabel={`Stimmung: ${moodLabel[level]}`}
          >
            <View
              style={[
                styles.dot,
                { backgroundColor: moodColor[level] },
                active ? styles.dotActive : styles.dotInactive,
              ]}
            />
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 2, flexWrap: 'wrap' },
  label: { fontSize: 12, color: colors.textMuted, marginRight: 6 },
  // Punkt klein, Touch-Fläche groß genug (34px)
  dotHit: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: {
    borderRadius: 999,
  },
  dotInactive: {
    width: 14,
    height: 14,
    opacity: 0.35,
  },
  dotActive: {
    width: 22,
    height: 22,
    opacity: 1,
    borderWidth: 2,
    borderColor: colors.surface,
    // weicher Ring, damit die Auswahl auch ohne Emoji klar erkennbar ist
    boxShadow: '0px 0px 0px 2px rgba(31,36,33,0.25)',
  },
});
