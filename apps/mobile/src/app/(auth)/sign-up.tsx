import { cleanName, normaliseIndianMobile } from '@kitty/core';
import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { Linking, StyleSheet, Text } from 'react-native';

import { authErrorMessage, normaliseIdentifier, requestCode } from '@/lib/auth-flow';
import { config } from '@/lib/config';
import { Body, Button, ErrorText, Field, Screen, Small, TextLink, Title, type TextInputRef } from '@/ui/components';
import { colors } from '@/ui/theme';

/** Screen 19. With email login there's an extra email field until SMS is switched on. */
export default function SignUp() {
  const usesEmail = config.loginMethod === 'email';
  const [name, setName] = useState('');
  const [mobile, setMobile] = useState('');
  const [email, setEmail] = useState('');
  const [errors, setErrors] = useState<{ name?: string; mobile?: string; email?: string; form?: string }>({});
  const [sending, setSending] = useState(false);
  const mobileRef = useRef<TextInputRef>(null);
  const emailRef = useRef<TextInputRef>(null);

  async function submit() {
    const cleanedName = cleanName(name);
    const phone = normaliseIndianMobile(mobile);
    const identifier = usesEmail ? normaliseIdentifier(email) : phone;
    const next = {
      ...(cleanedName ? {} : { name: 'Add your name. Your friends see it when you share a kitty.' }),
      ...(phone ? {} : { mobile: 'Enter a 10 digit Indian mobile number.' }),
      ...(usesEmail && !identifier ? { email: 'Enter an email address, like rohan@gmail.com.' } : {}),
    };
    setErrors(next);
    if (Object.keys(next).length > 0 || !identifier || !cleanedName || !phone) return;

    setSending(true);
    try {
      await requestCode({ mode: 'sign-up', identifier, name: cleanedName, phone });
      router.push({ pathname: '/verify', params: { identifier, mode: 'sign-up' } });
    } catch (error) {
      setErrors({ form: authErrorMessage(error) });
    } finally {
      setSending(false);
    }
  }

  return (
    <Screen
      title="Kitty"
      headerRight={<TextLink onPress={() => router.replace('/log-in')}>Log in</TextLink>}
      footer={
        <>
          <Small>
            By continuing you agree to the{' '}
            <Text style={styles.legalLink} onPress={() => Linking.openURL(`${config.memberPageUrl}/terms`)}>
              terms
            </Text>{' '}
            and{' '}
            <Text style={styles.legalLink} onPress={() => Linking.openURL(`${config.memberPageUrl}/privacy`)}>
              privacy policy
            </Text>
            .
          </Small>
          <ErrorText>{errors.form}</ErrorText>
          <Button onPress={submit} loading={sending}>
            Send code
          </Button>
        </>
      }
    >
      <Title>Start your first kitty</Title>
      <Body>Only the organiser needs an account. Everyone else pays from a link.</Body>

      <Field
        label="Your name"
        value={name}
        onChangeText={setName}
        placeholder="Your name"
        autoComplete="name"
        textContentType="name"
        autoCapitalize="words"
        returnKeyType="next"
        onSubmitEditing={() => mobileRef.current?.focus()}
        error={errors.name ?? null}
      />
      <Field
        ref={mobileRef}
        label="Mobile number"
        prefix="+91"
        value={mobile}
        onChangeText={setMobile}
        placeholder="98765 43210"
        keyboardType="phone-pad"
        autoComplete="tel"
        textContentType="telephoneNumber"
        returnKeyType={usesEmail ? 'next' : 'done'}
        onSubmitEditing={() => (usesEmail ? emailRef.current?.focus() : submit())}
        hint={usesEmail ? undefined : "We'll text you a 6 digit code."}
        error={errors.mobile ?? null}
      />
      {usesEmail ? (
        <Field
          ref={emailRef}
          label="Email"
          value={email}
          onChangeText={setEmail}
          placeholder="you@example.com"
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="email"
          textContentType="emailAddress"
          returnKeyType="done"
          onSubmitEditing={submit}
          hint="We'll email you a 6 digit code."
          error={errors.email ?? null}
        />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  legalLink: { textDecorationLine: 'underline', color: colors.ink },
});
