import { Redirect } from 'expo-router';

import { useAuth } from '@/lib/auth';

/** The app's front door: "/" is always reachable, and sends you to the right place. */
export default function Index() {
  const { session } = useAuth();
  return <Redirect href={session ? '/home' : '/sign-up'} />;
}
