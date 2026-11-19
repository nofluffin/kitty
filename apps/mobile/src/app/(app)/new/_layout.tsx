import { Stack } from 'expo-router';

import { useAuth } from '@/lib/auth';
import { DraftKittyProvider } from '@/lib/draft-kitty';
import { CenteredState } from '@/ui/components';
import { colors } from '@/ui/theme';

/** Screens 2, 3 and 4 share one draft kitty until it's created. */
export default function NewKittyLayout() {
  const { profile } = useAuth();
  if (!profile) return <CenteredState />;
  return (
    <DraftKittyProvider organiserName={profile.name} upiId={profile.upi_id ?? ''}>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.page } }} />
    </DraftKittyProvider>
  );
}
