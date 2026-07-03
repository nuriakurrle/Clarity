/**
 * Zentrale API-Schicht für die vier Backend-Agenten (Docker, Ports 8001-8004).
 *
 * Die Agenten laufen auf dem Entwicklungsrechner. In Expo Go zeigt
 * `Constants.expoConfig.hostUri` auf genau diesen Rechner (z. B.
 * "192.168.2.34:8081") – daraus leiten wir die Basis-IP ab, damit das
 * Handy die Agenten im selben WLAN erreicht. Im Web-Build (localhost)
 * funktioniert derselbe Mechanismus über den Fallback.
 */
import Constants from 'expo-constants';

// Bewusst nur die Agenten, deren Endpoints wir aktuell nutzen:
// Sentiment (eigener Agent) und Digest (hat bereits GET /digest/latest).
const PORTS = {
  sentiment: 8001,
  digest: 8004,
} as const;

type AgentName = keyof typeof PORTS;

function resolveHost(): string {
  const hostUri = Constants.expoConfig?.hostUri;
  if (hostUri) return hostUri.split(':')[0];
  return 'localhost';
}

const HOST = resolveHost();

function baseUrl(agent: AgentName): string {
  return `http://${HOST}:${PORTS[agent]}`;
}

async function request<T>(
  agent: AgentName,
  path: string,
  init?: RequestInit,
  timeoutMs = 15000,
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${baseUrl(agent)}${path}`, {
      ...init,
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json', ...init?.headers },
    });
    if (!res.ok) {
      throw new Error(`${agent} ${path}: HTTP ${res.status}`);
    }
    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

// --- Typen (Antwortformate der Agenten) --------------------------------------

export type SentimentAnalysis = {
  sentiment: 'positive' | 'neutral' | 'negative';
  valence: number;
  intensity: number;
  tone: string;
  primary_emotion: string;
  secondary_emotions: string[];
  confidence: number;
  reasoning?: string;
};

export type AnalyzeResult = {
  entry_id: number;
  analysis: SentimentAnalysis;
};

export type DailyMood = {
  date: string;
  average_valence: number;
  average_intensity: number;
  dominant_emotions: string[];
  mood_shift: string;
  entry_count: number;
};

export type MoodProfile = {
  period_days: number;
  mood_profile: {
    daily_breakdown: DailyMood[];
    start_date: string;
    end_date: string;
  };
  trend_analysis: {
    trend: string;
    valence_change: number;
    valence_trend: string;
    intensity_change: number;
    intensity_trend: string;
    average_valence: number;
    average_intensity: number;
    data_points: number;
  };
};

export type Digest = {
  week_start?: string;
  summary: string;
  highlights: string[];
  challenges: string[];
  growth: string[];
  affirmation: string;
};

// --- Aufrufe ------------------------------------------------------------------

/** Speichert einen Tagebucheintrag und analysiert ihn (Sentiment-Agent).
 *  Die LLM-Analyse kann auf dem lokalen Rechner eine Weile dauern. */
export function analyzeEntry(text: string): Promise<AnalyzeResult> {
  return request<AnalyzeResult>(
    'sentiment',
    '/analyze',
    { method: 'POST', body: JSON.stringify({ text }) },
    300000,
  );
}

/** Longitudinales Stimmungsprofil der letzten `days` Tage (Sentiment-Agent). */
export function fetchMoodProfile(days = 7): Promise<MoodProfile> {
  return request<MoodProfile>('sentiment', `/mood-profile?days=${days}`);
}

/** Letzter gespeicherter Wochenrückblick (Digest-Agent). */
export function fetchLatestDigest(): Promise<Digest> {
  return request<Digest>('digest', '/digest/latest');
}
