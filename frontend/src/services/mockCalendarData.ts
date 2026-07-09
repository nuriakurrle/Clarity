/**
 * MOCK-Daten für den Bubble-Kalender.
 *
 * TODO: Nur Fallback! Wird ausschließlich verwendet, wenn das Backend nicht
 * erreichbar ist oder noch keine Einträge existieren – sobald echte Einträge
 * da sind, berechnet CalendarScreen die Verteilungen aus fetchEntries().
 *
 * Prozentuale Mood-Verteilung pro Wochentag (Mo–Fr), Summe je Tag = 100.
 * Stufen entsprechen der 5-Stufen-Skala aus theme/colors.ts
 * (great/good/neutral/low/bad), nicht einzelnen Emotionen.
 *
 * Bewusst positiv gehalten: Über die Woche summiert (siehe unten) ist
 * „Sehr gut" (great) klar die dominante Kategorie – das spiegelt eine
 * überwiegend positive Woche und macht den größten Klecks im 5-Klekse-Modell
 * eindeutig grün, nicht nur knapp vorn.
 *
 *   Wochensumme je Kategorie (Σ über Mo–Fr):
 *     great   250   ← klar dominant (~1,7× der nächsten)
 *     good    143
 *     neutral  69
 *     low      26
 *     bad      12
 */
import { MoodLevel } from '../theme/moodColors';

export type MockDayDistribution = {
  /** Wochentags-Offset relativ zum Montag der aktuellen Woche (0 = Mo). */
  weekdayOffset: number;
  moods: { level: MoodLevel; percent: number }[];
};

export const MOCK_WEEK: MockDayDistribution[] = [
  {
    // Montag: guter Start, überwiegend sehr gut
    weekdayOffset: 0,
    moods: [
      { level: 'great', percent: 45 },
      { level: 'good', percent: 30 },
      { level: 'neutral', percent: 15 },
      { level: 'low', percent: 7 },
      { level: 'bad', percent: 3 }, // < MIN_PERCENT → nur im Detail sichtbar
    ],
  },
  {
    // Dienstag: richtig starker Tag
    weekdayOffset: 1,
    moods: [
      { level: 'great', percent: 55 },
      { level: 'good', percent: 25 },
      { level: 'neutral', percent: 12 },
      { level: 'low', percent: 5 },
      { level: 'bad', percent: 3 }, // < MIN_PERCENT → nur im Detail sichtbar
    ],
  },
  {
    // Mittwoch: gut, mit ruhiger Note
    weekdayOffset: 2,
    moods: [
      { level: 'great', percent: 40 },
      { level: 'good', percent: 35 },
      { level: 'neutral', percent: 20 },
      { level: 'low', percent: 5 },
    ],
  },
  {
    // Donnerstag: bester Tag der Woche
    weekdayOffset: 3,
    moods: [
      { level: 'great', percent: 60 },
      { level: 'good', percent: 25 },
      { level: 'neutral', percent: 10 },
      { level: 'low', percent: 3 },
      { level: 'bad', percent: 2 }, // < MIN_PERCENT → nur im Detail sichtbar
    ],
  },
  {
    // Freitag: weiterhin positiv, kleine Tiefs
    weekdayOffset: 4,
    moods: [
      { level: 'great', percent: 50 },
      { level: 'good', percent: 28 },
      { level: 'neutral', percent: 12 },
      { level: 'low', percent: 6 },
      { level: 'bad', percent: 4 },
    ],
  },
];
