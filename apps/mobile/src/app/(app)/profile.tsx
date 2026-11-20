import { cleanName, formatIndianMobile, isValidUpiId, normaliseIndianMobile, normaliseUpiId } from '@kitty/core';
import { router } from 'expo-router';
import { useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import { useAuth, type Profile } from '@/lib/auth';
import { avatarUrl, changeAvatar, removeAvatar } from '@/lib/avatar';
import { explainFailure } from '@/lib/errors';
import { supabase } from '@/lib/supabase';
import { versionLines } from '@/lib/version';
import { Avatar, Body, Button, CenteredState, ErrorText, Field, Gap, Label, Screen, Small, SmallButton, TextLink } from '@/ui/components';

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
      <PhotoPicker profile={profile} onChange={refreshProfile} />

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

/** Take or choose a photo for the You picture (Raj, 20 Nov 2026). */
function PhotoPicker({ profile, onChange }: { profile: Profile; onChange: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(action: () => Promise<unknown>) {
    setError(null);
    setBusy(true);
    try {
      await action();
      onChange();
    } catch (e) {
      setError(
        e instanceof Error && e.message === 'camera_permission'
          ? 'Kitty needs the camera to take your photo. Allow it in Settings, or choose one from your photos.'
          : await explainFailure(e, 'change your photo'),
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={photoStyles.wrap}>
      <Avatar text="You" imageUrl={avatarUrl(profile.avatar_path)} size={88} />
      <View style={photoStyles.actions}>
        {Platform.OS !== 'web' ? (
          <SmallButton disabled={busy} onPress={() => run(() => changeAvatar('camera', profile.id, profile.avatar_path))}>
            Take photo
          </SmallButton>
        ) : null}
        <SmallButton disabled={busy} onPress={() => run(() => changeAvatar('gallery', profile.id, profile.avatar_path))}>
          {Platform.OS === 'web' ? 'Upload photo' : 'Choose photo'}
        </SmallButton>
        {profile.avatar_path ? (
          <TextLink onPress={() => run(() => removeAvatar(profile.id, profile.avatar_path))}>Remove photo</TextLink>
        ) : null}
      </View>
      <ErrorText>{error}</ErrorText>
    </View>
  );
}

const photoStyles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: 12, marginBottom: 20 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap', justifyContent: 'center' },
});
