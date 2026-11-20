import { addMonths, combineByPayer, formatRupees, shareMessage, type KittyKind, type KittyStatus } from '@kitty/core';
import * as Clipboard from 'expo-clipboard';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { Linking, Platform, Share, StyleSheet, Text, TextInput, View } from 'react-native';

import { config } from '@/lib/config';
import { isEditable } from '@/lib/edit-kitty';
import { explainFailure } from '@/lib/errors';
import { supabase } from '@/lib/supabase';
import {
  Body,
  Button,
  CenteredState,
  ErrorText,
  Label,
  Row,
  Screen,
  SmallButton,
  TextLink,
  Title,
} from '@/ui/components';
import { colors, layout, type } from '@/ui/theme';

interface ShareKitty {
  id: string;
  title: string;
  kind: KittyKind;
  status: KittyStatus;
  dueDate: string;
  totalPaise: number;
  slug: string;
  /** Goals paid in parts. */
  partsCount: number | null;
  /** Editable until someone pays (decided 20 Nov 2026). */
  editable: boolean;
  /** Per person; paidBy names whoever pays their share, if someone else does. */
  members: { name: string; sharePaise: number; isOrganiser: boolean; id: string; paidById: string | null }[];
}

async function loadKitty(id: string): Promise<ShareKitty> {
  const { data, error } = await supabase
    .from('kitties')
    .select('id, title, kind, status, due_date, total_paise, share_slug, parts_count, members(id, name, share_paise, is_organiser, sort_order, paid_by_member_id, payments(status))')
    .eq('id', id)
    .single();
  if (error) throw error;
  return {
    id: data.id,
    title: data.title,
    kind: data.kind,
    status: data.status,
    dueDate: data.due_date,
    totalPaise: data.total_paise,
    slug: data.share_slug,
    partsCount: data.parts_count,
    editable: isEditable(
      data.status,
      data.members.flatMap((m) => m.payments.map((p) => ({ isOrganiser: m.is_organiser, status: p.status }))),
    ),
    members: [...data.members]
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((m) => ({ id: m.id, name: m.name, sharePaise: m.share_paise, isOrganiser: m.is_organiser, paidById: m.paid_by_member_id })),
  };
}

/** Screens 6 (everyone pays the same) and 24 (amounts differ). */
export default function ShareScreen() {
  const { id, fresh } = useLocalSearchParams<{ id: string; fresh?: string }>();
  const [kitty, setKitty] = useState<ShareKitty | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  // Reloads on focus, so coming back from editing shows the new amounts.
  useFocusEffect(
    useCallback(() => {
      let current = true;
      void attempt; // "Try again" reloads too
      loadKitty(id)
        .then((k) => current && setKitty(k))
        .catch(() => current && setFailed(true));
      return () => {
        current = false;
      };
    }, [id, attempt]),
  );

  const load = () => {
    setFailed(false);
    setAttempt((a) => a + 1);
  };

  const close = fresh ? () => router.replace('/home') : undefined;
  if (failed) {
    return (
      <Screen title="Share" back={!close} close={close}>
        <CenteredState title="Couldn’t load this kitty" body="Check your connection and try again." action={<Button onPress={load}>Try again</Button>} />
      </Screen>
    );
  }
  if (!kitty) {
    return (
      <Screen title="Share" back={!close} close={close}>
        <CenteredState />
      </Screen>
    );
  }
  // A draft saved for "Scan it" whose scan hasn't finished: there's nothing to share yet.
  if (kitty.status === 'draft' && kitty.totalPaise === 0) {
    return (
      <Screen title={kitty.title} back={!close} close={close}>
        <CenteredState
          title="No total yet"
          body="Scan the bill to work out everyone’s exact share."
          action={<Button onPress={() => router.push({ pathname: '/kitty/[id]/scan', params: { id: kitty.id, mode: 'draft' } })}>Scan the bill</Button>}
        />
      </Screen>
    );
  }
  // A new key after an edit, so the message is rebuilt from the new amounts.
  return <ShareReady key={`${kitty.title}|${kitty.totalPaise}|${kitty.members.map((m) => m.sharePaise).join(',')}`} kitty={kitty} close={close} />;
}

function ShareReady({ kitty, close }: { kitty: ShareKitty; close?: () => void }) {
  const link = `${config.memberPageUrl}/k/${kitty.slug}`;
  // What each payer is asked for: their own share plus anyone they pay for.
  const asked = combineByPayer(kitty.members, (m) => m.sharePaise);
  const shares = kitty.members.filter((m) => !m.paidById).map((m) => asked.get(m.id) ?? 0);
  // The last part falls on the pay by date, one a month before it (goalParts in core).
  const parts = kitty.partsCount ? { count: kitty.partsCount, firstDueDate: addMonths(kitty.dueDate, -(kitty.partsCount - 1)) } : undefined;
  const message = shareMessage({ ...kitty, sharesPaise: shares, link, parts });
  const equal = message.variant === 'equal';
  const each = equal ? formatRupees(Math.min(...shares)) : null;

  // The link always goes at the end, so the organiser edits the words only.
  const [words, setWords] = useState(message.text.slice(0, -link.length).trimEnd());
  const [editing, setEditing] = useState(false);
  const [status, setStatus] = useState(kitty.status);
  const [busy, setBusy] = useState<'share' | 'copy' | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const finalText = `${words.trim()} ${link}`;

  // Sharing or copying the link locks the amounts (spec section 4).
  async function lock(): Promise<boolean> {
    if (status !== 'draft') return true;
    const { error: e } = await supabase.rpc('share_kitty', { p_kitty_id: kitty.id });
    if (e) {
      setError(await explainFailure(e, 'share the kitty'));
      return false;
    }
    setStatus('shared');
    return true;
  }

  async function shareOnWhatsApp() {
    setError(null);
    setBusy('share');
    try {
      if (!(await lock())) return;
      // wa.me with no number opens WhatsApp's own chat picker, so the organiser can pick the group.
      const url = `https://wa.me/?text=${encodeURIComponent(finalText)}`;
      try {
        await Linking.openURL(url);
      } catch {
        if (Platform.OS !== 'web') await Share.share({ message: finalText });
      }
    } finally {
      setBusy(null);
    }
  }

  async function copyLink() {
    setError(null);
    setBusy('copy');
    try {
      if (!(await lock())) return;
      await Clipboard.setStringAsync(link);
      setCopied(true);
    } finally {
      setBusy(null);
    }
  }

  const locked = status !== 'draft';

  return (
    <Screen
      title={kitty.title}
      back={!close}
      close={close}
      footer={
        <>
          <ErrorText>{error}</ErrorText>
          <Button onPress={shareOnWhatsApp} loading={busy === 'share'}>
            Share on WhatsApp
          </Button>
          <Button variant="secondary" onPress={copyLink} loading={busy === 'copy'}>
            {copied ? 'Link copied' : 'Copy link'}
          </Button>
          <View style={styles.skip}>
            <TextLink
              onPress={() => (locked ? router.replace({ pathname: '/kitty/[id]', params: { id: kitty.id } }) : router.replace('/home'))}
            >
              {locked ? 'Go to the kitty' : 'Skip for now, go to the kitty'}
            </TextLink>
          </View>
        </>
      }
    >
      <Title>Your kitty is ready</Title>
      <Body>
        {equal
          ? 'Send the link to the group. Each person picks their name and pays their share to you.'
          : 'Amounts differ per person, so the message does not name one. Each person sees their own share on the link.'}{' '}
        {kitty.editable ? 'You can edit amounts and people until someone pays.' : 'Someone has paid, so amounts are locked.'}
      </Body>
      {kitty.editable ? (
        <View style={styles.editLink}>
          <TextLink onPress={() => router.push({ pathname: '/new', params: { edit: kitty.id } })}>Edit the kitty</TextLink>
        </View>
      ) : null}

      <View style={styles.section}>
        <Label>Message preview</Label>
        <View style={styles.preview}>
          {editing ? (
            <TextInput
              value={words}
              onChangeText={setWords}
              multiline
              autoFocus
              accessibilityLabel="Message"
              style={[type.bodyInk, styles.editor]}
            />
          ) : (
            <Text style={[type.bodyInk, styles.message]}>
              {words}
              {equal ? '' : ` ${link}`}
            </Text>
          )}
          {equal && !editing ? (
            <View style={styles.linkCard}>
              <Text style={type.bodyBold}>
                {kitty.title}, {each} each
              </Text>
              <Text style={[type.metaMuted, styles.linkText]} numberOfLines={1}>
                {link}
              </Text>
            </View>
          ) : null}
          <View style={styles.editButton}>
            <SmallButton onPress={() => setEditing((e) => !e)}>{editing ? 'Done editing' : 'Edit message'}</SmallButton>
          </View>
        </View>
      </View>

      {!equal ? (
        <View style={styles.section}>
          <Label>What each person will see</Label>
          <View style={styles.list}>
            {kitty.members
              .filter((m) => !m.paidById)
              .map((m) => {
                const paysFor = kitty.members.filter((x) => x.paidById === m.id).map((x) => x.name);
                const who = m.isOrganiser ? 'You' : m.name;
                return (
                  <Row key={m.id} left={paysFor.length > 0 ? `${who}, with ${paysFor.join(', ')}` : who} right={formatRupees(asked.get(m.id) ?? 0)} />
                );
              })}
          </View>
        </View>
      ) : null}
    </Screen>
  );
}

// Spacing measured from screens 6 and 24.
const styles = StyleSheet.create({
  section: { marginTop: 32 },
  preview: {
    marginTop: 12,
    backgroundColor: colors.surface,
    borderWidth: layout.border,
    borderColor: colors.line,
    padding: layout.cardPadding,
  },
  message: { lineHeight: 24 },
  editor: { minHeight: 96, textAlignVertical: 'top', lineHeight: 24 },
  linkCard: {
    marginTop: 20,
    borderWidth: layout.border,
    borderStyle: 'dashed',
    borderColor: colors.line,
    paddingHorizontal: 12,
    paddingVertical: 14,
  },
  linkText: { marginTop: 4 },
  editButton: { marginTop: 20, alignSelf: 'flex-start' },
  list: { marginTop: 12 },
  skip: { alignItems: 'center' },
  editLink: { marginTop: 12, alignItems: 'flex-start' },
});
