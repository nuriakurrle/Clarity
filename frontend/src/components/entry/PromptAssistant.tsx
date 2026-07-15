/**
 * PromptAssistant – gesamte Prompt-Integration für den Editor in einer Komponente.
 *
 * Bündelt Consent-Banner und PromptBubble inklusive des
 * kompletten Zustands (via usePromptSuggestions). Screens binden nur noch
 * diese eine Komponente ein und liefern den Journal-Text plus einen
 * onSelectPrompt-Callback – so bleibt der geteilte EntryScreen von
 * Prompt-Agent-Änderungen unberührt.
 */
import React from 'react';
import { PromptBubble } from './PromptBubble';
import { PromptConsentBanner } from './PromptConsentBanner';
import { usePromptSuggestions } from '../../hooks/usePromptSuggestions';
import type { MoodLevel } from '../../theme/colors';

type Props = {
  journalText: string;
  /** Gewählte Stimmung: geht als Sentiment-Override an den Prompt-Agenten. */
  mood?: MoodLevel | null;
  /** Färbt den Orb (z.B. in der gewählten Stimmungsfarbe). */
  moodTint?: string;
  /** Beim Schreiben (Tastatur offen): Orb zurückhaltend klein und blass. */
  compact?: boolean;
  onSelectPrompt: (prompt: string) => void;
};

export function PromptAssistant({ journalText, mood, moodTint, compact, onSelectPrompt }: Props) {
  const {
    visible,
    currentSuggestion,
    showConsentBanner,
    next,
    acceptConsent,
    declineConsent,
  } = usePromptSuggestions(journalText, mood ?? null);

  return (
    <>
      <PromptConsentBanner
        visible={showConsentBanner}
        onAccept={acceptConsent}
        onDecline={declineConsent}
      />

      {/* Orb antippen = nächste Frage aus dem Agent-Pool (Orchestrator mit
          echten Einträgen; offline lokale Bibliothek);
          Sprechblase antippen = Frage in den Eintrag übernehmen. */}
      <PromptBubble
        suggestion={currentSuggestion}
        visible={visible}
        tint={moodTint}
        compact={compact}
        onRequestPreview={next}
        onAccept={
          currentSuggestion ? () => onSelectPrompt(currentSuggestion) : undefined
        }
      />
    </>
  );
}
