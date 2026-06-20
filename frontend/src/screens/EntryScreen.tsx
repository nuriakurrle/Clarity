/**
 * EntryScreen – statischer Screen (noch keine Backend-Anbindung).
 *
 * Leere Eingabemaske für einen neuen Tagebucheintrag: Titel, Fließtext
 * und Stimmungsauswahl. Datum/Uhrzeit kommen direkt von der Geräteuhr,
 * der restliche Inhalt ist absichtlich leer (frischer Eintrag).
 * Speichern/Persistenz folgt später über die lokale Datenbank.
 *
 * Die UI besteht aus den Entry-eigenen Bausteinen aus `../components/entry`.
 */
import React, { useState } from 'react';
import {
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
import { EditorToolbar, MoodEmojiPicker } from '../components/entry';
import { colors } from '../theme/colors';
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
  const [mood, setMood] = useState<string | null>(null);

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

          <EditorToolbar />

          <TextInput
            value={body}
            onChangeText={setBody}
            placeholder="Schreib, was dir gerade durch den Kopf geht…"
            placeholderTextColor={colors.textFaint}
            style={styles.body}
            multiline
            textAlignVertical="top"
          />
        </ScrollView>

        <View style={styles.footer}>
          <MoodEmojiPicker value={mood} onChange={setMood} />
          <TouchableOpacity style={styles.doneBtn} onPress={onDone} activeOpacity={0.8}>
            <Text style={styles.doneText}>Fertig</Text>
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
  body: {
    fontFamily: serif,
    fontSize: 16,
    lineHeight: 26,
    color: colors.text,
    minHeight: 280,
    padding: 0,
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
  },
  doneText: { color: '#fff', fontSize: 14, fontWeight: '700' },
});
