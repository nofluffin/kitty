import { cleanName, formatIndianMobile, normaliseIndianMobile, type Diet } from '@kitty/core';
import { Contact } from 'expo-contacts';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, Platform, StyleSheet, Text, View } from 'react-native';

import { useAuth } from '@/lib/auth';
import { describePerson, useDraftKitty, type DraftPerson } from '@/lib/draft-kitty';
import { Button, Field, Label, Row, Screen, Segmented, Small, TextLink } from '@/ui/components';
import { type } from '@/ui/theme';

/**
 * Screen 3. Adds people one after another; the list underneath shows who's in.
 * Tapping someone in the list loads them back into the form to change or remove.
 */
export default function AddPerson() {
  const { key: editKey } = useLocalSearchParams<{ key?: string }>();
  const k = useDraftKitty();
  const editing = k.people.find((p) => p.key === editKey) ?? null;
  // Remount the form when switching between adding and editing someone.
  return <PersonForm key={editing?.key ?? 'new'} editing={editing} />;
}

function PersonForm({ editing }: { editing: DraftPerson | null }) {
  const k = useDraftKitty();
  const { profile } = useAuth();
  const [name, setName] = useState(editing?.name ?? '');
  const [mobile, setMobile] = useState(editing?.phone ? formatIndianMobile(editing.phone).replace(/^\+91 /, '') : '');
  const [diet, setDiet] = useState<Diet>(editing?.diet ?? 'veg');
  const [drinks, setDrinks] = useState(editing?.drinks ?? false);
  const [errors, setErrors] = useState<{ name?: string; mobile?: string }>({});
  const isOrganiser = editing?.isOrganiser ?? false;
  const shownName = name.trim() || 'them';

  async function pickContact() {
    try {
      const contact = await Contact.presentPicker();
      if (!contact) return;
      const [fullName, phones] = await Promise.all([contact.getFullName(), contact.getPhones()]);
      if (fullName) setName(fullName);
      const indian = phones.map((p) => normaliseIndianMobile(p.number ?? '')).find(Boolean);
      setMobile(indian ? formatIndianMobile(indian).replace(/^\+91 /, '') : '');
    } catch {
      Alert.alert('Couldn’t open contacts', 'Type their name instead.');
    }
  }

  function save() {
    const cleaned = isOrganiser ? editing!.name : cleanName(name);
    const phone = mobile.trim() ? normaliseIndianMobile(mobile) : null;
    const next = {
      ...(cleaned ? {} : { name: 'Add their name.' }),
      ...(mobile.trim() && !phone ? { mobile: 'Enter a 10 digit Indian mobile number, or leave it empty.' } : {}),
    };
    setErrors(next);
    if (Object.keys(next).length > 0 || !cleaned) return;

    const person = { name: cleaned, phone, isOrganiser, diet, drinks };
    if (editing) {
      k.updatePerson(editing.key, person);
      router.setParams({ key: undefined });
    } else {
      k.addPerson(person);
      setName('');
      setMobile('');
      setDiet('veg');
      setDrinks(false);
    }
  }

  function remove() {
    if (!editing) return;
    k.removePerson(editing.key);
    router.setParams({ key: undefined });
  }

  return (
    <Screen title={editing ? (isOrganiser ? 'You' : `Edit ${editing.name}`) : 'Add a person'} back>
      {!editing && Platform.OS !== 'web' ? (
        <>
          <Button variant="secondary" onPress={pickContact}>
            Pick from contacts
          </Button>
          <View style={styles.privacy}>
            <Small>Kitty only sees the people you pick, not your whole address book.</Small>
          </View>
        </>
      ) : null}

      {isOrganiser ? (
        <Text style={type.body}>Set your own food and drink, so the bill splits fairly for you too.</Text>
      ) : (
        <>
          <Field
            label="Name"
            value={name}
            onChangeText={setName}
            placeholder="Aisha"
            autoCapitalize="words"
            maxLength={80}
            error={errors.name ?? null}
          />
          <Field
            label="Mobile number"
            prefix="+91"
            value={mobile}
            onChangeText={setMobile}
            placeholder="Optional"
            keyboardType="phone-pad"
            hint={`Used to open a WhatsApp chat with ${shownName} when you share or nudge. Optional.`}
            error={errors.mobile ?? null}
          />
        </>
      )}

      <View style={styles.group}>
        <Label>Food</Label>
        <View style={styles.control}>
          <Segmented
            label="Food"
            options={[
              { value: 'veg', label: 'Veg' },
              { value: 'nonveg', label: 'Non-veg' },
            ]}
            value={diet}
            onChange={setDiet}
          />
        </View>
      </View>
      <View style={styles.group}>
        <Label>Alcohol</Label>
        <View style={styles.control}>
          <Segmented
            label="Alcohol"
            options={[
              { value: 'yes', label: 'Drinks' },
              { value: 'no', label: 'Doesn’t drink' },
            ]}
            value={drinks ? 'yes' : 'no'}
            onChange={(v) => setDrinks(v === 'yes')}
          />
        </View>
        <View style={styles.hint}>
          <Small>
            Kitty uses this to split the bill after you scan it. Veg eaters don’t pay for non-veg dishes, and only
            drinkers pay for alcohol.
          </Small>
        </View>
      </View>

      <View style={styles.actions}>
        <Button onPress={save}>{editing ? 'Save changes' : 'Add to kitty'}</Button>
        {editing ? (
          <Button variant="secondary" onPress={remove}>
            {isOrganiser ? 'I’m not paying into this one' : 'Remove from kitty'}
          </Button>
        ) : null}
      </View>

      <View style={styles.listGap}>
        <Label>In this kitty</Label>
        {!k.people.some((p) => p.isOrganiser) ? (
          <View style={styles.addBack}>
            <TextLink onPress={() => k.addPerson({ name: profile?.name || 'You', phone: null, isOrganiser: true, diet: 'veg', drinks: false })}>
              Add yourself back
            </TextLink>
          </View>
        ) : null}
        <View style={styles.list}>
          {k.people.length === 0 ? (
            <Text style={[type.note, styles.empty]}>Nobody yet.</Text>
          ) : (
            k.people.map((p) => (
              <Row
                key={p.key}
                left={p.isOrganiser ? 'You' : p.name}
                right={describePerson(p)}
                onPress={() => router.setParams({ key: p.key })}
              />
            ))
          )}
        </View>
      </View>
    </Screen>
  );
}

// Spacing measured from screen 3.
const styles = StyleSheet.create({
  privacy: { marginTop: 16, alignItems: 'center' },
  group: { marginTop: 18 },
  control: { marginTop: 6 },
  hint: { marginTop: 16 },
  actions: { marginTop: 30, gap: 12 },
  listGap: { marginTop: 29 },
  list: { marginTop: 12 },
  empty: { paddingVertical: 12 },
  addBack: { marginTop: 8 },
});
