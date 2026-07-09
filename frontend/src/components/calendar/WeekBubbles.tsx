/**
 * Wochenansicht im 5-Klekse-Modell: EINE freie Fläche (Canvas) mit genau
 * einem weichen Farbklecks pro Mood-Kategorie (Sehr gut, Gut, Neutral,
 * Gedrückt, Schwer). Die Größe eines Klecks ist proportional zur WOCHENSUMME
 * seiner Kategorie – die Fläche (nicht der Durchmesser) wächst linear mit der
 * Summe, deshalb Radius ∝ √Summe. Kategorien ohne Anteil erscheinen nicht.
 *
 * Die Woche wird IMMER direkt als Ganzes gezeigt (kein Tap nötig) – die
 * Tages-Granularität liegt in der Monatsansicht.
 *
 * Jeder Klecks = eine Mood-Farbe (GelBubble: satter Gradient + Blur + Saturate
 * + gemeinsame Fade-Maske + Grain, KEIN Glanz/Schatten – reiner Farbfleck).
 * Bewegung: pro Klecks ein eigener, phasenverschobener RN-Animated-Drift
 * (translate + leichte Scale-Variation, 4–8 s), analog zum Home-Blob – sanftes
 * Schweben statt Stillstand; Überlappungen sind gewollt, Farben bleiben
 * getrennt. Eingang: gestaffelter Pop-in-Spring pro Klecks.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Platform, StyleSheet, View } from 'react-native';
import { moodColor, MoodLevel } from '../../theme/moodColors';
import { GelBubble } from './GelBubble';

const NATIVE_DRIVER = Platform.OS !== 'web';

/** Kategorie-Reihenfolge (positiv → negativ) für stabile, deterministische Sortierung. */
const MOOD_ORDER: readonly MoodLevel[] = ['great', 'good', 'neutral', 'low', 'bad'];

/**
 * Schwelle für den Detailbereich (CalendarScreen): Mood-Anteile unter diesem
 * Prozentsatz werden dort als „weitere Emotionen" gesammelt statt als eigene
 * Pill gezeigt. Für die Wochen-Kleckse selbst irrelevant, aber hier zentral
 * gepflegt.
 */
export const MIN_PERCENT = 3;

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
};

/** Höhe der freien Bubble-Fläche. */
const CANVAS_HEIGHT = 360;

/** Größter Klecks ≈ 54 % der Canvas-Breite (durch die Höhe gedeckelt). */
const MAX_DIAMETER_W = 0.54;
/** Kleinster Klecks: klar kleiner, aber gut erkennbar. */
const MIN_DIAMETER_W = 0.17;

/**
 * Anteil der KLEINEREN Bubble, der maximal in der größeren liegen darf (0..1).
 * Mindest-Mittelpunktabstand = r_groß + r_klein − 2·r_klein·OVERLAP_FRAC.
 *
 * Diese Formel skaliert – anders als das frühere (r1+r2)·Faktor – korrekt mit
 * großem Größenunterschied: die kleinere Bubble wird immer an die KANTE der
 * größeren gesetzt (Mittelpunkt nie innerhalb der größeren), nur ein Teil von
 * ihr überlappt. Bei 0.4 überlappt die Kleinere höchstens ~40 %; für gleich
 * große Bubbles entspricht das dem alten Faktor 0.6.
 */
const OVERLAP_FRAC = 0.4;

/**
 * Grundpositionen (Anteil an Breite/Höhe) für bis zu 5 Kleckse, über die
 * Fläche verteilt statt geclustert – der größte Klecks liegt zuerst und damit
 * eher zentral, die weiteren füllen die Ecken/Ränder. Seed-Versatz je Klecks
 * lockert das Raster organisch auf.
 */
const ANCHORS: readonly { x: number; y: number }[] = [
  { x: 0.40, y: 0.44 },
  { x: 0.70, y: 0.30 },
  { x: 0.72, y: 0.70 },
  { x: 0.28, y: 0.68 },
  { x: 0.30, y: 0.26 },
];

/**
 * Drift-Konfiguration pro Klecks: unterschiedliche Dauer (4–8 s) und
 * gegenläufige Bewegungsrichtungen, damit nichts synchron/mechanisch wirkt.
 * Bewegungsradius klein (~8–14 px) → ruhiges Schweben, kein Springen.
 */
const DRIFT_CONFIG: readonly {
  dur: number;
  dx: [number, number];
  dy: [number, number];
  scale: [number, number];
}[] = [
  { dur: 4200, dx: [-11, 11], dy: [9, -13], scale: [0.96, 1.06] },
  { dur: 5600, dx: [13, -12], dy: [-12, 9], scale: [1.05, 0.95] },
  { dur: 6800, dx: [-9, 12], dy: [-9, 13], scale: [1.04, 0.96] },
  { dur: 5000, dx: [11, -9], dy: [11, -10], scale: [0.97, 1.05] },
  { dur: 7600, dx: [-8, 12], dy: [-11, 10], scale: [1.03, 0.97] },
];

/** Deterministische Pseudo-Zufallszahl 0..1 aus einem String. */
function seededRand(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return ((h >>> 0) % 1000) / 1000;
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Endlos-Loop 0→1→0 mit sanfter Sinus-Easing-Kurve (wie MoodMirrorBlob). */
function makeLoop(value: Animated.Value, duration: number) {
  return Animated.loop(
    Animated.sequence([
      Animated.timing(value, {
        toValue: 1,
        duration,
        easing: Easing.inOut(Easing.sin),
        useNativeDriver: NATIVE_DRIVER,
      }),
      Animated.timing(value, {
        toValue: 0,
        duration,
        easing: Easing.inOut(Easing.sin),
        useNativeDriver: NATIVE_DRIVER,
      }),
    ]),
  );
}

/**
 * Wochensumme pro Mood-Kategorie: die Tages-Prozentanteile ALLER angezeigten
 * Tage der Woche je Kategorie aufaddieren. Tage ohne Eintrag tragen 0 bei.
 * Ergebnis absteigend nach Summe – Kategorien ohne Anteil fallen raus.
 *
 * Exportiert, damit CalendarScreen dieselbe Aggregation für die Wochen-
 * Zusammenfassung (Text + Prozent-Pills) nutzen kann – eine Quelle für Bubbles
 * und Zusammenfassung, damit sie nie auseinanderlaufen.
 */
export function buildWeekTotals(days: WeekDay[]): { level: MoodLevel; total: number }[] {
  const totals = new Map<MoodLevel, number>();
  for (const d of days) {
    for (const m of d.moods) {
      totals.set(m.level, (totals.get(m.level) ?? 0) + m.percent);
    }
  }
  return MOOD_ORDER.map((level) => ({ level, total: totals.get(level) ?? 0 }))
    .filter((t) => t.total > 0)
    .sort((a, b) => b.total - a.total);
}

export function WeekBubbles({ days }: Props) {
  const [width, setWidth] = useState(0);

  // Ein fester Pool animierter Werte (max. 5 Kategorien): Drift-Loop je Klecks
  // und Pop-in-Spring je Klecks. Über einen einzelnen useRef stabil gehalten.
  const drifts = useRef(Array.from({ length: 5 }, () => new Animated.Value(0))).current;
  const pops = useRef(Array.from({ length: 5 }, () => new Animated.Value(0))).current;

  // Wochensumme → Kleckse mit Position und flächenproportionaler Größe.
  const totals = useMemo(() => buildWeekTotals(days), [days]);
  const bubbles = useMemo(() => {
    if (width === 0 || totals.length === 0) return [];
    const maxTotal = totals[0].total;
    const maxD = Math.min(width * MAX_DIAMETER_W, CANVAS_HEIGHT * 0.6);
    const minD = Math.max(56, width * MIN_DIAMETER_W);

    // Bereits platzierte Kleckse (größte zuerst, da `totals` absteigend ist),
    // damit die Kollisionsauflösung kleinere aus größeren herausdrückt und die
    // dominante Bubble ihren zentralen Platz behält.
    const placed: { x: number; y: number; r: number }[] = [];

    return totals.map((t, k) => {
      // Fläche ∝ Summe  ⇒  Durchmesser ∝ √Summe.
      const diameter = clamp(maxD * Math.sqrt(t.total / maxTotal), minD, maxD);
      const r = diameter / 2;
      const anchor = ANCHORS[k % ANCHORS.length];
      const jx = (seededRand(`${t.level}-x`) - 0.5) * width * 0.12;
      const jy = (seededRand(`${t.level}-y`) - 0.5) * CANVAS_HEIGHT * 0.12;
      let x = width * anchor.x + jx;
      let y = CANVAS_HEIGHT * anchor.y + jy;

      // Kollisionsauflösung: solange der Mittelpunkt einem bereits platzierten
      // Klecks näher als der Mindestabstand ist, entlang der Verbindungslinie
      // wegschieben. Gilt gegen ALLE bereits platzierten (größeren) Kleckse.
      // Deterministisch (Seed); danach in die Fläche zurückklemmen.
      for (let iter = 0; iter < 24; iter++) {
        let moved = false;
        for (const p of placed) {
          const dx = x - p.x;
          const dy = y - p.y;
          const dist = Math.hypot(dx, dy);
          const minDist = r + p.r - 2 * Math.min(r, p.r) * OVERLAP_FRAC;
          if (dist < minDist) {
            if (dist < 0.5) {
              // (nahezu) konzentrisch: in eine deterministische Richtung raus
              const ang = seededRand(`${t.level}-push`) * 2 * Math.PI;
              x = p.x + Math.cos(ang) * minDist;
              y = p.y + Math.sin(ang) * minDist;
            } else {
              const push = minDist - dist;
              x += (dx / dist) * push;
              y += (dy / dist) * push;
            }
            moved = true;
          }
        }
        // Mittelpunkte dürfen leicht über den Rand ragen – die weiche FadeMask
        // blendet die Kleckse ohnehin vor der Kante aus.
        x = clamp(x, r * 0.32, width - r * 0.32);
        y = clamp(y, r * 0.34, CANVAS_HEIGHT - r * 0.34);
        if (!moved) break;
      }

      placed.push({ x, y, r });
      return { key: t.level, level: t.level, d: diameter, x, y, index: k };
    });
  }, [totals, width]);

  // Drift-Loops dauerhaft laufen lassen.
  useEffect(() => {
    const loops = drifts.map((v, i) => makeLoop(v, DRIFT_CONFIG[i].dur));
    loops.forEach((l) => l.start());
    return () => loops.forEach((l) => l.stop());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Pop-in gestaffelt, sobald die Kleckse feststehen (Layout gemessen). Beim
  // Wochenwechsel remountet CalendarScreen die Komponente (key=weekStart) → der
  // Pop-in läuft für die neue Woche automatisch erneut.
  useEffect(() => {
    pops.forEach((p) => p.setValue(0));
    const timers = bubbles.map((b, i) =>
      setTimeout(() => {
        Animated.spring(pops[b.index], {
          toValue: 1,
          friction: 5,
          tension: 60,
          useNativeDriver: NATIVE_DRIVER,
        }).start();
      }, i * 60),
    );
    return () => timers.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bubbles.length, width]);

  return (
    <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      {/* Freie Fläche – bewusst OHNE Karten-/Spalten-Optik auf reinem Weiß */}
      <View style={styles.canvas}>
        {bubbles.map((b) => {
          const cfg = DRIFT_CONFIG[b.index];
          const drift = drifts[b.index];
          return (
            <Animated.View
              key={b.key}
              style={{
                position: 'absolute',
                left: b.x - b.d / 2,
                top: b.y - b.d / 2,
                transform: [
                  { translateX: drift.interpolate({ inputRange: [0, 1], outputRange: cfg.dx }) },
                  { translateY: drift.interpolate({ inputRange: [0, 1], outputRange: cfg.dy }) },
                  { scale: pops[b.index] },
                  { scale: drift.interpolate({ inputRange: [0, 1], outputRange: cfg.scale }) },
                ],
              }}
              pointerEvents="none"
            >
              <GelBubble color={moodColor[b.level]} size={b.d} />
            </Animated.View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  canvas: { height: CANVAS_HEIGHT },
});
