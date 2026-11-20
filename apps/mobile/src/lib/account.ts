import { removeAllAvatars } from './avatar';
import { supabase } from './supabase';

/**
 * Deletes the organiser's account and everything in it (App Store rule, step 10):
 * bill photos first through the storage API, then the account, which removes
 * their kitties, people, payments, notifications and phones in the database.
 */
export async function deleteAccount(): Promise<Error | null> {
  const { data: kitties, error } = await supabase.from('kitties').select('id');
  if (error) return error;

  for (const k of kitties) {
    const { data: files } = await supabase.storage.from('bills').list(k.id);
    const paths = (files ?? []).map((f) => `${k.id}/${f.name}`);
    if (paths.length > 0) {
      const { error: removeError } = await supabase.storage.from('bills').remove(paths);
      if (removeError) return removeError;
    }
  }

  const { data: me } = await supabase.auth.getUser();
  if (me.user) await removeAllAvatars(me.user.id);

  const { error: deleteError } = await supabase.rpc('delete_my_account');
  if (deleteError) return deleteError;
  // The login no longer exists; clear it from this phone.
  await supabase.auth.signOut({ scope: 'local' });
  return null;
}
