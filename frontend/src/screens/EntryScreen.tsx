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
 *
 * Editor-Extras (Toolbar über der Tastatur):
 * - „Aa" klappt das Format-Panel auf (Schrift, Größe, Ausrichtung, Farbe);
 *   formatiert wird zeilenweise – jede Zeile ist ein eigener Block (BlockEditor)
 * - Bild-Button hängt Fotos aus der Galerie an (bleiben lokal auf dem Gerät)
 * - Mikro diktiert per Web Speech API auf Deutsch in den Eintrag
 * - Stimmung wird oben unterm Datum gewählt (MoodBar), nicht mehr im Footer
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
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import {
  BlockEditor,
  EditorToolbar,
  EntryImages,
  KeyboardToolbar,
  MoodBar,
  PromptAssistant,
} from '../components/entry';
import { Block, newBlockId } from '../components/entry/BlockEditor';
import { DEFAULT_FORMAT, EditorFormat, formatToStyle } from '../components/entry/EditorToolbar';
import { useDictation } from '../hooks/useDictation';
import { useKeyboardHeight } from '../hooks/useKeyboardHeight';
import { analyzeEntry, detectPatterns } from '../services/api';
import { notifyOnNewPatterns } from '../services/notifications';
import { colors, moodColor, MoodLevel } from '../theme/colors';
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
  // Eintragstext als Absatz-Blöcke – jede Zeile mit eigenem Format
  const [blocks, setBlocks] = useState<Block[]>(() => [
    { id: newBlockId(), text: '', format: DEFAULT_FORMAT },
  ]);
  const [activeBlockId, setActiveBlockId] = useState<string>(blocks[0].id);
  const [mood, setMood] = useState<MoodLevel | null>(null);
  const [saving, setSaving] = useState(false);
  const [formatOpen, setFormatOpen] = useState(false);
  const [images, setImages] = useState<string[]>([]);

  // Die „Aa"-Leiste zeigt und ändert das Format der Zeile mit dem Cursor
  const activeBlock = blocks.find((b) => b.id === activeBlockId) ?? blocks[blocks.length - 1];
  const handleFormatChange = (next: EditorFormat) =>
    setBlocks((prev) => prev.map((b) => (b.id === activeBlock.id ? { ...b, format: next } : b)));

  // Reiner Text des Eintrags (fürs Speichern, den Prompt-Agenten & Co.)
  const bodyText = blocks.map((b) => b.text).join('\n');

  // Tastatur offen? Dann Editor-Leiste direkt über der Tastatur zeigen
  // (Android/Edge-to-Edge hebt nichts automatisch an, deshalb selbst schieben)
  // und die Fußzeile (Stimmung + Fertig) so lange ausblenden.
  const keyboardHeight = useKeyboardHeight();
  const keyboardOpen = keyboardHeight > 0;
  // iOS schiebt schon die KeyboardAvoidingView – nur Android braucht Padding
  const keyboardPad = Platform.OS === 'android' ? keyboardHeight : 0;

  // Diktierte Sätze ans Ende der letzten Zeile anhängen (mit Leerzeichen davor)
  const dictation = useDictation((text) =>
    setBlocks((prev) => {
      const last = prev[prev.length - 1];
      const merged = last.text.trim() ? `${last.text.trimEnd()} ${text}` : text;
      return [...prev.slice(0, -1), { ...last, text: merged }];
    }),
  );

  const handleAddImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      quality: 0.8,
    });
    if (result.canceled) return;
    const uris = result.assets.map((a) => a.uri);
    setImages((prev) => [...prev, ...uris.filter((u) => !prev.includes(u))]);
  };

  const handleToggleDictation = () => {
    if (!dictation.supported) {
      Alert.alert(
        'Diktieren nicht verfügbar',
        'Spracheingabe läuft aktuell im Browser (Chrome/Edge/Safari). In der nativen App folgt sie mit einem Development-Build.',
      );
      return;
    }
    if (dictation.listening) dictation.stop();
    else dictation.start();
  };

  const handleDone = async () => {
    const text = [title.trim(), bodyText.trim()].filter(Boolean).join('\n\n');
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
    const hasText = Boolean(title.trim() || bodyText.trim() || images.length);
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
        // Frage als eigene neue Zeile ans Ende des Eintrags
        onPress: () =>
          setBlocks((prev) => [
            ...prev,
            { id: newBlockId(), text: `💭 ${prompt}`, format: DEFAULT_FORMAT },
          ]),
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={[styles.flex, keyboardPad > 0 && { paddingBottom: keyboardPad }]}
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

          {/* Stimmung zuerst: sichtbar wählen, dann schreiben */}
          <MoodBar value={mood} onChange={setMood} />

          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder="Worum geht's heute?"
            placeholderTextColor={colors.textFaint}
            style={styles.title}
          />

          <EntryImages
            uris={images}
            onRemove={(uri) => setImages((prev) => prev.filter((u) => u !== uri))}
          />

          <View style={styles.editor}>
            <BlockEditor
              blocks={blocks}
              setBlocks={setBlocks}
              onActiveIdChange={setActiveBlockId}
              placeholder="Schreib, was dir gerade durch den Kopf geht…"
            />
          </View>

          {/* Live-Vorschau des gerade gesprochenen Satzes (landet in der letzten Zeile) */}
          {dictation.listening && dictation.interim ? (
            <Text style={[styles.interim, formatToStyle(blocks[blocks.length - 1].format)]}>
              {dictation.interim}…
            </Text>
          ) : null}
        </ScrollView>

        {/* Editor-Leiste: sitzt über der Tastatur (KeyboardAvoidingView schiebt
            sie hoch); „Aa" klappt darüber das Format-Panel aus */}
        <View style={styles.editorBar}>
          {formatOpen && (
            <View style={styles.formatPanel}>
              <EditorToolbar value={activeBlock.format} onChange={handleFormatChange} />
            </View>
          )}
          <KeyboardToolbar
            formatOpen={formatOpen}
            onToggleFormat={() => setFormatOpen((v) => !v)}
            onAddImage={handleAddImage}
            dictating={dictation.listening}
            dictationSupported={dictation.supported}
            onToggleDictation={handleToggleDictation}
          />
        </View>

        {/* Schwebt rechts auf Höhe der Pill-Leiste (nach ihr gerendert, damit
            er antippbar bleibt). Absolute Position ignoriert das Tastatur-
            Padding, deshalb bei offener Tastatur selbst mit anheben. */}
        <View style={[styles.assistant, keyboardOpen && { bottom: keyboardHeight + 4 }]}>
          {/* Orb übernimmt die Farbe der gewählten Stimmung; beim Tippen
              nimmt er sich zurück und wird nur mit Empfehlung präsent */}
          <PromptAssistant
            journalText={bodyText}
            moodTint={mood ? moodColor[mood] : undefined}
            compact={keyboardOpen}
            onSelectPrompt={handlePromptSelect}
          />
        </View>

        {/* Beim Tippen ausgeblendet, damit die Editor-Leiste direkt auf der
            Tastatur sitzt; erscheint wieder, sobald die Tastatur zu ist. */}
        {!keyboardOpen && (
          <View style={styles.footer}>
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
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// Web zeichnet um fokussierte Eingabefelder einen schwarzen Standard-Rahmen –
// hier unerwünscht, der Editor soll rahmenlos wirken (nativ gibt es das nicht)
const noOutline = Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : null;

const styles = StyleSheet.create({
  // Reines Weiß wie die übrigen Screens (früher: Creme-Aura mit Farb-Orbs)
  safe: { flex: 1, backgroundColor: colors.bg },
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
  // Zeilen-Blöcke: Größe/Farbe/Font je Zeile kommen aus dem BlockEditor
  editor: {
    marginTop: 12,
  },
  // Gesprochener Satz, solange er noch nicht final erkannt ist
  interim: { opacity: 0.45, marginTop: 4 },
  editorBar: { paddingBottom: 2 },
  // Format-Panel als weiche Karte über der Pill-Leiste
  formatPanel: {
    marginHorizontal: 20,
    marginBottom: 6,
    paddingHorizontal: 14,
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: colors.shadow,
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  // Prompt-Orb samt Banner: schwebt rechts knapp über der Pill-Leiste
  // (Orb-Container ist 120 hoch, die Kugel sitzt mittig darin)
  assistant: {
    position: 'absolute',
    left: 0,
    right: 12,
    bottom: 74,
    pointerEvents: 'box-none',
  },
  // Nur noch „Fertig" – die Stimmung wird oben in der MoodBar gewählt
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
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
