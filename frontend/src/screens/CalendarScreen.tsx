/**
 * CalendarScreen – Bubble-Kalender mit echten Backend-Daten.
 *
 * Zeigt die Journaling-Aktivität als weiche Mood-Bubbles: Farbe = Stimmung
 * (5-Stufen-Skala aus valence), Größe = Intensität der Emotionen.
 * Zwei Ansichten: Woche (große Bubbles, Mo–So) und Monat (kompaktes Gitter).
 * Tippen auf einen Tag öffnet den Inline-Detailbereich mit Emotionen,
 * Intensität und den Einträgen des Tages.
 *
 * Daten: fetchEntries() (Einträge + valence) und fetchMoodProfile(days)
 * (average_valence / average_intensity / dominant_emotions pro Tag).
 * `/mood-profile?days=N` liefert strikt die letzten N Tage ab heute – beim
 * Blättern in die Vergangenheit wird das Fenster bei Bedarf vergrößert.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  LayoutAnimation,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AuraHeader, Card, SectionLabel } from '../components';
import { LoadingPulse } from '../components/LoadingPulse';
import {
  CalendarGrid,
  DayMood,
  EntryCard,
  MIN_PERCENT,
  MonthNav,
  MoodLegend,
  MoodPill,
  WeekBubbles,
  WeekDay,
  buildWeekTotals,
} from '../components/calendar';
import { SegmentedControl, Tag } from '../components/insight';
import {
  DailyMood,
  EntryRecord,
  fetchEntries,
  fetchMoodProfile,
} from '../services/api';
import { colors } from '../theme/colors';
import { MoodLevel, normalizeIntensity, valenceToMoodLevel } from '../theme/moodColors';
import { serif } from '../theme/typography';
import { dayMoodLine, weekMoodLine } from '../utils/moodPrompts';
import { TypewriterText } from '../components/home/TypewriterText';

const WEEKDAYS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
const MONTHS = [
  'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember',
];
const VIEWS = ['Woche', 'Monat'] as const;
type ViewMode = (typeof VIEWS)[number];

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

/** Lokales Datum als ISO-Key (YYYY-MM-DD). */
function toKey(d: Date): string {
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

/** Montag der Woche, in der `d` liegt (lokale Zeit, 00:00). */
function mondayOf(d: Date): Date {
  const m = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  m.setDate(m.getDate() - ((m.getDay() + 6) % 7));
  return m;
}

/** created_at ("YYYY-MM-DD HH:MM:SS", UTC) → lokales Date. */
function parseEntryDate(createdAt: string): Date | null {
  const ts = Date.parse(`${createdAt.replace(' ', 'T')}Z`);
  return Number.isNaN(ts) ? null : new Date(ts);
}

/** Aufbereitete Daten eines Tages mit Einträgen. */
type DayData = {
  date: string;
  level: MoodLevel;
  intensity: number; // 0..1
  /** Prozentuale Mood-Verteilung des Tages (absteigend, Summe ≈ 100). */
  moods: DayMood[];
  emotions: string[];
  entries: EntryRecord[];
};

/** Verteilung aus den Einträgen eines Tages: Anteil je Mood-Stufe in %. */
function buildDistribution(dayEntries: EntryRecord[]): DayMood[] {
  const counts = new Map<MoodLevel, number>();
  let total = 0;
  for (const e of dayEntries) {
    if (e.valence == null) continue;
    const level = valenceToMoodLevel(e.valence);
    counts.set(level, (counts.get(level) ?? 0) + 1);
    total += 1;
  }
  if (!total) return [];
  return [...counts.entries()]
    .map(([level, n]) => ({ level, percent: Math.round((n / total) * 100) }))
    .sort((a, b) => b.percent - a.percent);
}

type Props = {
  /** Öffnet die Vollansicht eines angetippten Eintrags (siehe App.tsx). */
  onOpenEntry?: (entry: EntryRecord) => void;
};

export default function CalendarScreen({ onOpenEntry }: Props) {
  const today = new Date();
  const todayKey = toKey(today);

  const [view, setView] = useState<ViewMode>('Woche');
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [weekStart, setWeekStart] = useState<Date>(() => mondayOf(today));
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const [entries, setEntries] = useState<EntryRecord[]>([]);
  const [dailyByDate, setDailyByDate] = useState<Record<string, DailyMood>>({});
  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState(false);
  // Bereits geladenes mood-profile-Fenster (Tage) – nur bei Bedarf vergrößern.
  const loadedDaysRef = useRef(0);

  useEffect(() => {
    fetchEntries()
      .then((res) => setEntries(res.entries ?? []))
      .catch(() => setOffline(true))
      .finally(() => setLoading(false));
  }, []);

  // Mood-Profile-Fenster muss bis zum Monatsanfang des angezeigten Monats reichen.
  useEffect(() => {
    const monthStart = new Date(year, month, 1);
    const neededDays = Math.min(
      366,
      Math.max(7, Math.ceil((Date.now() - monthStart.getTime()) / 86400000) + 1),
    );
    if (neededDays <= loadedDaysRef.current) return;
    loadedDaysRef.current = neededDays;
    fetchMoodProfile(neededDays)
      .then((profile) => {
        const map: Record<string, DailyMood> = {};
        for (const d of profile.mood_profile?.daily_breakdown ?? []) {
          map[d.date] = d;
        }
        setDailyByDate(map);
      })
      .catch(() => {
        /* ohne Profil greift der valence-Fallback aus den Einträgen */
      });
  }, [year, month]);

  // Einträge + Tagesprofile zu Tagesdaten verdichten (lokaler Datums-Key).
  const dayMap = useMemo(() => {
    const byDate = new Map<string, EntryRecord[]>();
    for (const e of entries) {
      const local = parseEntryDate(e.created_at);
      if (!local) continue;
      const key = toKey(local);
      const list = byDate.get(key) ?? [];
      list.push(e);
      byDate.set(key, list);
    }

    const map = new Map<string, DayData>();
    for (const [date, dayEntries] of byDate) {
      const profile = dailyByDate[date];
      let level: MoodLevel;
      if (profile) {
        level = valenceToMoodLevel(profile.average_valence);
      } else {
        const valences = dayEntries
          .map((e) => e.valence)
          .filter((v): v is number => v != null);
        level = valences.length
          ? valenceToMoodLevel(valences.reduce((s, v) => s + v, 0) / valences.length)
          : 'neutral';
      }
      map.set(date, {
        date,
        level,
        intensity: profile ? normalizeIntensity(profile.average_intensity) : 0.5,
        moods: buildDistribution(dayEntries),
        emotions: profile?.dominant_emotions ?? [],
        entries: dayEntries,
      });
    }
    return map;
  }, [entries, dailyByDate]);

  // --- Monatsansicht -------------------------------------------------------
  const cells = useMemo(() => buildMonthGrid(year, month), [year, month]);
  const gridDayData = useMemo(() => {
    const rec: Record<number, { level: MoodLevel; intensity: number }> = {};
    for (const [date, d] of dayMap) {
      const [y, m, day] = date.split('-').map(Number);
      if (y === year && m === month + 1) {
        rec[day] = { level: d.level, intensity: d.intensity };
      }
    }
    return rec;
  }, [dayMap, year, month]);

  // --- Wochenansicht (Mo–Fr, wie im "Pause"-Referenzlayout) ----------------
  // Ausschliesslich echte Einträge: Tage ohne Eintrag bleiben leer, statt eine
  // Stimmung zu erfinden, die es nie gab.
  const weekDays: WeekDay[] = useMemo(() => {
    return Array.from({ length: 5 }, (_, i) => {
      const d = new Date(weekStart);
      d.setDate(d.getDate() + i);
      const key = toKey(d);
      const data = dayMap.get(key);
      return {
        date: key,
        day: d.getDate(),
        label: WEEKDAYS[i],
        moods: data?.moods ?? [],
        isToday: key === todayKey,
      };
    });
  }, [weekStart, dayMap, todayKey]);

  /** Keine Kleckse zeichnen, wenn in der Woche kein einziger Eintrag liegt. */
  const weekHasData = weekDays.some((d) => d.moods.length > 0);

  const selectDate = (date: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setSelectedDate((prev) => (prev === date ? null : date));
  };

  const changeView = (v: ViewMode) => {
    if (v === 'Woche') {
      // Zur Woche des ausgewählten Tags bzw. von heute springen.
      const anchor = selectedDate ? new Date(`${selectedDate}T00:00:00`) : today;
      setWeekStart(mondayOf(anchor));
    }
    setView(v);
  };

  const goPrev = () => {
    setSelectedDate(null);
    if (view === 'Monat') {
      if (month === 0) {
        setMonth(11);
        setYear((y) => y - 1);
      } else {
        setMonth((m) => m - 1);
      }
    } else {
      const d = new Date(weekStart);
      d.setDate(d.getDate() - 7);
      setWeekStart(d);
      setYear(d.getFullYear());
      setMonth(d.getMonth());
    }
  };

  const goNext = () => {
    setSelectedDate(null);
    if (view === 'Monat') {
      if (month === 11) {
        setMonth(0);
        setYear((y) => y + 1);
      } else {
        setMonth((m) => m + 1);
      }
    } else {
      const d = new Date(weekStart);
      d.setDate(d.getDate() + 7);
      setWeekStart(d);
      setYear(d.getFullYear());
      setMonth(d.getMonth());
    }
  };

  // Angezeigter Bereich endet freitags (Mo–Fr-Ansicht).
  const weekEnd = useMemo(() => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + 4);
    return d;
  }, [weekStart]);

  const navLabel =
    view === 'Monat'
      ? `${MONTHS[month]} ${year}`
      : weekStart.getMonth() === weekEnd.getMonth()
        ? `${weekStart.getDate()}.–${weekEnd.getDate()}. ${MONTHS[weekEnd.getMonth()]}`
        : `${weekStart.getDate()}. ${MONTHS[weekStart.getMonth()]} – ${weekEnd.getDate()}. ${MONTHS[weekEnd.getMonth()]}`;

  // --- Detailbereich -------------------------------------------------------
  const selectedData = selectedDate ? dayMap.get(selectedDate) : undefined;
  const selectedMoods = selectedData?.moods ?? [];
  const mainMoods = selectedMoods.filter((m) => m.percent >= MIN_PERCENT);
  // Anteile unter der Bubble-Schwelle: gesammelt im Detail statt als Bubble.
  const minorMoods = selectedMoods.filter((m) => m.percent < MIN_PERCENT);
  const selectedTitle = selectedDate
    ? (() => {
        const [, m, d] = selectedDate.split('-').map(Number);
        return `${d}. ${MONTHS[m - 1]}`;
      })()
    : 'Kein Tag ausgewählt';

  // --- Wochen-Zusammenfassung (nur Wochenansicht) --------------------------
  // Dieselbe Aggregation wie die Bubbles (buildWeekTotals) → Text, Prozent-Pills
  // und Kleckse können nicht auseinanderlaufen. Prozente = Anteil je Kategorie
  // an der Wochensumme; der Satz kommt aus der dominanten Kategorie.
  const weekTotals = buildWeekTotals(weekDays);
  const weekSum = weekTotals.reduce((sum, t) => sum + t.total, 0);
  const weekMoods: DayMood[] =
    weekSum > 0
      ? weekTotals.map((t) => ({ level: t.level, percent: Math.round((t.total / weekSum) * 100) }))
      : [];
  const weekLine =
    weekSum > 0
      ? weekMoodLine(weekTotals.map((t) => ({ level: t.level, share: t.total / weekSum })))
      : '';

  const todayDayInMonth =
    year === today.getFullYear() && month === today.getMonth() ? today.getDate() : null;

  return (
    <SafeAreaView style={styles.safe} edges={[]}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <AuraHeader
          label={`${MONTHS[month]} ${year}`}
          title="Kalender"
          subtitle="Deine Einträge im Überblick"
        />

        <View style={styles.spacer20}>
          <SegmentedControl options={VIEWS} value={view} onChange={changeView} />
        </View>

        <View style={styles.spacer16}>
          <MonthNav label={navLabel} onPrev={goPrev} onNext={goNext} />
        </View>

        <View style={styles.spacer16}>
          {loading ? (
            <LoadingPulse label="Einträge werden geladen …" />
          ) : view === 'Monat' ? (
            <CalendarGrid
              weekdays={WEEKDAYS}
              cells={cells}
              dayData={gridDayData}
              selected={
                selectedDate ? Number(selectedDate.split('-')[2]) : null
              }
              onSelect={(day) => {
                const key = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                selectDate(key);
              }}
              today={todayDayInMonth}
            />
          ) : weekHasData ? (
            <WeekBubbles
              // key: bei Wochenwechsel remounten → Pop-in-Animation läuft erneut
              key={toKey(weekStart)}
              days={weekDays}
            />
          ) : (
            <Text style={styles.hint}>
              Keine Einträge in dieser Woche – blättere zurück oder schreib etwas.
            </Text>
          )}
        </View>

        {offline ? (
          <Text style={styles.hint}>
            Backend nicht erreichbar – läuft „docker compose up"?
          </Text>
        ) : null}
        {!loading && !offline && entries.length === 0 ? (
          <Text style={styles.hint}>
            Noch keine Einträge – dein Kalender füllt sich mit jedem Eintrag.
          </Text>
        ) : null}

        {/* Sektionen im HomeScreen-Stil: SectionLabel-Überschriften +
            luftige Abstände, Inhalte in weißen Karten. */}
        <View style={styles.spacer32}>
          <SectionLabel text="Stimmungsskala" />
          <View style={styles.sectionContent}>
            <MoodLegend />
          </View>
        </View>

        {view === 'Woche' ? (
          /* Wochenansicht: Zusammenfassung der GESAMTEN Woche (kein Tag nötig) */
          <>
            <View style={styles.spacer32}>
              <Text style={styles.detailTitle}>{navLabel}</Text>
            </View>
            {weekMoods.length > 0 ? (
              <View style={styles.sectionContent}>
                {/* Wochen-Beobachtung, tippt sich beim Wochenwechsel neu ein */}
                <TypewriterText
                  key={`week-${toKey(weekStart)}`}
                  text={weekLine}
                  active
                  style={styles.dayLine}
                />
                {/* Wochen-aggregierte Verteilung als farbige Pills */}
                <View style={styles.emotionRow}>
                  {weekMoods.map((m) => (
                    <MoodPill key={m.level} level={m.level} percent={m.percent} />
                  ))}
                </View>
              </View>
            ) : (
              <Card style={styles.emptyCard}>
                <Text style={styles.emptyText}>Noch keine Einträge in dieser Woche.</Text>
              </Card>
            )}
          </>
        ) : (
          /* Monatsansicht: unveränderte Tages-Detailansicht (Tag-Granularität) */
          <>
            {/* Ausgewählter Tag: Serif-Headline wie auf dem HomeScreen */}
            <View style={styles.spacer32}>
              <Text style={styles.detailTitle}>{selectedTitle}</Text>
            </View>

            {selectedMoods.length > 0 ? (
              <View style={styles.sectionContent}>
                {/* Kurze Tages-Beobachtung, tippt sich bei jeder Tages-Auswahl
                    ein (key={selectedDate} remountet den Typewriter). */}
                <TypewriterText
                  key={selectedDate}
                  text={dayMoodLine(selectedMoods[0].level)}
                  active
                  style={styles.dayLine}
                />
                {/* Exakte Verteilung als farbige Pills („Schwer · 70 %") */}
                <View style={styles.emotionRow}>
                  {mainMoods.map((m) => (
                    <MoodPill key={m.level} level={m.level} percent={m.percent} />
                  ))}
                </View>
                {minorMoods.length > 0 ? (
                  <View style={styles.emotionRow}>
                    <Text style={styles.intensityText}>Weitere Emotionen:</Text>
                    {minorMoods.map((m) => (
                      <MoodPill key={m.level} level={m.level} percent={m.percent} />
                    ))}
                  </View>
                ) : null}
                {selectedData && selectedData.emotions.length > 0 ? (
                  <View style={styles.emotionRow}>
                    {selectedData.emotions.map((emo) => (
                      <Tag key={emo} label={emo} />
                    ))}
                  </View>
                ) : null}
                {selectedData?.entries.map((e) => {
                  const local = parseEntryDate(e.created_at);
                  const time = local
                    ? `${String(local.getHours()).padStart(2, '0')}:${String(local.getMinutes()).padStart(2, '0')}`
                    : '';
                  const text =
                    e.content.length > 140
                      ? `${e.content.slice(0, 140).trimEnd()}…`
                      : e.content;
                  return (
                    <EntryCard
                      key={e.id}
                      time={time}
                      text={text}
                      onPress={onOpenEntry ? () => onOpenEntry(e) : undefined}
                    />
                  );
                })}
              </View>
            ) : (
              <Card style={styles.emptyCard}>
                <Text style={styles.emptyText}>
                  {selectedDate != null
                    ? 'An diesem Tag gibt es keinen Eintrag.'
                    : 'Wähle einen Tag, um Einträge zu sehen.'}
                </Text>
              </Card>
            )}
          </>
        )}

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
  hint: { marginTop: 12, fontSize: 14, lineHeight: 20, color: colors.textMuted },
  // Abstände/Struktur wie HomeScreen (SectionLabel + sectionContent)
  spacer32: { marginTop: 32 },
  sectionContent: { marginTop: 12 },
  // Serif-Headline wie die Home-Frage („Was bewegt dich heute?")
  detailTitle: {
    fontFamily: serif,
    fontSize: 23,
    lineHeight: 31,
    fontWeight: '600',
    color: '#000000',
  },
  // Tages-Beobachtung im Zitat-Stil der Digest-Sektion
  dayLine: {
    fontFamily: serif,
    fontStyle: 'italic',
    fontSize: 15,
    lineHeight: 22,
    color: colors.textMuted,
    marginBottom: 12,
  },
  emotionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  intensityText: { fontSize: 13, color: colors.textMuted },
  // Leere Karte im QuoteBlock-Look des HomeScreens: weiß + dezente Linie,
  // Serifen-Kursiv wie die Zitate dort.
  emptyCard: {
    marginTop: 12,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
  },
  emptyText: {
    fontFamily: serif,
    fontStyle: 'italic',
    fontSize: 15,
    lineHeight: 22,
    color: colors.textMuted,
  },
  bottomSpace: { height: 24 },
});
