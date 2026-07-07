import { Platform } from 'react-native';

const hostForPort = (port: number) =>
  Platform.OS === 'android' ? `http://10.0.2.2:${port}` : `http://localhost:${port}`;

const PROMPT_URL = `${hostForPort(8003)}/generate-prompts`;
const REQUEST_TIMEOUT_MS = 3000;

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs = REQUEST_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

export type PromptMode = 'starter' | 'reflection';

export const DEFAULT_TOPICS = [
  'Arbeit',
  'Beziehungen',
  'Familie',
  'Gesundheit',
  'Finanzen',
  'Zukunft',
  'Selbstwert',
];

function clampPrompts(prompts: string[], blockedTopics?: string[]) {
  const blocked = new Set((blockedTopics ?? []).map((topic) => topic.toLowerCase()));
  return prompts.filter((prompt) => ![...blocked].some((topic) => prompt.toLowerCase().includes(topic)));
}

export function getInstantReflectionPrompts(
  text: string,
  opts?: {
    sentiment?: string;
    emotions?: string[];
    blockedTopics?: string[];
  },
): { prompts: string[]; mode: PromptMode } {
  const trimmed = text.trim();
  const hasText = trimmed.length > 12;
  const mode: PromptMode = hasText ? 'reflection' : 'starter';
  const sentiment = (opts?.sentiment ?? '').toLowerCase();
  const emotion = (opts?.emotions ?? [])[0]?.toLowerCase() ?? '';

  const reflectionPool = [
    'Was daran fühlt sich gerade am schwersten an?',
    'Was würdest du heute gern einmal aussprechen?',
    'Welcher Gedanke braucht gerade am meisten Raum?',
    'Was wäre heute ein kleiner, guter nächster Schritt?',
  ];

  const starterPool = [
    'Was ist dir heute leise aufgefallen?',
    'Woran möchtest du heute nicht vorbeischreiben?',
    'Was hat dich heute kurz angehalten?',
    'Welcher Moment war heute am ruhigsten?',
  ];

  const sentimentPool =
    sentiment.includes('neg') || emotion.includes('angst') || emotion.includes('traur')
      ? [
          'Was würde dir jetzt ein kleines bisschen Luft verschaffen?',
          'Was brauchst du gerade am dringendsten?',
          'Wovor möchtest du dich heute nicht allein fühlen?',
          'Was wäre gerade eine freundliche Antwort an dich selbst?',
        ]
      : sentiment.includes('pos')
        ? [
            'Was möchtest du an diesem Gefühl festhalten?',
            'Woran hast du heute gemerkt, dass es dir gutgeht?',
            'Was hat dir heute Energie gegeben?',
            'Welcher gute Moment soll nicht verloren gehen?',
          ]
        : [];

  const pool = sentimentPool.length > 0 ? sentimentPool : mode === 'starter' ? starterPool : reflectionPool;
  return {
    mode,
    prompts: clampPrompts(pool, opts?.blockedTopics).slice(0, 3),
  };
}

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

export async function analyzeSentiment(
  text: string,
): Promise<{ sentiment?: string; emotions?: string[] }> {
  const SENTIMENT_URL = `${hostForPort(8001)}/analyze`;

  try {
    const response = await fetchWithTimeout(SENTIMENT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text, persist: false }),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    return {
      sentiment: data?.analysis?.sentiment ?? data?.sentiment,
      emotions: data?.analysis?.secondary_emotions ?? data?.emotions ?? [],
    };
  } catch (error) {
    console.warn('[promptApi] sentiment fallback used:', error);
    return {};
  }
}

export async function getSentimentHint(
  body: string,
  mood: string | null,
  useAgent = false,
): Promise<{ sentiment?: string; emotions?: string[] }> {
  let sentiment = moodToSentiment(mood);
  let emotions: string[] | undefined;

  if (useAgent && body.trim().length > 15) {
    const result = await analyzeSentiment(body);
    if (result.sentiment) {
      sentiment = result.sentiment;
    }
    emotions = result.emotions;
  }

  return { sentiment, emotions };
}

export async function fetchReflectionPrompts(
  text: string,
  opts?: {
    sentiment?: string;
    emotions?: string[];
    blockedTopics?: string[];
  },
): Promise<{
  prompts: string[];
  mode: PromptMode;
}> {
  try {
    const response = await fetchWithTimeout(PROMPT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text,
        sentiment: opts?.sentiment ?? null,
        emotions: opts?.emotions ?? null,
        blocked_topics: opts?.blockedTopics ?? null,
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    return {
      prompts: Array.isArray(data.prompts) ? data.prompts : [],
      mode: data.mode === 'starter' ? 'starter' : 'reflection',
    };
  } catch (error) {
    console.warn('[promptApi] fallback prompt used:', error);
    return {
      ...getInstantReflectionPrompts(text, opts),
    };
  }
}