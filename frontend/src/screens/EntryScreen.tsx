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
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
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
  const [bodyFocused, setBodyFocused] = useState(false);

  // Toolbar erst zeigen, wenn geschrieben wird – der leere Screen bleibt ruhig.
  // Bei vorhandenem Text bleibt sie sichtbar, damit sie beim Antippen der
  // Format-Buttons (kurzer Fokusverlust) nicht wegspringt.
  const toolbarVisible = bodyFocused || body.trim().length > 0;

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

  // Schließen ohne Speichern – seit die Tab-Leiste im Schreibmodus
  // ausgeblendet ist, braucht der Screen einen eigenen Ausgang.
  // Bei vorhandenem Text wird nachgefragt (Alert ist auf Web ein No-op,
  // deshalb dort window.confirm).
  const handleClose = () => {
    const hasText = Boolean(title.trim() || body.trim());
    if (!hasText) {
      onDone?.();
      return;
    }
    if (Platform.OS === 'web') {
      const confirm = (globalThis as { confirm?: (msg: string) => boolean }).confirm;
      if (!confirm || confirm('Eintrag verwerfen? Dein Text wird nicht gespeichert.')) onDone?.();
      return;
    }
    Alert.alert('Eintrag verwerfen?', 'Dein Text wird nicht gespeichert.', [
      { text: 'Weiter schreiben' },
      { text: 'Verwerfen', style: 'destructive', onPress: () => onDone?.() },
    ]);
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
      {/* Sanfter warmer Verlauf oben – verbindet den Screen optisch mit Home */}
      <LinearGradient
        colors={[colors.warmSofter, '#FEFAF6', colors.surface]}
        locations={[0, 0.3, 0.65]}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.headerRow}>
            <Text style={styles.date}>
              {dateLabel} · {timeLabel}
            </Text>
            <TouchableOpacity
              onPress={handleClose}
              hitSlop={10}
              accessibilityLabel="Eintrag schließen"
            >
              <Ionicons name="close" size={22} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder="Worum geht's heute?"
            placeholderTextColor={colors.textFaint}
            style={styles.title}
          />

          {toolbarVisible && <EditorToolbar value={format} onChange={setFormat} />}

          <TextInput
            value={body}
            onChangeText={setBody}
            onFocus={() => setBodyFocused(true)}
            onBlur={() => setBodyFocused(false)}
            placeholder="Schreib, was dir gerade durch den Kopf geht…"
            placeholderTextColor={colors.textFaint}
            style={[styles.body, formatToStyle(format)]}
            multiline
            textAlignVertical="top"
          />
        </ScrollView>

        {/* Fest unten rechts verankert, statt mit dem Text mitzuwandern */}
        <View style={styles.assistant}>
          <PromptAssistant journalText={body} onSelectPrompt={handlePromptSelect} />
        </View>

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

// Web zeichnet um fokussierte Eingabefelder einen schwarzen Standard-Rahmen –
// hier unerwünscht, der Editor soll rahmenlos wirken (nativ gibt es das nicht)
const noOutline = Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : null;

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface },
  flex: { flex: 1 },
  scroll: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 16 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  date: { fontSize: 13, color: colors.warm, fontWeight: '600' },
  title: {
    fontFamily: serif,
    fontSize: 28,
    fontWeight: '700',
    color: colors.text,
    marginTop: 6,
    marginBottom: 16,
    padding: 0,
    ...noOutline,
  },
  // Größe/Farbe/Font kommen aus dem Toolbar-Format (formatToStyle)
  body: {
    minHeight: 280,
    padding: 0,
    marginTop: 12,
    ...noOutline,
  },
  // Prompt-Orb samt Banner: schwebt fest über dem Footer, rechts ausgerichtet
  assistant: {
    position: 'absolute',
    left: 0,
    right: 12,
    bottom: 78,
    pointerEvents: 'box-none',
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
