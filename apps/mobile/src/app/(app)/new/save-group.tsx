import { distinctNames } from '@kitty/core';
import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { describePerson, useDraftKitty } from '@/lib/draft-kitty';
import { explainFailure } from '@/lib/errors';
import { saveGroup } from '@/lib/groups';
import { useToast } from '@/lib/toast';
import { Body, Button, ErrorText, Field, Row, Screen } from '@/ui/components';

/** Save the kitty's people as a group (Raj, 20 Nov 2026; not in the wires). */
export default function SaveGroup() {
  const k = useDraftKitty();
  const toast = useToast();
  const others = k.people.filter((p) => !p.isOrganiser);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    if (!name.trim()) {
      setError('Give the group a name, like Office lunch or Family.');
      return;
    }
    setError(null);
    setBusy(true);
    const e = await saveGroup(name.trim(), k.people);
    setBusy(false);
    if (e) {
      setError(await explainFailure(e, 'save the group'));
      return;
    }
    toast(`Saved as ${name.trim()}`);
    router.back();
  }

  return (
    <Screen
      title="Save as a group"
      back
      footer={
        <>
          <ErrorText>{error}</ErrorText>
          <Button onPress={save} loading={busy}>
            Save group
          </Button>
        </>
      }
    >
      <Body>Next time, add everyone in one tap. Their numbers, food and drink, and who pays for whom are kept. You’re in the group too, so anyone you share it with gets you.</Body>
      <Field label="Group name" value={name} onChangeText={setName} placeholder="Office lunch" autoCapitalize="sentences" maxLength={60} />
      <Body>If you already have a group with this name, it’s swapped for this one. Anyone you shared the old one with keeps it.</Body>
      <View style={styles.list}>
        {others.map((p, i) => (
          <Row key={p.key} left={distinctNames(others)[i]!} right={describePerson(p)} />
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { marginTop: 12 },
});
