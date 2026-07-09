/**
 * Wochenansicht im "Pause"-Stil: EINE freie, durchgehende Fläche (Canvas),
 * auf der die Mood-Bubbles ALLER Tage der Woche organisch verstreut liegen –
 * keine Spalten, keine Kästen, keine Trennlinien. Die x-Position einer Bubble
 * entspricht nur GROB dem zeitlichen Platz ihres Tages (Montag eher links,
 * Freitag eher rechts) plus deterministischem Seed-Versatz; y ist frei
 * verteilt, Überlappungen (auch tagübergreifend) sind gewollt.
 *
 * Darunter, als eigene unabhängige Zeile: die Wochentag-Kapseln (Mo–Fr mit
 * Datum). Auswahl-Feedback passiert NUR an der Kapsel selbst – keine
 * Spalten-Abgrenzung in der Fläche darüber.
 *
 * Jede Bubble = genau eine Mood-Farbe (GelBubble: Gradient + Blur + Saturate
 * + gemeinsame Fade-Maske + Glanzpunkt), Größe proportional zum Prozentanteil
 * des Moods am Tag; Anteile unter MIN_PERCENT nur im Detailbereich.
 * Eingang: Pop-in-Spring pro Tag, ~50 ms gestaffelt von links nach rechts.
 */
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../../theme/colors';
import { moodColor, moodLabel, MoodLevel } from '../../theme/moodColors';
import { GelBubble } from './GelBubble';

const NATIVE_DRIVER = Platform.OS !== 'web';

/** Anteile unter dieser Schwelle bekommen keine eigene Bubble. */
export const MIN_PERCENT = 3;

/**
 * Maximale Bubbles pro Tag auf der Canvas-Fläche (Referenz "Pause": genau
 * eine Farbfläche pro Tag). Alle weiteren Moods des Tages erscheinen nur im
 * Detailbereich (Pills mit exaktem Prozentsatz), nicht auf der Fläche.
 */
export const MAX_BUBBLES_PER_DAY = 1;

/**
 * TEMP: Testflag für Multi-Mood-Darstellung, nur für Donnerstag – der Tag
 * mit diesem Wochentags-Kürzel zeigt ALLE Moods über MIN_PERCENT als eigene
 * Kleckse (Fläche ∝ Prozentsatz) über die GESAMTE Canvas-Breite; alle
 * anderen Tage rendern in diesem Test-Durchlauf bewusst KEINE Bubbles.
 * Vor Rollout auf die ganze Woche wieder entfernen/anpassen (null = aus).
 */
const TEST_MULTI_MOOD_DAY_LABEL: string | null = 'Do';

/**
 * TEMP: Beispiel-Verteilung für den Test-Tag (alle 5 Kategorien, Summe 100) –
 * überschreibt für den Test die echten Tagesdaten, damit das Verhalten mit
 * vollständigem Kategorien-Satz beurteilt werden kann.
 */
const TEST_MULTI_MOOD_DISTRIBUTION: DayMood[] = [
  { level: 'bad', percent: 55 },
  { level: 'low', percent: 20 },
  { level: 'neutral', percent: 15 },
  { level: 'good', percent: 7 },
  { level: 'great', percent: 3 },
];

export type DayMood = { level: MoodLevel; percent: number };

export type WeekDay = {
  /** ISO-Datum YYYY-MM-DD (lokal). */
  date: string;
  /** Tageszahl im Monat. */
  day: number;
  /** Wochentags-Kürzel (Mo/Di/…). */
  label: string;
  /** Mood-Verteilung des Tages (absteigend, Summe ≈ 100); leer = kein Eintrag. */
  moods: DayMood[];
  isToday: boolean;
};

type Props = {
  days: WeekDay[];
  selectedDate: string | null;
  onSelect: (date: string) => void;
};

/** Höhe der freien Bubble-Fläche. */
const CANVAS_HEIGHT = 360;

/** Deterministische Pseudo-Zufallszahl 0..1 aus einem String. */
function seededRand(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return ((h >>> 0) % 1000) / 1000;
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export function WeekBubbles({ days, selectedDate, onSelect }: Props) {
  const [width, setWidth] = useState(0);

  // Pop-in pro Tag: scale 0 → 1 mit Overshoot, 50 ms Staffelung.
  const pops = useRef(days.map(() => new Animated.Value(0))).current;
  useEffect(() => {
    const timers = days.map((_, i) =>
      setTimeout(() => {
        Animated.spring(pops[i], {
          toValue: 1,
          friction: 5,
          tension: 60,
          useNativeDriver: NATIVE_DRIVER,
        }).start();
      }, i * 50),
    );
    return () => timers.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Alle Bubbles der Woche auf der gemeinsamen Fläche platzieren.
  const bubbles =
    width > 0
      ? days.flatMap((d, i) => {
          // TEMP: Test-Durchlauf – NUR der Test-Tag rendert Bubbles auf der
          // Fläche, alle anderen Tage bewusst leer. Die Wochentag-Pillen
          // unten bleiben davon unberührt (eigener Render-Block).
          const isTestDay = d.label === TEST_MULTI_MOOD_DAY_LABEL;
          if (!isTestDay) return [];

          // TEMP: Beispiel-Verteilung mit allen 5 Kategorien statt der
          // echten Tagesdaten (siehe TEST_MULTI_MOOD_DISTRIBUTION).
          const visible = TEST_MULTI_MOOD_DISTRIBUTION.filter(
            (m) => m.percent >= MIN_PERCENT,
          );

          // Der Test-Tag darf die GESAMTE Canvas-Breite nutzen (keine
          // konkurrierenden Tage): organische Streuung über die volle
          // Fläche, Größen klar nach Prozentanteil gestaffelt.
          const maxD = Math.min(CANVAS_HEIGHT * 0.62, width * 0.6);
          const minD = 36;
          return visible.map((m, k) => {
            const diameter = clamp(
              minD + (m.percent / 100) * (maxD - minD),
              minD,
              maxD,
            );
            // Diagonale Grundverteilung über die volle Breite (größte oben
            // links → kleinste unten rechts) + Seed-Versatz für Organik.
            const baseX = width * ((k + 0.5) / visible.length);
            const baseY = CANVAS_HEIGHT * (0.25 + 0.5 * seededRand(`${d.date}-${m.level}-base`));
            const jx = (seededRand(`${d.date}-${m.level}-x`) - 0.5) * width * 0.22;
            const jy = (seededRand(`${d.date}-${m.level}-y`) - 0.5) * CANVAS_HEIGHT * 0.3;
            return {
              key: `${d.date}-${m.level}`,
              dayIndex: i,
              level: m.level,
              d: diameter,
              x: clamp(baseX + jx, diameter / 2 - width * 0.04, width - diameter / 2 + width * 0.04),
              y: clamp(baseY + jy, diameter / 2, CANVAS_HEIGHT - diameter / 2),
            };
          });
        })
      : [];

  return (
    <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      {/* Freie Fläche – bewusst OHNE Karten-/Spalten-Optik auf reinem Weiß */}
      <View style={styles.canvas}>
        {bubbles.map((b) => (
          <Animated.View
            key={b.key}
            style={{
              position: 'absolute',
              left: b.x - b.d / 2,
              top: b.y - b.d / 2,
              transform: [{ scale: pops[b.dayIndex] }],
            }}
            pointerEvents="none"
          >
            <GelBubble color={moodColor[b.level]} size={b.d} />
          </Animated.View>
        ))}
      </View>

      {/* Unabhängige Tages-Zeile: freistehende Kapseln, keine Verbindung nach oben */}
      <View style={styles.pillRow}>
        {days.map((d) => {
          const selected = d.date === selectedDate;
          const empty = d.moods.length === 0;
          return (
            <Pressable
              key={d.date}
              onPress={() => onSelect(d.date)}
              style={[
                styles.pill,
                d.isToday && styles.pillToday,
                selected && styles.pillSelected,
              ]}
              accessibilityRole="button"
              accessibilityLabel={
                empty
                  ? `${d.label} ${d.day}., kein Eintrag`
                  : `${d.label} ${d.day}., überwiegend ${moodLabel[d.moods[0].level]}`
              }
            >
              <Text
                style={[
                  styles.pillLabel,
                  empty && styles.pillLabelEmpty,
                  selected && styles.pillTextSelected,
                ]}
              >
                {d.label.toUpperCase()}
              </Text>
              <Text
                style={[
                  styles.pillDay,
                  empty && styles.pillLabelEmpty,
                  selected && styles.pillTextSelected,
                ]}
              >
                {d.day}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  canvas: { height: CANVAS_HEIGHT },
  pillRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
    marginTop: 12,
  },
  pill: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 22,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  pillToday: { borderColor: colors.textFaint },
  pillSelected: { backgroundColor: '#111111', borderColor: '#111111' },
  pillLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
    color: colors.textMuted,
  },
  pillDay: { fontSize: 15, fontWeight: '600', color: colors.text, marginTop: 2 },
  pillLabelEmpty: { color: colors.textFaint },
  pillTextSelected: { color: '#FFFFFF' },
});
