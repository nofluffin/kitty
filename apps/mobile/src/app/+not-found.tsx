import { router } from 'expo-router';

import { Button, CenteredState, Screen } from '@/ui/components';

/** Any unknown address. Uses Kitty's own look instead of the default developer page. */
export default function NotFound() {
  return (
    <Screen title="Kitty">
      <CenteredState
        title="This page doesn’t exist"
        body="The link may be old or mistyped."
        action={<Button onPress={() => router.replace('/')}>Go to Kitty</Button>}
      />
    </Screen>
  );
}
