/**
 * Prompt-Agent-API (Port 8003): kontextbezogene Reflexionsfragen.
 *
 * Den Sentiment-/Pattern-/Digest-Kontext holt sich der Prompt-Agent selbst
 * von den anderen Agents – die `opts` hier sind nur Overrides (z. B. die
 * Mood-Auswahl aus dem Editor als Live-Stimmung). Ist der Agent nicht
 * erreichbar (Offline-Modus), kommen die Fragen aus der lokalen Bibliothek.
 */
import { request } from './api';
import { offlinePrompts } from './promptLibrary';

export type PromptMode = 'starter' | 'reflection';
export type PromptSource = 'ollama' | 'mixed' | 'library';

export type ReflectionPrompts = {
  prompts: string[];
  mode: PromptMode;
  source: PromptSource;
};

/** Mood-Auswahl aus dem Editor → Sentiment-Beschreibung für den Agent. */
export function moodToSentiment(mood: string | null): string | undefined {
  switch (mood) {
    case '🥰':
      return 'sehr positiv';
    case '😊':
      return 'positiv';
    case '😕':
      return 'gemischt';
    case '😢':
      return 'traurig';
    case '😔':
      return 'niedergeschlagen';
    default:
      return undefined;
  }
}

/** Holt 4 Reflexionsfragen vom Prompt-Agent (POST /generate-prompts).
 *  Der Agent sammelt fehlenden Kontext selbst (Sentiment/Pattern/Digest)
 *  und generiert via Ollama; offline fällt er serverseitig auf seine
 *  Bibliothek zurück. Erst wenn der Agent selbst nicht antwortet, greift
 *  die lokale Offline-Bibliothek (source = "library"). */
export async function fetchReflectionPrompts(
  text: string,
  opts?: {
    entryId?: number;
    sentiment?: string;
    emotions?: string[];
    blockedTopics?: string[];
  },
): Promise<ReflectionPrompts> {
  const isStarter = text.trim().length < 15;
  try {
    const data = await request<ReflectionPrompts>(
      'prompt',
      '/generate-prompts',
      {
        method: 'POST',
        body: JSON.stringify({
          text,
          entry_id: opts?.entryId ?? null,
          // Sentiment-Override als Objekt, passend zum Agent-Schema:
          sentiment: opts?.sentiment
            ? { sentiment: opts.sentiment, emotions: opts?.emotions ?? [] }
            : null,
          blocked_topics: opts?.blockedTopics ?? null,
        }),
      },
      // Kontext-Fetch (~5s) + Ollama-Generierung (bis 30s) abdecken
      45000,
    );
    return {
      prompts: data.prompts ?? [],
      mode: data.mode === 'starter' ? 'starter' : 'reflection',
      source: data.source ?? 'ollama',
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
    };
  }
}
