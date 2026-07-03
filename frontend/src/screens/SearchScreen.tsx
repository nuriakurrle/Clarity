/**
 * SearchScreen – Verlauf mit echter Suche über die Tagebucheinträge.
 *
 * Lädt alle Einträge (inkl. Stimmung) vom Sentiment-Agenten und filtert
 * live beim Tippen: Gesucht wird in Überschrift und Text, der Suchbegriff
 * wird in den Treffern markiert. Jeder Treffer zeigt Datum, Stimmung,
 * Überschrift (erste Zeile des Eintrags) und einen Textausschnitt rund
 * um die Fundstelle. Die Liste ist zeitlich gruppiert (Heute … Früher).
 */
import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Card, ScreenHeader, SectionLabel } from '../components';
import { SearchBar, SearchEntryCard } from '../components/search';
import { EntryRecord, fetchEntries } from '../services/api';
import { colors } from '../theme/colors';

type Group = 'Heute' | 'Gestern' | 'Diese Woche' | 'Früher';
const GROUP_ORDER: Group[] = ['Heute', 'Gestern', 'Diese Woche', 'Früher'];

type DisplayEntry = {
  id: number;
  group: Group;
  dateLabel: string;
  title: string;
  body: string;
  valence: number | null;
};

/** "YYYY-MM-DD HH:MM:SS" (SQLite) → Date. */
function parseCreatedAt(createdAt: string): Date {
  return new Date(createdAt.replace(' ', 'T'));
}

function startOfDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

function groupFor(date: Date): Group {
  const dayMs = 24 * 60 * 60 * 1000;
  const diffDays = Math.round((startOfDay(new Date()) - startOfDay(date)) / dayMs);
  if (diffDays <= 0) return 'Heute';
  if (diffDays === 1) return 'Gestern';
  if (diffDays < 7) return 'Diese Woche';
  return 'Früher';
}

const dateFormat = new Intl.DateTimeFormat('de-DE', {
  weekday: 'short',
  day: 'numeric',
  month: 'long',
});
const timeFormat = new Intl.DateTimeFormat('de-DE', { hour: '2-digit', minute: '2-digit' });

function toDisplayEntry(e: EntryRecord): DisplayEntry {
  const date = parseCreatedAt(e.created_at);

  // Beim Speichern setzt der EntryScreen die Überschrift als erste Zeile.
  // Einträge ohne eigene Titelzeile bekommen die ersten Worte als Überschrift.
  const [firstLine, ...rest] = e.content.split('\n');
  let title = firstLine.trim();
  let body = rest.join('\n').trim();
  if (!body || title.length > 60) {
    title = title.length > 48 ? `${title.slice(0, 48).trimEnd()}…` : title;
    body = e.content.trim();
  }

  return {
    id: e.id,
    group: groupFor(date),
    dateLabel: `${dateFormat.format(date)} · ${timeFormat.format(date)}`,
    title,
    body,
    valence: e.valence,
  };
}

/** Ausschnitt rund um die erste Fundstelle, damit der Treffer sichtbar ist. */
function makeSnippet(body: string, query: string): string {
  const flat = body.replace(/\s+/g, ' ').trim();
  const max = 150;
  if (!query) {
    return flat.length > max ? `${flat.slice(0, max)}…` : flat;
  }
  const idx = flat.toLowerCase().indexOf(query.toLowerCase());
  if (idx < 0) return flat.length > max ? `${flat.slice(0, max)}…` : flat;

  const start = Math.max(0, idx - 40);
  const end = Math.min(flat.length, idx + query.length + 110);
  return `${start > 0 ? '…' : ''}${flat.slice(start, end)}${end < flat.length ? '…' : ''}`;
}

export default function SearchScreen() {
  const [query, setQuery] = useState('');
  const [entries, setEntries] = useState<DisplayEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetchEntries()
      .then((res) => setEntries(res.entries.map(toDisplayEntry)))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  const q = query.trim();

  const groups = useMemo(() => {
    const needle = q.toLowerCase();
    const filtered = entries.filter(
      (e) =>
        !needle ||
        e.title.toLowerCase().includes(needle) ||
        e.body.toLowerCase().includes(needle)
    );
    return GROUP_ORDER.map((group) => ({
      group,
      items: filtered.filter((e) => e.group === group),
    })).filter((g) => g.items.length > 0);
  }, [entries, q]);

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <ScreenHeader title="Verlauf" />

        <View style={styles.spacer20}>
          <SearchBar value={query} onChangeText={setQuery} placeholder="Suchen" />
        </View>

        {loading ? (
          <ActivityIndicator color={colors.primary} style={styles.loading} />
        ) : error ? (
          <Card style={styles.emptyCard}>
            <Text style={styles.emptyText}>
              Backend nicht erreichbar. Läuft „docker compose up" und bist du im
              selben WLAN?
            </Text>
          </Card>
        ) : groups.length === 0 ? (
          <Card style={styles.emptyCard}>
            <Text style={styles.emptyText}>
              {entries.length === 0
                ? 'Du hast noch keine Einträge geschrieben.'
                : `Keine Einträge mit „${q}" gefunden.`}
            </Text>
          </Card>
        ) : (
          groups.map(({ group, items }) => (
            <View key={group} style={styles.spacer24}>
              <SectionLabel text={group} />
              <View style={styles.spacer10}>
                {items.map((e) => (
                  <SearchEntryCard
                    key={e.id}
                    date={e.dateLabel}
                    title={e.title}
                    snippet={makeSnippet(e.body, q)}
                    valence={e.valence}
                    highlight={q || undefined}
                  />
                ))}
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  scroll: { flexGrow: 1, paddingHorizontal: 20, paddingTop: 8, paddingBottom: 24 },
  spacer20: { marginTop: 20 },
  spacer24: { marginTop: 24 },
  spacer10: { marginTop: 10 },
  loading: { marginTop: 40 },
  emptyCard: { backgroundColor: colors.surfaceAlt, borderWidth: 0, alignItems: 'center', marginTop: 24 },
  emptyText: { fontSize: 14, color: colors.textMuted, textAlign: 'center' },
});
