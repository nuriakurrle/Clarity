/** Eintrags-Vorschau in der Verlaufsliste – Datum, Titel, Snippet mit Suchtreffer-Highlight. */
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors } from '../../theme/colors';
import { serif } from '../../theme/typography';

type Props = {
  date: string;
  title: string;
  snippet: string;
  highlight?: string;
  onPress?: () => void;
};

function renderSnippet(snippet: string, highlight?: string) {
  if (!highlight) return <Text style={styles.snippet}>{snippet}</Text>;

  const parts = snippet.split(new RegExp(`(${escapeRegExp(highlight)})`, 'gi'));
  return (
    <Text style={styles.snippet}>
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

export function SearchEntryCard({ date, title, snippet, highlight, onPress }: Props) {
  return (
    <TouchableOpacity
      style={styles.card}
      onPress={onPress}
      activeOpacity={onPress ? 0.7 : 1}
      disabled={!onPress}
    >
      <Text style={styles.date}>{date}</Text>
      <Text style={styles.title}>{title}</Text>
      {renderSnippet(snippet, highlight)}
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
  date: { fontSize: 12, color: colors.warm, fontWeight: '600', marginBottom: 6 },
  title: { fontFamily: serif, fontSize: 18, color: colors.text, marginBottom: 4 },
  snippet: { fontSize: 14, lineHeight: 20, color: colors.textMuted },
  match: {
    backgroundColor: colors.warmHighlight,
    color: colors.text,
    fontWeight: '600',
  },
});
