/**
 * Lokale Push-Benachrichtigungen für neu erkannte Muster (Pattern-Agent).
 *
 * Mobilspezifisches Feature: Wenn der Pattern-Agent ein Thema oder einen Trigger
 * findet, das/den es vorher noch nicht gab, schickt die App eine lokale
 * Benachrichtigung ("Neues Muster erkannt: ..."). Der zuletzt gesehene Stand
 * wird in AsyncStorage gemerkt, damit nur wirklich Neues meldet.
 *
 * Hinweis: expo-notifications wird von Expo Go auf Android nicht mehr
 * unterstützt – dort würde schon der Import die App crashen. Deshalb wird das
 * Modul lazy geladen und degradiert bei Fehlern zum No-op; in einem
 * Development-Build oder Standalone-Build funktioniert alles normal.
 */
import { Platform } from 'react-native';
import { isRunningInExpoGo } from 'expo';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { PatternResult } from './api';

const LAST_SEEN_KEY = 'clarity.pattern.lastSeen';

type NotificationsModule = typeof import('expo-notifications');

const isExpoGoAndroid = Platform.OS === 'android' && isRunningInExpoGo();

let cachedModule: NotificationsModule | null | undefined;

/** Lädt expo-notifications lazy; null, wenn nicht verfügbar (z.B. Expo Go auf Android). */
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

/** Signatur der aktuellen Muster (Themen + Trigger-Namen) zum Vergleich. */
function signature(pattern: PatternResult): string[] {
  const themes = pattern.recurring_themes ?? [];
  const triggers = Object.keys(pattern.triggers ?? {});
  return [...themes, ...triggers.map((t) => `trigger:${t}`)];
}

/**
 * Vergleicht die neuen Muster mit dem zuletzt gesehenen Stand und schickt eine
 * lokale Push-Benachrichtigung, wenn ein neues Thema oder ein neuer Trigger
 * dazugekommen ist.
 */
export async function notifyOnNewPatterns(pattern: PatternResult | null): Promise<void> {
  if (!pattern || pattern.status) return; // kein/insufficient/no_data -> nichts tun

  const current = signature(pattern);
  if (current.length === 0) return;

  const raw = await AsyncStorage.getItem(LAST_SEEN_KEY);
  const seen: string[] = raw ? JSON.parse(raw) : [];
  const fresh = current.filter((s) => !seen.includes(s));

  // Aktuellen Stand immer merken
  await AsyncStorage.setItem(LAST_SEEN_KEY, JSON.stringify(current));

  if (fresh.length === 0) return; // nichts Neues

  const Notifications = getNotifications();
  if (!Notifications) return;

  const granted = await ensureNotificationPermission();
  if (!granted) return;

  const newThemes = fresh.filter((s) => !s.startsWith('trigger:')).slice(0, 3);
  const label =
    newThemes.length > 0
      ? newThemes.join(', ')
      : fresh.map((s) => s.replace('trigger:', '')).slice(0, 3).join(', ');

  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Neues Muster erkannt',
        body: `Clarity hat etwas Wiederkehrendes bemerkt: ${label}.`,
      },
      trigger: null, // sofort anzeigen
    });
  } catch {
    // In Umgebungen ohne Notification-Support (z.B. Expo Go) still ignorieren.
  }
}
