import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { deleteAccount } from '@/lib/account';
import { ask } from '@/lib/ask';
import { explainFailure } from '@/lib/errors';
import { Body, Button, ErrorText, Screen, Title } from '@/ui/components';
import { type } from '@/ui/theme';

/** Delete my account (App Store rule, step 10). Not in the wires. */
export default function DeleteAccount() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirmAndDelete() {
    const sure = await ask(
      'Delete your account?',
      'Your kitties, the people in them and their payment records are deleted for good. Links you’ve shared stop working.',
      'Delete',
    );
    if (!sure) return;
    setError(null);
    setBusy(true);
    const e = await deleteAccount();
    setBusy(false);
    if (e) {
      setError(await explainFailure(e, 'delete your account'));
      return;
    }
    router.replace('/sign-up');
  }

  return (
    <Screen
      title="Delete account"
      back
      hideAvatar
      footer={
        <>
          <ErrorText>{error}</ErrorText>
          <Button onPress={confirmAndDelete} loading={busy}>
            Delete my account
          </Button>
          <Button variant="secondary" onPress={() => router.back()}>
            Keep my account
          </Button>
        </>
      }
    >
      <Title>Delete your Kitty account</Title>
      <Body>This can’t be undone. Kitty deletes:</Body>
      <View style={styles.list}>
        {[
          'Your name, mobile number, email and UPI ID',
          'Every kitty you started, with the people in it and their payment records',
          'Bill photos and scanned bills',
          'Your notifications, and this phone’s registration for them',
        ].map((item) => (
          <Text key={item} style={[type.bodyInk, styles.item]}>
            {`•  ${item}`}
          </Text>
        ))}
      </View>
      <Body>
        Links you’ve shared stop working. Money already sent by UPI isn’t affected: Kitty never holds it. Settle anything still open
        with your friends first.
      </Body>
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { marginVertical: 16, gap: 8 },
  item: { lineHeight: 24 },
});
