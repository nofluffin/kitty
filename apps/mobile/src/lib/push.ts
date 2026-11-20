import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { AndroidImportance } from 'expo-notifications';
import { Platform } from 'react-native';

import { supabase } from './supabase';

/**
 * Push notifications to the organiser (spec section 10). The database queues and
 * sends them (see the push_notifications migration); the app only registers this
 * phone and handles taps. Browsers (app.thekitty.app) don't get push.
 */

export const pushSupported = Platform.OS === 'ios' || Platform.OS === 'android';

/** The "Confirm" button on "Kabir marked ₹1,000 as paid". */
export const CONFIRM_ACTION = 'confirm';

let configured = false;

/** Once per app start: how notifications show while the app is open, and the Confirm button. */
export async function configurePush() {
  if (!pushSupported || configured) return;
  configured = true;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
  if (Platform.OS === 'android') {
    // The database sends with channelId "default".
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Payments and reminders',
      importance: AndroidImportance.HIGH,
    });
  }
  await Notifications.setNotificationCategoryAsync('payment_marked', [
    { identifier: CONFIRM_ACTION, buttonTitle: 'Confirm it arrived', options: { opensAppToForeground: true } },
  ]);
}

let registeredToken: string | null = null;

/**
 * Registers this phone for the logged-in organiser. With ask, shows the system
 * permission prompt if it hasn't been answered yet; otherwise only registers when
 * permission was already given. Returns whether notifications are on.
 */
export async function registerForPush({ ask }: { ask: boolean }): Promise<boolean> {
  if (!pushSupported) return false;
  try {
    await configurePush();
    let { granted, canAskAgain } = await Notifications.getPermissionsAsync();
    if (!granted && ask && canAskAgain) {
      ({ granted } = await Notifications.requestPermissionsAsync());
    }
    if (!granted) return false;

    const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
    const { error } = await supabase.rpc('register_device_token', { p_token: token, p_platform: Platform.OS });
    if (error) return false;
    registeredToken = token;
    return true;
  } catch {
    // Push is a nice-to-have: never block the app over it.
    return false;
  }
}

/** On log out, so this phone stops getting the organiser's notifications. */
export async function forgetPushToken() {
  if (!registeredToken) return;
  await supabase.from('device_tokens').delete().eq('expo_push_token', registeredToken);
  registeredToken = null;
}

export async function notificationsOn(): Promise<boolean> {
  if (!pushSupported) return false;
  return (await Notifications.getPermissionsAsync()).granted;
}
