import { Stack } from 'expo-router';

import { useAuth } from '@/lib/auth';
import { DraftKittyProvider } from '@/lib/draft-kitty';
import { Button, CenteredState, Screen } from '@/ui/components';
import { colors } from '@/ui/theme';

/** Screens 2, 3 and 4 share one draft kitty until it's created. */
export default function NewKittyLayout() {
  const { profile, profileStatus, refreshProfile } = useAuth();

  if (!profile) {
    // Never spin forever: if the profile can't load, say so and offer a retry.
    return (
      <Screen title="New kitty" back>
        {profileStatus === 'error' ? (
          <CenteredState
            title="Couldn’t load your details"
            body="Check your connection and try again."
            action={<Button onPress={refreshProfile}>Try again</Button>}
          />
        ) : (
          <CenteredState />
        )}
      </Screen>
    );
  }
  return (
    <DraftKittyProvider organiserName={profile.name} upiId={profile.upi_id ?? ''}>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.page } }} />
    </DraftKittyProvider>
  );
}
