/**
 * EntryScreen – Eingabemaske für einen neuen Tagebucheintrag.
 *
 * Titel, Fließtext und Stimmungsauswahl. Datum/Uhrzeit kommen direkt von
 * der Geräteuhr. „Fertig" schickt den Eintrag an den Sentiment-Agenten
 * (`POST /analyze`), der ihn in SQLite speichert und direkt emotional
 * auswertet – davon leben später Einblicke & Wochenrückblick.
 *
 * Prompt-Integration:
 * - PromptAssistant kapselt Bubble, Fragen-Liste und Consent-Banner
 *   (Zustand & API-Calls liegen in usePromptSuggestions)
 */
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { EditorToolbar, MoodPicker, PromptAssistant } from '../components/entry';
import { DEFAULT_FORMAT, EditorFormat, formatToStyle } from '../components/entry/EditorToolbar';
import { analyzeEntry, detectPatterns } from '../services/api';
import { notifyOnNewPatterns } from '../services/notifications';
import { colors, MoodLevel } from '../theme/colors';
import { serif } from '../theme/typography';

const now = new Date();
const dateLabel = new Intl.DateTimeFormat('de-DE', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
}).format(now);
const timeLabel = new Intl.DateTimeFormat('de-DE', { hour: '2-digit', minute: '2-digit' }).format(now);

type Props = { onDone?: () => void };

export default function EntryScreen({ onDone }: Props) {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [mood, setMood] = useState<MoodLevel | null>(null);
  const [saving, setSaving] = useState(false);
  const [format, setFormat] = useState<EditorFormat>(DEFAULT_FORMAT);

  const handleDone = async () => {
    const text = [title.trim(), body.trim()].filter(Boolean).join('\n\n');
    if (!text) {
      onDone?.();
      return;
    }

    setSaving(true);
    try {
      await analyzeEntry(text, mood ?? undefined);
      // Muster im Hintergrund neu berechnen (nicht blockierend, LLM dauert).
      // Der Agent liest die echten Eintraege der letzten 7 Tage aus der DB.
      // Danach ggf. eine lokale Push bei neu erkanntem Muster/Trigger.
      detectPatterns()
        .then((pattern) => notifyOnNewPatterns(pattern))
        .catch(() => {});
      onDone?.();
    } catch (e) {
      Alert.alert(
        'Speichern fehlgeschlagen',
        'Der Eintrag konnte nicht ans Backend geschickt werden. Läuft das Backend (docker compose up) und bist du im selben WLAN?',
        [
          { text: 'Nochmal versuchen' },
          { text: 'Verwerfen', style: 'destructive', onPress: () => onDone?.() },
        ],
      );
    } finally {
      setSaving(false);
    }
  };

  const handlePromptSelect = (prompt: string) => {
    // Füge die Frage zum Text hinzu oder zeige sie in einem Modal
    Alert.alert('Reflektive Frage', prompt, [
      { text: 'Schließen' },
      {
        text: 'In Eintrag aufnehmen',
        onPress: () => setBody(body + '\n\n💭 ' + prompt),
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.date}>
            {dateLabel} · {timeLabel}
          </Text>

          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder="Titel"
            placeholderTextColor={colors.textFaint}
            style={styles.title}
          />

          <EditorToolbar value={format} onChange={setFormat} />

          <TextInput
            value={body}
            onChangeText={setBody}
            placeholder="Schreib, was dir gerade durch den Kopf geht…"
            placeholderTextColor={colors.textFaint}
            style={[styles.body, formatToStyle(format)]}
            multiline
            textAlignVertical="top"
          />

          <PromptAssistant journalText={body} onSelectPrompt={handlePromptSelect} />
        </ScrollView>

        <View style={styles.footer}>
          <MoodPicker value={mood} onChange={setMood} />
          <TouchableOpacity
            style={[styles.doneBtn, saving && styles.doneBtnDisabled]}
            onPress={handleDone}
            activeOpacity={0.8}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.doneText}>Fertig</Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface },
  flex: { flex: 1 },
  scroll: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 16 },
  date: { fontSize: 13, color: colors.warm, fontWeight: '600' },
  title: {
    fontFamily: serif,
    fontSize: 28,
    fontWeight: '700',
    color: colors.text,
    marginTop: 6,
    marginBottom: 16,
    padding: 0,
  },
  // Größe/Farbe/Font kommen aus dem Toolbar-Format (formatToStyle)
  body: {
    minHeight: 280,
    padding: 0,
    marginTop: 12,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  doneBtn: {
    backgroundColor: colors.text,
    borderRadius: 22,
    paddingHorizontal: 20,
    paddingVertical: 10,
    minWidth: 76,
    alignItems: 'center',
  },
  doneBtnDisabled: { opacity: 0.6 },
  doneText: { color: '#fff', fontSize: 14, fontWeight: '700' },
});
