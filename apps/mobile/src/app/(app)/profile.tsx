import { cleanName, formatIndianMobile, isValidUpiId, normaliseIndianMobile, normaliseUpiId } from '@kitty/core';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Linking, Platform, Share, StyleSheet, Text, View } from 'react-native';

import { ask } from '@/lib/ask';
import { useAuth, type Profile } from '@/lib/auth';
import { explainFailure } from '@/lib/errors';
import { config } from '@/lib/config';
import { leaveGroup, loadGroups, type SavedGroup } from '@/lib/groups';
import { supabase } from '@/lib/supabase';
import { versionLines } from '@/lib/version';
import { Body, Button, CenteredState, ErrorText, Field, Gap, Label, Screen, Small, SmallButton, TextLink } from '@/ui/components';
import { colors, type } from '@/ui/theme';

/** Organiser's own details. Not drawn in the wires: reached from the You picture at the top right of every screen. */
export default function ProfileScreen() {
  const { profile } = useAuth();
  if (!profile) {
    return (
      <Screen title="Your details" back hideAvatar>
        <CenteredState />
      </Screen>
    );
  }
  // Keyed so the form starts fresh from the saved profile for each account.
  return <ProfileForm key={profile.id} profile={profile} />;
}

function ProfileForm({ profile }: { profile: Profile }) {
  const { session, refreshProfile, signOut } = useAuth();
  const [name, setName] = useState(profile.name);
  const [mobile, setMobile] = useState(profile.phone ? formatIndianMobile(profile.phone).replace(/^\+91 /, '') : '');
  const [upi, setUpi] = useState(profile.upi_id ?? '');
  const [errors, setErrors] = useState<{ name?: string; mobile?: string; upi?: string; form?: string }>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function save() {
    const cleanedName = cleanName(name);
    const phone = mobile.trim() ? normaliseIndianMobile(mobile) : null;
    const upiId = upi.trim() ? normaliseUpiId(upi) : null;
    const next = {
      ...(cleanedName ? {} : { name: 'Add your name.' }),
      ...(mobile.trim() && !phone ? { mobile: 'Enter a 10 digit Indian mobile number.' } : {}),
      ...(upiId && !isValidUpiId(upiId) ? { upi: 'That doesn’t look like a UPI ID. It should look like name@bank.' } : {}),
    };
    setErrors(next);
    setSaved(false);
    if (Object.keys(next).length > 0) return;

    setSaving(true);
    const { error } = await supabase
      .from('profiles')
      .update({ name: cleanedName!, phone, upi_id: upiId })
      .eq('id', profile.id);
    setSaving(false);
    if (error) {
      setErrors({ form: await explainFailure(error, 'save your details') });
      return;
    }
    await refreshProfile();
    setSaved(true);
  }

  return (
    <Screen
      title="Your details"
      back
      hideAvatar
      footer={
        <>
          <ErrorText>{errors.form}</ErrorText>
          <Button onPress={save} loading={saving}>
            {saved ? 'Saved' : 'Save'}
          </Button>
          <Button variant="secondary" onPress={async () => { await signOut(); router.replace('/log-in'); }}>
            Log out
          </Button>
        </>
      }
    >
      <Field
        label="Your name"
        value={name}
        onChangeText={(t) => { setName(t); setSaved(false); }}
        autoCapitalize="words"
        autoComplete="name"
        hint="Friends see this on the kitty link."
        error={errors.name ?? null}
      />
      <Field
        label="Mobile number"
        prefix="+91"
        value={mobile}
        onChangeText={(t) => { setMobile(t); setSaved(false); }}
        keyboardType="phone-pad"
        autoComplete="tel"
        error={errors.mobile ?? null}
      />
      <Field
        label="Your UPI ID"
        value={upi}
        onChangeText={(t) => { setUpi(t); setSaved(false); }}
        placeholder="name@bank"
        autoCapitalize="none"
        autoCorrect={false}
        hint="Filled in for you on new kitties. Everyone pays straight to this ID. Kitty never holds the money."
        error={errors.upi ?? null}
      />

      <Gap size="xxl" />
      <Label>Logged in as</Label>
      <Body ink>{session?.user.email ?? (session?.user.phone ? formatIndianMobile(`+${session.user.phone}`) : '')}</Body>

      <YourGroups />

      <Gap size="xxl" />
      <TextLink onPress={() => router.push('/delete-account')}>Delete my account</TextLink>

      <Gap size="xxl" />
      <Label>App version</Label>
      {versionLines().map((line) => (
        <Small key={line}>{line}</Small>
      ))}
    </Screen>
  );
}

/** Saved groups (Raj, 20 Nov 2026): share one with a WhatsApp link, or leave it (others keep it). */
function YourGroups() {
  const { profile } = useAuth();
  const [groups, setGroups] = useState<SavedGroup[]>([]);
  useFocusEffect(
    useCallback(() => {
      loadGroups()
        .then(setGroups)
        .catch(() => setGroups([]));
    }, []),
  );
  if (groups.length === 0) return null;

  async function share(g: SavedGroup) {
    const text = `${profile?.name || 'I'} shared the group ${g.name} on Kitty. Open this to add it to your Kitty: ${config.memberPageUrl}/g/${g.shareToken}`;
    try {
      await Linking.openURL(`https://wa.me/?text=${encodeURIComponent(text)}`);
    } catch {
      if (Platform.OS !== 'web') await Share.share({ message: text });
    }
  }

  async function leave(g: SavedGroup) {
    if (!(await ask(`Leave ${g.name}?`, 'It goes from your groups. Anyone else who has it keeps it.', 'Leave'))) return;
    const e = await leaveGroup(g.id);
    if (e) await explainFailure(e, 'leave the group');
    setGroups(await loadGroups().catch(() => []));
  }

  return (
    <>
      <Gap size="xxl" />
      <Label>Your groups</Label>
      {groups.map((g) => (
        <View key={g.id} style={groupStyles.row}>
          <View style={groupStyles.flex}>
            <Text style={type.bodyInk}>{g.name}</Text>
            <Text style={type.note}>
              {`${g.people.map((p) => (p.profileId === profile?.id ? 'You' : p.name)).join(', ')}${g.createdBy.id === profile?.id ? '' : `. From ${g.createdBy.name || 'a friend'}`}`}
            </Text>
          </View>
          <View style={groupStyles.actions}>
            <SmallButton onPress={() => share(g)}>Share</SmallButton>
            <SmallButton onPress={() => leave(g)}>Leave</SmallButton>
          </View>
        </View>
      ))}
    </>
  );
}

const groupStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.line },
  flex: { flex: 1, gap: 2 },
  actions: { flexDirection: 'row', gap: 8 },
});
