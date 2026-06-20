/** Serifenschrift für Titel/Eintragstexte (Home, Verlauf, Eintrag schreiben). */
import { Platform } from 'react-native';

export const serif = Platform.select({
  ios: 'Georgia',
  android: 'serif',
  default: 'Georgia',
});
