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
// Monat: 31, damit das Profil-Fenster auch am 31. den ganzen Monat abdeckt
const RANGE_DAYS: Record<Range, number> = { Woche: 7, Monat: 31, Jahr: 365 };
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

/** Chart-Daten: Punkte + Indizes interpolierter Tage (ohne sichtbaren Dot). */
type ChartData = { points: MoodPoint[]; hiddenDots: number[] };

/** Tages-Stimmungen des Agents in Chart-Punkte je Zeitraum umrechnen. */
function buildMoodPoints(profile: MoodProfile, range: Range): ChartData {
  const days = profile.mood_profile.daily_breakdown; // aufsteigend nach Datum
  if (days.length === 0) return { points: [], hiddenDots: [] };

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
    return {
      points: [...buckets.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([, b]) => ({ label: MONTH_LABELS[b.month], valence: b.sum / b.n })),
      hiddenDots: [],
    };
  }

  if (range === 'Woche') {
    return {
      points: days.map((d) => ({
        label: WEEKDAY_LABELS[new Date(`${d.date}T12:00:00`).getDay()],
        valence: d.average_valence,
      })),
      hiddenDots: [],
    };
  }

  // Monat: der AKTUELLE Kalendermonat, die X-Achse spannt IMMER den ganzen
  // Monat (1. bis Monatsende) – mit vier festen Marken „01 · 10 · 20 · 31"
  // (letzter Tag je nach Monat). Jeder Tag bekommt eine Position; Tage ohne
  // Eintrag werden auf der Linie interpoliert bzw. flach weitergezogen und
  // zeigen keinen Punkt – Punkte gibt es nur an Tagen mit echtem Eintrag.
  const now = new Date();
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const prefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-`;
  const byDay = new Map<number, number>();
  for (const d of days) {
    if (d.date.startsWith(prefix)) {
      byDay.set(parseInt(d.date.slice(8, 10), 10), d.average_valence);
    }
  }
  if (byDay.size === 0) return { points: [], hiddenDots: [] };

  const knownDays = [...byDay.keys()].sort((a, b) => a - b);
  const labelDays = new Set([1, 10, 20, lastDay]);
  const points: MoodPoint[] = [];
  const hiddenDots: number[] = [];
  for (let day = 1; day <= lastDay; day++) {
    let valence: number;
    const known = byDay.get(day);
    if (known != null) {
      valence = known;
    } else {
      hiddenDots.push(day - 1);
      // Lücke füllen: linear zwischen den nächsten Tagen mit Eintrag,
      // vor dem ersten/nach dem letzten Eintrag flach weiterziehen.
      const prev = [...knownDays].reverse().find((k) => k < day);
      const next = knownDays.find((k) => k > day);
      if (prev != null && next != null) {
        const t = (day - prev) / (next - prev);
        valence = byDay.get(prev)! + t * (byDay.get(next)! - byDay.get(prev)!);
      } else {
        valence = byDay.get(prev ?? next!)!;
      }
    }
    const label = labelDays.has(day) ? String(day).padStart(2, '0') : '';
    points.push({ label, valence });
  }
  return { points, hiddenDots };
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

  const { points, hiddenDots } = profile
    ? buildMoodPoints(profile, range)
    : { points: [], hiddenDots: [] };

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
            <MoodLineChart
              data={points}
              thinLabels={range !== 'Monat'}
              hideDotsAtIndex={hiddenDots}
            />
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
