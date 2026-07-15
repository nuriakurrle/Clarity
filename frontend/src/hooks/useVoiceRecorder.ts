/**
 * useVoiceRecorder – Sprachaufnahme + Whisper-Transkription für den Eintrag.
 *
 * Ablauf: Mikro antippen → Aufnahme läuft (expo-audio, nativ UND Web) →
 * nochmal antippen → die Aufnahme geht an den Transcribe-Agenten (Port 8005),
 * der sie lokal mit Whisper transkribiert. Deutsch/Englisch werden dabei
 * automatisch erkannt. Der fertige Text kommt über `onText` zurück und wird
 * vom EntryScreen an den Eintrag angehängt.
 *
 * Ersetzt die frühere Web-Speech-API-Diktierfunktion (useDictation), die nur
 * im Browser lief – Aufnahme + Whisper funktionieren auch in Expo Go.
 */
import { useCallback, useRef, useState } from 'react';
import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
} from 'expo-audio';
import { transcribeAudio } from '../services/api';

export type VoiceRecorderError = 'permission' | 'transcribe';

export function useVoiceRecorder(onText: (text: string) => void) {
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [error, setError] = useState<VoiceRecorderError | null>(null);
  // Technische Ursache des letzten Fehlers – wird im Alert mit angezeigt,
  // damit sich "Backend nicht erreichbar" von "HTTP 500" unterscheiden lässt.
  const [errorDetail, setErrorDetail] = useState<string | null>(null);
  // Callback in einer Ref, damit start/stop stabil bleiben und trotzdem
  // immer der aktuelle Eintragstext ergänzt wird (kein stale closure)
  const onTextRef = useRef(onText);
  onTextRef.current = onText;

  const start = useCallback(async () => {
    setError(null);
    setErrorDetail(null);
    const permission = await requestRecordingPermissionsAsync();
    if (!permission.granted) {
      setError('permission');
      return;
    }
    // iOS nimmt sonst im Stumm-Modus nicht auf
    await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
    await recorder.prepareToRecordAsync();
    recorder.record();
    setRecording(true);
  }, [recorder]);

  const stop = useCallback(async () => {
    setRecording(false);
    try {
      await recorder.stop();
    } catch {
      return; // Aufnahme kam nie zustande → nichts zu transkribieren
    }
    // Aufnahme-Modus wieder freigeben (iOS-Lautsprecher-Routing)
    setAudioModeAsync({ allowsRecording: false }).catch(() => {});

    const uri = recorder.uri;
    if (!uri) return;

    setTranscribing(true);
    try {
      const result = await transcribeAudio(uri);
      if (result.text) onTextRef.current(result.text);
    } catch (e) {
      setErrorDetail(e instanceof Error ? e.message : String(e));
      setError('transcribe');
    } finally {
      setTranscribing(false);
    }
  }, [recorder]);

  return { recording, transcribing, error, errorDetail, start, stop };
}
