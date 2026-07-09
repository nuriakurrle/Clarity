/**
 * HomeScreen – wöchentlicher Rückblick aus echten Agent-Daten.
 *
 * Füllt die drei Abschnitte mit Inhalten aus dem Backend:
 *   - Tonverlauf                ← Digest-Agent (Zusammenfassung der Woche)
 *   - Wiederkehrende Themen     ← Digest-Agent (Highlights + Challenges)
 *   - Eine Frage zum Weitertragen ← lokaler Impuls,
 *     mit der Digest-Affirmation als sanftem Abschluss.
 *
 * Bausteine aus `../components/home` (Bullet, QuoteBlock) und der
 * Themen-Chip aus `../components/insight` (Tag).
 */
import React, { useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Card, PrivacyNote, SectionLabel } from '../components';
import { Bullet, QuoteBlock, MoodMirrorBlob } from '../components/home';
import { Tag } from '../components/insight';
import {
  Digest,
  PatternResult,
  fetchEntries,
  fetchLatestDigest,
  fetchLatestPatterns,
} from '../services/api';
import { colors } from '../theme/colors';
import { moodColor, MoodLevel, valenceToMoodLevel } from '../theme/moodColors';
import { serif } from '../theme/typography';

const FALLBACK_QUESTION = 'Was hat dir diese Woche am meisten Energie gegeben?';
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/** Nur Muster dieser Woche auf Home zeigen (created_at ist UTC "YYYY-MM-DD HH:MM:SS"). */
function isWithinLastWeek(createdAt?: string): boolean {
  if (!createdAt) return true; // ohne Zeitstempel nicht ausschliessen
  const ts = Date.parse(`${createdAt.replace(' ', 'T')}Z`);
  if (Number.isNaN(ts)) return true;
  return Date.now() - ts < WEEK_MS;
}

type Props = { onWrite?: () => void };

export default function HomeScreen({ onWrite }: Props) {
  const [digest, setDigest] = useState<Digest | null>(null);
  const [pattern, setPattern] = useState<PatternResult | null>(null);
  const [offline, setOffline] = useState(false);
  // Sichtbare Hoehe, damit der Begruessungs-Hero den ersten Screen ganz fuellt.
  const [viewportH, setViewportH] = useState(0);
  // Dominante Mood-Farbe der Woche – hauchzarter Tint für die Zitat-Boxen,
  // damit sich die Digest-Sektion am Blob-Farbschema orientiert.
  const [weekAccent, setWeekAccent] = useState<string | undefined>();
  // Typewriter-Trigger: werden true, sobald der jeweilige Block in den
  // sichtbaren Bereich scrollt (und bleiben true – einmal pro Sitzung).
  const [typeSummary, setTypeSummary] = useState(false);
  const [typeQuestion, setTypeQuestion] = useState(false);
  const bodyY = useRef(0);
  const summaryY = useRef(0);
  const questionY = useRef(0);

  useEffect(() => {
    fetchLatestDigest()
      .then(setDigest)
      .catch((e) => {
        // Nur bei echtem Verbindungsfehler "offline". Ein HTTP-Fehler wie 404
        // heisst nur: es gibt noch keinen Wochenrueckblick (kein Backend-Problem).
        if (!String(e?.message ?? '').includes('HTTP')) setOffline(true);
      });
    fetchLatestPatterns()
      .then(setPattern)
      .catch(() => {});
    // Häufigste Stimmung der letzten 7 Tage bestimmen (gleiche Logik wie im
    // MoodMirrorBlob: pro Eintrag, valence → 5-Stufen-Level).
    fetchEntries()
      .then((res) => {
        const counts = new Map<MoodLevel, number>();
        for (const e of res.entries ?? []) {
          if (e.valence == null || !isWithinLastWeek(e.created_at)) continue;
          const level = valenceToMoodLevel(e.valence);
          counts.set(level, (counts.get(level) ?? 0) + 1);
        }
        const top = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
        if (top) setWeekAccent(moodColor[top[0]]);
      })
      .catch(() => {});
  }, []);

  // Blöcke gelten als "im Viewport", sobald sie zu ~85 % sichtbar werden.
  const checkInView = (offsetY: number) => {
    const line = offsetY + viewportH * 0.85;
    if (!typeSummary && summaryY.current > 0 && line > bodyY.current + summaryY.current) {
      setTypeSummary(true);
    }
    if (!typeQuestion && questionY.current > 0 && line > bodyY.current + questionY.current) {
      setTypeQuestion(true);
    }
  };

  // Muster des Pattern-Agents fuer die Karte "Themen, die wiederkehren".
  // Nur anzeigen, wenn die Analyse aus der letzten Woche stammt.
  const activePattern =
    pattern && pattern.status !== 'no_data' && isWithinLastWeek(pattern.created_at)
      ? pattern
      : null;
  const observations = activePattern?.observations ?? [];
  // Themen mit Häufigkeit ("Uni 5×"), Personen ohne Zähler; nach Label dedupliziert.
  const themeCounts = activePattern?.theme_counts ?? {};
  const tagItems = activePattern
    ? [
        ...(activePattern.recurring_themes ?? []).map((label) => ({
          label,
          count: themeCounts[label] && themeCounts[label] > 0 ? themeCounts[label] : undefined,
        })),
        ...(activePattern.recurring_people ?? []).map((label) => ({ label, count: undefined })),
      ].filter((item, i, arr) => arr.findIndex((x) => x.label === item.label) === i)
    : [];
  const themeCount = activePattern?.recurring_themes?.length ?? 0;
  const hasPattern = observations.length > 0 || tagItems.length > 0;

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        onLayout={(e) => setViewportH(e.nativeEvent.layout.height)}
        onScroll={(e) => checkInView(e.nativeEvent.contentOffset.y)}
        scrollEventThrottle={16}
      >
        <MoodMirrorBlob onWrite={onWrite} minHeight={viewportH || undefined} />

        <View style={styles.body} onLayout={(e) => (bodyY.current = e.nativeEvent.layout.y)}>
          <SectionLabel text="Tonverlauf" />
          {digest ? (
            <View
              style={styles.sectionContent}
              onLayout={(e) => (summaryY.current = e.nativeEvent.layout.y)}
            >
              <QuoteBlock text={digest.summary} accentColor={weekAccent} typingActive={typeSummary} />
              {digest.highlights.map((h, i) => (
                <View key={i} style={styles.bulletSpacing}>
                  <Bullet text={h} />
                </View>
              ))}
            </View>
          ) : (
            <Text style={styles.hint}>
              {offline
                ? 'Backend nicht erreichbar – läuft „docker compose up"?'
                : 'Noch kein Wochenrückblick – schreib ein paar Einträge!'}
            </Text>
          )}

          <View style={styles.spacer32}>
            <SectionLabel
              text="Themen, die wiederkehren"
              emphasis={
                hasPattern && themeCount > 0
                  ? `${themeCount} ${themeCount === 1 ? 'Thema' : 'Themen'}`
                  : undefined
              }
            />
            {hasPattern ? (
              <Card style={styles.themeCard}>
                {observations.map((o, i) => (
                  <Bullet key={i} text={o} />
                ))}
                {tagItems.length > 0 ? (
                  <View style={styles.pillWrap}>
                    {tagItems.map((item) => (
                      <Tag key={item.label} label={item.label} count={item.count} />
                    ))}
                  </View>
                ) : null}
              </Card>
            ) : (
              <Text style={styles.hint}>Noch keine Muster erkannt.</Text>
            )}
          </View>

          <View
            style={styles.spacer32}
            onLayout={(e) => (questionY.current = e.nativeEvent.layout.y)}
          >
            <SectionLabel text="Eine Frage zum Weitertragen" />
            <View style={styles.sectionContent}>
              <QuoteBlock text={FALLBACK_QUESTION} accentColor={weekAccent} typingActive={typeQuestion} />
              {digest?.affirmation ? (
                <Text style={styles.affirmation}>{digest.affirmation}</Text>
              ) : null}
            </View>
          </View>
        </View>

        <PrivacyNote style={styles.footerPrivacy} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  scroll: { flexGrow: 1, paddingBottom: 24 },
  body: { paddingHorizontal: 20, paddingTop: 24 },
  footerPrivacy: { marginTop: 28, marginBottom: 8 },
  spacer32: { marginTop: 32 },
  sectionContent: { marginTop: 12, gap: 12 },
  bulletSpacing: { marginBottom: -8 },
  pillWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  themeCard: { marginTop: 12 },
  hint: { marginTop: 12, fontSize: 14, lineHeight: 20, color: colors.textMuted },
  affirmation: {
    fontFamily: serif,
    fontStyle: 'italic',
    fontSize: 14,
    lineHeight: 21,
    color: colors.textMuted,
  },
});
