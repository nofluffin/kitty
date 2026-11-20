import { Stack } from 'expo-router';

import { useAuth } from '@/lib/auth';
import { DraftKittyProvider } from '@/lib/draft-kitty';
import { CenteredState, Screen } from '@/ui/components';
import { colors } from '@/ui/theme';

/**
 * A new group from the Groups tab (Raj, 20 Nov 2026). Uses the same people screen
 * as a kitty (screen 3), so contacts, food and drink and "who pays" work the same.
 */
export default function NewGroupLayout() {
  const { profile } = useAuth();
  if (!profile) {
    return (
      <Screen title="New group" back>
        <CenteredState />
      </Screen>
    );
  }
  return (
    <DraftKittyProvider organiserName={profile.name} upiId={profile.upi_id ?? ''}>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.page } }} />
    </DraftKittyProvider>
  );
}
