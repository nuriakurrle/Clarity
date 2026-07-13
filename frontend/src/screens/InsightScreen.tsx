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
// Mo-first: Index 0 = Montag (Zuordnung via (getDay() + 6) % 7)
const WEEKDAY_LABELS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
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

/** Chart-Daten: Punkte + Indizes interpolierter Positionen (ohne sichtbaren Dot). */
type ChartData = { points: MoodPoint[]; hiddenDots: number[] };

/**
 * Lückenlose Serie über [first..last] aufspannen: Positionen mit bekanntem Wert
 * bekommen einen Punkt, Lücken werden linear interpoliert bzw. vor der ersten/
 * nach der letzten bekannten Position flach weitergezogen (ohne sichtbaren Dot).
 */
function fillSeries(
  byIndex: Map<number, number>,
  first: number,
  last: number,
  labelFor: (index: number) => string,
): ChartData {
  const known = [...byIndex.keys()].sort((a, b) => a - b);
  const points: MoodPoint[] = [];
  const hiddenDots: number[] = [];
  for (let i = first; i <= last; i++) {
    let valence: number;
    const value = byIndex.get(i);
    if (value != null) {
      valence = value;
    } else {
      hiddenDots.push(i - first);
      const prev = [...known].reverse().find((k) => k < i);
      const next = known.find((k) => k > i);
      if (prev != null && next != null) {
        const t = (i - prev) / (next - prev);
        valence = byIndex.get(prev)! + t * (byIndex.get(next)! - byIndex.get(prev)!);
      } else {
        valence = byIndex.get((prev ?? next)!)!;
      }
    }
    points.push({ label: labelFor(i), valence });
  }
  return { points, hiddenDots };
}

/** Tages-Stimmungen des Agents in Chart-Punkte je Zeitraum umrechnen. */
function buildMoodPoints(profile: MoodProfile, range: Range): ChartData {
  const days = profile.mood_profile.daily_breakdown; // aufsteigend nach Datum
  if (days.length === 0) return { points: [], hiddenDots: [] };
  const now = new Date();

  if (range === 'Jahr') {
    // Das AKTUELLE Kalenderjahr: die X-Achse spannt immer Jan–Dez. Alle zwölf
    // Monatsnamen überlappen auf Handybreite, darum Quartalsmarken plus
    // Endmarke: Jan · Apr · Jul · Okt · Dez. Monate ohne Eintrag werden wie in
    // der Monatsansicht interpoliert, ohne sichtbaren Punkt.
    const yearPrefix = `${now.getFullYear()}-`;
    const buckets = new Map<number, { sum: number; n: number }>();
    for (const d of days) {
      if (!d.date.startsWith(yearPrefix)) continue;
      const month = parseInt(d.date.slice(5, 7), 10) - 1;
      const b = buckets.get(month) ?? { sum: 0, n: 0 };
      b.sum += d.average_valence;
      b.n += 1;
      buckets.set(month, b);
    }
    if (buckets.size === 0) return { points: [], hiddenDots: [] };
    const byMonth = new Map([...buckets].map(([m, b]) => [m, b.sum / b.n] as const));
    const labelMonths = new Set([0, 3, 6, 9, 11]);
    return fillSeries(byMonth, 0, 11, (m) => (labelMonths.has(m) ? MONTH_LABELS[m] : ''));
  }

  if (range === 'Woche') {
    // Die AKTUELLE Kalenderwoche: die X-Achse spannt immer Mo–So. Tage ohne
    // Eintrag werden interpoliert und zeigen keinen Punkt.
    const monday = new Date(now);
    monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
    const mondayMs = new Date(`${localIso(monday)}T12:00:00`).getTime();
    const byDay = new Map<number, number>();
    for (const d of days) {
      const idx = Math.round(
        (new Date(`${d.date}T12:00:00`).getTime() - mondayMs) / DAY_MS,
      );
      if (idx >= 0 && idx <= 6) byDay.set(idx, d.average_valence);
    }
    if (byDay.size === 0) return { points: [], hiddenDots: [] };
    return fillSeries(byDay, 0, 6, (i) => WEEKDAY_LABELS[i]);
  }

  // Monat: der AKTUELLE Kalendermonat, die X-Achse spannt IMMER den ganzen
  // Monat (1. bis Monatsende) – mit Marken im Wochenraster „1. · 8. · 15. ·
  // 22. · 29.", also gleichmäßig alle 7 Tage. Tage ohne Eintrag werden
  // interpoliert und zeigen keinen Punkt – Punkte nur an Tagen mit Eintrag.
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const prefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-`;
  const byDay = new Map<number, number>();
  for (const d of days) {
    if (d.date.startsWith(prefix)) {
      byDay.set(parseInt(d.date.slice(8, 10), 10), d.average_valence);
    }
  }
  if (byDay.size === 0) return { points: [], hiddenDots: [] };

  // Wochenraster: alle 7 Tage eine Marke (im Februar entfällt die 29 automatisch)
  const labelDays = new Set([1, 8, 15, 22, 29].filter((d) => d <= lastDay));
  return fillSeries(byDay, 1, lastDay, (d) => (labelDays.has(d) ? `${d}.` : ''));
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
            <MoodLineChart data={points} hideDotsAtIndex={hiddenDots} />
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
