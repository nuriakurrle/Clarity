/**
 * Wochenfenster der App – dieselbe Definition wie im Digest-Agent
 * (backend/agent_digest: week_window): die *abgeschlossene* Vorwoche,
 * Montag 00:00 bis exklusiv Montag 00:00.
 *
 * Wichtig: kein gleitendes "letzte 7 Tage"-Fenster. Sonst zeigen Blob und
 * Wochenrückblick unterschiedliche Tage und widersprechen sich.
 */
export type WeekRange = { start: number; end: number };

/** Vorwoche (Mo–So) als Zeitstempel-Bereich; `weeksBack=1` = letzte Woche. */
export function lastWeekRange(weeksBack = 1, now = new Date()): WeekRange {
  const monday = new Date(now);
  // Sonntag (getDay 0) gehört zur laufenden Woche, die am Montag begann.
  const weekday = (monday.getDay() + 6) % 7;
  monday.setDate(monday.getDate() - weekday - 7 * weeksBack);
  monday.setHours(0, 0, 0, 0);
  const end = new Date(monday);
  end.setDate(end.getDate() + 7);
  return { start: monday.getTime(), end: end.getTime() };
}

/** created_at des Backends ("YYYY-MM-DD HH:MM:SS", UTC) als Zeitstempel. */
export function parseCreatedAt(createdAt?: string): number {
  if (!createdAt) return NaN;
  return Date.parse(`${createdAt.replace(' ', 'T')}Z`);
}

/** Liegt der Eintrag in der Vorwoche? Ohne/mit kaputtem Zeitstempel: nein. */
export function isInLastWeek(createdAt?: string, range = lastWeekRange()): boolean {
  const ts = parseCreatedAt(createdAt);
  if (Number.isNaN(ts)) return false;
  return ts >= range.start && ts < range.end;
}
