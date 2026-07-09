/**
 * Höhe der eingeblendeten Bildschirmtastatur in Pixeln (0, wenn zu).
 *
 * Nötig vor allem für Android mit Edge-to-Edge (Expo Go ab SDK 53): dort
 * schiebt das System die Ansicht nicht mehr automatisch hoch (adjustResize
 * greift nicht), die Tastatur legt sich einfach über den Inhalt. Mit der
 * gemessenen Höhe kann der Screen die Editor-Leiste selbst anheben.
 * Auf Web feuern die Keyboard-Events nicht – der Hook bleibt dort bei 0.
 */
import { useEffect, useState } from 'react';
import { Keyboard, Platform } from 'react-native';

export function useKeyboardHeight(): number {
  const [height, setHeight] = useState(0);

  useEffect(() => {
    // iOS meldet die Höhe schon beim Einblenden (will), Android erst danach (did)
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const show = Keyboard.addListener(showEvent, (e) => setHeight(e.endCoordinates.height));
    const hide = Keyboard.addListener(hideEvent, () => setHeight(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  return height;
}
