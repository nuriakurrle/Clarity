/**
 * Offline-Prompt-Bibliothek: Fallback, wenn der Prompt-Agent (Port 8003)
 * nicht erreichbar ist. Spiegelt die Kategorien der Backend-Bibliothek
 * (backend/agent_prompt/tools/prompt_library.py) in kompakter Form.
 */

const STARTER = [
  'Wie fühlst du dich gerade in diesem Moment?',
  'Was hat dich heute beschäftigt?',
  'Wofür bist du heute dankbar?',
  'Was möchtest du gerade festhalten?',
];

const REFLECTION = [
  'Was steckt wirklich hinter diesem Gefühl?',
  'Was würdest du einer Freundin in dieser Situation raten?',
  'Was nimmst du aus diesem Moment mit?',
  'Was brauchst du gerade am meisten?',
];

const SENTIMENT: Record<'positive' | 'negative' | 'neutral', string[]> = {
  positive: [
    'Was hat diesen guten Moment möglich gemacht?',
    'Wie kannst du mehr davon in deinen Alltag holen?',
  ],
  negative: [
    'Was würde dir gerade ein kleines bisschen helfen?',
    'Was möchtest du diesem schweren Gefühl sagen?',
  ],
  neutral: [
    'Was liegt heute unter der Oberfläche?',
    'Welche Kleinigkeit ist dir heute aufgefallen?',
  ],
};

function polarity(sentiment?: string): keyof typeof SENTIMENT {
  const s = (sentiment ?? '').toLowerCase();
  if (/(pos|gut|freu|liebe|dankbar)/.test(s)) return 'positive';
  if (/(neg|trau|schlecht|nieder|wut|angst|frust|müde)/.test(s)) return 'negative';
  return 'neutral';
}

export function offlinePrompts(opts: {
  sentiment?: string;
  blockedTopics?: string[];
  starter?: boolean;
  n?: number;
}): string[] {
  const n = opts.n ?? 4;
  let pool = [...(opts.starter ? STARTER : REFLECTION)];
  if (opts.sentiment) pool = pool.concat(SENTIMENT[polarity(opts.sentiment)]);

  const blocked = (opts.blockedTopics ?? []).map((topic) => topic.toLowerCase());
  pool = pool.filter((prompt) => !blocked.some((topic) => prompt.toLowerCase().includes(topic)));

  // dedupe + mischen
  const uniq = Array.from(new Set(pool));
  for (let i = uniq.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [uniq[i], uniq[j]] = [uniq[j], uniq[i]];
  }
  return uniq.slice(0, n);
}
