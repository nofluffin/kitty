import { distinctNames, youLabel } from '@kitty/core';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { ask } from '@/lib/ask';

import { useDraftKitty } from '@/lib/draft-kitty';
import { explainFailure } from '@/lib/errors';
import { useAuth } from '@/lib/auth';
import { deleteGroup, leaveGroup, loadGroups, saveGroup, type SavedGroup } from '@/lib/groups';
import { useToast } from '@/lib/toast';
import { Body, Button, DashedButton, ErrorText, Field, Label, Screen } from '@/ui/components';
import { PersonRow } from '@/ui/diet-tags';
import { colors, type } from '@/ui/theme';

/** New group (Raj, 20 Nov 2026): a name and people, saved without starting a kitty. */
export default function NewGroup() {
  const k = useDraftKitty();
  const { profile } = useAuth();
  const toast = useToast();
  // Edit (Raj, 21 Nov 2026): the group's name and people, filled in. Saving makes a new
  // version for you; anyone you shared the old one with keeps theirs.
  const { edit } = useLocalSearchParams<{ edit?: string }>();
  const [original, setOriginal] = useState<SavedGroup | null>(null);
  // The group's name lives in the draft, so the people screen can edit it too (Raj, 21 Nov 2026).
  const name = k.title;
  const setName = k.setTitle;
  useEffect(() => {
    if (!edit) return;
    let current = true;
    loadGroups().then((groups) => {
      const g = groups.find((x) => x.id === edit);
      if (!current || !g) return;
      setOriginal(g);
      setName(g.name);
      const me = g.people.find((p) => p.profileId === profile?.id);
      const organiser = k.people.find((p) => p.isOrganiser);
      if (me && organiser) k.updatePerson(organiser.key, { ...organiser, diet: me.diet, drinks: me.drinks });
      k.addGroup(g.people.map(({ profileId, ...p }) => ({ ...p, isMe: profileId === profile?.id })));
    });
    return () => {
      current = false;
    };
    // Load once for this edit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [edit]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const others = k.people.filter((p) => !p.isOrganiser);
  const nameOf = (key: string | null) => {
    const p = k.people.find((x) => x.key === key);
    return p ? (p.isOrganiser ? youLabel(profile?.name || p.name) : p.name) : null;
  };

  async function save() {
    if (!name.trim()) return setError('Give the group a name, like Family or Office lunch.');
    if (others.length === 0) return setError('Add at least one other person.');
    setError(null);
    setBusy(true);
    const e = await saveGroup(name.trim(), k.people);
    if (!e && original) await leaveGroup(original.id); // a renamed group replaces the old one too
    setBusy(false);
    if (e) return setError(await explainFailure(e, 'save the group'));
    toast(original ? `${name.trim()} saved` : `${name.trim()} added to your groups`);
    router.back();
  }

  // Raj, 21 Nov 2026: Leave, and Delete for groups you made, live here rather than on the list.
  async function leave() {
    if (!original) return;
    const message =
      original.createdBy.id === profile?.id
        ? `${original.name} goes from your Kitty only. Anyone you shared it with keeps it and can still use it. To remove it from everyone, delete it instead.`
        : `${original.name} goes from your Kitty only. ${original.createdBy.name || 'Whoever made it'} and anyone else who has it keep it.`;
    if (!(await ask(`Leave ${original.name}?`, message, 'Leave'))) return;
    const e = await leaveGroup(original.id);
    if (e) return setError(await explainFailure(e, 'leave the group'));
    toast(`You left ${original.name}`);
    router.back();
  }

  async function remove() {
    if (!original) return;
    if (
      !(await ask(
        `Delete ${original.name} for everyone?`,
        `${original.name} goes from your Kitty and from the Kitty of anyone you shared it with. They can’t get it back. Kitties already made with it don’t change.`,
        'Delete',
      ))
    )
      return;
    const e = await deleteGroup(original.id);
    if (e) return setError(await explainFailure(e, 'delete the group'));
    toast(`${original.name} deleted for everyone`);
    router.back();
  }

  return (
    <Screen
      title={original ? 'Edit group' : 'New group'}
      back
      footer={
        <>
          {original ? (
            <View style={styles.links}>
              <Pressable onPress={leave} accessibilityRole="button" hitSlop={8}>
                <Text style={type.link}>Leave this group</Text>
              </Pressable>
              {original.createdBy.id === profile?.id ? (
                <Pressable onPress={remove} accessibilityRole="button" hitSlop={8}>
                  <Text style={[type.link, styles.danger]}>Delete this group</Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}
          <ErrorText>{error}</ErrorText>
          <Button onPress={save} loading={busy}>
            Save group
          </Button>
        </>
      }
    >
      <Body>
        {original
          ? 'Change the name or people. Saving makes a new version for you; anyone you shared it with keeps the old one.'
          : 'People you often split with. Start a kitty with them in one tap. You’re in the group too.'}
      </Body>
      <Field label="Group name" value={name} onChangeText={setName} placeholder="Family" autoCapitalize="sentences" maxLength={60} />
      <View style={styles.section}>
        <Label>Who is in</Label>
        <View style={styles.list}>
          {k.people.map((p, i) => (
            <PersonRow
              key={p.key}
              name={p.isOrganiser ? youLabel(profile?.name || p.name) : distinctNames(k.people)[i]!}
              diet={p.diet}
              drinks={p.drinks}
              note={p.paidByKey ? `${nameOf(p.paidByKey)} pays for them` : null}
              onPress={() => router.push({ pathname: '/new-group/person', params: { key: p.key } })}
            />
          ))}
        </View>
        <View style={styles.add}>
          <DashedButton onPress={() => router.push('/new-group/person')}>Add or edit people</DashedButton>
        </View>
        <View style={styles.add}>
          {/* Raj, 20 Nov 2026: say names and food and drink instead of typing them. */}
          <DashedButton onPress={() => router.push('/new-group/voice')}>Add people by voice</DashedButton>
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  section: { marginTop: 20 },
  list: { marginTop: 10 },
  add: { marginTop: 12 },
  links: { flexDirection: 'row', gap: 24 },
  danger: { color: colors.destructive },
});
