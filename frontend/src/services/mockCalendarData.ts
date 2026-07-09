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
 */
import { MoodLevel } from '../theme/moodColors';

export type MockDayDistribution = {
  /** Wochentags-Offset relativ zum Montag der aktuellen Woche (0 = Mo). */
  weekdayOffset: number;
  moods: { level: MoodLevel; percent: number }[];
};

export const MOCK_WEEK: MockDayDistribution[] = [
  {
    // Montag: schwer dominiert, etwas Dankbarkeit/Ruhe
    weekdayOffset: 0,
    moods: [
      { level: 'bad', percent: 70 },
      { level: 'good', percent: 15 },
      { level: 'great', percent: 10 },
      { level: 'neutral', percent: 5 },
    ],
  },
  {
    // Dienstag: gedrückt, aber mit gutem Abend
    weekdayOffset: 1,
    moods: [
      { level: 'low', percent: 55 },
      { level: 'neutral', percent: 25 },
      { level: 'good', percent: 20 },
    ],
  },
  {
    // Mittwoch: ausgeglichen mit leichtem Hoch
    weekdayOffset: 2,
    moods: [
      { level: 'neutral', percent: 45 },
      { level: 'good', percent: 40 },
      { level: 'low', percent: 13 },
      { level: 'bad', percent: 2 }, // < MIN_PERCENT → nur im Detail sichtbar
    ],
  },
  {
    // Donnerstag: richtig guter Tag
    weekdayOffset: 3,
    moods: [
      { level: 'great', percent: 60 },
      { level: 'good', percent: 30 },
      { level: 'neutral', percent: 10 },
    ],
  },
  {
    // Freitag: gemischt, kleine Spitze nach unten
    weekdayOffset: 4,
    moods: [
      { level: 'good', percent: 35 },
      { level: 'low', percent: 30 },
      { level: 'great', percent: 20 },
      { level: 'bad', percent: 15 },
    ],
  },
];
