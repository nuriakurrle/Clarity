/**
 * usePromptSuggestions – kapselt den kompletten Prompt-Zustand für den Editor.
 *
 * Holt 4 kontextbezogene Reflexionsfragen vom Prompt-Agenten (Orchestrator,
 * POST /generate-prompts) – mit echten Daten: dem aktuellen Journal-Text,
 * den letzten gespeicherten Einträgen (für Pattern-Kontext) und der
 * Mood-Auswahl als Sentiment-Override. Beim Tippen wird debounced neu
 * geladen, der Tap auf den Orb blättert durch den geladenen Fragen-Pool
 * und lädt am Pool-Ende im Hintergrund frische Fragen nach.
 *
 * Ist der Agent nicht erreichbar, liefert fetchReflectionPrompts automatisch
 * Fragen aus der lokalen Offline-Bibliothek – der Orb funktioniert immer.
 *
 * Schreib-Hänger (useIdlePrompt): Bleibt der Text eine Weile unverändert –
 * der User macht eine Pause oder kommt nicht ins Schreiben –, blendet der
 * Orb von selbst die nächste Frage als Sprechblase ein. Danach greift ein
 * Cooldown, damit dieselbe Pause nicht mehrfach hintereinander feuert.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchEntries } from '../services/api';
import { fetchReflectionPrompts, moodToSentiment } from '../services/promptApi';
import { offlinePrompts } from '../services/promptLibrary';
import { useIdlePrompt } from './useIdlePrompt';
import type { MoodLevel } from '../theme/colors';

const DEBOUNCE_MS = 800;
const MIN_TEXT_LENGTH = 10;
/** Wie viele der letzten Einträge als Pattern-/Digest-Kontext mitgehen. */
const MAX_CONTEXT_ENTRIES = 10;

export function usePromptSuggestions(journalText: string, mood: MoodLevel | null = null) {
  const [visible, setVisible] = useState(true);
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [currentSuggestion, setCurrentSuggestion] = useState<string>();
  const [showConsentBanner, setShowConsentBanner] = useState(false);

  // Blätter-Position im Pool; Refs statt State, damit Taps nicht re-rendern
  const poolRef = useRef<string[]>([]);
  const indexRef = useRef(0);
  // Nur die jeweils letzte Anfrage darf den Zustand setzen (Race-Schutz)
  const seqRef = useRef(0);
  // Echte Einträge als Kontext für den Pattern-/Digest-Teil des Orchestrators
  const entriesRef = useRef<string[]>([]);

  // Einmal pro Editor-Besuch die letzten Einträge laden (offline: leer,
  // der Agent nutzt dann seine gespeicherten Pattern-/Digest-Ergebnisse)
  useEffect(() => {
    let cancelled = false;
    fetchEntries()
      .then(({ entries }) => {
        if (cancelled) return;
        entriesRef.current = entries
          .slice(0, MAX_CONTEXT_ENTRIES)
          .map((entry) => entry.content)
          .filter((content) => content && content.trim().length > 0);
      })
      .catch((error) => {
        console.warn('[usePromptSuggestions] Einträge nicht ladbar (offline?):', error);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const loadPrompts = useCallback(
    async (text: string, showFirst: boolean) => {
      if (!visible) return;
      const seq = ++seqRef.current;
      setLoading(true);
      // fetchReflectionPrompts fängt Fehler selbst ab (Offline-Bibliothek)
      const result = await fetchReflectionPrompts(text, {
        entries: entriesRef.current,
        sentiment: moodToSentiment(mood),
      });
      if (seq !== seqRef.current) return; // inzwischen läuft eine neuere Anfrage
      setLoading(false);
      if (!result.prompts.length) return;
      poolRef.current = result.prompts;
      indexRef.current = showFirst ? 1 : 0;
      setSuggestions(result.prompts);
      if (showFirst) setCurrentSuggestion(result.prompts[0]);
    },
    [visible, mood],
  );

  // Beim Tippen debounced neu laden; auf leerer Seite Starter-Fragen
  // vorladen, damit der erste Tap auf den Orb sofort eine Frage zeigt.
  useEffect(() => {
    const timer = setTimeout(() => {
      if (journalText.trim().length >= MIN_TEXT_LENGTH) {
        loadPrompts(journalText, true);
      } else if (!poolRef.current.length) {
        loadPrompts(journalText, false);
      }
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [journalText, loadPrompts]);

  // Tap auf den Orb: nächste Frage aus dem Agent-Pool. Ist noch nichts
  // geladen, überbrückt die Offline-Bibliothek sofort, während im
  // Hintergrund echte Fragen geholt werden.
  const next = useCallback(() => {
    const pool = poolRef.current;
    if (!pool.length) {
      const local = offlinePrompts({
        starter: journalText.trim().length < 15,
        sentiment: moodToSentiment(mood),
      });
      poolRef.current = local;
      indexRef.current = 1;
      setSuggestions(local);
      setCurrentSuggestion(local[0]);
      loadPrompts(journalText, false);
      return;
    }
    let i = indexRef.current % pool.length;
    if (pool[i] === currentSuggestion) {
      i = (i + 1) % pool.length; // nicht dieselbe Frage zweimal hintereinander
    }
    setCurrentSuggestion(pool[i]);
    indexRef.current = i + 1;
    // Pool durchgeblättert -> im Hintergrund frische Fragen nachladen
    if (indexRef.current >= pool.length && !loading) {
      loadPrompts(journalText, false);
    }
  }, [journalText, mood, currentSuggestion, loading, loadPrompts]);

  // Schreibpause erkannt (Text bleibt idleMs unverändert – auch die leere
  // Seite zählt, wenn jemand nicht ins Schreiben findet): proaktiv die
  // nächste Frage einblenden. dismiss() setzt den Cooldown, bevor next()
  // den Text ggf. ändert und den Timer neu startet.
  const { isIdle, dismiss: snoozeIdle } = useIdlePrompt(journalText, { enabled: visible });
  useEffect(() => {
    if (!isIdle) return;
    snoozeIdle();
    next();
  }, [isIdle, snoozeIdle, next]);

  // Lädt auch bei leerem Text – der Agent liefert dann Starter-Fragen
  const refresh = useCallback(() => {
    loadPrompts(journalText, true);
  }, [journalText, loadPrompts]);

  const acceptConsent = useCallback(() => {
    setShowConsentBanner(false);
    setVisible(true);
    if (journalText.trim()) {
      loadPrompts(journalText, true);
    }
  }, [journalText, loadPrompts]);

  const declineConsent = useCallback(() => {
    setShowConsentBanner(false);
    setVisible(false);
  }, []);

  const dismiss = useCallback(() => setVisible(false), []);

  return {
    visible,
    loading,
    suggestions,
    currentSuggestion,
    showConsentBanner,
    refresh,
    next,
    acceptConsent,
    declineConsent,
    dismiss,
  };
}
