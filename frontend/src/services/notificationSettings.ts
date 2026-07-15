/**
 * Persistente Benachrichtigungs-Einstellungen (AsyncStorage).
 *
 * Ein einziges Objekt steuert, welche lokalen Push-Benachrichtigungen die App
 * schickt und wann der taegliche Reminder faellt. Gelesen vom Notification-Service
 * (services/notifications.ts) und bearbeitet im SettingsScreen.
 *
 * Bewusst simpel gehalten (ein Objekt, ein Storage-Key), passend zum
 * useState-Routing der App - keine externe State-Bibliothek noetig.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'clarity.notifications.settings';

export type NotificationSettings = {
  /** Hauptschalter: aus = gar keine Benachrichtigungen. */
  enabled: boolean;
  /** Push, wenn der Sentiment-Agent einen Eintrag fertig analysiert hat. */
  analysisDone: boolean;
  /** Push, wenn der Pattern-Agent ein neues wiederkehrendes Muster findet. */
  newPattern: boolean;
  /** Push, wenn der Digest-Agent einen neuen Wochenrueckblick bereitstellt. */
  digestReady: boolean;
  /** Taeglicher Schreib-Reminder zur unten gewaehlten Uhrzeit. */
  dailyReminder: boolean;
  /** Uhrzeit des Reminders (lokale Zeit). */
  reminderHour: number;
  reminderMinute: number;
  /** Sanfter Stupser, wenn seit `inactivityDays` Tagen kein Eintrag kam. */
  inactivityNudge: boolean;
  inactivityDays: number;
};

export const DEFAULT_SETTINGS: NotificationSettings = {
  enabled: true,
  analysisDone: true,
  newPattern: true,
  digestReady: true,
  dailyReminder: true,
  reminderHour: 20,
  reminderMinute: 0,
  inactivityNudge: true,
  inactivityDays: 2,
};

let cache: NotificationSettings | null = null;

/** Aktuelle Einstellungen (mit Defaults aufgefuellt); cached nach dem ersten Lesen. */
export async function getNotificationSettings(): Promise<NotificationSettings> {
  if (cache) return cache;
  let loaded: NotificationSettings = { ...DEFAULT_SETTINGS };
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (raw) loaded = { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {}
  cache = loaded;
  return loaded;
}

/** Aendert einzelne Felder, speichert und gibt den neuen Gesamtstand zurueck. */
export async function updateNotificationSettings(
  patch: Partial<NotificationSettings>,
): Promise<NotificationSettings> {
  const current = await getNotificationSettings();
  const next = { ...current, ...patch };
  cache = next;
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Schreibfehler ignorieren - der cache haelt den Wert fuer diese Session.
  }
  return next;
}
