/**
 * Eintrags-Vorschau in der Verlaufsliste.
 *
 * Zeigt pro Treffer: Datum, Stimmung (farbiger Punkt + Label aus der
 * Sentiment-Analyse), Überschrift und Textausschnitt. Der aktuelle
 * Suchbegriff wird in Überschrift UND Text markiert.
 */
import React from 'react';
import { StyleProp, StyleSheet, Text, TextStyle, TouchableOpacity, View } from 'react-native';
import { colors, moodColor, moodLabel, valenceToMoodLevel } from '../../theme/colors';
import { serif } from '../../theme/typography';

type Props = {
  date: string;
  title: string;
  snippet: string;
  /** Valenz aus der Sentiment-Analyse (-1..+1); ohne Wert kein Stimmungs-Badge. */
  valence?: number | null;
  highlight?: string;
  onPress?: () => void;
};

function renderHighlighted(text: string, style: StyleProp<TextStyle>, highlight?: string) {
  if (!highlight) return <Text style={style}>{text}</Text>;

  const parts = text.split(new RegExp(`(${escapeRegExp(highlight)})`, 'gi'));
  return (
    <Text style={style}>
      {parts.map((part, i) =>
        part.toLowerCase() === highlight.toLowerCase() ? (
          <Text key={i} style={styles.match}>
            {part}
          </Text>
        ) : (
          part
        )
      )}
    </Text>
  );
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function SearchEntryCard({ date, title, snippet, valence, highlight, onPress }: Props) {
  const level = valence != null ? valenceToMoodLevel(valence) : null;

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={onPress}
      activeOpacity={onPress ? 0.7 : 1}
      disabled={!onPress}
    >
      <View style={styles.headerRow}>
        <Text style={styles.date}>{date}</Text>
        {level ? (
          <View style={styles.moodBadge}>
            <View style={[styles.moodDot, { backgroundColor: moodColor[level] }]} />
            <Text style={styles.moodText}>{moodLabel[level]}</Text>
          </View>
        ) : null}
      </View>
      {renderHighlighted(title, styles.title, highlight)}
      {snippet ? renderHighlighted(snippet, styles.snippet, highlight) : null}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.warmSofter,
    borderRadius: 18,
    padding: 16,
    marginBottom: 12,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  date: { fontSize: 12, color: colors.warm, fontWeight: '600' },
  moodBadge: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  moodDot: { width: 8, height: 8, borderRadius: 4 },
  moodText: { fontSize: 12, color: colors.textMuted, fontWeight: '500' },
  title: { fontFamily: serif, fontSize: 18, color: colors.text, marginBottom: 4 },
  snippet: { fontSize: 14, lineHeight: 20, color: colors.textMuted },
  match: {
    backgroundColor: colors.warmHighlight,
    color: colors.text,
    fontWeight: '600',
  },
});
