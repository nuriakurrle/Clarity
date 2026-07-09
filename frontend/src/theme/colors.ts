/**
 * Clarity – zentrale Farbpalette.
 * Ruhiges, "privacy-first" Journaling-Look & Feel.
 * Gemeinsam genutzt von allen Screens, damit das Design konsistent bleibt.
 */
export const colors = {
  // Flächen (app-weit reines Weiß – Blob-Redesign)
  bg: '#FFFFFF',
  surface: '#FFFFFF',
  surfaceAlt: '#F1EFEA',

  // Text
  text: '#1F2421',
  textMuted: '#6B7B73',
  textFaint: '#A7B0AA',

  // Akzent (ruhiges Grün)
  primary: '#5B8A72',
  primarySoft: '#E3EEE7',

  border: '#E7E5DF',
  shadow: '#000000',

  // Warme Akzente (Home / Verlauf / Eintrag schreiben – Journal-Look)
  warm: '#C9784B',
  warmSoft: '#F3CDB0',
  warmSofter: '#FBEAE0',
  warmSage: '#EEF1E5',
  warmHighlight: '#E3D3B5',
  navBg: '#FBE4D2',

  // Stimmungs-Palette (von gut nach schlecht) – satte Blob-Farben.
  // Bewusst dunkler/gesättigter (Tailwind-600 statt -500), damit nach
  // Blur + Fade im Mood-Blob genug Farbkraft übrig bleibt.
  moodGreat: '#16A34A', // Grün
  moodGood: '#0891B2', // Türkis
  moodNeutral: '#CA8A04', // Gelb
  moodLow: '#2563EB', // Blau
  moodBad: '#DC2626', // Rot
} as const;

export type MoodLevel = 'great' | 'good' | 'neutral' | 'low' | 'bad';

export const moodColor: Record<MoodLevel, string> = {
  great: colors.moodGreat,
  good: colors.moodGood,
  neutral: colors.moodNeutral,
  low: colors.moodLow,
  bad: colors.moodBad,
};

export const moodLabel: Record<MoodLevel, string> = {
  great: 'Sehr gut',
  good: 'Gut',
  neutral: 'Neutral',
  low: 'Gedrückt',
  bad: 'Schwer',
};

/**
 * Zwei Hex-Farben mischen (amount 0..1 = Anteil der Zielfarbe).
 * Z.B. mixHex(moodColor.good, '#FFFFFF', 0.5) → pastellige Variante.
 */
export function mixHex(hex: string, target: string, amount: number): string {
  const parse = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const [r1, g1, b1] = parse(hex);
  const [r2, g2, b2] = parse(target);
  const ch = (a: number, b: number) =>
    Math.round(a + (b - a) * amount)
      .toString(16)
      .padStart(2, '0');
  return `#${ch(r1, r2)}${ch(g1, g2)}${ch(b1, b2)}`;
}

/** Valenz des Sentiment-Agenten (-1..+1) auf die fünfstufige Skala abbilden. */
export function valenceToMoodLevel(valence: number): MoodLevel {
  if (valence >= 0.6) return 'great';
  if (valence >= 0.2) return 'good';
  if (valence >= -0.2) return 'neutral';
  if (valence >= -0.6) return 'low';
  return 'bad';
}
