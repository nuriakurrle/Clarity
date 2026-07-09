/**
 * usePromptSuggestions – kapselt den kompletten Prompt-Zustand für den Editor.
 *
 * Lädt debounced reflektive Fragen vom Prompt-Agenten (Port 8003), sobald der
 * Journal-Text lang genug ist. Hält Sichtbarkeit, Loading-State und die
 * Consent-Banner-Logik, damit Screens davon nichts wissen müssen.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { generatePrompt } from '../services/api';

const DEBOUNCE_MS = 800;
const MIN_TEXT_LENGTH = 10;
const FALLBACK_QUESTION = 'Was beschäftigt dich gerade?';

/**
 * Lokale Fragen fürs Durchtippen am Orb – bewusst OHNE Agent-Aufruf
 * (Mock; die tiefere Agent-Anbindung folgt später). Jeder Tap liefert die
 * nächste Frage der Liste, unabhängig davon, ob das Backend erreichbar ist.
 */
const LOCAL_PROMPTS = [
  'Was beschäftigt dich gerade am meisten?',
  'Wie fühlst du dich in diesem Moment?',
  'Gibt es etwas, das du heute loswerden möchtest?',
  'Was hat dich heute überrascht?',
  'Wofür bist du heute dankbar?',
  'Was war der schönste Moment des Tages?',
  'Welcher Gedanke lässt dich gerade nicht los?',
  'Was würdest du deinem morgigen Ich mitgeben?',
  'Welche Person ging dir heute durch den Kopf?',
  'Was kannst du heute loslassen?',
];

/**
 * Tageszeit-Kontext für den Prompt-Agenten: Morgens/abends wählt der
 * ContextAnalyzer dann passende Temporal-Fragen statt der Starter-Liste.
 */
function timeContext(): 'morning' | 'evening' | 'editor_open' {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 11) return 'morning';
  if (hour >= 17) return 'evening';
  return 'editor_open';
}

export function usePromptSuggestions(journalText: string) {
  const [visible, setVisible] = useState(true);
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [currentSuggestion, setCurrentSuggestion] = useState<string>();
  const [showConsentBanner, setShowConsentBanner] = useState(false);

  const loadPrompts = useCallback(
    async (text: string) => {
      if (!visible) return;

      setLoading(true);
      try {
        console.log('[usePromptSuggestions] loadPrompts called with text length:', text.length);
        const result = await generatePrompt({
          journal_text: text,
          // Leere Seite → Starter-Frage (Blank-Page Prevention); sobald
          // geschrieben wird, darf die Tageszeit die Frage einfärben.
          context: text.trim().length >= MIN_TEXT_LENGTH ? timeContext() : 'editor_open',
          streak_days: 0,
        });

        console.log('[usePromptSuggestions] Prompt result:', result);
        setSuggestions([result.question]);
        setCurrentSuggestion(result.question);
      } catch (e) {
        console.error('[usePromptSuggestions] Prompt generation failed:', e);
        // Fallback: lokale Starter-Frage, damit der Orb auch offline etwas anbietet
        setSuggestions([FALLBACK_QUESTION]);
        setCurrentSuggestion(FALLBACK_QUESTION);
      } finally {
        setLoading(false);
      }
    },
    [visible],
  );

  // Lade Prompts nach Änderung des Journal-Textes (debounced)
  useEffect(() => {
    if (!journalText.trim() || journalText.length < MIN_TEXT_LENGTH) {
      setSuggestions([]);
      setCurrentSuggestion(undefined);
      return;
    }

    const timer = setTimeout(() => {
      loadPrompts(journalText);
    }, DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [journalText, loadPrompts]);

  // Lädt auch bei leerem Text — das Backend liefert dann eine Starter-Frage
  // (Blank-Page Prevention beim Tap auf den Orb)
  const refresh = useCallback(() => {
    loadPrompts(journalText);
  }, [journalText, loadPrompts]);

  // Tap auf den Orb: nächste lokale Frage. Überspringt die aktuell gezeigte,
  // damit sich die Sprechblase immer sichtbar mit neuem Inhalt meldet.
  const localIndex = useRef(0);
  const next = useCallback(() => {
    let question = LOCAL_PROMPTS[localIndex.current % LOCAL_PROMPTS.length];
    localIndex.current += 1;
    if (question === currentSuggestion) {
      question = LOCAL_PROMPTS[localIndex.current % LOCAL_PROMPTS.length];
      localIndex.current += 1;
    }
    setSuggestions([question]);
    setCurrentSuggestion(question);
  }, [currentSuggestion]);

  const acceptConsent = useCallback(() => {
    setShowConsentBanner(false);
    setVisible(true);
    if (journalText.trim()) {
      loadPrompts(journalText);
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
