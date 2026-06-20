/**
 * Clarity – zentrale Farbpalette.
 * Ruhiges, "privacy-first" Journaling-Look & Feel.
 * Gemeinsam genutzt von allen Screens, damit das Design konsistent bleibt.
 */
export const colors = {
  // Flächen
  bg: '#F7F6F3',
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

  // Stimmungs-Palette (von gut nach schlecht)
  moodGreat: '#5B8A72',
  moodGood: '#9CC5A1',
  moodNeutral: '#E3C770',
  moodLow: '#E0A16B',
  moodBad: '#C97B7B',
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
