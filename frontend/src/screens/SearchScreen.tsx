/**
 * SearchScreen – statisches Gerüst, noch ohne echte Einträge.
 *
 * Die Such-/Filterlogik und die Listendarstellung sind voll funktionsfähig
 * (siehe `ENTRIES` unten), zeigen aber bewusst keine Mock-Daten – die App
 * hat ja noch keine Tagebucheinträge. Sobald die lokale Datenbank befüllt
 * ist, ersetzt deren Inhalt einfach das leere `ENTRIES`-Array.
 *
 * Die UI besteht aus geteilten Komponenten aus `../components` und den
 * Search-eigenen Bausteinen aus `../components/search`.
 */
import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Card, ScreenHeader, SectionLabel } from '../components';
import { SearchBar, SearchEntryCard } from '../components/search';
import { colors } from '../theme/colors';

type Group = 'Gestern' | 'Letzte Woche' | 'Früher';
const GROUP_ORDER: Group[] = ['Gestern', 'Letzte Woche', 'Früher'];

type Entry = { id: string; group: Group; date: string; title: string; snippet: string };

// Noch keine echten Einträge – kommt später aus der lokalen Datenbank.
const ENTRIES: Entry[] = [];

export default function SearchScreen() {
  const [query, setQuery] = useState('');

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = ENTRIES.filter(
      (e) => !q || e.title.toLowerCase().includes(q) || e.snippet.toLowerCase().includes(q)
    );
    return GROUP_ORDER.map((group) => ({
      group,
      items: filtered.filter((e) => e.group === group),
    })).filter((g) => g.items.length > 0);
  }, [query]);

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <ScreenHeader title="Verlauf" />

        <View style={styles.spacer20}>
          <SearchBar value={query} onChangeText={setQuery} placeholder="Suchen" />
        </View>

        {groups.length === 0 ? (
          <Card style={styles.emptyCard}>
            <Text style={styles.emptyText}>
              {ENTRIES.length === 0
                ? 'Du hast noch keine Einträge geschrieben.'
                : 'Keine Einträge gefunden.'}
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
                    date={e.date}
                    title={e.title}
                    snippet={e.snippet}
                    highlight={query.trim() || undefined}
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
  scroll: { flexGrow: 1, paddingHorizontal: 20, paddingTop: 8 },
  spacer20: { marginTop: 20 },
  spacer24: { marginTop: 24 },
  spacer10: { marginTop: 10 },
  emptyCard: { backgroundColor: colors.surfaceAlt, borderWidth: 0, alignItems: 'center', marginTop: 24 },
  emptyText: { fontSize: 14, color: colors.textMuted, textAlign: 'center' },
});
