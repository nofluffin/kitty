import { isValidEmail, normaliseEmail, normaliseIndianMobile } from '@kitty/core';

import { config } from './config';
import { supabase } from './supabase';

/**
 * Sign up and log in with a one-time code. The method (email or SMS) is set by
 * EXPO_PUBLIC_LOGIN_METHOD, so switching after DLT approval is a config change.
 */

export interface CodeRequest {
  mode: 'sign-up' | 'log-in';
  /** Email address or +91 mobile number, depending on the login method. */
  identifier: string;
  /** Sign up only. Saved to the profile by the database trigger. */
  name?: string;
  phone?: string;
}

/** Cleans what was typed into the login field. Returns null if it isn't valid. */
export function normaliseIdentifier(input: string): string | null {
  if (config.loginMethod === 'sms') return normaliseIndianMobile(input);
  return isValidEmail(input) ? normaliseEmail(input) : null;
}

export async function requestCode({ mode, identifier, name, phone }: CodeRequest): Promise<void> {
  const options = {
    shouldCreateUser: mode === 'sign-up',
    ...(mode === 'sign-up' ? { data: { name, phone } } : {}),
  };
  const { error } =
    config.loginMethod === 'sms'
      ? await supabase.auth.signInWithOtp({ phone: identifier, options })
      : await supabase.auth.signInWithOtp({ email: identifier, options });
  if (error) throw error;
}

export async function verifyCode(identifier: string, token: string): Promise<void> {
  const { error } =
    config.loginMethod === 'sms'
      ? await supabase.auth.verifyOtp({ phone: identifier, token, type: 'sms' })
      : await supabase.auth.verifyOtp({ email: identifier, token, type: 'email' });
  if (error) throw error;
}

/** Turns Supabase auth errors into words an organiser can act on. */
export function authErrorMessage(error: unknown): string {
  const e = (error ?? {}) as { code?: string; message?: string; status?: number; name?: string };
  const message = e.message ?? '';
  const noun = config.loginMethod === 'sms' ? 'number' : 'email';

  if (e.code === 'otp_disabled' || /signups not allowed/i.test(message)) {
    return `There's no Kitty account for that ${noun}. Sign up instead.`;
  }
  if (e.code === 'otp_expired' || /expired|invalid/i.test(message)) {
    return 'That code is wrong or has run out. Check it, or send a new one.';
  }
  if (/only request this after/i.test(message)) {
    return 'Wait a few seconds before asking for another code.';
  }
  if (e.status === 429 || /rate limit/i.test(message)) {
    return 'Too many codes asked for. Wait a minute and try again.';
  }
  if (e.name === 'AuthRetryableFetchError' || e.status === 0 || /network|fetch/i.test(message)) {
    return "Can't reach Kitty. Check your connection and try again.";
  }
  return 'Something went wrong. Try again.';
}
