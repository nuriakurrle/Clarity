/**
 * Einfühlsame Wochen-Ansprache für den Home-Screen, abgestimmt auf die
 * dominante Stimmung, die der Mood-Blob gerade zeigt.
 *
 * Formulierungsregeln:
 *  - warm und nicht wertend, keine klinischen/diagnostischen Begriffe
 *  - Beobachtung + offene, aufs SCHREIBEN bezogene Einladung (der Blob-Tap
 *    öffnet den Editor, der Text soll natürlich dorthin überleiten)
 *  - WICHTIG: Die App positioniert sich nie als Gesprächspartner, Zuhörer
 *    oder emotionale Stütze („Ich bin da…", „erzähl mir…" sind tabu) –
 *    sie lädt ausschließlich zum Aufschreiben/Festhalten ein.
 *  - pro Stufe mehrere Varianten; die Auswahl ist pro Tag stabil, damit der
 *    Text nicht bei jedem Re-Render wechselt
 */
import { MoodLevel } from '../theme/moodColors';

export const DEFAULT_PROMPT = 'Was bewegt dich heute?';

const PROMPTS: Record<MoodLevel, string[]> = {
  bad: [
    'Diese Woche steckte viel Schweres in dir. Magst du aufschreiben, was los war?',
    'Es war wohl eine schwere Woche. Was davon möchtest du festhalten?',
  ],
  low: [
    'Diese Woche wirkte etwas gedrückt. Was ist dir durch den Kopf gegangen?',
    'Manche Tage waren wohl schwerer als andere. Magst du festhalten, was dich beschäftigt hat?',
  ],
  neutral: [
    'Eine ausgeglichene Woche liegt hinter dir. Was hat sie geprägt?',
    'Diese Woche war ruhig unterwegs. Was möchtest du festhalten?',
  ],
  good: [
    'Diese Woche hatte viele gute Momente. Was hat dir besonders gutgetan?',
    'Es lief ziemlich rund diese Woche. Was möchtest du dir merken?',
  ],
  great: [
    'Diese Woche steckte viel Freude in dir. Was hat dich zum Strahlen gebracht?',
    'Was für eine gute Woche! Was hat sie so besonders gemacht?',
  ],
};

/** Wenn die zwei stärksten Stimmungen fast gleichauf liegen. */
const MIXED_PROMPTS = [
  'Diese Woche war gemischt. Was ist dir besonders in Erinnerung geblieben?',
  'Hoch und runter diese Woche – was ist dir am meisten in Erinnerung geblieben?',
];

/** Anteil-Schwelle: liegen Top-2 näher beieinander, gilt die Woche als gemischt. */
const MIXED_MARGIN = 0.1;

/** Pro Tag stabile Varianten-Wahl (kein Springen bei Re-Renders). */
function pickDaily(variants: string[]): string {
  return variants[new Date().getDate() % variants.length];
}

/**
 * Liefert die Wochen-Ansprache aus den Blob-Schichten (Stimmung + Anteil,
 * absteigend sortiert). Ohne Daten: neutrale Standard-Frage.
 */
export function weeklyMoodPrompt(
  layers: { level: MoodLevel; share: number }[],
): string {
  if (!layers.length) return DEFAULT_PROMPT;
  if (layers.length > 1 && layers[0].share - layers[1].share < MIXED_MARGIN) {
    return pickDaily(MIXED_PROMPTS);
  }
  return pickDaily(PROMPTS[layers[0].level]);
}

/**
 * Kurze Tages-Beobachtung für den Kalender-Detailbereich – gleiche
 * Tonalitäts-Regeln wie oben: Beobachtung statt Diagnose, kein
 * Gesprächspartner-Ton.
 */
const DAY_LINES: Record<MoodLevel, string> = {
  bad: 'Ein Tag mit viel Schwerem.',
  low: 'Ein eher gedrückter Tag.',
  neutral: 'Ein ausgeglichener Tag.',
  good: 'Ein Tag mit guten Momenten.',
  great: 'Ein richtig guter Tag.',
};

/** Beschreibende Zeile zum ausgewählten Tag (dominante Stimmung). */
export function dayMoodLine(level: MoodLevel): string {
  return DAY_LINES[level];
}
