/**
 * usePromptSuggestions – kapselt den kompletten Prompt-Zustand für den Editor.
 *
 * Lädt debounced reflektive Fragen vom Prompt-Agenten (Port 8003), sobald der
 * Journal-Text lang genug ist. Hält Sichtbarkeit, Loading-State und die
 * Consent-Banner-Logik, damit Screens davon nichts wissen müssen.
 */
import { useCallback, useEffect, useState } from 'react';
import { generatePrompt } from '../services/api';

const DEBOUNCE_MS = 800;
const MIN_TEXT_LENGTH = 10;

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
          context: 'editor_open',
          streak_days: 0,
        });

        console.log('[usePromptSuggestions] Prompt result:', result);
        setSuggestions([result.question]);
        setCurrentSuggestion(result.question);
      } catch (e) {
        console.error('[usePromptSuggestions] Prompt generation failed:', e);
        // Fallback: Zeige Loading-State trotzdem
        setSuggestions(['Reflexionsfrage wird geladen...']);
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

  const refresh = useCallback(() => {
    if (journalText.trim()) {
      loadPrompts(journalText);
    }
  }, [journalText, loadPrompts]);

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
    acceptConsent,
    declineConsent,
    dismiss,
  };
}
