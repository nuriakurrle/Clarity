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
// Sentiment (8001), Pattern (8002), Prompt (8003), Digest (8004)
// und Transcribe (8005, Whisper Speech-to-Text).
const PORTS = {
  sentiment: 8001,
  pattern: 8002,
  prompt: 8003,
  digest: 8004,
  transcribe: 8005,
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
  /** Die Analyse läuft im Backend als Hintergrund-Task ("queued"). */
  status: string;
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

export type EntryRecord = {
  id: number;
  content: string;
  created_at: string; // "YYYY-MM-DD HH:MM:SS"
  sentiment: 'positive' | 'neutral' | 'negative' | null;
  valence: number | null;
  primary_emotion: string | null;
};

export type Digest = {
  week_start?: string;
  summary: string;
  highlights: string[];
  challenges: string[];
  growth: string[];
  affirmation: string;
};

/** Ergebnis des Pattern-Agents (wiederkehrende Muster über mehrere Einträge). */
export type PatternResult = {
  recurring_themes: string[];
  recurring_people: string[];
  situations: string[];
  triggers: Record<string, string>;
  language_shifts: string[];
  observations: string[];
  theme_counts?: Record<string, number>;
  new_themes?: string[];
  theme_changes?: Record<string, string>;
  mood_trend: 'improving' | 'stable' | 'declining';
  summary: string;
  created_at?: string;
  status?: 'no_data' | 'insufficient_data';
};

/** Ein Schlagwort aus den Einträgen (Pattern-Agent, GET /keywords).
 *  `count` = in wie vielen Einträgen es vorkommt, `valence` = durchschnittliche
 *  Stimmung dieser Einträge (-1..+1) → bestimmt die Farbe der „Key-Themes"-Pille. */
export type KeywordItem = {
  word: string;
  count: number;
  valence: number;
};

export type KeywordsResult = {
  days: number;
  entry_count: number;
  keywords: KeywordItem[];
};

/** Ergebnis des Transcribe-Agents (Whisper Speech-to-Text). */
export type TranscriptionResult = {
  text: string;
  /** Automatisch erkannte Sprache ("de", "en", …). */
  language: string;
  language_probability: number;
  duration: number;
};

/** Ergebnis des Prompt-Agents (reflektive Fragen). */
export type PromptResponse = {
  question: string;
  prompt_type: string;
  category: string;
  subcategory?: string | null;
  context_reason: string;
  suggested_timing?: string;
  entry_id?: number;
  language: string;
};

// --- Aufrufe ------------------------------------------------------------------

/** Speichert einen Tagebucheintrag und analysiert ihn (Sentiment-Agent).
 *  `selfReportedMood` ist die optionale Stimmungsauswahl aus dem Editor
 *  (bad…great) und fließt als Zusatz-Kontext in die Analyse ein.
 *  Die LLM-Analyse kann auf dem lokalen Rechner eine Weile dauern. */
export function analyzeEntry(text: string, selfReportedMood?: string): Promise<AnalyzeResult> {
  return request<AnalyzeResult>(
    'sentiment',
    '/analyze',
    { method: 'POST', body: JSON.stringify({ text, self_reported_mood: selfReportedMood ?? null }) },
    300000,
  );
}

/** Longitudinales Stimmungsprofil der letzten `days` Tage (Sentiment-Agent). */
export function fetchMoodProfile(days = 7): Promise<MoodProfile> {
  return request<MoodProfile>('sentiment', `/mood-profile?days=${days}`);
}

/** Alle Tagebucheinträge inkl. Stimmung, neueste zuerst (Sentiment-Agent). */
export function fetchEntries(): Promise<{ entries: EntryRecord[] }> {
  return request<{ entries: EntryRecord[] }>('sentiment', '/entries');
}

/** Letzter gespeicherter Wochenrückblick (Digest-Agent). */
export function fetchLatestDigest(): Promise<Digest> {
  return request<Digest>('digest', '/digest/latest');
}

/** Zuletzt erkannte wiederkehrende Muster & Trigger (Pattern-Agent). */
export function fetchLatestPatterns(): Promise<PatternResult> {
  return request<PatternResult>('pattern', '/patterns/latest');
}

/** Meistgenutzte Schlagwörter der letzten `days` Tage inkl. Stimmungswert
 *  (Sentiment-Agent, GET /keywords). Deterministisch – kommt sofort, kein LLM. */
export function fetchKeywords(days = 30, limit = 10): Promise<KeywordsResult> {
  return request<KeywordsResult>('sentiment', `/keywords?days=${days}&limit=${limit}`);
}

/** Stößt eine Musteranalyse über die letzten `days` Tage an (Pattern-Agent).
 *  Ohne `entries` liest der Agent die echten Einträge aus der DB. Läuft im
 *  Hintergrund; das Ergebnis wird gespeichert und später via fetchLatestPatterns
 *  gelesen. Die LLM-Analyse kann eine Weile dauern. */
export function detectPatterns(days = 7): Promise<PatternResult> {
  return request<PatternResult>(
    'pattern',
    '/detect-patterns',
    { method: 'POST', body: JSON.stringify({ days }) },
    300000,
  );
}

/** Transkribiert eine Audio-Aufnahme lokal per Whisper (Transcribe-Agent).
 *  Die Sprache (Deutsch/Englisch) wird automatisch erkannt. Multipart-Upload,
 *  deshalb nicht über den JSON-`request`-Helper: Der Browser/RN setzt den
 *  Content-Type mit Boundary selbst. Native schickt die Datei-URI direkt,
 *  im Web wird die Blob-URL der MediaRecorder-Aufnahme erst geladen. */
export async function transcribeAudio(uri: string): Promise<TranscriptionResult> {
  const url = `${baseUrl('transcribe')}/transcribe`;
  try {
    if (uri.startsWith('blob:') || uri.startsWith('data:')) {
      // Web: MediaRecorder liefert eine Blob-URL (webm/mp4 je nach Browser)
      const blob = await (await fetch(uri)).blob();
      const ext = blob.type.includes('webm') ? 'webm' : 'm4a';
      const form = new FormData();
      form.append('file', new File([blob], `recording.${ext}`, { type: blob.type || 'audio/webm' }));
      const res = await fetch(url, { method: 'POST', body: form });
      if (!res.ok) throw new Error(`HTTP ${res.status} von ${url}`);
      return (await res.json()) as TranscriptionResult;
    }

    // Nativ: Upload über React Natives XMLHttpRequest statt fetch/expo-file-system.
    // Grund: `expo/fetch` (globales fetch) akzeptiert kein { uri }-FormData-Teil
    // ("Unsupported FormDataPart implementation") und expo-file-system darf in
    // Expo Go den Aufnahme-Ordner von expo-audio nicht lesen ("Missing 'READ'
    // permission" / "isn't readable"). RNs eigener Netzwerk-Stack liest die
    // Datei nativ und kennt beide Einschränkungen nicht.
    return await new Promise<TranscriptionResult>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', url);
      xhr.timeout = 300000;
      xhr.onload = () => {
        if (xhr.status === 200) {
          try {
            resolve(JSON.parse(xhr.responseText) as TranscriptionResult);
          } catch {
            reject(new Error(`Ungültige Antwort von ${url}`));
          }
        } else {
          reject(new Error(`HTTP ${xhr.status} von ${url}`));
        }
      };
      xhr.onerror = () => reject(new Error(`Netzwerkfehler beim Upload (${url})`));
      xhr.ontimeout = () => reject(new Error(`Zeitüberschreitung beim Upload (${url})`));

      const ext = uri.split('.').pop()?.toLowerCase() ?? 'm4a';
      const form = new FormData();
      form.append('file', {
        uri,
        name: `recording.${ext}`,
        type: `audio/${ext}`,
      } as unknown as Blob);
      xhr.send(form);
    });
  } catch (e) {
    // Netzwerkfehler um die Ziel-URL anreichern – "Network request failed"
    // allein verrät nicht, welchen Host die App erreichen wollte.
    if (e instanceof Error && !e.message.includes(url)) {
      throw new Error(`${e.message} (${url})`);
    }
    throw e;
  }
}

/** Generiert eine reflektive Frage basierend auf dem Journal-Text (Prompt-Agent).
 *  Kontextabhängig - passt die Frage an Kontext, Stimmung und Muster an.
 *  Die Antwort enthält einen Grund, warum diese Frage gewählt wurde (Explainability). */
export function generatePrompt(params: {
  journal_text: string;
  context?: 'editor_open' | 'post_entry' | 'home_screen' | 'weekly' | 'morning' | 'evening';
  streak_days?: number;
}): Promise<PromptResponse> {
  return request<PromptResponse>(
    'prompt',
    '/generate-prompt',
    {
      method: 'POST',
      body: JSON.stringify({
        journal_text: params.journal_text,
        context: params.context ?? 'editor_open',
        streak_days: params.streak_days ?? 0,
      }),
    },
    30000,
  );
}
