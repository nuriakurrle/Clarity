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

type Props = {
  journalText: string;
  /** Färbt den Orb (z.B. in der gewählten Stimmungsfarbe). */
  moodTint?: string;
  /** Beim Schreiben (Tastatur offen): Orb zurückhaltend klein und blass. */
  compact?: boolean;
  onSelectPrompt: (prompt: string) => void;
};

export function PromptAssistant({ journalText, moodTint, compact, onSelectPrompt }: Props) {
  const {
    visible,
    currentSuggestion,
    showConsentBanner,
    refresh,
    acceptConsent,
    declineConsent,
  } = usePromptSuggestions(journalText);

  return (
    <>
      <PromptConsentBanner
        visible={showConsentBanner}
        onAccept={acceptConsent}
        onDecline={declineConsent}
      />

      {/* Prompt Bubble: Orb ist immer da; Tap ohne geladene Frage holt eine Starter-Frage */}
      <PromptBubble
        suggestion={currentSuggestion}
        visible={visible}
        tint={moodTint}
        compact={compact}
        onRequestPreview={() => {
          if (currentSuggestion) {
            onSelectPrompt(currentSuggestion);
          } else {
            refresh();
          }
        }}
      />
    </>
  );
}
