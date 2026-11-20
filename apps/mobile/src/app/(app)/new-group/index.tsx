import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { describePerson, useDraftKitty } from '@/lib/draft-kitty';
import { explainFailure } from '@/lib/errors';
import { saveGroup } from '@/lib/groups';
import { Body, Button, DashedButton, ErrorText, Field, Label, Row, Screen } from '@/ui/components';

/** New group (Raj, 20 Nov 2026): a name and people, saved without starting a kitty. */
export default function NewGroup() {
  const k = useDraftKitty();
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const others = k.people.filter((p) => !p.isOrganiser);
  const nameOf = (key: string | null) => {
    const p = k.people.find((x) => x.key === key);
    return p ? (p.isOrganiser ? 'You' : p.name) : null;
  };

  async function save() {
    if (!name.trim()) return setError('Give the group a name, like Family or Office lunch.');
    if (others.length === 0) return setError('Add at least one other person.');
    setError(null);
    setBusy(true);
    const e = await saveGroup(name.trim(), k.people);
    setBusy(false);
    if (e) return setError(await explainFailure(e, 'save the group'));
    router.back();
  }

  return (
    <Screen
      title="New group"
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
      <Body>People you often split with. Start a kitty with them in one tap. You’re in the group too.</Body>
      <Field label="Group name" value={name} onChangeText={setName} placeholder="Family" autoCapitalize="sentences" maxLength={60} />
      <View style={styles.section}>
        <Label>Who is in</Label>
        <View style={styles.list}>
          {k.people.map((p) => (
            <Row
              key={p.key}
              left={p.isOrganiser ? 'You' : p.name}
              right={describePerson(p, nameOf(p.paidByKey))}
              onPress={() => router.push({ pathname: '/new-group/person', params: { key: p.key } })}
            />
          ))}
        </View>
        <View style={styles.add}>
          <DashedButton onPress={() => router.push('/new-group/person')}>Add or edit people</DashedButton>
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  section: { marginTop: 20 },
  list: { marginTop: 10 },
  add: { marginTop: 12 },
});
