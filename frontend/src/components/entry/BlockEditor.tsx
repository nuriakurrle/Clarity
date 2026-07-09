/**
 * BlockEditor – Absatz-Editor mit zeilenweiser Formatierung.
 *
 * Jede Zeile (Absatz) ist ein eigener Block mit eigenem `EditorFormat` –
 * die „Aa"-Leiste des Screens wirkt immer auf die Zeile, in der der Cursor
 * steht. Enter teilt den Block in eine neue Zeile (Format wird geerbt),
 * Backspace am Zeilenanfang hängt die Zeile wieder an die vorherige an.
 * Der Screen hält den Blockzustand; beim Speichern werden die Zeilen
 * schlicht mit Zeilenumbrüchen verbunden (Formatierung ist nur fürs
 * Schreiberlebnis, sie wird nicht ans Backend geschickt).
 *
 * Backspace am Zeilenanfang, je Plattform:
 * - iOS/Web: `onKeyPress` meldet Backspace zuverlässig; „am Zeilenanfang"
 *   erkennen wir über die zuletzt gemeldete Cursor-Position.
 * - Android: Soft-Keyboards melden Backspace über `onKeyPress` nur, wenn es
 *   nichts zu löschen gibt. Deshalb trägt dort jede Zeile außer der ersten
 *   ein unsichtbares Wächterzeichen (Zero-Width-Space) am Anfang: Löscht
 *   Backspace das Wächterzeichen, stand der Cursor am Zeilenanfang und die
 *   Zeile wird mit der vorherigen verbunden. Das Zeichen wird vor dem
 *   Speichern immer herausgefiltert.
 */
import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import {
  NativeSyntheticEvent,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  TextInputKeyPressEventData,
  View,
} from 'react-native';
import { colors } from '../../theme/colors';
import { EditorFormat, formatToStyle } from './EditorToolbar';

export type Block = { id: string; text: string; format: EditorFormat };

let seq = 0;
/** Eindeutige Block-ID (nur innerhalb der Session relevant). */
export const newBlockId = () => `block-${(seq += 1)}`;

/** Fokus-Steuerung für den Screen (z. B. Enter im Titel → erste Zeile). */
export type BlockEditorHandle = {
  focusFirst: () => void;
  focusLast: () => void;
};

// Wächterzeichen für die Android-Backspace-Erkennung (siehe Kopfkommentar)
const SENTINEL = '​';
const USE_SENTINEL = Platform.OS === 'android';

type Selection = { id: string; start: number; end: number };

type Props = {
  blocks: Block[];
  setBlocks: React.Dispatch<React.SetStateAction<Block[]>>;
  onActiveIdChange: (id: string) => void;
  placeholder: string;
};

export const BlockEditor = forwardRef<BlockEditorHandle, Props>(function BlockEditor(
  { blocks, setBlocks, onActiveIdChange, placeholder },
  ref,
) {
  const inputs = useRef<Record<string, TextInput | null>>({});
  // Cursor-Position je Block – für „Backspace am Zeilenanfang" (iOS/Web)
  const selectionStart = useRef<Record<string, number>>({});
  // Nach Teilen/Löschen soll der Fokus in den richtigen Block springen;
  // der existiert erst nach dem nächsten Render, daher hier vormerken.
  const pendingFocus = useRef<string | null>(null);
  // Nach einem Merge soll der Cursor an der Nahtstelle stehen, nicht am
  // Zeilenende. Die Wunschposition wird nach dem Fokus für einen Render als
  // kontrollierte `selection` angelegt (pendingSelection) und sofort wieder
  // freigegeben, damit der Cursor danach frei beweglich bleibt.
  const desiredSelection = useRef<Selection | null>(null);
  const [pendingSelection, setPendingSelection] = useState<Selection | null>(null);

  useEffect(() => {
    if (pendingFocus.current) {
      const input = inputs.current[pendingFocus.current];
      if (input) {
        pendingFocus.current = null;
        input.focus();
      }
    }
    if (desiredSelection.current) {
      // Erst fokussieren (oben), dann im Folge-Render die Selection setzen
      const next = desiredSelection.current;
      desiredSelection.current = null;
      setPendingSelection(next);
      return;
    }
    if (pendingSelection) {
      // Selection wurde mit diesem Render angewendet → wieder freigeben
      const timer = setTimeout(() => setPendingSelection(null), 0);
      return () => clearTimeout(timer);
    }
  });

  /** Zeile `idx` an die vorherige anhängen; Cursor landet an der Nahtstelle. */
  const mergeIntoPrevious = (prev: Block[], idx: number, tail: string): Block[] => {
    const target = prev[idx - 1];
    const merged = { ...target, text: target.text + tail };
    pendingFocus.current = merged.id;
    // Offset +1, wenn die Zielzeile selbst ein Wächterzeichen trägt
    const cursor = target.text.length + (USE_SENTINEL && idx - 1 > 0 ? 1 : 0);
    desiredSelection.current = { id: merged.id, start: cursor, end: cursor };
    return [...prev.slice(0, idx - 1), merged, ...prev.slice(idx + 1)];
  };

  const handleChange = (id: string, raw: string) => {
    // Tippen hebt eine evtl. noch festgehaltene Cursor-Position auf
    if (pendingSelection) setPendingSelection(null);
    setBlocks((prev) => {
      const idx = prev.findIndex((b) => b.id === id);
      if (idx < 0) return prev;
      const block = prev[idx];
      // Android: Wächterzeichen wurde weggelöscht → Backspace am Zeilenanfang
      if (USE_SENTINEL && idx > 0 && !raw.includes(SENTINEL)) {
        return mergeIntoPrevious(prev, idx, raw.split('\n').join(' '));
      }
      const text = raw.split(SENTINEL).join('');
      if (!text.includes('\n')) {
        const next = [...prev];
        next[idx] = { ...block, text };
        return next;
      }
      // Enter: an Zeilenumbrüchen in neue Blöcke teilen, Format erben
      const parts = text.split('\n');
      const created = parts.map((part, i) =>
        i === 0 ? { ...block, text: part } : { id: newBlockId(), text: part, format: block.format },
      );
      pendingFocus.current = created[created.length - 1].id;
      const next = [...prev];
      next.splice(idx, 1, ...created);
      return next;
    });
  };

  const handleKeyPress = (id: string, e: NativeSyntheticEvent<TextInputKeyPressEventData>) => {
    // Android merged über das Wächterzeichen in handleChange – der KeyPress-
    // Pfad bliebe dort zusätzlich aktiv und würde doppelt zusammenführen.
    if (USE_SENTINEL || e.nativeEvent.key !== 'Backspace') return;
    setBlocks((prev) => {
      const idx = prev.findIndex((b) => b.id === id);
      if (idx <= 0) return prev; // erste Zeile bleibt immer stehen
      const block = prev[idx];
      const atStart = block.text.length === 0 || selectionStart.current[id] === 0;
      if (!atStart) return prev;
      return mergeIntoPrevious(prev, idx, block.text);
    });
  };

  const focusFirst = () => {
    const first = blocks[0];
    if (first) inputs.current[first.id]?.focus();
  };

  const focusLast = () => {
    const last = blocks[blocks.length - 1];
    if (last) inputs.current[last.id]?.focus();
  };

  useImperativeHandle(ref, () => ({ focusFirst, focusLast }));

  return (
    <View>
      {blocks.map((block, i) => {
        const guarded = USE_SENTINEL && i > 0;
        return (
          <TextInput
            key={block.id}
            ref={(el) => {
              inputs.current[block.id] = el;
            }}
            value={guarded ? SENTINEL + block.text : block.text}
            selection={
              pendingSelection?.id === block.id
                ? { start: pendingSelection.start, end: pendingSelection.end }
                : undefined
            }
            onChangeText={(t) => handleChange(block.id, t)}
            onKeyPress={(e) => handleKeyPress(block.id, e)}
            onSelectionChange={(e) => {
              const { start, end } = e.nativeEvent.selection;
              selectionStart.current[block.id] = start;
              // Android: Cursor nicht vor das Wächterzeichen lassen, sonst
              // gäbe es dort eine Position, an der Backspace nichts tut
              if (guarded && start === 0) {
                setPendingSelection({ id: block.id, start: 1, end: Math.max(end, 1) });
              }
            }}
            onFocus={() => onActiveIdChange(block.id)}
            placeholder={i === 0 && blocks.length === 1 ? placeholder : undefined}
            placeholderTextColor={colors.textFaint}
            style={[styles.block, formatToStyle(block.format)]}
            multiline
            textAlignVertical="top"
          />
        );
      })}
      {/* Tipp auf die freie Fläche darunter fokussiert die letzte Zeile */}
      <Pressable style={styles.filler} onPress={focusLast} />
    </View>
  );
});

// Web zeichnet um fokussierte Eingabefelder einen schwarzen Standard-Rahmen –
// hier unerwünscht, der Editor soll rahmenlos wirken (nativ gibt es das nicht)
const noOutline = Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : null;

const styles = StyleSheet.create({
  block: { padding: 0, ...noOutline },
  filler: { minHeight: 180 },
});
