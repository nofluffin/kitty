import Constants from 'expo-constants';
import { Platform } from 'react-native';

export type LoginMethod = 'email' | 'sms';

function required(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(`${name} is not set. Copy the values from .env.example into apps/mobile/.env.local.`);
  }
  return value;
}

/**
 * On a real phone, 127.0.0.1 is the phone itself. In development, point local
 * URLs at the computer running Expo instead, using the address the phone already
 * reached Metro on.
 */
function reachableFromDevice(url: string): string {
  if (!__DEV__ || Platform.OS === 'web') return url;
  const host = Constants.expoConfig?.hostUri?.split(':')[0];
  if (!host) return url;
  return url.replace(/\/\/(127\.0\.0\.1|localhost)(?=[:/]|$)/, `//${host}`);
}

// EXPO_PUBLIC_ values must be read with literal property names so Expo can inline them.
export const config = {
  supabaseUrl: reachableFromDevice(required('EXPO_PUBLIC_SUPABASE_URL', process.env.EXPO_PUBLIC_SUPABASE_URL)),
  supabaseAnonKey: required('EXPO_PUBLIC_SUPABASE_ANON_KEY', process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY),
  memberPageUrl: reachableFromDevice(process.env.EXPO_PUBLIC_MEMBER_PAGE_URL ?? 'http://127.0.0.1:3456'),
  /** Email codes until SMS sender DLT registration is approved (spec section 11). */
  loginMethod: (process.env.EXPO_PUBLIC_LOGIN_METHOD === 'sms' ? 'sms' : 'email') as LoginMethod,
} as const;
