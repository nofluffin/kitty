import { Stack, useGlobalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';

import { useAuth } from '@/lib/auth';
import { DraftKittyProvider, type ExistingKitty } from '@/lib/draft-kitty';
import { loadEditableKitty } from '@/lib/edit-kitty';
import { Button, CenteredState, Screen } from '@/ui/components';
import { colors } from '@/ui/theme';

/**
 * Screens 2, 3 and 4 share one draft kitty until it's created.
 * Opened as /new?edit=<id>, the same screens edit a saved kitty until someone pays.
 */
export default function NewKittyLayout() {
  const { profile, profileStatus, refreshProfile } = useAuth();
  const { edit } = useGlobalSearchParams<{ edit?: string }>();
  // Read once: the edit id stays fixed while moving between screens 2, 3 and 4.
  const [editId] = useState(edit);
  const [existing, setExisting] = useState<ExistingKitty | null | 'error' | 'locked'>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!editId) return;
    let current = true;
    loadEditableKitty(editId)
      .then((k) => current && setExisting(k ?? 'locked'))
      .catch(() => current && setExisting('error'));
    return () => {
      current = false;
    };
  }, [editId, attempt]);

  const title = editId ? 'Edit' : 'New kitty';
  if (!profile || (editId && (existing === null || existing === 'error' || existing === 'locked'))) {
    // Never spin forever: if something can't load, say so and offer a retry.
    const failed = profileStatus === 'error' || existing === 'error';
    return (
      <Screen title={title} back>
        {existing === 'locked' ? (
          <CenteredState
            title="Someone has already paid"
            body="Amounts lock once anyone pays. To change the total now, settle up from the kitty’s feed."
          />
        ) : failed ? (
          <CenteredState
            title="Couldn’t load your details"
            body="Check your connection and try again."
            action={
              <Button
                onPress={() => {
                  refreshProfile();
                  setExisting(null);
                  setAttempt((a) => a + 1);
                }}
              >
                Try again
              </Button>
            }
          />
        ) : (
          <CenteredState />
        )}
      </Screen>
    );
  }
  return (
    <DraftKittyProvider organiserName={profile.name} upiId={profile.upi_id ?? ''} existing={editId ? (existing as ExistingKitty) : null}>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.page } }} />
    </DraftKittyProvider>
  );
}
