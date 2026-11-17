import { router } from 'expo-router';
import { useState } from 'react';

import { authErrorMessage, normaliseIdentifier, requestCode } from '@/lib/auth-flow';
import { config } from '@/lib/config';
import { Body, Button, ErrorText, Field, Screen, TextLink, Title } from '@/ui/components';

/** Not drawn in the wires: the "Log in" link on screen 19. Same code flow, no new account. */
export default function LogIn() {
  const usesEmail = config.loginMethod === 'email';
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  async function submit() {
    const identifier = normaliseIdentifier(value);
    if (!identifier) {
      setError(usesEmail ? 'Enter the email you signed up with.' : 'Enter a 10 digit Indian mobile number.');
      return;
    }
    setError(null);
    setSending(true);
    try {
      await requestCode({ mode: 'log-in', identifier });
      router.push({ pathname: '/verify', params: { identifier, mode: 'log-in' } });
    } catch (e) {
      setError(authErrorMessage(e));
    } finally {
      setSending(false);
    }
  }

  return (
    <Screen
      title="Kitty"
      headerRight={<TextLink onPress={() => router.replace('/sign-up')}>Sign up</TextLink>}
      footer={
        <Button onPress={submit} loading={sending}>
          Send code
        </Button>
      }
    >
      <Title>Welcome back</Title>
      <Body>We’ll send a code to log you in.</Body>
      {usesEmail ? (
        <Field
          label="Email"
          value={value}
          onChangeText={setValue}
          placeholder="you@example.com"
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="email"
          textContentType="emailAddress"
          autoFocus
          returnKeyType="done"
          onSubmitEditing={submit}
        />
      ) : (
        <Field
          label="Mobile number"
          prefix="+91"
          value={value}
          onChangeText={setValue}
          placeholder="98765 43210"
          keyboardType="phone-pad"
          autoComplete="tel"
          textContentType="telephoneNumber"
          autoFocus
          returnKeyType="done"
          onSubmitEditing={submit}
        />
      )}
      <ErrorText>{error}</ErrorText>
    </Screen>
  );
}
