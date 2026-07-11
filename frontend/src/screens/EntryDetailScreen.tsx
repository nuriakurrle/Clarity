/**
 * EntryDetailScreen – Vollansicht eines gespeicherten Tagebucheintrags.
 *
 * Wird aus dem Verlauf (SearchScreen) und dem Kalender-Detailbereich
 * geöffnet, wenn ein Eintrag angetippt wird. Aufbau orientiert sich am
 * EntryScreen (Datum-Kopfzeile + X, Serif-Titel, Fließtext): Datum/Uhrzeit
 * kommen aus `created_at`, dazu die Stimmung aus der Sentiment-Analyse
 * (farbiger Punkt + Label) und – falls vorhanden – die Hauptemotion.
 *
 * Bearbeiten: Der Stift schaltet Titel + Text auf Eingabefelder um –
 * mit derselben Editor-Leiste wie beim neuen Eintrag („Aa"-Format-Panel,
 * Bild anhängen, Spracheingabe per Whisper). Neue Bilder werden erst beim
 * Speichern hochgeladen (Abbrechen verwirft sie). „Speichern" schickt den
 * neuen Text per PUT /entries/{id} an den Sentiment-Agenten (Save-first,
 * die Analyse läuft im Hintergrund neu) und meldet den aktualisierten
 * Eintrag über `onUpdated` an App.tsx – so zeigen Detailansicht und
 * Listen sofort den neuen Stand.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
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
import { BlockEditor, EditorToolbar, EntryImages, KeyboardToolbar } from '../components/entry';
import { Block, BlockEditorHandle, newBlockId } from '../components/entry/BlockEditor';
import { DEFAULT_FORMAT, EditorFormat } from '../components/entry/EditorToolbar';
import { useVoiceRecorder } from '../hooks/useVoiceRecorder';
import { useKeyboardHeight } from '../hooks/useKeyboardHeight';
import {
  EntryRecord,
  deleteEntry,
  deleteEntryImage,
  entryImageUrl,
  updateEntry,
  uploadEntryImage,
} from '../services/api';
import { colors, moodColor, moodLabel, valenceToMoodLevel } from '../theme/colors';
import { serif } from '../theme/typography';

type Props = {
  entry: EntryRecord;
  onClose?: () => void;
  /** Meldet den gespeicherten Stand nach dem Bearbeiten (siehe App.tsx). */
  onUpdated?: (entry: EntryRecord) => void;
};

/** created_at ("YYYY-MM-DD HH:MM:SS", UTC) → lokales Date. */
function parseCreatedAt(createdAt: string): Date {
  return new Date(`${createdAt.replace(' ', 'T')}Z`);
}

/**
 * Überschrift + Fließtext aus dem gespeicherten Inhalt ableiten.
 *
 * Nur wenn der Eintrag eine ECHTE Titelzeile hat (kurze erste Zeile mit Text
 * darunter), gibt es eine Überschrift – sonst bleibt sie leer und der ganze
 * Inhalt ist Fließtext. Wichtig: Ansicht und Bearbeiten nutzen dieselbe
 * Aufteilung, damit beim Umschalten nichts „verschwindet" oder der Text
 * plötzlich in der Überschrift landet (keine gebastelte Kurz-Überschrift
 * aus den ersten Zeichen des Textes mehr).
 */
function splitEntry(content: string): { title: string; body: string } {
  const [firstLine, ...rest] = content.split('\n');
  const title = firstLine.trim();
  const body = rest.join('\n').trim();
  if (!body || title.length > 60) return { title: '', body: content.trim() };
  return { title, body };
}

export default function EntryDetailScreen({ entry, onClose, onUpdated }: Props) {
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  // Eintragstext beim Bearbeiten als Absatz-Blöcke – wie im EntryScreen,
  // damit „Aa"-Format-Panel und Spracheingabe identisch funktionieren.
  const [editBlocks, setEditBlocks] = useState<Block[]>([]);
  const [activeBlockId, setActiveBlockId] = useState<string>('');
  const [formatOpen, setFormatOpen] = useState(false);
  // Beim Bearbeiten neu angehängte Bilder (lokale URIs); Upload erst beim Speichern
  const [pendingImages, setPendingImages] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  // Dateiname des Bildes, das gerade im Vollbild-Viewer offen ist
  const [viewerImage, setViewerImage] = useState<string | null>(null);
  const editorRef = useRef<BlockEditorHandle>(null);

  const { dateLabel, timeLabel } = useMemo(() => {
    const d = parseCreatedAt(entry.created_at);
    return {
      dateLabel: new Intl.DateTimeFormat('de-DE', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }).format(d),
      timeLabel: new Intl.DateTimeFormat('de-DE', {
        hour: '2-digit',
        minute: '2-digit',
      }).format(d),
    };
  }, [entry.created_at]);

  const { title, body } = useMemo(() => splitEntry(entry.content), [entry.content]);
  const level = entry.valence != null ? valenceToMoodLevel(entry.valence) : null;

  const showError = (message: string) => {
    if (Platform.OS === 'web') {
      (globalThis as { alert?: (msg: string) => void }).alert?.(message);
    } else {
      Alert.alert('Bearbeiten', message);
    }
  };

  const startEditing = () => {
    // Exakt dieselbe Aufteilung wie die Ansicht – Überschrift und Text
    // stehen beim Bearbeiten genau dort, wo sie eben noch angezeigt wurden.
    const raw = splitEntry(entry.content);
    setEditTitle(raw.title);
    const lines = raw.body ? raw.body.split('\n') : [''];
    const blocks = lines.map((line) => ({ id: newBlockId(), text: line, format: DEFAULT_FORMAT }));
    setEditBlocks(blocks);
    setActiveBlockId(blocks[blocks.length - 1].id);
    setFormatOpen(false);
    setPendingImages([]);
    setEditing(true);
  };

  const cancelEditing = () => {
    setEditing(false);
    setFormatOpen(false);
    setPendingImages([]);
  };

  // Die „Aa"-Leiste zeigt und ändert das Format der Zeile mit dem Cursor
  const activeBlock =
    editBlocks.find((b) => b.id === activeBlockId) ?? editBlocks[editBlocks.length - 1];
  const handleFormatChange = (next: EditorFormat) =>
    setEditBlocks((prev) =>
      prev.map((b) => (b.id === activeBlock.id ? { ...b, format: next } : b)),
    );

  // Tastatur offen? Editor-Leiste direkt darüber zeigen, Fußzeile solange
  // ausblenden (Android hebt nichts automatisch an – wie im EntryScreen).
  const keyboardHeight = useKeyboardHeight();
  const keyboardOpen = keyboardHeight > 0;
  const keyboardPad = Platform.OS === 'android' ? keyboardHeight : 0;

  // Transkribierten Text ans Ende der letzten Zeile anhängen (wie im EntryScreen)
  const voice = useVoiceRecorder((text) =>
    setEditBlocks((prev) => {
      if (prev.length === 0) return [{ id: newBlockId(), text, format: DEFAULT_FORMAT }];
      const last = prev[prev.length - 1];
      const merged = last.text.trim() ? `${last.text.trimEnd()} ${text}` : text;
      return [...prev.slice(0, -1), { ...last, text: merged }];
    }),
  );

  const handleToggleDictation = async () => {
    if (voice.transcribing) return; // läuft schon – Ergebnis abwarten
    if (voice.recording) {
      await voice.stop();
      return;
    }
    await voice.start();
  };

  // Fehler aus dem Recorder melden (Berechtigung/Backend) – wie im EntryScreen
  useEffect(() => {
    if (!voice.error) return;
    showError(
      voice.error === 'permission'
        ? 'Bitte erlaube den Mikrofon-Zugriff, um deine Stimme aufzunehmen.'
        : 'Die Aufnahme konnte nicht transkribiert werden. Läuft das Backend (docker compose up) und bist du im selben WLAN?' +
            (voice.errorDetail ? `\n\nDetails: ${voice.errorDetail}` : ''),
    );
  }, [voice.error]);

  const handleAddImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      quality: 0.8,
    });
    if (result.canceled) return;
    const uris = result.assets.map((a) => a.uri);
    setPendingImages((prev) => [...prev, ...uris.filter((u) => !prev.includes(u))]);
  };

  // URL einer Bild-Kachel → gespeicherter Dateiname (letztes Pfadsegment)
  const filenameFromUrl = (url: string) => decodeURIComponent(url.split('/').pop() ?? '');

  // Einzelnes Bild mit Nachfrage löschen (DB-Zeile + Datei im Backend);
  // der aktualisierte Eintrag geht über onUpdated an App.tsx.
  const confirmImageDelete = (filename: string) => {
    const doDelete = async () => {
      try {
        await deleteEntryImage(entry.id, filename);
        setViewerImage(null);
        onUpdated?.({
          ...entry,
          images: (entry.images ?? []).filter((f) => f !== filename),
        });
      } catch {
        showError(
          'Das Bild konnte nicht gelöscht werden. Läuft das Backend (docker compose up) und bist du im selben WLAN?',
        );
      }
    };
    if (Platform.OS === 'web') {
      const confirm = (globalThis as { confirm?: (msg: string) => boolean }).confirm;
      if (!confirm || confirm('Bild endgültig löschen?')) doDelete();
      return;
    }
    Alert.alert('Bild löschen?', 'Das kann nicht rückgängig gemacht werden.', [
      { text: 'Abbrechen' },
      { text: 'Löschen', style: 'destructive', onPress: doDelete },
    ]);
  };

  // Löschen mit Nachfrage – entfernt den Eintrag samt Analyse-Daten in der DB
  // (DELETE /entries/{id}) und schließt danach die Vollansicht. Verlauf und
  // Kalender laden beim Schließen ohnehin neu (die Screens remounten).
  const confirmDelete = () => {
    const doDelete = async () => {
      setDeleting(true);
      try {
        await deleteEntry(entry.id);
        onClose?.();
      } catch {
        showError(
          'Der Eintrag konnte nicht gelöscht werden. Läuft das Backend (docker compose up) und bist du im selben WLAN?',
        );
        setDeleting(false);
      }
    };
    // Alert mit Buttons ist auf Web ein No-op – dort window.confirm (wie im EntryScreen)
    if (Platform.OS === 'web') {
      const confirm = (globalThis as { confirm?: (msg: string) => boolean }).confirm;
      if (!confirm || confirm('Eintrag endgültig löschen?')) doDelete();
      return;
    }
    Alert.alert('Eintrag löschen?', 'Das kann nicht rückgängig gemacht werden.', [
      { text: 'Abbrechen' },
      { text: 'Löschen', style: 'destructive', onPress: doDelete },
    ]);
  };

  const saveEdit = async () => {
    // Gleiches Format wie beim Anlegen im EntryScreen: Titel + Leerzeile + Text
    const bodyText = editBlocks.map((b) => b.text).join('\n');
    const text = [editTitle.trim(), bodyText.trim()].filter(Boolean).join('\n\n');
    if (!text) {
      showError('Der Eintrag darf nicht leer sein.');
      return;
    }
    setSaving(true);
    try {
      await updateEntry(entry.id, text);
      // Neu angehängte Bilder zum Eintrag hochladen (wie im EntryScreen);
      // allSettled: Ein fehlgeschlagenes Bild verwirft nicht die Änderung.
      let addedImages: string[] = [];
      if (pendingImages.length > 0) {
        const results = await Promise.allSettled(
          pendingImages.map((uri) => uploadEntryImage(entry.id, uri)),
        );
        addedImages = results
          .filter((r): r is PromiseFulfilledResult<{ entry_id: number; filename: string }> =>
            r.status === 'fulfilled',
          )
          .map((r) => r.value.filename);
      }
      // Stimmungswerte bleiben vorerst die alten – die Analyse des neuen
      // Texts läuft im Backend als Hintergrund-Task.
      onUpdated?.({
        ...entry,
        content: text,
        images: [...(entry.images ?? []), ...addedImages],
      });
      setEditing(false);
      setPendingImages([]);
      setFormatOpen(false);
    } catch {
      showError(
        'Die Änderung konnte nicht gespeichert werden. Läuft das Backend (docker compose up) und bist du im selben WLAN?',
      );
    } finally {
      setSaving(false);
    }
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
            <View style={styles.headerIcons}>
              {!editing ? (
                <>
                  <TouchableOpacity
                    onPress={startEditing}
                    hitSlop={10}
                    disabled={deleting}
                    accessibilityLabel="Eintrag bearbeiten"
                  >
                    <Ionicons name="pencil-outline" size={20} color={colors.textMuted} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={confirmDelete}
                    hitSlop={10}
                    disabled={deleting}
                    accessibilityLabel="Eintrag löschen"
                  >
                    {deleting ? (
                      <ActivityIndicator size="small" color={colors.textMuted} />
                    ) : (
                      <Ionicons name="trash-outline" size={20} color={colors.textMuted} />
                    )}
                  </TouchableOpacity>
                </>
              ) : null}
              <TouchableOpacity
                onPress={editing ? cancelEditing : onClose}
                hitSlop={10}
                accessibilityLabel={editing ? 'Bearbeiten abbrechen' : 'Eintrag schließen'}
              >
                <Ionicons name="close" size={22} color={colors.textMuted} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Stimmung aus der Analyse – gleicher Badge-Look wie im Verlauf */}
          {!editing && level ? (
            <View style={styles.moodRow}>
              <View style={[styles.moodDot, { backgroundColor: moodColor[level] }]} />
              <Text style={styles.moodText}>{moodLabel[level]}</Text>
              {entry.primary_emotion ? (
                <Text style={styles.emotionText}>· {entry.primary_emotion}</Text>
              ) : null}
            </View>
          ) : null}

          {editing ? (
            <>
              {/* defaultValue statt value: Das Feld wird beim Umschalten in
                  den Bearbeiten-Modus frisch gemountet und garantiert mit dem
                  bestehenden Text vorbefüllt (kontrollierte Inputs zeigten auf
                  Android beim Einblenden teils leere Felder). Der State läuft
                  über onChangeText fürs Speichern weiter mit. */}
              <TextInput
                defaultValue={editTitle}
                onChangeText={setEditTitle}
                placeholder="Worum geht's?"
                placeholderTextColor={colors.textFaint}
                style={styles.titleInput}
                returnKeyType="next"
                onSubmitEditing={() => editorRef.current?.focusFirst()}
              />
              <BlockEditor
                ref={editorRef}
                blocks={editBlocks}
                setBlocks={setEditBlocks}
                onActiveIdChange={setActiveBlockId}
                placeholder="Dein Eintrag …"
              />
              {/* Bilder auch beim Bearbeiten zeigen: gespeicherte Bilder löscht
                  das „ד (mit Nachfrage) direkt aus DB + Dateisystem, neu
                  angehängte (lokale) werden nur aus der Auswahl entfernt */}
              {(entry.images?.length ?? 0) + pendingImages.length > 0 ? (
                <View style={styles.imagesWrap}>
                  <EntryImages
                    uris={[...(entry.images ?? []).map(entryImageUrl), ...pendingImages]}
                    onRemove={(uri) =>
                      pendingImages.includes(uri)
                        ? setPendingImages((prev) => prev.filter((u) => u !== uri))
                        : confirmImageDelete(filenameFromUrl(uri))
                    }
                  />
                </View>
              ) : null}
            </>
          ) : (
            <>
              {title ? <Text style={styles.title}>{title}</Text> : null}
              {body ? <Text style={styles.body}>{body}</Text> : null}
              {/* Angehängte Bilder – Tippen öffnet den Vollbild-Viewer */}
              {entry.images && entry.images.length > 0 ? (
                <View style={styles.imagesWrap}>
                  <EntryImages
                    uris={entry.images.map(entryImageUrl)}
                    onPress={(uri) => setViewerImage(filenameFromUrl(uri))}
                  />
                </View>
              ) : null}
            </>
          )}

          <View style={styles.bottomSpace} />
        </ScrollView>

        {/* Editor-Leiste wie im EntryScreen: sitzt über der Tastatur; „Aa"
            klappt darüber das Format-Panel aus */}
        {editing ? (
          <View style={styles.editorBar}>
            {formatOpen && activeBlock ? (
              <View style={styles.formatPanel}>
                <EditorToolbar value={activeBlock.format} onChange={handleFormatChange} />
              </View>
            ) : null}
            <KeyboardToolbar
              formatOpen={formatOpen}
              onToggleFormat={() => setFormatOpen((v) => !v)}
              onAddImage={handleAddImage}
              dictating={voice.recording}
              transcribing={voice.transcribing}
              onToggleDictation={handleToggleDictation}
            />
          </View>
        ) : null}

        {/* Fußzeile wie im EntryScreen – nur im Bearbeiten-Modus; beim Tippen
            ausgeblendet, damit die Editor-Leiste direkt auf der Tastatur sitzt */}
        {editing && !keyboardOpen ? (
          <View style={styles.footer}>
            <TouchableOpacity onPress={cancelEditing} hitSlop={8} disabled={saving}>
              <Text style={styles.cancelText}>Abbrechen</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
              onPress={saveEdit}
              activeOpacity={0.8}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.saveText}>Speichern</Text>
              )}
            </TouchableOpacity>
          </View>
        ) : null}

        {/* Vollbild-Viewer: dunkler Hintergrund, Bild eingepasst; „X" schließt,
            der Mülleimer löscht genau dieses Bild (mit Nachfrage). */}
        <Modal
          visible={viewerImage != null}
          transparent
          animationType="fade"
          onRequestClose={() => setViewerImage(null)}
        >
          <View style={styles.viewerBackdrop}>
            {viewerImage ? (
              <Image
                source={{ uri: entryImageUrl(viewerImage) }}
                style={styles.viewerImage}
                resizeMode="contain"
              />
            ) : null}
            <TouchableOpacity
              style={[styles.viewerButton, styles.viewerClose]}
              onPress={() => setViewerImage(null)}
              hitSlop={10}
              accessibilityLabel="Vollbild schließen"
            >
              <Ionicons name="close" size={24} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.viewerButton, styles.viewerDelete]}
              onPress={() => viewerImage && confirmImageDelete(viewerImage)}
              hitSlop={10}
              accessibilityLabel="Bild löschen"
            >
              <Ionicons name="trash-outline" size={22} color="#fff" />
            </TouchableOpacity>
          </View>
        </Modal>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// Web zeichnet um fokussierte Eingabefelder einen schwarzen Standard-Rahmen –
// hier unerwünscht, die Felder sollen rahmenlos wirken (wie im EntryScreen)
const noOutline = Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : null;

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  scroll: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 24 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerIcons: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  // Neutral wie die Datumszeilen in Verlauf/Kalender (früher: Orange/warm)
  date: { fontSize: 13, color: colors.textMuted, fontWeight: '600' },
  moodRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 14 },
  moodDot: { width: 10, height: 10, borderRadius: 5 },
  moodText: { fontSize: 13, color: colors.textMuted, fontWeight: '600' },
  emotionText: { fontSize: 13, color: colors.textMuted },
  title: {
    fontFamily: serif,
    fontSize: 28,
    fontWeight: '700',
    color: colors.text,
    marginTop: 10,
  },
  // marginTop trägt den Abstand – funktioniert mit und ohne Überschrift
  body: { fontSize: 16, lineHeight: 24, color: colors.text, marginTop: 12 },
  imagesWrap: { marginTop: 12 },
  // Vollbild-Viewer
  viewerBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewerImage: { width: '100%', height: '100%' },
  viewerButton: {
    position: 'absolute',
    top: 48,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewerClose: { right: 20 },
  viewerDelete: { left: 20 },
  // Eingabefelder im Look der Anzeige (Titel serif, Text wie body)
  titleInput: {
    fontFamily: serif,
    fontSize: 28,
    fontWeight: '700',
    color: colors.text,
    marginTop: 10,
    marginBottom: 12,
    padding: 0,
    ...noOutline,
  },
  // Editor-Leiste + Format-Panel im Look des EntryScreens
  editorBar: { paddingBottom: 2, zIndex: 2 },
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
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 20,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  cancelText: { fontSize: 14, color: colors.textMuted, fontWeight: '600' },
  saveBtn: {
    backgroundColor: colors.text,
    borderRadius: 22,
    paddingHorizontal: 20,
    paddingVertical: 10,
    minWidth: 100,
    alignItems: 'center',
  },
  saveBtnDisabled: { opacity: 0.6 },
  saveText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  bottomSpace: { height: 24 },
});
