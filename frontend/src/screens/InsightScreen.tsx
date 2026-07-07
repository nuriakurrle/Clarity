/**
 * InsightScreen – Einblicke aus den echten Agent-Daten.
 *
 * Zeigt die ausgewerteten Einblicke aus dem Journaling:
 *   - Stimmungsverlauf   ← Sentiment-Agent (GET /mood-profile)
 *   - Muster & Trigger   ← Pattern-Agent   (GET /patterns/latest)
 *   - Wochenrückblick    ← Digest-Agent    (GET /digest/latest)
 *   - Reflexionsfragen   ← lokale Impulse (bis der Prompt-Agent einen
 *                          GET-Endpoint für gespeicherte Fragen anbietet)
 *
 * UI aus wiederverwendbaren Komponenten:
 *   - geteilt:        ../components (Card, ScreenHeader)
 *   - Insight-eigen:  ../components/insight
 *   - wiederverwendet: ../components/home (Bullet)
 */
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { AuraHeader, Card } from '../components';
import { Bullet } from '../components/home';
import {
  MoodBar,
  MoodBarChart,
  NumberedItem,
  PatternThread,
  SegmentedControl,
  StatBox,
  Tag,
} from '../components/insight';
import {
  Digest,
  MoodProfile,
  PatternResult,
  fetchLatestDigest,
  fetchLatestPatterns,
  fetchMoodProfile,
} from '../services/api';
import { colors, MoodLevel } from '../theme/colors';
import { serif } from '../theme/typography';

type Range = 'Woche' | 'Monat' | 'Jahr';

const RANGES: readonly Range[] = ['Woche', 'Monat', 'Jahr'];
const RANGE_DAYS: Record<Range, number> = { Woche: 7, Monat: 30, Jahr: 365 };
const WEEKDAY_LABELS = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];

const FALLBACK_QUESTIONS = [
  'Was hat dir diese Woche am meisten Energie gegeben?',
  'Welche Situation würdest du gerne noch einmal anders angehen?',
  'Wofür warst du in den letzten Tagen dankbar?',
];

// --- Mapping Agent-Daten -> Chart --------------------------------------------

/** Valenz (-1..+1) auf die fünfstufige Stimmungsskala abbilden. */
function valenceToLevel(valence: number): MoodLevel {
  if (valence >= 0.6) return 'great';
  if (valence >= 0.2) return 'good';
  if (valence >= -0.2) return 'neutral';
  if (valence >= -0.6) return 'low';
  return 'bad';
}

/** Valenz (-1..+1) auf Balkenhöhe (0..1) abbilden. */
const valenceToBarValue = (valence: number) => (valence + 1) / 2;

/** Datum als YYYY-MM-DD in lokaler Zeit (toISOString wäre UTC). */
function localIso(date: Date): string {
  const m = `${date.getMonth() + 1}`.padStart(2, '0');
  const d = `${date.getDate()}`.padStart(2, '0');
  return `${date.getFullYear()}-${m}-${d}`;
}

function buildMoodBars(profile: MoodProfile, range: Range): MoodBar[] {
  const days = profile.mood_profile.daily_breakdown;

  if (range === 'Woche') {
    // Feste Mo-So-Achse der aktuellen Woche; Tage ohne Eintrag bleiben leer.
    const byDate = new Map(days.map((d) => [d.date, d]));
    const today = new Date();
    const monday = new Date(today);
    monday.setDate(today.getDate() - ((today.getDay() + 6) % 7));

    return Array.from({ length: 7 }, (_, i) => {
      const day = new Date(monday);
      day.setDate(monday.getDate() + i);
      const data = byDate.get(localIso(day));
      return {
        label: WEEKDAY_LABELS[day.getDay()],
        level: data ? valenceToLevel(data.average_valence) : 'neutral',
        value: data ? Math.max(0.08, valenceToBarValue(data.average_valence)) : 0,
      };
    });
  }

  // Monat/Jahr: die letzten Tage mit Daten (max. 10 Balken, sonst wird es eng).
  return days.slice(-10).map((d) => ({
    label: `${parseInt(d.date.slice(8, 10), 10)}.`,
    level: valenceToLevel(d.average_valence),
    value: Math.max(0.08, valenceToBarValue(d.average_valence)),
  }));
}

/** „5 Tage in Folge": Kette zusammenhängender Tage bis zum letzten Eintrag. */
function calcStreak(profile: MoodProfile): number {
  const dates = profile.mood_profile.daily_breakdown.map((d) => d.date).sort();
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

/** Valenzänderung (-2..+2) als Prozent der Stimmungsskala, z. B. „+8%". */
function formatMoodChange(profile: MoodProfile): string {
  const change = profile.trend_analysis.valence_change ?? 0;
  const percent = Math.round((change / 2) * 100);
  return `${percent > 0 ? '+' : ''}${percent}%`;
}

type TagItem = { label: string; count?: number };

/** Themen (mit Häufigkeit) & Personen aus dem Pattern-Agent, dedupliziert. */
function patternTags(pattern: PatternResult | null): TagItem[] {
  if (!pattern || pattern.status === 'no_data') return [];
  const counts = pattern.theme_counts ?? {};
  const themes = (pattern.recurring_themes ?? []).map((label) => ({
    label,
    count: counts[label] && counts[label] > 0 ? counts[label] : undefined,
  }));
  const people = (pattern.recurring_people ?? []).map((label) => ({ label, count: undefined }));
  return [...themes, ...people].filter(
    (item, i, arr) => arr.findIndex((x) => x.label === item.label) === i,
  );
}

/** Trigger als lesbare "Auslöser → Reaktion"-Zeilen. */
function patternTriggers(pattern: PatternResult | null): string[] {
  if (!pattern || pattern.status === 'no_data') return [];
  return Object.entries(pattern.triggers ?? {}).map(([trigger, reaction]) =>
    reaction ? `${trigger} → ${reaction}` : trigger,
  );
}

// --- Screen -----------------------------------------------------------------

export default function InsightScreen() {
  const [range, setRange] = useState<Range>('Woche');
  const [profile, setProfile] = useState<MoodProfile | null>(null);
  const [digest, setDigest] = useState<Digest | null>(null);
  const [pattern, setPattern] = useState<PatternResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  // Wochenrückblick & erkannte Muster einmalig laden (unabhängig vom Zeitraum)
  useEffect(() => {
    fetchLatestDigest().then(setDigest).catch(() => {});
    fetchLatestPatterns().then(setPattern).catch(() => {});
  }, []);

  // Stimmungsprofil neu laden, wenn der Zeitraum wechselt
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);
    fetchMoodProfile(RANGE_DAYS[range])
      .then((res) => {
        if (!cancelled) setProfile(res);
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

  const entryCount = profile
    ? profile.mood_profile.daily_breakdown.reduce((sum, d) => sum + d.entry_count, 0)
    : 0;
  const moodChange = profile ? formatMoodChange(profile) : '±0%';
  const themes = patternTags(pattern);
  const triggers = patternTriggers(pattern);

  const digestBullets = digest
    ? [digest.summary, ...digest.growth].filter(Boolean)
    : [];

  return (
    <SafeAreaView style={styles.safe} edges={[]}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <AuraHeader
          label="Diese Woche"
          title="Einblicke"
          subtitle="Muster und Stimmungen aus deinen Einträgen"
        />

        <View style={styles.spacer20}>
          <SegmentedControl options={RANGES} value={range} onChange={setRange} />
        </View>

        <View style={styles.statsRow}>
          <StatBox value={`${entryCount}`} label="Einträge" />
          <StatBox value={`${profile ? calcStreak(profile) : 0}`} label="Tage in Folge" />
          <StatBox
            value={moodChange}
            label="Stimmung"
            highlight={!moodChange.startsWith('-')}
          />
        </View>

        <Card
          title="Stimmungsverlauf"
          subtitle="Durchschnittliche Stimmung pro Tag"
          style={styles.spacer16}
        >
          {loading ? (
            <ActivityIndicator color={colors.primary} style={styles.chartLoading} />
          ) : error ? (
            <Text style={styles.hint}>
              Backend nicht erreichbar. Läuft „docker compose up" und bist du im
              selben WLAN?
            </Text>
          ) : profile && profile.mood_profile.daily_breakdown.length > 0 ? (
            <MoodBarChart data={buildMoodBars(profile, range)} />
          ) : (
            <Text style={styles.hint}>
              Noch keine Einträge in diesem Zeitraum – schreib deinen ersten!
            </Text>
          )}
        </Card>

        <Card style={styles.spacer16}>
          <View style={styles.agentLabelRow}>
            <Ionicons name="share-social-outline" size={13} color={colors.primary} />
            <Text style={styles.agentLabel}>Pattern Agent</Text>
          </View>
          <Text style={styles.patternTitle}>Wiederkehrende Muster</Text>
          <Text style={styles.patternSubtitle}>
            Themen & Auslöser über mehrere Einträge
          </Text>

          {themes.length > 0 || triggers.length > 0 ? (
            <>
              {themes.length > 0 && (
                <View style={styles.threadWrap}>
                  <PatternThread />
                </View>
              )}
              {themes.length > 0 && (
                <View style={styles.tagWrap}>
                  {themes.map((item) => (
                    <Tag key={item.label} label={item.label} count={item.count} />
                  ))}
                </View>
              )}
              {triggers.length > 0 && (
                <View style={styles.triggerList}>
                  {triggers.map((t, i) => (
                    <View key={i} style={styles.triggerRow}>
                      <View style={styles.triggerDot} />
                      <Text style={styles.triggerText}>{t}</Text>
                    </View>
                  ))}
                </View>
              )}
            </>
          ) : (
            <Text style={styles.hint}>Noch keine Muster erkannt.</Text>
          )}
        </Card>

        <Card
          title="Wochenrückblick"
          subtitle="Zusammengefasst aus deinen Einträgen"
          style={styles.spacer16}
        >
          {digestBullets.length > 0 ? (
            digestBullets.map((h, i) => <Bullet key={i} text={h} />)
          ) : (
            <Text style={styles.hint}>Noch kein Wochenrückblick vorhanden.</Text>
          )}
        </Card>

        <Card
          title="Reflexionsfragen"
          subtitle="Impulse für deinen nächsten Eintrag"
          style={styles.spacer16}
        >
          {FALLBACK_QUESTIONS.map((q, i) => (
            <NumberedItem key={i} index={i + 1} text={q} />
          ))}
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
  statsRow: { flexDirection: 'row', gap: 12, marginTop: 16 },
  tagWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  triggerList: { marginTop: 14 },
  agentLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  agentLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: colors.primary,
  },
  patternTitle: {
    fontFamily: serif,
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
    marginTop: 8,
  },
  patternSubtitle: { fontSize: 13, lineHeight: 19, color: colors.textMuted, marginTop: 2 },
  threadWrap: { marginTop: 16, marginBottom: 4, alignItems: 'flex-start' },
  triggerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  triggerDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.warm,
    marginRight: 10,
  },
  triggerText: { flex: 1, fontSize: 14, lineHeight: 20, color: colors.text },
  chartLoading: { height: 140 },
  hint: { fontSize: 14, lineHeight: 20, color: colors.textMuted },
  bottomSpace: { height: 24 },
});
