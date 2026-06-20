/**
 * InsightScreen – statischer Screen (noch keine Backend-Anbindung).
 *
 * Zeigt die ausgewerteten Einblicke aus dem Journaling:
 * Stimmungsverlauf, wiederkehrende Muster und den Wochenrückblick.
 * Alle Daten sind hier fest verdrahtetes Mock-Material und werden später
 * durch die AI-Agenten (Sentiment / Pattern / Digest) ersetzt.
 *
 * UI aus wiederverwendbaren Komponenten:
 *   - geteilt:        ../components (Card, ScreenHeader)
 *   - Insight-eigen:  ../components/insight
 *   - wiederverwendet: ../components/home (Bullet)
 */
import React, { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Card, ScreenHeader } from '../components';
import { Bullet } from '../components/home';
import {
  MoodBar,
  MoodBarChart,
  NumberedItem,
  SegmentedControl,
  StatBox,
  Tag,
} from '../components/insight';
import { colors } from '../theme/colors';

type Range = 'Woche' | 'Monat' | 'Jahr';

// --- Mock-Daten (später aus den Agenten) ------------------------------------

const RANGES: readonly Range[] = ['Woche', 'Monat', 'Jahr'];

const moodWeek: MoodBar[] = [
  { label: 'Mo', level: 'good', value: 0.7 },
  { label: 'Di', level: 'neutral', value: 0.5 },
  { label: 'Mi', level: 'low', value: 0.35 },
  { label: 'Do', level: 'good', value: 0.72 },
  { label: 'Fr', level: 'great', value: 0.95 },
  { label: 'Sa', level: 'great', value: 0.88 },
  { label: 'So', level: 'neutral', value: 0.55 },
];

const patterns: { tag: string; count: number }[] = [
  { tag: 'Arbeit & Stress', count: 5 },
  { tag: 'Schlaf', count: 4 },
  { tag: 'Freunde', count: 3 },
  { tag: 'Sport', count: 3 },
  { tag: 'Dankbarkeit', count: 2 },
];

const digestHighlights: string[] = [
  'Deine Stimmung war am Wochenende deutlich stabiler.',
  'Stress trat vor allem an Tagen mit wenig Schlaf auf.',
  'Soziale Kontakte hatten einen positiven Einfluss auf deinen Tag.',
];

const reflectionQuestions: string[] = [
  'Was hat dir diese Woche am meisten Energie gegeben?',
  'Welche Situation würdest du gerne noch einmal anders angehen?',
  'Wofür warst du in den letzten Tagen dankbar?',
];

// --- Screen -----------------------------------------------------------------

export default function InsightScreen() {
  const [range, setRange] = useState<Range>('Woche');

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <ScreenHeader
          title="Einblicke"
          subtitle="Muster und Stimmungen aus deinen Einträgen"
        />

        <View style={styles.spacer20}>
          <SegmentedControl options={RANGES} value={range} onChange={setRange} />
        </View>

        <View style={styles.statsRow}>
          <StatBox value="12" label="Einträge" />
          <StatBox value="5" label="Tage in Folge" />
          <StatBox value="+8%" label="Stimmung" highlight />
        </View>

        <Card
          title="Stimmungsverlauf"
          subtitle="Durchschnittliche Stimmung pro Tag"
          style={styles.spacer16}
        >
          <MoodBarChart data={moodWeek} />
        </Card>

        <Card
          title="Wiederkehrende Muster"
          subtitle="Häufige Themen in deinen Einträgen"
          style={styles.spacer16}
        >
          <View style={styles.tagWrap}>
            {patterns.map((p) => (
              <Tag key={p.tag} label={p.tag} count={p.count} />
            ))}
          </View>
        </Card>

        <Card
          title="Wochenrückblick"
          subtitle="Zusammengefasst aus deinen Einträgen"
          style={styles.spacer16}
        >
          {digestHighlights.map((h, i) => (
            <Bullet key={i} text={h} />
          ))}
        </Card>

        <Card
          title="Reflexionsfragen"
          subtitle="Impulse für deinen nächsten Eintrag"
          style={styles.spacer16}
        >
          {reflectionQuestions.map((q, i) => (
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
  spacer20: { marginTop: 20 },
  spacer16: { marginTop: 16 },
  statsRow: { flexDirection: 'row', gap: 12, marginTop: 16 },
  tagWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  bottomSpace: { height: 24 },
});
