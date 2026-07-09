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

/**
 * Beschreibende Zeile zur GESAMTEN Woche, abgeleitet aus der dominanten
 * Kategorie der Wochen-Aggregation. Gleiche Tonalitäts-Regeln wie oben:
 * Aussage statt Diagnose, kein Gesprächspartner-Ton.
 */
const WEEK_LINES: Record<MoodLevel, string> = {
  bad: 'Eine schwere Woche.',
  low: 'Eine eher gedrückte Woche.',
  neutral: 'Eine ausgeglichene, ruhige Woche.',
  good: 'Eine überwiegend gute Woche.',
  great: 'Eine überwiegend leichte, schöne Woche.',
};

/** Gemischte Woche mit echtem Kontrast (eine klar positive + eine klar negative Kategorie). */
const WEEK_MIXED_CONTRAST = 'Eine Woche mit Höhen und Tiefen.';
/** Gemischt, aber ohne starken Kontrast (benachbarte Kategorien, z. B. gut + neutral). */
const WEEK_MIXED_ADJACENT = 'Eine Woche ohne klare Richtung.';

/**
 * Position auf der Stimmungsskala (positiv > 0, negativ < 0, neutral = 0).
 * Das Vorzeichen entscheidet, ob zwei Kategorien „über die Mitte" liegen.
 */
const SCALE_POS: Record<MoodLevel, number> = {
  great: 2,
  good: 1,
  neutral: 0,
  low: -1,
  bad: -2,
};

/**
 * Liefert die Wochen-Zeile aus den Kategorie-Anteilen (absteigend sortiert).
 * Liegen die Top-2 näher als MIXED_MARGIN zusammen, gilt die Woche als gemischt:
 * „Höhen und Tiefen" nur, wenn die beiden Kategorien tatsächlich über die Mitte
 * liegen (eine positiv, eine negativ) – sonst der neutralere „ohne klare
 * Richtung"-Satz. Ohne Daten: leerer String (Aufrufer blendet dann nichts ein).
 */
export function weekMoodLine(entries: { level: MoodLevel; share: number }[]): string {
  if (!entries.length) return '';
  if (entries.length > 1 && entries[0].share - entries[1].share < MIXED_MARGIN) {
    const [a, b] = entries;
    const contrast = SCALE_POS[a.level] * SCALE_POS[b.level] < 0;
    return contrast ? WEEK_MIXED_CONTRAST : WEEK_MIXED_ADJACENT;
  }
  return WEEK_LINES[entries[0].level];
}
