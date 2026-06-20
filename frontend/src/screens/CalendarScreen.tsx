/**
 * CalendarScreen – statischer Screen (noch keine Backend-Anbindung).
 *
 * Monatsübersicht der Journaling-Aktivität: Tage mit Einträgen sind durch
 * einen farbigen Stimmungs-Punkt markiert. Tippen auf einen Tag zeigt die
 * (statischen) Einträge dieses Tages.
 * Die Eintrags-/Stimmungsdaten sind Mock-Daten und werden später aus der
 * lokalen Datenbank geladen.
 *
 * UI aus wiederverwendbaren Komponenten:
 *   - geteilt:         ../components (Card, ScreenHeader)
 *   - Calendar-eigen:  ../components/calendar
 */
import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Card, ScreenHeader } from '../components';
import {
  CalendarGrid,
  EntryCard,
  MonthNav,
  MoodLegend,
  MoodPill,
} from '../components/calendar';
import { colors, MoodLevel } from '../theme/colors';

const WEEKDAYS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
const MONTHS = [
  'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember',
];

type DayEntry = { mood: MoodLevel; entries: { time: string; text: string }[] };

// Mock-Einträge für den aktuell angezeigten Monat (Tag -> Daten).
const MOCK_MONTH: Record<number, DayEntry> = {
  2: { mood: 'good', entries: [{ time: '08:12', text: 'Ruhiger Start in die Woche.' }] },
  3: { mood: 'neutral', entries: [{ time: '21:40', text: 'Viel zu tun, aber okay.' }] },
  5: {
    mood: 'low',
    entries: [
      { time: '07:55', text: 'Schlecht geschlafen.' },
      { time: '22:10', text: 'Abends besser gefühlt.' },
    ],
  },
  9: { mood: 'great', entries: [{ time: '19:30', text: 'Toller Tag mit Freunden.' }] },
  12: { mood: 'good', entries: [{ time: '18:05', text: 'Sport getan, zufrieden.' }] },
  15: { mood: 'neutral', entries: [{ time: '20:00', text: 'Normaler Tag.' }] },
  18: { mood: 'bad', entries: [{ time: '23:15', text: 'Stressiger Tag im Büro.' }] },
  20: {
    mood: 'great',
    entries: [
      { time: '09:00', text: 'Früh aufgewacht, motiviert.' },
      { time: '21:00', text: 'Dankbar für den Tag.' },
    ],
  },
  23: { mood: 'good', entries: [{ time: '17:20', text: 'Spaziergang im Park.' }] },
  26: { mood: 'low', entries: [{ time: '22:45', text: 'Müde und nachdenklich.' }] },
};

// Erzeugt die Tageszellen (Mo-basiert) für einen Monat. Leere Zellen = `null`.
function buildMonthGrid(year: number, month: number): (number | null)[] {
  const firstDay = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const startOffset = (firstDay.getDay() + 6) % 7; // 0 = Montag
  const cells: (number | null)[] = [];
  for (let i = 0; i < startOffset; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

// Stimmungen pro Tag für das Gitter (nur Tag -> Stimmung).
const moodByDay: Record<number, MoodLevel> = Object.fromEntries(
  Object.entries(MOCK_MONTH).map(([day, data]) => [Number(day), data.mood])
);

export default function CalendarScreen() {
  // Startet im Juni 2026 (Monat 0-basiert -> 5).
  const [year, setYear] = useState(2026);
  const [month, setMonth] = useState(5);
  const [selected, setSelected] = useState<number | null>(20);

  const cells = useMemo(() => buildMonthGrid(year, month), [year, month]);
  const selectedEntry = selected != null ? MOCK_MONTH[selected] : undefined;

  const goPrev = () => {
    setSelected(null);
    if (month === 0) {
      setMonth(11);
      setYear((y) => y - 1);
    } else {
      setMonth((m) => m - 1);
    }
  };

  const goNext = () => {
    setSelected(null);
    if (month === 11) {
      setMonth(0);
      setYear((y) => y + 1);
    } else {
      setMonth((m) => m + 1);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <ScreenHeader title="Kalender" subtitle="Deine Einträge im Überblick" />

        <View style={styles.spacer20}>
          <MonthNav
            label={`${MONTHS[month]} ${year}`}
            onPrev={goPrev}
            onNext={goNext}
          />
        </View>

        <View style={styles.spacer16}>
          <CalendarGrid
            weekdays={WEEKDAYS}
            cells={cells}
            moodByDay={moodByDay}
            selected={selected}
            onSelect={setSelected}
          />
        </View>

        <View style={styles.spacer16}>
          <MoodLegend />
        </View>

        {/* Ausgewählter Tag */}
        <View style={styles.detailHeaderRow}>
          <Text style={styles.detailTitle}>
            {selected != null
              ? `${selected}. ${MONTHS[month]}`
              : 'Kein Tag ausgewählt'}
          </Text>
          {selectedEntry ? <MoodPill level={selectedEntry.mood} /> : null}
        </View>

        {selectedEntry ? (
          selectedEntry.entries.map((e, i) => (
            <EntryCard key={i} time={e.time} text={e.text} />
          ))
        ) : (
          <Card style={styles.emptyCard}>
            <Text style={styles.emptyText}>
              {selected != null
                ? 'An diesem Tag gibt es keinen Eintrag.'
                : 'Wähle einen Tag, um Einträge zu sehen.'}
            </Text>
          </Card>
        )}

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
  detailHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 24,
    marginBottom: 12,
  },
  detailTitle: { fontSize: 18, fontWeight: '700', color: colors.text },
  emptyCard: { backgroundColor: colors.surfaceAlt, borderWidth: 0, alignItems: 'center' },
  emptyText: { fontSize: 14, color: colors.textMuted, textAlign: 'center' },
  bottomSpace: { height: 24 },
});
