import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';

import { explainFailure } from '@/lib/errors';
import { joinGroup } from '@/lib/groups';
import { Button, CenteredState, Screen } from '@/ui/components';

/** Opened from a "Share group" link (thekitty.app/g/<token>): adds the group to your login. */
export default function JoinGroup() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const [result, setResult] = useState<{ name: string } | { error: string } | null>(null);

  useEffect(() => {
    let current = true;
    joinGroup(token).then(async (r) => {
      if (!current) return;
      setResult(r instanceof Error ? { error: await explainFailure(r, 'add the group') } : r);
    });
    return () => {
      current = false;
    };
  }, [token]);

  return (
    <Screen title="Shared group" back>
      {!result ? (
        <CenteredState />
      ) : 'error' in result ? (
        <CenteredState title="Couldn’t add the group" body={result.error} />
      ) : (
        <CenteredState
          title={`${result.name} is in your groups`}
          body="When you start a kitty, tap it under “Add a saved group” to add everyone at once. You’ll find it in Your details too."
          action={<Button onPress={() => router.replace('/new')}>Start a kitty with it</Button>}
        />
      )}
    </Screen>
  );
}
