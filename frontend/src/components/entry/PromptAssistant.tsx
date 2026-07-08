/**
 * PromptAssistant – gesamte Prompt-Integration für den Editor in einer Komponente.
 *
 * Bündelt Consent-Banner, PromptBubble und ReflectionPrompts inklusive des
 * kompletten Zustands (via usePromptSuggestions). Screens binden nur noch
 * diese eine Komponente ein und liefern den Journal-Text plus einen
 * onSelectPrompt-Callback – so bleibt der geteilte EntryScreen von
 * Prompt-Agent-Änderungen unberührt.
 */
import React from 'react';
import { PromptBubble } from './PromptBubble';
import { PromptConsentBanner } from './PromptConsentBanner';
import { ReflectionPrompts } from './ReflectionPrompts';
import { usePromptSuggestions } from '../../hooks/usePromptSuggestions';

type Props = {
  journalText: string;
  onSelectPrompt: (prompt: string) => void;
};

export function PromptAssistant({ journalText, onSelectPrompt }: Props) {
  const {
    visible,
    loading,
    suggestions,
    currentSuggestion,
    showConsentBanner,
    refresh,
    acceptConsent,
    declineConsent,
    dismiss,
  } = usePromptSuggestions(journalText);

  return (
    <>
      <PromptConsentBanner
        visible={showConsentBanner}
        onAccept={acceptConsent}
        onDecline={declineConsent}
      />

      {/* Prompt Bubble mit Vorschlag */}
      {visible && (
        <PromptBubble
          suggestion={currentSuggestion}
          visible={loading || !!currentSuggestion}
          onRequestPreview={() => {
            if (currentSuggestion) onSelectPrompt(currentSuggestion);
          }}
        />
      )}

      {/* Reflection Prompts Liste */}
      {visible && suggestions.length > 0 && (
        <ReflectionPrompts
          prompts={suggestions}
          loading={loading}
          mode="reflection"
          onSelect={onSelectPrompt}
          onRefresh={refresh}
          onClose={dismiss}
        />
      )}
    </>
  );
}
