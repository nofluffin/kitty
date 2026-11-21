import { cleanName, type Diet, distinctNames, formatIndianMobile, normaliseIndianMobile, youLabel } from '@kitty/core';
// The legacy picker returns the picked person's details directly. The newer Contact.presentPicker
// only returns an ID, and reading the numbers then needs full address book permission on iPhone.
import { presentContactPickerAsync } from 'expo-contacts/legacy';
import { router, useLocalSearchParams, usePathname } from 'expo-router';
import { useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';

import { useAuth } from '@/lib/auth';
import { describePerson, useDraftKitty, type DraftPerson } from '@/lib/draft-kitty';
import { notify } from '@/lib/notify';
import { Button, Chip, Field, Label, Row, Screen, Segmented, Small, TextLink } from '@/ui/components';
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
  // The same screen adds people to a new group (Groups tab).
  const inGroup = usePathname().startsWith('/new-group');
  const [name, setName] = useState(editing?.name ?? '');
  const hasName = name.trim().length > 0;
  const [mobile, setMobile] = useState(editing?.phone ? formatIndianMobile(editing.phone).replace(/^\+91 /, '') : '');
  const [diet, setDiet] = useState<Diet>(editing?.diet ?? 'veg');
  const [drinks, setDrinks] = useState(editing?.drinks ?? false);
  const [paidByKey, setPaidByKey] = useState<string | null>(editing?.paidByKey ?? null);
  const [errors, setErrors] = useState<{ name?: string; mobile?: string }>({});
  const [added, setAdded] = useState<string | null>(null);
  const isOrganiser = editing?.isOrganiser ?? false;
  // Paying for someone else: anyone who pays for themselves can pay for this person.
  // Someone already paying for others can't be paid for (no chains), nor can the organiser.
  const paysForOthers = editing ? k.people.filter((p) => p.paidByKey === editing.key) : [];
  const payers = k.people.filter((p) => p.key !== editing?.key && !p.paidByKey);
  // Names as shown, telling apart people who share one.
  const labels = new Map(k.people.map((p, i) => [p.key, distinctNames(k.people)[i]!]));
  const canBePaidFor = !isOrganiser && paysForOthers.length === 0 && payers.length > 0;
  const nameOf = (key: string | null) => {
    const p = k.people.find((x) => x.key === key);
    return p ? (p.isOrganiser ? youLabel(p.name) : p.name) : null;
  };
  const shownName = name.trim() || 'them';

  async function pickContact() {
    try {
      const contact = await presentContactPickerAsync();
      if (!contact) return;
      const fullName = contact.name || [contact.firstName, contact.lastName].filter(Boolean).join(' ');
      if (fullName) setName(fullName);
      // The main number first, then the first Indian mobile among the rest.
      const phones = [...(contact.phoneNumbers ?? [])].sort((a, b) => Number(!!b.isPrimary) - Number(!!a.isPrimary));
      const indian = phones.map((p) => normaliseIndianMobile(p.number ?? p.digits ?? '')).find(Boolean);
      setMobile(indian ? formatIndianMobile(indian).replace(/^\+91 /, '') : '');
      setErrors(
        !indian && phones.length > 0
          ? { mobile: `${fullName ? `${fullName}’s` : 'Their'} number isn’t an Indian mobile. Type one, or leave it empty.` }
          : {},
      );
    } catch {
      notify('Couldn’t open contacts', 'Type their name instead.');
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

    // Someone paid for by another person isn't messaged, so their number isn't kept.
    const person = { name: cleaned, phone: paidByKey ? null : phone, isOrganiser, diet, drinks, paidByKey: canBePaidFor ? paidByKey : null };
    if (editing) {
      k.updatePerson(editing.key, person);
      router.setParams({ key: undefined });
    } else {
      k.addPerson(person);
      setAdded(cleaned);
      setName('');
      setMobile('');
      setDiet('veg');
      setDrinks(false);
      setPaidByKey(null);
    }
  }

  function remove() {
    if (!editing) return;
    k.removePerson(editing.key);
    router.setParams({ key: undefined });
  }

  return (
    <Screen
      title={editing ? (isOrganiser ? youLabel(editing.name) : `Edit ${editing.name}`) : 'Add a person'}
      back
      footer={
        // Raj, 20 Nov 2026: one pinned button. "Add to kitty" while someone is being filled in,
        // then "Done, 4 people in" once the form is empty again.
        editing ? (
          <Button onPress={save}>Save changes</Button>
        ) : name.trim() ? (
          <Button onPress={save}>{inGroup ? 'Add to group' : 'Add to kitty'}</Button>
        ) : (
          <Button onPress={() => router.back()}>{`Done, ${k.people.length} ${k.people.length === 1 ? 'person' : 'people'} in`}</Button>
        )
      }
    >
      {inGroup ? (
        // Raj, 21 Nov 2026: the group's name can be changed while adding people too.
        <View style={styles.groupName}>
          <Field label="Group name" value={k.title} onChangeText={k.setTitle} placeholder="Family" autoCapitalize="sentences" maxLength={60} />
        </View>
      ) : null}
      {!editing && Platform.OS !== 'web' ? (
        <>
          <Button variant="secondary" onPress={pickContact}>
            Pick from contacts
          </Button>
          <View style={styles.privacy}>
            <Small>Picking a contact shares only that person with Kitty.</Small>
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
          {canBePaidFor ? (
            <View style={styles.group}>
              <Label>Who pays for them</Label>
              <View style={styles.chips}>
                {/* Raj, 21 Nov 2026: greyed out until there's a name. */}
                <Chip filled={paidByKey === null} disabled={!hasName} onPress={() => setPaidByKey(null)}>
                  Themselves
                </Chip>
                {payers.map((p) => (
                  <Chip key={p.key} filled={paidByKey === p.key} disabled={!hasName} onPress={() => setPaidByKey(p.key)}>
                    {p.isOrganiser ? youLabel(p.name) : (labels.get(p.key) ?? p.name)}
                  </Chip>
                ))}
              </View>
              <View style={styles.hint}>
                <Small>
                  {!hasName
                    ? 'Type their name first, then choose who pays for them.'
                    : paidByKey
                    ? k.people.find((x) => x.key === paidByKey)?.isOrganiser
                      ? 'You cover their share along with your own.'
                      : `${nameOf(paidByKey)} is asked for their share along with their own.`
                    : 'For a child, or anyone whose share someone else covers.'}
                </Small>
              </View>
            </View>
          ) : paysForOthers.length > 0 ? (
            <View style={styles.group}>
              <Small>{`Pays for ${paysForOthers.map((p) => p.name).join(', ')} too.`}</Small>
            </View>
          ) : null}
          {paidByKey && canBePaidFor ? null : (
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
          )}
        </>
      )}

      <View style={styles.group}>
        <Label>Food</Label>
        <View style={styles.control}>
          <Segmented
            label="Food"
            options={[
              { value: 'veg', label: 'Veg' },
              { value: 'nonveg', label: 'Non-Veg' },
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
              { value: 'yes', label: 'Alcohol' },
              { value: 'no', label: 'No Alcohol' },
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
        {added && !editing ? <Text style={[type.note, styles.added]}>{added} added. Add someone else, or tap Done.</Text> : null}
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
            <TextLink
              onPress={() => k.addPerson({ name: profile?.name || 'You', phone: null, isOrganiser: true, diet: 'veg', drinks: false, paidByKey: null })}
            >
              Add yourself back
            </TextLink>
          </View>
        ) : null}
        <View style={styles.list}>
          {k.people.length === 0 ? (
            <Text style={[type.note, styles.empty]}>Nobody yet.</Text>
          ) : (
            k.people.map((p, i) => (
              <Row
                key={p.key}
                left={p.isOrganiser ? youLabel(p.name) : distinctNames(k.people)[i]!}
                right={describePerson(p, nameOf(p.paidByKey))}
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
  groupName: { marginBottom: 16 },
  privacy: { marginTop: 16, alignItems: 'center' },
  group: { marginTop: 18 },
  control: { marginTop: 6 },
  hint: { marginTop: 16 },
  actions: { marginTop: 30, gap: 12 },
  listGap: { marginTop: 29 },
  list: { marginTop: 12 },
  empty: { paddingVertical: 12 },
  addBack: { marginTop: 8 },
  added: { textAlign: 'center' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 9, marginTop: 11 },
});
