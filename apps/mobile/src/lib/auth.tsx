import type { Row } from '@kitty/db';
import type { Session } from '@supabase/supabase-js';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { forgetPushToken } from './push';
import { supabase } from './supabase';

export type Profile = Row<'profiles'>;

/** loading: being fetched. error: couldn't reach the server (retry). ready: loaded. */
export type ProfileStatus = 'loading' | 'error' | 'ready';

interface AuthState {
  /** False until the saved session has been read and checked. */
  ready: boolean;
  session: Session | null;
  profile: Profile | null;
  profileStatus: ProfileStatus;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

type ProfileResult = { kind: 'found'; profile: Profile } | { kind: 'missing' } | { kind: 'error' };

async function fetchProfile(userId: string): Promise<ProfileResult> {
  const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
  if (error) return { kind: 'error' };
  return data ? { kind: 'found', profile: data } : { kind: 'missing' };
}

/**
 * A saved login can outlive its account, for example after the local database is
 * rebuilt. Ask the server whether it's still valid, and log out cleanly if not.
 * Network failures keep the session, so organisers aren't logged out when offline.
 */
async function checkSavedSession(session: Session | null): Promise<Session | null> {
  if (!session) return null;
  const { data, error } = await supabase.auth.getUser();
  const gone = error ? error.status === 401 || error.status === 403 || error.status === 404 : data.user?.id !== session.user.id;
  if (gone) {
    await supabase.auth.signOut({ scope: 'local' });
    return null;
  }
  return session;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [profileStatus, setProfileStatus] = useState<ProfileStatus>('loading');

  useEffect(() => {
    let current = true;
    supabase.auth
      .getSession()
      .then(({ data }) => checkSavedSession(data.session))
      .then((checked) => {
        if (!current) return;
        setSession(checked);
        setReady(true);
      });
    const { data } = supabase.auth.onAuthStateChange((_event, next) => setSession(next));
    return () => {
      current = false;
      data.subscription.unsubscribe();
    };
  }, []);

  const userId = session?.user.id;

  const applyProfile = useCallback(async (result: ProfileResult) => {
    if (result.kind === 'found') {
      setProfile(result.profile);
      setProfileStatus('ready');
    } else if (result.kind === 'missing') {
      // Logged in but the account has no profile: the account was removed. Start again.
      await supabase.auth.signOut({ scope: 'local' });
    } else {
      setProfileStatus('error');
    }
  }, []);

  useEffect(() => {
    if (!userId) return;
    let current = true;
    fetchProfile(userId).then((r) => {
      if (current) applyProfile(r);
    });
    return () => {
      current = false;
    };
  }, [userId, applyProfile]);

  const refreshProfile = useCallback(async () => {
    if (!userId) return;
    setProfileStatus('loading');
    await applyProfile(await fetchProfile(userId));
  }, [userId, applyProfile]);

  const signOut = useCallback(async () => {
    // Stop this phone getting the organiser's notifications first, while still logged in.
    await forgetPushToken().catch(() => {});
    // This phone only. Logging out shouldn't end the organiser's sessions on other devices.
    await supabase.auth.signOut({ scope: 'local' });
  }, []);

  // A profile left over from a previous login is never shown.
  const visibleProfile = profile && profile.id === userId ? profile : null;
  const visibleStatus: ProfileStatus = visibleProfile ? 'ready' : profileStatus === 'error' ? 'error' : 'loading';

  const value = useMemo(
    () => ({ ready, session, profile: visibleProfile, profileStatus: visibleStatus, refreshProfile, signOut }),
    [ready, session, visibleProfile, visibleStatus, refreshProfile, signOut],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside AuthProvider');
  return value;
}
