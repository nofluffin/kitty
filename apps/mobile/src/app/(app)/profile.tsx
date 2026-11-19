import { cleanName, formatIndianMobile, isValidUpiId, normaliseIndianMobile, normaliseUpiId } from '@kitty/core';
import { router } from 'expo-router';
import { useState } from 'react';

import { useAuth, type Profile } from '@/lib/auth';
import { explainFailure } from '@/lib/errors';
import { supabase } from '@/lib/supabase';
import { Body, Button, CenteredState, ErrorText, Field, Gap, Label, Screen } from '@/ui/components';

/** Organiser's own details. Not drawn in the wires: reached from the avatar on home. */
export default function ProfileScreen() {
  const { profile } = useAuth();
  if (!profile) {
    return (
      <Screen title="Your details" back>
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
    </Screen>
  );
}
