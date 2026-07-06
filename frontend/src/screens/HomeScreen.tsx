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
import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Card, SectionLabel } from '../components';
import { Bullet, QuoteBlock } from '../components/home';
import { Tag } from '../components/insight';
import {
  Digest,
  PatternResult,
  fetchLatestDigest,
  fetchLatestPatterns,
} from '../services/api';
import { colors } from '../theme/colors';
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

export default function HomeScreen() {
  const [digest, setDigest] = useState<Digest | null>(null);
  const [pattern, setPattern] = useState<PatternResult | null>(null);
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    fetchLatestDigest()
      .then(setDigest)
      .catch(() => setOffline(true));
    fetchLatestPatterns()
      .then(setPattern)
      .catch(() => {});
  }, []);

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
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.banner}>
          <Text style={styles.bannerTitle}>Diese Woche</Text>
          <Text style={styles.bannerSubtitle}>Ein sanfter Rückblick…</Text>
        </View>

        <View style={styles.body}>
          <SectionLabel text="Tonverlauf" />
          {digest ? (
            <View style={styles.sectionContent}>
              <QuoteBlock text={digest.summary} tint="peach" />
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

          <View style={styles.spacer32}>
            <SectionLabel text="Eine Frage zum Weitertragen" />
            <View style={styles.sectionContent}>
              <QuoteBlock text={FALLBACK_QUESTION} tint="sage" />
              {digest?.affirmation ? (
                <Text style={styles.affirmation}>{digest.affirmation}</Text>
              ) : null}
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  scroll: { flexGrow: 1, paddingBottom: 24 },
  banner: { backgroundColor: colors.warmSoft, paddingHorizontal: 20, paddingTop: 8, paddingBottom: 24 },
  bannerTitle: { fontFamily: serif, fontSize: 32, fontWeight: '700', color: colors.text },
  bannerSubtitle: { fontSize: 15, color: colors.text, opacity: 0.6, marginTop: 4 },
  body: { paddingHorizontal: 20, paddingTop: 24 },
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
