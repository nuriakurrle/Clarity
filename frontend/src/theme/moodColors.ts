/**
 * Clarity – zentrale Mood-Farb-Konstanten für das Blob-Redesign.
 *
 * Re-exportiert die kanonische 5-Stufen-Skala aus `colors.ts` (dort gepflegt,
 * damit bestehende Importe weiter funktionieren) und ergänzt Blob-spezifische
 * Helfer, die MoodMirrorBlob, BubbleDay & Co. gemeinsam nutzen.
 */
export { moodColor, moodLabel, valenceToMoodLevel } from './colors';
export type { MoodLevel } from './colors';

/** Platzhalter-Farbe für Tage ohne Eintrag (kleiner, blasser Kreis). */
export const EMPTY_DAY_COLOR = '#E5E7EB';

/** Sanfter Pastell-Default für den Home-Blob, solange keine Einträge existieren. */
export const EMPTY_BLOB_COLORS = ['#A7F3D0', '#BAE6FD', '#FDE68A', '#FBCFE8'];

/**
 * Intensität defensiv auf 0..1 normalisieren.
 * Das Backend liefert `average_intensity` auf einer 0–100-Skala; falls
 * irgendwo bereits 0..1 ankommt, wird nichts verfälscht.
 */
export function normalizeIntensity(v: number | null | undefined): number {
  if (v == null || Number.isNaN(v)) return 0.5;
  const n = v > 1 ? v / 100 : v;
  return Math.min(1, Math.max(0, n));
}

/**
 * Multi-Stop-Fade für weiche Blobs ohne harte Kreisränder.
 *
 * Technik-Entscheidung: react-native-svg <RadialGradient> mit Opacity-Fade
 * auf 0 bereits bei 92 % statt <FeGaussianBlur>. SVG-Filter sind in
 * react-native-svg auf iOS/Android unzuverlässig bzw. teuer; der Fade-Ansatz
 * ist im Projekt erprobt (siehe PromptBubble.tsx) und rendert überall weich.
 * Der 92 %-Stop verhindert sichtbare Kanten durch Rundungsartefakte.
 */
export function makeBlobStops(centerOpacity: number) {
  return [
    { offset: '0%', opacity: centerOpacity },
    { offset: '50%', opacity: centerOpacity * 0.6 },
    { offset: '78%', opacity: centerOpacity * 0.22 },
    { offset: '92%', opacity: 0 },
    { offset: '100%', opacity: 0 },
  ] as const;
}

/** Standard-Fade für Kalender-Bubbles u. Ä. */
export const BLOB_STOPS = makeBlobStops(0.55);
