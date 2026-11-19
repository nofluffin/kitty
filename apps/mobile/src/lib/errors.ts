import { notify } from './notify';
import { supabase } from './supabase';

/**
 * Turns a failed save or load into words an organiser can act on.
 *
 * A login can end behind the app's back (e.g. "Log out" on another device, or
 * an expired session that couldn't refresh). Requests then go out without the
 * login and the database refuses them. Rather than blame the connection, ask
 * the server whether the login is still good, and if not, log out here and say so.
 */
export async function explainFailure(error: unknown, action: string): Promise<string> {
  const e = (error ?? {}) as { message?: string; name?: string };
  if (e.name === 'AuthRetryableFetchError' || /failed to fetch|network request failed|load failed/i.test(e.message ?? '')) {
    return "Can't reach Kitty. Check your connection and try again.";
  }

  const { data, error: authError } = await supabase.auth.getUser();
  const unreachable = authError?.name === 'AuthRetryableFetchError' || authError?.status === 0;
  if (unreachable) return "Can't reach Kitty. Check your connection and try again.";
  if (authError || !data.user) {
    notify('You’ve been logged out', 'Log in again to carry on.');
    await supabase.auth.signOut({ scope: 'local' }); // the app moves to log in
    return 'You’ve been logged out. Log in again to carry on.';
  }
  return `Couldn’t ${action}. Try again.`;
}
