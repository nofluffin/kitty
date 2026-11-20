import { cleanName, formatIndianMobile, isValidUpiId, normaliseIndianMobile, normaliseUpiId } from '@kitty/core';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

import { ask } from '@/lib/ask';
import { useAuth, type Profile } from '@/lib/auth';
import { explainFailure } from '@/lib/errors';
import { deleteGroup, loadGroups, type SavedGroup } from '@/lib/groups';
import { supabase } from '@/lib/supabase';
import { versionLines } from '@/lib/version';
import { Body, Button, CenteredState, ErrorText, Field, Gap, Label, Row, Screen, Small, TextLink } from '@/ui/components';

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

/** Saved groups (Raj, 20 Nov 2026). Made from the new kitty screen; deleted here. */
function YourGroups() {
  const [groups, setGroups] = useState<SavedGroup[]>([]);
  useFocusEffect(
    useCallback(() => {
      loadGroups()
        .then(setGroups)
        .catch(() => setGroups([]));
    }, []),
  );
  if (groups.length === 0) return null;
  return (
    <>
      <Gap size="xxl" />
      <Label>Your groups</Label>
      {groups.map((g) => (
        <Row
          key={g.id}
          left={g.name}
          right={`${g.people.length} ${g.people.length === 1 ? 'person' : 'people'}, tap to delete`}
          onPress={async () => {
            if (!(await ask(`Delete ${g.name}?`, 'Kitties made with this group stay as they are.', 'Delete'))) return;
            const e = await deleteGroup(g.id);
            if (e) await explainFailure(e, 'delete the group');
            setGroups(await loadGroups().catch(() => []));
          }}
        />
      ))}
    </>
  );
}
