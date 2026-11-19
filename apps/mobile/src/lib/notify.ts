import { Alert, Platform } from 'react-native';

/**
 * A simple message box that works everywhere. React Native's Alert does
 * nothing in a web browser, so the web preview uses the browser's own.
 */
export function notify(title: string, message: string): void {
  if (Platform.OS === 'web') {
    window.alert(`${title}\n\n${message}`);
  } else {
    Alert.alert(title, message);
  }
}
