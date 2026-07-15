/**
 * HomeScreen – wöchentlicher Rückblick aus echten Agent-Daten.
 *
 * Füllt die drei Abschnitte mit Inhalten aus dem Backend:
 *   - Tonverlauf                ← Digest-Agent (Zusammenfassung der Woche)
 *     + Pattern-Agent (language_shifts: Ton-Entwicklung über die Woche)
 *   - Wiederkehrende Themen     ← Pattern-Agent
 *   - Reflexionsfrage           ← Digest-Agent (aus den Einträgen der Woche),
 *     mit der Digest-Affirmation als sanftem Abschluss.
 *
 * Deckt der gespeicherte Digest die Vorwoche noch nicht ab, stösst der Screen
 * einmal pro Sitzung /reflect an – sonst triggert den Agenten niemand.
 *
 * Bausteine aus `../components/home` (Bullet, QuoteBlock) und der
 * Themen-Chip aus `../components/insight` (Tag).
 */
import React, { useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Card, HighlightText, PrivacyNote, SectionLabel } from '../components';
import { LoadingPulse } from '../components/LoadingPulse';
import { Bullet, QuoteBlock, MoodMirrorBlob } from '../components/home';
import { Tag } from '../components/insight';
import {
  Digest,
  EntryRecord,
  KeywordItem,
  PatternResult,
  createReflection,
  detectPatterns,
  fetchEntries,
  fetchKeywords,
  fetchLatestDigest,
  fetchLatestPatterns,
} from '../services/api';
import { notifyDigestReady } from '../services/notifications';
import { colors } from '../theme/colors';
import { moodColor, MoodLevel, valenceToMoodLevel } from '../theme/moodColors';
import { serif } from '../theme/typography';
import { lastWeekRange, lastWeekStartKey, parseCreatedAt } from '../utils/week';

const FALLBACK_QUESTION = 'Was hat dir letzte Woche am meisten Energie gegeben?';

/**
 * Nur Daten der Vorwoche (Mo–So) auf Home zeigen – dasselbe Fenster wie der
 * Digest-Agent und der Mood-Blob, damit alle drei über dieselben Tage reden.
 * Ohne Zeitstempel wird nicht ausgeschlossen (Muster tragen nicht immer einen).
 */
function isWithinLastWeek(createdAt?: string): boolean {
  if (!createdAt) return true;
  const ts = parseCreatedAt(createdAt);
  if (Number.isNaN(ts)) return true;
  const { start, end } = lastWeekRange();
  return ts >= start && ts < end;
}

/**
 * Ist die Musteranalyse noch aktuell? `created_at` ist der Analyse-Zeitpunkt;
 * eine Analyse gilt als frisch, solange sie nach Beginn der Vorwoche lief –
 * dann deckt sie deren Einträge ab. Ältere Analysen werden neu angestossen.
 */
function isPatternFresh(createdAt?: string): boolean {
  if (!createdAt) return false;
  const ts = parseCreatedAt(createdAt);
  if (Number.isNaN(ts)) return false;
  return ts >= lastWeekRange().start;
}

type Props = { onWrite?: () => void };

export default function HomeScreen({ onWrite }: Props) {
  const [digest, setDigest] = useState<Digest | null>(null);
  const [pattern, setPattern] = useState<PatternResult | null>(null);
  const [entries, setEntries] = useState<EntryRecord[]>([]);
  const [keywords, setKeywords] = useState<KeywordItem[]>([]);
  const [offline, setOffline] = useState(false);
  // Sichtbare Hoehe, damit der Begruessungs-Hero den ersten Screen ganz fuellt.
  const [viewportH, setViewportH] = useState(0);
  // Dominante Mood-Farbe der Woche – hauchzarter Tint für die Zitat-Boxen,
  // damit sich die Digest-Sektion am Blob-Farbschema orientiert.
  const [weekAccent, setWeekAccent] = useState<string | undefined>();
  // Typewriter-Trigger: wird true, sobald der Block in den sichtbaren
  // Bereich scrollt (und bleibt true – einmal pro Sitzung).
  const [typeSummary, setTypeSummary] = useState(false);
  // Laeuft gerade ein /reflect? (LLM, dauert ein paar Sekunden)
  const [reflecting, setReflecting] = useState(false);
  const bodyY = useRef(0);
  const summaryY = useRef(0);
  // Guard: hoechstens ein /reflect pro Sitzung, sonst feuert jeder Re-Mount
  // des Screens das Modell erneut an.
  const reflectStarted = useRef(false);
  const patternStarted = useRef(false);

  /** Wochenrueckblick der Vorwoche erzeugen lassen (nur einmal pro Sitzung). */
  const refreshDigest = () => {
    if (reflectStarted.current) return;
    reflectStarted.current = true;
    setReflecting(true);
    createReflection(1)
      .then((d) => {
        setDigest(d);
        notifyDigestReady(d);
      })
      .catch(() => {
        // 404 = keine Eintraege in der Vorwoche. Kein Fehlerfall: der leere
        // Zustand unten sagt das bereits. Verbindungsfehler meldet der
        // fetchLatestDigest-Pfad.
      })
      .finally(() => setReflecting(false));
  };

  /** Musteranalyse ueber die letzte Woche anstossen (nur einmal pro Sitzung). */
  const refreshPatterns = () => {
    if (patternStarted.current) return;
    patternStarted.current = true;
    detectPatterns(7)
      // Die Antwort von /detect-patterns traegt kein created_at (das vergibt
      // erst die DB) – ohne das gaelte das frische Muster als veraltet und die
      // Karte bliebe leer. Deshalb den gespeicherten Stand nachladen.
      .then(() => fetchLatestPatterns())
      .then(setPattern)
      .catch(() => {
        /* keine/zu wenige Eintraege – der leere Zustand sagt das bereits */
      });
  };

  useEffect(() => {
    // Deckt der gespeicherte Digest schon die Vorwoche ab? Wenn nicht (neue
    // Woche oder noch nie erzeugt), einmal /reflect anstossen – niemand sonst
    // triggert den Agenten. Verpasste Wochen holen sich so von selbst auf.
    fetchLatestDigest()
      .then((d) => {
        setDigest(d);
        notifyDigestReady(d);
        if (d.week_start !== lastWeekStartKey()) refreshDigest();
      })
      .catch((e) => {
        // Nur bei echtem Verbindungsfehler "offline". Ein HTTP-Fehler wie 404
        // heisst nur: es gibt noch keinen Wochenrueckblick (kein Backend-Problem).
        if (String(e?.message ?? '').includes('HTTP')) refreshDigest();
        else setOffline(true);
      });
    // Wie beim Digest: den Pattern-Agenten triggert sonst nur das Schreiben
    // eines Eintrags. Ist die letzte Analyse aelter als die Vorwoche, hier
    // einmal nachziehen – sonst bleibt die Themen-Karte dauerhaft leer.
    fetchLatestPatterns()
      .then((p) => {
        setPattern(p);
        if (!isPatternFresh(p.created_at)) refreshPatterns();
      })
      .catch(() => refreshPatterns());
    // Häufigste Wörter der Woche – dienen als „wichtige" Begriffe zum Hervorheben.
    fetchKeywords(7, 10)
      .then((res) => setKeywords(res.keywords))
      .catch(() => {});
    // Häufigste Stimmung der Vorwoche bestimmen (gleiche Logik wie im
    // MoodMirrorBlob: pro Eintrag, valence → 5-Stufen-Level).
    fetchEntries()
      .then((res) => {
        setEntries(res.entries ?? []);
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

  // Der Block gilt als "im Viewport", sobald er zu ~85 % sichtbar wird.
  const checkInView = (offsetY: number) => {
    const line = offsetY + viewportH * 0.85;
    if (!typeSummary && summaryY.current > 0 && line > bodyY.current + summaryY.current) {
      setTypeSummary(true);
    }
  };

  // Muster des Pattern-Agents fuer die Karte "Themen, die wiederkehren".
  // Achtung: created_at ist der Zeitpunkt der ANALYSE, nicht der Zeitraum der
  // Daten. Er darf deshalb nicht gegen das Vorwochen-Fenster geprueft werden –
  // eine heute gelaufene Analyse faellt da nie hinein. Stattdessen: zeigen,
  // solange die Analyse frisch ist (siehe isPatternFresh).
  const activePattern =
    pattern && pattern.status !== 'no_data' && isPatternFresh(pattern.created_at)
      ? pattern
      : null;
  const observations = activePattern?.observations ?? [];
  // Themen mit Häufigkeit ("Uni 5×"), Personen ohne Zähler; nach Label dedupliziert.
  // Wie oft ein Label in den Einträgen der letzten Woche vorkommt – so bekommen
  // auch Personen (die der Pattern-Agent ohne Zähler liefert, z. B. Mama) eine Zahl.
  const countInWeek = (label: string) =>
    entries.filter(
      (e) =>
        isWithinLastWeek(e.created_at) &&
        (e.content ?? '').toLowerCase().includes(label.toLowerCase()),
    ).length;

  const themeCounts = activePattern?.theme_counts ?? {};
  const tagItems = activePattern
    ? [
        ...(activePattern.recurring_themes ?? []).map((label) => {
          const c =
            themeCounts[label] && themeCounts[label] > 0 ? themeCounts[label] : countInWeek(label);
          return { label, count: c > 0 ? c : undefined };
        }),
        ...(activePattern.recurring_people ?? []).map((label) => {
          const c = countInWeek(label);
          return { label, count: c > 0 ? c : undefined };
        }),
      ].filter((item, i, arr) => arr.findIndex((x) => x.label === item.label) === i)
    : [];
  const hasPattern = observations.length > 0 || tagItems.length > 0;

  // „Wichtige" Wörter zum Fett-Hervorheben: Schlagwörter + wiederkehrende
  // Themen/Personen (klein geschrieben, Beugungen werden tolerant gematcht).
  const highlightTerms = [
    ...keywords.map((k) => k.word),
    ...(activePattern?.recurring_themes ?? []),
    ...(activePattern?.recurring_people ?? []),
  ].map((w) => w.toLowerCase());

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
          {/* Überschrift über dem gesamten Digest-Abschnitt (Weekly Digest) */}
          <Text style={styles.digestTitle}>Wochenrückblick</Text>
          <Text style={styles.digestSubtitle}>Was deine Einträge über die Woche erzählen</Text>

          <View style={styles.firstSection}>
            <SectionLabel text="Tonverlauf" />
          </View>
          {digest ? (
            <View
              style={styles.sectionContent}
              onLayout={(e) => (summaryY.current = e.nativeEvent.layout.y)}
            >
              <QuoteBlock text={digest.summary} accentColor={weekAccent} typingActive={typeSummary} />
              {digest.highlights.map((h, i) => (
                <View key={i} style={styles.bulletSpacing}>
                  <Bullet text={<HighlightText text={h} terms={highlightTerms} />} />
                </View>
              ))}
              {/* Ton-Entwicklung der Woche aus dem Pattern-Agent */}
              {(activePattern?.language_shifts ?? []).map((s, i) => (
                <View key={`shift-${i}`} style={styles.bulletSpacing}>
                  <Bullet text={<HighlightText text={s} terms={highlightTerms} />} />
                </View>
              ))}
            </View>
          ) : reflecting ? (
            <LoadingPulse label="Dein Wochenrückblick entsteht …" />
          ) : (
            <Text style={styles.hint}>
              {offline
                ? 'Backend nicht erreichbar – läuft „docker compose up"?'
                : 'Noch kein Wochenrückblick – schreib ein paar Einträge!'}
            </Text>
          )}

          <View style={styles.section}>
            <SectionLabel
              text="Themen, die wiederkehren"
              emphasis={
                hasPattern && tagItems.length > 0
                  ? `${tagItems.length} ${tagItems.length === 1 ? 'Thema' : 'Themen'}`
                  : undefined
              }
            />
            {hasPattern ? (
              <Card style={styles.themeCard}>
                {observations.map((o, i) => (
                  <Bullet key={i} text={<HighlightText text={o} terms={highlightTerms} />} />
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

          <View style={styles.section}>
            <SectionLabel text="Reflexionsfrage" />
            <View style={styles.sectionContent}>
              {/* Frage des Digest-Agents aus den Einträgen der Woche; der
                  neutrale Satz greift nur, wenn noch kein Digest da ist. */}
              <QuoteBlock
                text={digest?.question?.trim() || FALLBACK_QUESTION}
                accentColor={weekAccent}
              />
            </View>
          </View>

          {digest?.affirmation ? (
            <View style={styles.section}>
              <SectionLabel text="Ermutigung" />
              <View style={styles.sectionContent}>
                <Text style={styles.affirmation}>{digest.affirmation}</Text>
              </View>
            </View>
          ) : null}
        </View>

        <PrivacyNote style={styles.footerPrivacy} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  scroll: { flexGrow: 1, paddingBottom: 24 },
  body: { paddingHorizontal: 20, paddingTop: 36 },
  // Überschrift des Wochenrückblick-Abschnitts – Serif wie die Wortmarke,
  // damit der Abschnitt als eigenes „Kapitel" unter dem Hero lesbar ist.
  digestTitle: {
    fontFamily: serif,
    fontSize: 26,
    fontWeight: '600',
    color: colors.text,
  },
  digestSubtitle: {
    marginTop: 6,
    fontSize: 14,
    lineHeight: 20,
    color: colors.textMuted,
  },
  // Abstand Kapitel-Überschrift → erster Abschnitt bzw. zwischen den
  // Abschnitten: großzügig, damit die Sektionen als Einheiten lesbar sind –
  // innerhalb eines Abschnitts bleibt es bewusst dichter (sectionContent).
  firstSection: { marginTop: 32 },
  footerPrivacy: { marginTop: 36, marginBottom: 8 },
  section: { marginTop: 44 },
  sectionContent: { marginTop: 14, gap: 12 },
  bulletSpacing: { marginBottom: -8 },
  pillWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  themeCard: { marginTop: 14 },
  hint: { marginTop: 14, fontSize: 14, lineHeight: 20, color: colors.textMuted },
  affirmation: {
    fontFamily: serif,
    fontStyle: 'italic',
    fontSize: 14,
    lineHeight: 21,
    color: colors.textMuted,
  },
});
