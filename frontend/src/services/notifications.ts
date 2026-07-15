/**
 * Lokale Push-Benachrichtigungen fuer Clarity.
 *
 * Vier Ausloeser, alle ueber notificationSettings.ts an-/abschaltbar:
 *   1. Neues Muster        - der Pattern-Agent findet ein neues Thema/Trigger
 *   2. Analyse fertig      - der Sentiment-Agent hat einen Eintrag analysiert
 *   3. Wochenrueckblick     - der Digest-Agent stellt einen neuen Digest bereit
 *   4. Reminder / Stupser  - taegliche Erinnerung + Stupser bei Inaktivitaet
 *
 * Hinweis: expo-notifications wird von Expo Go auf Android nicht mehr
 * unterstuetzt - dort wuerde schon der Import crashen. Deshalb wird das Modul
 * lazy geladen und degradiert bei Fehlern zum No-op; in einem Development- oder
 * Standalone-Build (und iOS-Simulator) funktioniert alles normal.
 */
import { Platform } from 'react-native';
import { isRunningInExpoGo } from 'expo';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Digest, PatternResult, fetchEntries } from './api';
import { getNotificationSettings } from './notificationSettings';

const LAST_SEEN_PATTERN_KEY = 'clarity.pattern.lastSeen';
const LAST_SEEN_DIGEST_KEY = 'clarity.digest.lastSeen';
const REMINDER_ID_KEY = 'clarity.notif.reminderId';
const INACTIVITY_ID_KEY = 'clarity.notif.inactivityId';

type NotificationsModule = typeof import('expo-notifications');

const isExpoGoAndroid = Platform.OS === 'android' && isRunningInExpoGo();

let cachedModule: NotificationsModule | null | undefined;

/** Laedt expo-notifications lazy; null, wenn nicht verfuegbar (z.B. Expo Go auf Android). */
function getNotifications(): NotificationsModule | null {
  if (cachedModule !== undefined) return cachedModule;
  if (isExpoGoAndroid) {
    cachedModule = null;
    return cachedModule;
  }
  try {
    const mod: NotificationsModule = require('expo-notifications');
    // Benachrichtigung auch anzeigen, wenn die App im Vordergrund ist.
    mod.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: false,
        shouldSetBadge: false,
      }),
    });
    cachedModule = mod;
  } catch {
    cachedModule = null;
  }
  return cachedModule;
}

let permissionAsked = false;

/** Fragt (einmal pro Session) die Benachrichtigungs-Berechtigung an. */
export async function ensureNotificationPermission(): Promise<boolean> {
  const Notifications = getNotifications();
  if (!Notifications) return false;
  try {
    const settings = await Notifications.getPermissionsAsync();
    if (settings.granted) return true;
    if (permissionAsked) return false;
    permissionAsked = true;
    const req = await Notifications.requestPermissionsAsync();
    return req.granted;
  } catch {
    return false;
  }
}

/** Zeigt eine Benachrichtigung sofort an - zentral, damit alle gleich degradieren. */
async function fireNow(title: string, body: string): Promise<void> {
  const Notifications = getNotifications();
  if (!Notifications) return;
  if (!(await ensureNotificationPermission())) return;
  try {
    await Notifications.scheduleNotificationAsync({
      content: { title, body },
      trigger: null,
    });
  } catch {
    // In Umgebungen ohne Notification-Support still ignorieren.
  }
}

// --- 1) Neues Muster ---------------------------------------------------------

/** Signatur der aktuellen Muster (Themen + Trigger-Namen) zum Vergleich. */
function patternSignature(pattern: PatternResult): string[] {
  const themes = pattern.recurring_themes ?? [];
  const triggers = Object.keys(pattern.triggers ?? {});
  return [...themes, ...triggers.map((t) => `trigger:${t}`)];
}

/**
 * Vergleicht die neuen Muster mit dem zuletzt gesehenen Stand und meldet, wenn
 * ein neues Thema oder ein neuer Trigger dazugekommen ist.
 */
export async function notifyOnNewPatterns(pattern: PatternResult | null): Promise<void> {
  if (!pattern || pattern.status) return; // kein/insufficient/no_data -> nichts tun

  const settings = await getNotificationSettings();

  const current = patternSignature(pattern);
  if (current.length === 0) return;

  const raw = await AsyncStorage.getItem(LAST_SEEN_PATTERN_KEY);
  const seen: string[] = raw ? JSON.parse(raw) : [];
  const fresh = current.filter((s) => !seen.includes(s));

  // Aktuellen Stand immer merken - auch wenn die Meldung aus ist, damit nach dem
  // Einschalten nicht die gesamte Historie auf einmal als "neu" gilt.
  await AsyncStorage.setItem(LAST_SEEN_PATTERN_KEY, JSON.stringify(current));

  if (!settings.enabled || !settings.newPattern) return;
  if (fresh.length === 0) return;

  const newThemes = fresh.filter((s) => !s.startsWith('trigger:')).slice(0, 3);
  const label =
    newThemes.length > 0
      ? newThemes.join(', ')
      : fresh.map((s) => s.replace('trigger:', '')).slice(0, 3).join(', ');

  await fireNow('Neues Muster erkannt', `Clarity hat etwas Wiederkehrendes bemerkt: ${label}.`);
}

// --- 2) Analyse fertig -------------------------------------------------------

/**
 * Wartet, bis der Sentiment-Agent den Eintrag analysiert hat, und meldet dann.
 *
 * Das Backend analysiert asynchron ("queued") und meldet nicht zurueck - deshalb
 * pollen wir den Eintrag, bis sein `sentiment` gesetzt ist. Best effort: wird die
 * App geschlossen, stoppt das Polling (lokale Loesung ohne Server-Push).
 */
export async function notifyAnalysisDone(entryId: number): Promise<void> {
  const settings = await getNotificationSettings();
  if (!settings.enabled || !settings.analysisDone) return;
  if (!getNotifications()) return;

  const deadline = Date.now() + 3 * 60 * 1000; // hoechstens 3 Minuten warten
  while (Date.now() < deadline) {
    try {
      const { entries } = await fetchEntries();
      const entry = entries.find((e) => e.id === entryId);
      if (entry && entry.sentiment) {
        await fireNow(
          'Deine Reflexion ist analysiert',
          'Clarity hat deinen Eintrag ausgewertet - schau dir deine Stimmung an.',
        );
        return;
      }
    } catch {
      // Netzwerkfehler: weiter versuchen bis zum Timeout.
    }
    await new Promise((r) => setTimeout(r, 3000));
  }
}

// --- 3) Wochenrueckblick ------------------------------------------------------

/** Meldet, wenn ein Wochenrueckblick fuer eine neue Woche vorliegt. */
export async function notifyDigestReady(digest: Digest | null): Promise<void> {
  if (!digest || !digest.week_start) return;

  const settings = await getNotificationSettings();

  const lastSeen = await AsyncStorage.getItem(LAST_SEEN_DIGEST_KEY);
  await AsyncStorage.setItem(LAST_SEEN_DIGEST_KEY, digest.week_start);

  if (!settings.enabled || !settings.digestReady) return;
  if (lastSeen === digest.week_start) return;
  // Beim allerersten Lauf (noch nie etwas gesehen) nicht rueckwirkend melden.
  if (lastSeen === null) return;

  await fireNow(
    'Dein Wochenrueckblick ist da',
    'Clarity hat deine Woche zusammengefasst - wirf einen ruhigen Blick zurueck.',
  );
}

// --- 4) Reminder & Inaktivitaets-Stupser -------------------------------------

/** Cancelt eine zuvor unter `storageKey` gemerkte geplante Benachrichtigung. */
async function cancelStored(storageKey: string): Promise<void> {
  const Notifications = getNotifications();
  if (!Notifications) return;
  const id = await AsyncStorage.getItem(storageKey);
  if (id) {
    try {
      await Notifications.cancelScheduledNotificationAsync(id);
    } catch {}
    await AsyncStorage.removeItem(storageKey);
  }
}

/** Plant den taeglichen Schreib-Reminder neu (oder cancelt ihn, wenn aus). */
export async function scheduleDailyReminder(): Promise<void> {
  const Notifications = getNotifications();
  if (!Notifications) return;
  await cancelStored(REMINDER_ID_KEY);

  const settings = await getNotificationSettings();
  if (!settings.enabled || !settings.dailyReminder) return;
  if (!(await ensureNotificationPermission())) return;

  try {
    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Zeit fuer einen Moment Klarheit',
        body: 'Wie war dein Tag? Ein paar Zeilen genuegen.',
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour: settings.reminderHour,
        minute: settings.reminderMinute,
      },
    });
    await AsyncStorage.setItem(REMINDER_ID_KEY, id);
  } catch {}
}

/**
 * Plant den Inaktivitaets-Stupser neu: eine einmalige Meldung in `inactivityDays`
 * Tagen. Bei jedem neuen Eintrag erneut aufrufen, damit der Zaehler zurueckspringt.
 */
export async function scheduleInactivityNudge(): Promise<void> {
  const Notifications = getNotifications();
  if (!Notifications) return;
  await cancelStored(INACTIVITY_ID_KEY);

  const settings = await getNotificationSettings();
  if (!settings.enabled || !settings.inactivityNudge) return;
  if (!(await ensureNotificationPermission())) return;

  const seconds = Math.max(1, settings.inactivityDays) * 24 * 60 * 60;
  try {
    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Clarity vermisst dich',
        body: 'Ein paar Tage ohne Eintrag. Magst du kurz innehalten?',
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds,
      },
    });
    await AsyncStorage.setItem(INACTIVITY_ID_KEY, id);
  } catch {}
}

/**
 * Setzt die geplanten Benachrichtigungen neu auf. Beim App-Start und nach jeder
 * Aenderung in den Einstellungen aufrufen, damit Reminder und Stupser dem
 * aktuellen Stand entsprechen (iOS behaelt geplante Notifications sonst).
 */
export async function refreshScheduledNotifications(): Promise<void> {
  await scheduleDailyReminder();
  await scheduleInactivityNudge();
}
