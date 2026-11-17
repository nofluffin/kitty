import { formatIndianMobile } from '@kitty/core';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';

import { authErrorMessage, requestCode, verifyCode } from '@/lib/auth-flow';
import { config } from '@/lib/config';
import { CodeInput } from '@/ui/code-input';
import { Body, Button, ErrorText, Gap, Note, Screen, TextLink, Title } from '@/ui/components';

const RESEND_AFTER_SECONDS = 30;

/** Screen 20. A successful code swaps the whole app to the logged-in screens. */
export default function Verify() {
  const { identifier = '', mode = 'log-in' } = useLocalSearchParams<{ identifier: string; mode: 'sign-up' | 'log-in' }>();
  const usesEmail = config.loginMethod === 'email';
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [wait, setWait] = useState(RESEND_AFTER_SECONDS);
  const [resent, setResent] = useState(false);

  useEffect(() => {
    if (wait <= 0) return;
    const timer = setTimeout(() => setWait((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [wait]);

  async function submit(token = code) {
    if (token.length !== 6 || verifying) return;
    setError(null);
    setVerifying(true);
    try {
      await verifyCode(identifier, token);
      // The root layout sees the new session and moves to home.
    } catch (e) {
      setError(authErrorMessage(e));
      setCode('');
      setVerifying(false);
    }
  }

  async function resend() {
    setError(null);
    setResent(false);
    try {
      await requestCode({ mode: 'log-in', identifier });
      setWait(RESEND_AFTER_SECONDS);
      setResent(true);
    } catch (e) {
      setError(authErrorMessage(e));
    }
  }

  const shown = usesEmail ? identifier : formatIndianMobile(identifier);

  return (
    <Screen
      title="Enter the code"
      back
      footer={
        <Button onPress={() => submit()} loading={verifying} disabled={code.length !== 6}>
          Continue
        </Button>
      }
    >
      <Title>{usesEmail ? 'Check your email' : 'Check your messages'}</Title>
      <Body>We sent a code to {shown}.</Body>

      <CodeInput
        value={code}
        invalid={!!error}
        onChange={(next) => {
          setCode(next);
          if (next.length === 6) submit(next);
        }}
      />
      <ErrorText>{error}</ErrorText>

      <Gap size="xl" />
      {wait > 0 ? (
        <TextLink onPress={() => {}} disabled>
          {`Send it again in 0:${String(wait).padStart(2, '0')}`}
        </TextLink>
      ) : (
        <TextLink onPress={resend}>Send it again</TextLink>
      )}
      {resent ? <Body>New code sent.</Body> : null}
      <Gap size="lg" />
      <TextLink onPress={() => router.back()}>{usesEmail ? 'Wrong email? Change it' : 'Wrong number? Change it'}</TextLink>

      {mode === 'sign-up' ? (
        <>
          <Gap size="xxl" />
          <Note>Your UPI ID is asked for later, when you create your first kitty.</Note>
        </>
      ) : null}
    </Screen>
  );
}
