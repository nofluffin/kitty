import Feather from '@expo/vector-icons/Feather';
import { formatIndianMobile, parseSpokenPeople, type Diet } from '@kitty/core';
import { router } from 'expo-router';
import { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent } from 'expo-speech-recognition';
import { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { useDraftKitty } from '@/lib/draft-kitty';
import { contactsAccessLevel, findKnown, pickContact, searchContacts, type ContactMatch, type KnownPerson } from '@/lib/voice-people';
import { Body, Button, ErrorText, Label, Screen, Segmented, Small, SmallButton, TextLink } from '@/ui/components';
import { colors, layout, type } from '@/ui/theme';

/**
 * Add people by voice (Raj, 20 Nov 2026): "Devika, veg, alcohol. Kabir, non-veg, no alcohol."
 * Food and drink come from what was said, else from the organiser's groups and past
 * kitties, else Kitty asks. If several contacts match a name, Kitty asks which one.
 */

interface Draft {
  id: number;
  spokenName: string;
  diet?: Diet;
  drinks?: boolean;
  /** Where the tags came from, when not said. */
  from?: string;
  known: KnownPerson[];
  contacts: (ContactMatch & { exact: boolean })[];
  /** The chosen contact: an index into contacts, or -1 for none. */
  contact: number;
  /** Picked by hand with "Pick from contacts". Wins over the search. */
  manual?: ContactMatch;
}

/** The name and number a card will add, and where the number came from (Raj, 21 Nov 2026). */
function resolved(p: Draft): { name: string; phone: string | null; source: string | null } {
  const contact = p.manual ?? (p.contact >= 0 ? p.contacts[p.contact] : null);
  if (contact) return { name: contact.name || p.spokenName, phone: contact.phone, source: 'From your contacts' };
  const known = p.known.length === 1 ? p.known[0]! : null;
  if (known?.phone) return { name: p.spokenName, phone: known.phone, source: 'From your groups and kitties' };
  return { name: p.spokenName, phone: null, source: null };
}

export default function AddByVoice() {
  const k = useDraftKitty();
  const [listening, setListening] = useState(false);
  const [heard, setHeard] = useState('');
  const [people, setPeople] = useState<Draft[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useSpeechRecognitionEvent('result', (e) => {
    const text = e.results[0]?.transcript;
    if (text) setHeard(text);
  });
  useSpeechRecognitionEvent('end', () => setListening(false));
  useSpeechRecognitionEvent('error', (e) => {
    setListening(false);
    if (e.error !== 'aborted' && e.error !== 'no-speech') setError('Kitty couldn’t hear that. Try again, or type the names below.');
  });

  async function listen() {
    setError(null);
    const permission = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    if (!permission.granted) {
      setError('Kitty needs the microphone to hear names. Allow it in Settings, or type the names below.');
      return;
    }
    setHeard('');
    setListening(true);
    ExpoSpeechRecognitionModule.start({ lang: 'en-IN', interimResults: true, continuous: true });
  }

  function stop() {
    ExpoSpeechRecognitionModule.stop();
    setListening(false);
  }

  async function review() {
    const spoken = parseSpokenPeople(heard);
    if (spoken.length === 0) {
      setError('No names found. Say a name, then veg or non-veg, and alcohol or no alcohol.');
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const found = await Promise.all(
        spoken.map(async (s, i): Promise<Draft> => {
          const [known, contacts] = await Promise.all([findKnown(s.name).catch(() => []), searchContacts(s.name).catch(() => [])]);
          const only = known.length === 1 ? known[0] : null;
          return {
            id: i,
            spokenName: s.name,
            diet: s.diet ?? only?.diet,
            drinks: s.drinks ?? only?.drinks,
            from: only && (s.diet === undefined || s.drinks === undefined) ? 'From your groups and kitties' : undefined,
            known,
            contacts,
            // One contact with the whole name (or the only match) is picked for you.
            contact: contacts.filter((c) => c.exact).length === 1 ? contacts.findIndex((c) => c.exact) : contacts.length === 1 ? 0 : -1,
          };
        }),
      );
      setPeople(found);
    } finally {
      setBusy(false);
    }
  }

  const update = (id: number, change: Partial<Draft>) => setPeople((list) => list?.map((p) => (p.id === id ? { ...p, ...change } : p)) ?? null);
  const ready = !!people && people.length > 0 && people.every((p) => p.diet && p.drinks !== undefined);

  function addAll() {
    if (!people) return;
    for (const p of people) {
      const who = resolved(p);
      k.addPerson({
        name: who.name,
        phone: who.phone,
        isOrganiser: false,
        diet: p.diet!,
        drinks: p.drinks!,
        paidByKey: null,
      });
    }
    router.back();
  }

  if (people) {
    return (
      <Screen
        title="Check who you said"
        back
        footer={
          <>
            {!ready ? <Small>Choose food and drink for everyone to continue.</Small> : null}
            <Button onPress={addAll} disabled={!ready}>{`Add ${people.length} ${people.length === 1 ? 'person' : 'people'}`}</Button>
          </>
        }
      >
        {contactsAccessLevel() === 'limited' ? (
          <Small>Your iPhone lets Kitty see only some contacts, so some numbers may be missing. Allow full access in Settings, Kitty, Contacts, or tap Pick from contacts.</Small>
        ) : contactsAccessLevel() === 'none' ? (
          <Small>Kitty can’t search your contacts, so numbers aren’t filled in. Tap Pick from contacts on anyone, or allow it in Settings, Kitty, Contacts.</Small>
        ) : null}
        {people.map((p) => (
          <View key={p.id} style={styles.card}>
            <View style={styles.cardTop}>
              <Text style={[type.bodyBold, styles.flex]}>{resolved(p).name}</Text>
              <TextLink onPress={() => setPeople((list) => list?.filter((x) => x.id !== p.id) ?? null)}>Remove</TextLink>
            </View>
            {p.from ? <Small>{p.from}</Small> : null}

            {p.known.length > 1 && (p.diet === undefined || p.drinks === undefined) ? (
              <View style={styles.block}>
                <Label>{`Which ${p.spokenName}?`}</Label>
                {p.known.map((kp, i) => (
                  <Option
                    key={i}
                    label={`${kp.name}, ${kp.diet === 'veg' ? 'veg' : 'non-veg'}, ${kp.drinks ? 'drinks' : 'doesn’t drink'}`}
                    onPress={() => update(p.id, { diet: kp.diet, drinks: kp.drinks, from: 'From your groups and kitties' })}
                  />
                ))}
              </View>
            ) : null}

            <View style={styles.numberRow}>
              <Text style={[type.note, styles.flex]}>
                {(() => {
                  const who = resolved(p);
                  if (who.phone) return `${who.source}, ${formatIndianMobile(who.phone)}`;
                  if (who.source) return `${who.source}, no mobile number saved`;
                  return 'No number yet';
                })()}
              </Text>
              {Platform.OS !== 'web' ? (
                <SmallButton
                  onPress={async () => {
                    const picked = await pickContact().catch(() => null);
                    if (picked) update(p.id, { manual: picked });
                  }}
                >
                  Pick from contacts
                </SmallButton>
              ) : null}
            </View>

            {!p.manual && p.contacts.length > 1 ? (
              <View style={styles.block}>
                <Label>{`Which ${p.spokenName} in your contacts?`}</Label>
                {p.contacts.map((c, i) => (
                  <Option
                    key={i}
                    selected={p.contact === i}
                    label={`${c.name}${c.phone ? `, ${formatIndianMobile(c.phone)}` : ''}`}
                    onPress={() => update(p.id, { contact: i })}
                  />
                ))}
                <Option selected={p.contact === -1} label="None of these" onPress={() => update(p.id, { contact: -1 })} />
              </View>
            ) : null}

            <View style={styles.block}>
              <Segmented
                label="Food"
                options={[
                  { value: 'veg', label: 'Veg' },
                  { value: 'nonveg', label: 'Non-veg' },
                ]}
                value={p.diet ?? ('' as Diet)}
                onChange={(v) => update(p.id, { diet: v })}
              />
            </View>
            <View style={styles.block}>
              <Segmented
                label="Alcohol"
                options={[
                  { value: 'yes', label: 'Drinks' },
                  { value: 'no', label: 'Doesn’t drink' },
                ]}
                value={p.drinks === undefined ? '' : p.drinks ? 'yes' : 'no'}
                onChange={(v) => update(p.id, { drinks: v === 'yes' })}
              />
            </View>
          </View>
        ))}
      </Screen>
    );
  }

  return (
    <Screen
      title="Add by voice"
      back
      footer={
        <>
          <ErrorText>{error}</ErrorText>
          <Button onPress={review} loading={busy} disabled={!heard.trim() || listening}>
            Find these people
          </Button>
        </>
      }
    >
      <Body>
        Say everyone in one go, with their food and drink. For example: “Add Biba Bajaj, vegetarian, drinks. Api Bajaj, non-veg, doesn’t
        drink. Gaurav, veg, alcohol.”
      </Body>
      <View style={styles.micWrap}>
        <Pressable
          onPress={listening ? stop : listen}
          accessibilityRole="button"
          accessibilityLabel={listening ? 'Stop listening' : 'Start listening'}
          style={({ pressed }) => [styles.mic, listening && styles.micOn, pressed && styles.pressed]}
        >
          <Feather name={listening ? 'square' : 'mic'} size={34} color={listening ? colors.inkOnDark : colors.ink} />
        </Pressable>
        <Text style={type.note}>{listening ? 'Listening… tap to stop' : 'Tap to speak'}</Text>
      </View>
      <Label>What Kitty heard</Label>
      <TextInput
        value={heard}
        onChangeText={setHeard}
        multiline
        placeholder="Names appear here. You can fix or type them too."
        placeholderTextColor={colors.muted}
        style={[type.bodyInk, styles.heard]}
      />
      <Small>Names you say are looked up in your contacts on this phone, to find their numbers.</Small>
      {contactsAccessLevel() === 'limited' ? (
        <Small>Your iPhone lets Kitty see only some contacts. To find everyone, allow full access in Settings, Kitty, Contacts.</Small>
      ) : null}
    </Screen>
  );
}

function Option({ label, onPress, selected }: { label: string; onPress: () => void; selected?: boolean }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="radio" accessibilityState={{ checked: !!selected }} style={[styles.option, selected && styles.optionOn]}>
      <Text style={selected ? type.bodyBold : type.bodyInk}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  micWrap: { alignItems: 'center', gap: 10, marginVertical: 28 },
  mic: {
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: layout.border,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  micOn: { backgroundColor: colors.action, borderColor: colors.action },
  pressed: { opacity: 0.8 },
  heard: {
    marginTop: 8,
    marginBottom: 8,
    minHeight: 96,
    borderWidth: layout.border,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    padding: 12,
    textAlignVertical: 'top',
  },
  card: { borderWidth: layout.border, borderColor: colors.line, backgroundColor: colors.surface, padding: layout.cardPadding, marginBottom: 14, gap: 6 },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  numberRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  block: { marginTop: 8, gap: 6 },
  option: { borderWidth: layout.border, borderColor: colors.line, paddingHorizontal: 12, paddingVertical: 10, backgroundColor: colors.surface },
  optionOn: { backgroundColor: colors.selected, borderColor: colors.selected },
});
