/**
 * Prompt-Agent-API (Port 8003): kontextbezogene Reflexionsfragen.
 *
 * Der Prompt-Agent orchestriert die anderen Agents selbst (live mit
 * persist=false, sonst zuletzt gespeicherte Ergebnisse). Über die use*-Flags
 * lassen sich Komponenten abschalten; `sentiment` aus der Mood-Auswahl wirkt
 * als Override und erspart dem Agent den Sentiment-Aufruf. Ist der Agent
 * nicht erreichbar (Offline-Modus), kommen die Fragen aus der lokalen
 * Bibliothek.
 */
import { request } from './api';
import { offlinePrompts } from './promptLibrary';
import type { MoodLevel } from '../theme/colors';

export type PromptMode = 'starter' | 'reflection';
export type PromptSource = 'ollama' | 'mixed' | 'library';

export type ReflectionPrompts = {
  prompts: string[];
  mode: PromptMode;
  source: PromptSource;
  /** Welche Agents tatsächlich in die Fragen eingeflossen sind. */
  contextUsed: string[];
};

/** Mood-Auswahl aus dem Editor (5-Stufen-Skala aus theme/colors) →
 *  Sentiment-Beschreibung für den Agent. Die Begriffe matchen die
 *  Polaritäts-Heuristiken in promptLibrary (Frontend) und
 *  prompt_library.py (Backend). */
export function moodToSentiment(mood: MoodLevel | null | undefined): string | undefined {
  switch (mood) {
    case 'great':
      return 'sehr positiv';
    case 'good':
      return 'positiv';
    case 'neutral':
      return 'neutral';
    case 'low':
      return 'niedergeschlagen';
    case 'bad':
      return 'sehr schlecht';
    default:
      return undefined;
  }
}

/** Holt 4 Reflexionsfragen vom Prompt-Agent (POST /generate-prompts).
 *  `entries` sind bisherige Einträge für Pattern-/Digest-Kontext; die Analyse
 *  läuft serverseitig ohne zu speichern (persist=false). Erst wenn der Agent
 *  selbst nicht antwortet, greift die lokale Offline-Bibliothek. */
export async function fetchReflectionPrompts(
  text: string,
  opts?: {
    entries?: string[];
    entryId?: number;
    useSentiment?: boolean;
    usePattern?: boolean;
    useDigest?: boolean;
    sentiment?: string;
    emotions?: string[];
    blockedTopics?: string[];
  },
): Promise<ReflectionPrompts> {
  const isStarter = text.trim().length < 15;
  try {
    const data = await request<{
      prompts: string[];
      mode: string;
      source: PromptSource;
      context_used: string[];
    }>(
      'prompt',
      '/generate-prompts',
      {
        method: 'POST',
        body: JSON.stringify({
          text,
          entries: opts?.entries ?? [],
          entry_id: opts?.entryId ?? null,
          use_sentiment: opts?.useSentiment ?? true,
          use_pattern: opts?.usePattern ?? true,
          use_digest: opts?.useDigest ?? false,
          // Sentiment-Override als Objekt, passend zum Agent-Schema:
          sentiment: opts?.sentiment
            ? { sentiment: opts.sentiment, emotions: opts?.emotions ?? [] }
            : null,
          blocked_topics: opts?.blockedTopics ?? null,
        }),
      },
      // Live-Analysen (bis 45s) + Ollama-Generierung (bis 30s) abdecken
      120000,
    );
    return {
      prompts: data.prompts ?? [],
      mode: data.mode === 'starter' ? 'starter' : 'reflection',
      source: data.source ?? 'ollama',
      contextUsed: data.context_used ?? [],
    };
  } catch (error) {
    console.warn('[promptApi] Prompt-Agent offline – nutze lokale Bibliothek:', error);
    return {
      prompts: offlinePrompts({
        sentiment: opts?.sentiment,
        blockedTopics: opts?.blockedTopics,
        starter: isStarter,
      }),
      mode: isStarter ? 'starter' : 'reflection',
      source: 'library',
      contextUsed: [],
    };
  }
}
