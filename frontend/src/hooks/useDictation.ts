/**
 * useDictation – Spracheingabe für den Eintrag (Deutsch).
 *
 * Nutzt die Web Speech API des Browsers (Chrome/Edge/Safari): Zwischenstände
 * kommen als `interim` (live-Vorschau), fertige Sätze werden über
 * `onFinalText` an den Aufrufer gereicht und dort an den Text angehängt.
 * Die Erkennung läuft lokal im Browser-Stack – es geht nichts an unser Backend.
 *
 * Auf iOS/Android (Expo Go) gibt es die API nicht; dort meldet der Hook
 * `supported: false` und der Screen erklärt das beim Antippen des Mikros.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';

// Minimaler Typ der Web Speech API – die DOM-Typen fehlen im RN-Setup.
type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((event: SpeechResultEvent) => void) | null;
  onend: (() => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
};

type SpeechResultEvent = {
  resultIndex: number;
  results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }>;
};

function getRecognitionCtor(): (new () => SpeechRecognitionLike) | null {
  if (Platform.OS !== 'web' || typeof globalThis === 'undefined') return null;
  const g = globalThis as {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  };
  return g.SpeechRecognition ?? g.webkitSpeechRecognition ?? null;
}

export function useDictation(onFinalText: (text: string) => void) {
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState('');
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  // Callback in einer Ref, damit start/stop stabil bleiben und trotzdem
  // immer der aktuelle Eintragstext ergänzt wird (kein stale closure)
  const onFinalRef = useRef(onFinalText);
  onFinalRef.current = onFinalText;

  const supported = getRecognitionCtor() !== null;

  const stop = useCallback(() => {
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    setListening(false);
    setInterim('');
  }, []);

  const start = useCallback(() => {
    const Ctor = getRecognitionCtor();
    if (!Ctor || recognitionRef.current) return;

    const recognition = new Ctor();
    recognition.lang = 'de-DE';
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onresult = (event) => {
      let interimText = '';
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i];
        const transcript = result[0].transcript;
        if (result.isFinal) onFinalRef.current(transcript.trim());
        else interimText += transcript;
      }
      setInterim(interimText.trim());
    };
    // Browser beendet die Erkennung selbst (Stille, Berechtigung entzogen …)
    recognition.onend = () => {
      recognitionRef.current = null;
      setListening(false);
      setInterim('');
    };
    recognition.onerror = () => {
      recognitionRef.current = null;
      setListening(false);
      setInterim('');
    };

    recognitionRef.current = recognition;
    recognition.start();
    setListening(true);
  }, []);

  // Beim Unmount (Screen verlassen) laufende Erkennung beenden
  useEffect(() => () => recognitionRef.current?.stop(), []);

  return { supported, listening, interim, start, stop };
}
