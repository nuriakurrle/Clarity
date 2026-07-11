/**
 * InsightScreen – Einblicke aus den echten Agent-Daten.
 *
 *   - Kennzahlen        ← Sentiment-Agent (/entries): Einträge, Wörter, Serie
 *   - Stimmungsverlauf  ← Sentiment-Agent (/mood-profile) als Linien-Diagramm
 *   - Key Themes        ← Sentiment-Agent (/keywords): häufigste Wörter,
 *                          nach Stimmung eingefärbt
 *
 * Zeitraum (Woche/Monat/Jahr) steuert Verlauf, Themen und Kennzahlen.
 */
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AuraHeader, Card } from '../components';
import {
  BigStat,
  KeywordPills,
  MoodLineChart,
  MoodPoint,
  SegmentedControl,
} from '../components/insight';
import {
  KeywordItem,
  MoodProfile,
  fetchEntries,
  fetchKeywords,
  fetchMoodProfile,
} from '../services/api';
import { colors } from '../theme/colors';

type Range = 'Woche' | 'Monat' | 'Jahr';

const RANGES: readonly Range[] = ['Woche', 'Monat', 'Jahr'];
const RANGE_DAYS: Record<Range, number> = { Woche: 7, Monat: 30, Jahr: 365 };
const WEEKDAY_LABELS = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
const MONTH_LABELS = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];
const DAY_MS = 24 * 60 * 60 * 1000;

// --- Hilfen ------------------------------------------------------------------

/** Datum als YYYY-MM-DD in lokaler Zeit (toISOString wäre UTC). */
function localIso(date: Date): string {
  const m = `${date.getMonth() + 1}`.padStart(2, '0');
  const d = `${date.getDate()}`.padStart(2, '0');
  return `${date.getFullYear()}-${m}-${d}`;
}

/** created_at ("YYYY-MM-DD HH:MM:SS", UTC) → Millisekunden. */
const parseUtc = (s: string) => Date.parse(`${s.replace(' ', 'T')}Z`);

/** Montag (lokale Zeit) der Woche, in der das Datum liegt. */
function mondayOf(date: Date): Date {
  const m = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  m.setDate(m.getDate() - ((m.getDay() + 6) % 7));
  return m;
}

/** Zusammenhängende Tage in Folge bis zum letzten Eintrag. */
function calcStreak(localDates: string[]): number {
  const dates = [...new Set(localDates)].sort();
  let streak = 0;
  let expected: string | null = null;
  for (let i = dates.length - 1; i >= 0; i--) {
    if (expected !== null && dates[i] !== expected) break;
    streak++;
    const prev = new Date(`${dates[i]}T12:00:00`);
    prev.setDate(prev.getDate() - 1);
    expected = localIso(prev);
  }
  return streak;
}

/** Kennzahlen (Einträge, Wörter, Serie) aus den Einträgen im Zeitraum. */
function computeStats(
  entries: { content: string; created_at: string }[],
  days: number,
): { entryCount: number; wordCount: number; streak: number } {
  const cutoff = Date.now() - days * DAY_MS;
  const inRange = entries.filter((e) => {
    const ms = parseUtc(e.created_at);
    return !Number.isNaN(ms) && ms >= cutoff;
  });
  const wordCount = inRange.reduce(
    (sum, e) => sum + e.content.trim().split(/\s+/).filter(Boolean).length,
    0,
  );
  const streak = calcStreak(inRange.map((e) => localIso(new Date(parseUtc(e.created_at)))));
  return { entryCount: inRange.length, wordCount, streak };
}

/** Tages-Stimmungen des Agents in Chart-Punkte je Zeitraum umrechnen. */
function buildMoodPoints(profile: MoodProfile, range: Range): MoodPoint[] {
  const days = profile.mood_profile.daily_breakdown; // aufsteigend nach Datum
  if (days.length === 0) return [];

  if (range === 'Jahr') {
    // Nach Monat bündeln, damit die Linie nicht überläuft.
    const buckets = new Map<string, { sum: number; n: number; month: number }>();
    for (const d of days) {
      const key = d.date.slice(0, 7);
      const month = parseInt(d.date.slice(5, 7), 10) - 1;
      const b = buckets.get(key) ?? { sum: 0, n: 0, month };
      b.sum += d.average_valence;
      b.n += 1;
      buckets.set(key, b);
    }
    return [...buckets.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([, b]) => ({ label: MONTH_LABELS[b.month], valence: b.sum / b.n }));
  }

  if (range === 'Woche') {
    return days.map((d) => ({
      label: WEEKDAY_LABELS[new Date(`${d.date}T12:00:00`).getDay()],
      valence: d.average_valence,
    }));
  }

  // Monat: Tagespunkte behalten (die Kurve zeigt weiterhin jede Schwankung),
  // aber die X-Achse pro Kalenderwoche beschriften: Der erste Datenpunkt
  // einer Woche trägt „von–bis" („29.–5."), alle weiteren bleiben leer.
  let lastWeekKey = '';
  return days.map((d) => {
    const monday = mondayOf(new Date(`${d.date}T12:00:00`));
    const key = localIso(monday);
    let label = '';
    if (key !== lastWeekKey) {
      lastWeekKey = key;
      const sunday = new Date(monday);
      sunday.setDate(sunday.getDate() + 6);
      label = `${monday.getDate()}.–${sunday.getDate()}.`;
    }
    return { label, valence: d.average_valence };
  });
}

// --- Screen -----------------------------------------------------------------

export default function InsightScreen() {
  const [range, setRange] = useState<Range>('Woche');
  const [profile, setProfile] = useState<MoodProfile | null>(null);
  const [keywords, setKeywords] = useState<KeywordItem[]>([]);
  const [stats, setStats] = useState({ entryCount: 0, wordCount: 0, streak: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  // Verlauf, Themen und Kennzahlen neu laden, wenn der Zeitraum wechselt
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);

    const days = RANGE_DAYS[range];
    Promise.all([fetchMoodProfile(days), fetchKeywords(days, 10), fetchEntries()])
      .then(([prof, kw, entriesRes]) => {
        if (cancelled) return;
        setProfile(prof);
        setKeywords(kw.keywords);
        setStats(computeStats(entriesRes.entries ?? [], days));
      })
      .catch(() => {
        if (!cancelled) setError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [range]);

  const points = profile ? buildMoodPoints(profile, range) : [];

  return (
    <SafeAreaView style={styles.safe} edges={[]}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <AuraHeader
          label="Diese Woche"
          title="Einblicke"
          subtitle="Muster und Stimmungen aus deinen Einträgen"
        />

        <View style={styles.spacer20}>
          <SegmentedControl options={RANGES} value={range} onChange={setRange} />
        </View>

        <View style={styles.statsRow}>
          <BigStat label="Einträge" value={`${stats.entryCount}`} />
          <BigStat label="Wörter" value={stats.wordCount.toLocaleString('de-DE')} />
          <BigStat label="Tage in Folge" value={`${stats.streak}`} />
        </View>

        <Card
          title="Stimmungsverlauf"
          subtitle={`Stimmung je ${range === 'Jahr' ? 'Monat' : 'Tag'} · 0 = schwer, 100 = leicht`}
          style={styles.spacer16}
        >
          {loading ? (
            <ActivityIndicator color={colors.primary} style={styles.chartLoading} />
          ) : error ? (
            <Text style={styles.hint}>
              Backend nicht erreichbar. Läuft „docker compose up" und bist du im selben WLAN?
            </Text>
          ) : points.length > 0 ? (
            <MoodLineChart data={points} thinLabels={range !== 'Monat'} />
          ) : (
            <Text style={styles.hint}>
              Noch keine Einträge in diesem Zeitraum – schreib deinen ersten!
            </Text>
          )}
        </Card>

        <Card
          title="Key Themes"
          subtitle="Deine häufigsten Wörter, nach Stimmung eingefärbt"
          style={styles.spacer16}
        >
          {loading ? (
            <ActivityIndicator color={colors.primary} style={styles.themesLoading} />
          ) : keywords.length > 0 ? (
            <View style={styles.themesWrap}>
              <KeywordPills items={keywords} />
            </View>
          ) : (
            <Text style={styles.hint}>Noch keine Themen erkannt – schreib ein paar Einträge!</Text>
          )}
        </Card>

        <View style={styles.bottomSpace} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  scroll: { paddingHorizontal: 20, paddingTop: 8 },
  spacer20: { marginTop: 12 },
  spacer16: { marginTop: 16 },
  statsRow: { flexDirection: 'row', gap: 10, marginTop: 16 },
  themesWrap: { marginTop: 4 },
  chartLoading: { height: 200 },
  themesLoading: { height: 60 },
  hint: { fontSize: 14, lineHeight: 20, color: colors.textMuted },
  bottomSpace: { height: 24 },
});
