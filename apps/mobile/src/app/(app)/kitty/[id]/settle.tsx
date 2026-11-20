import { describeWhen, formatRupees, topUpMessage, whatsAppUrl } from '@kitty/core';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { Linking, Platform, Pressable, Share, StyleSheet, Text, View } from 'react-native';

import { ask } from '@/lib/ask';
import { config } from '@/lib/config';
import { explainFailure } from '@/lib/errors';
import { loadFeed, type FeedKitty, type FeedMember } from '@/lib/feed';
import { closeKitty, confirmTopUp, markRefundSent } from '@/lib/settle';
import { Button, CenteredState, ErrorText, Label, Note, Screen } from '@/ui/components';
import { colors, layout, type } from '@/ui/theme';

const OPEN = ['requested', 'marked', 'not_received'];

/** Screens 12 and 13: settle up after the final bill. */
export default function SettleUp() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [kitty, setKitty] = useState<FeedKitty | null>(null);
  const [failed, setFailed] = useState(false);

  const reload = useCallback(async () => {
    try {
      setKitty(await loadFeed(id));
    } catch (e) {
      await explainFailure(e, 'load this kitty');
      setFailed(true);
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload]),
  );

  if (!kitty) {
    return (
      <Screen title="Settle up" back>
        {failed ? <CenteredState title="Couldn’t load this kitty" body="Go back and try again." /> : <CenteredState />}
      </Screen>
    );
  }
  return <SettleReady kitty={kitty} reload={reload} />;
}

/** What they paid towards their original share, before any top-up or refund. */
const paidBefore = (m: FeedMember) =>
  m.paidPaise - (m.topUp?.status === 'confirmed' ? m.topUp.amountPaise : 0) + (m.refund?.status === 'confirmed' ? m.refund.amountPaise : 0);

function SettleReady({ kitty, reload }: { kitty: FeedKitty; reload: () => Promise<void> }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const link = `${config.memberPageUrl}/k/${kitty.slug}`;
  const me = kitty.members.find((m) => m.isOrganiser);
  // One line per payer: someone paying for a child settles for both.
  const others = kitty.members.filter((m) => !m.isOrganiser && !m.paidById).sort((a, b) => a.sortOrder - b.sortOrder);
  const finalOf = (m: FeedMember) =>
    kitty.members.filter((x) => x.id === m.id || x.paidById === m.id).reduce((sum, x) => sum + (x.finalSharePaise ?? 0), 0);

  const toComeIn = others.filter((m) => m.topUp && OPEN.includes(m.topUp.status));
  const toSendBack = others.filter((m) => m.refund && OPEN.includes(m.refund.status));
  const settled = others.filter((m) => !toComeIn.includes(m) && !toSendBack.includes(m));
  const neverPaid = toComeIn.some((m) => paidBefore(m) <= 0);
  const covering = toComeIn.reduce((sum, m) => sum + (m.topUp?.amountPaise ?? 0), 0);
  const collected = kitty.members.reduce((sum, m) => sum + paidBefore(m), 0);
  const paidCount = kitty.members.filter((m) => !m.paidById && (paidBefore(m) > 0 || m.isOrganiser)).length;
  const square = toComeIn.length === 0 && toSendBack.length === 0;

  async function run(key: string, action: () => Promise<unknown>, what: string) {
    setError(null);
    setBusy(key);
    const e = await action();
    setBusy(null);
    if (e) setError(await explainFailure(e, what));
    else await reload();
  }

  async function askForTopUp(m: FeedMember) {
    const text = topUpMessage({ memberName: m.name, title: kitty.title, newSharePaise: finalOf(m), paidPaise: paidBefore(m), link });
    const url = (m.phone && whatsAppUrl(m.phone, text)) || `https://wa.me/?text=${encodeURIComponent(text)}`;
    try {
      await Linking.openURL(url);
    } catch {
      if (Platform.OS !== 'web') await Share.share({ message: text });
    }
  }

  async function close() {
    if (!square) {
      const ok = await ask(
        'Close and write off what’s left?',
        `${formatRupees(covering)} still to come in and ${formatRupees(toSendBack.reduce((s, m) => s + (m.refund?.amountPaise ?? 0), 0))} still to send back will be written off. Kitty keeps a record.`,
        'Close and write off',
      );
      if (!ok) return;
    }
    setBusy('close');
    const e = await closeKitty(kitty.id, !square);
    setBusy(null);
    if (e) {
      setError(await explainFailure(e, 'close the kitty'));
      return;
    }
    router.replace('/home');
  }

  const comeIn = toComeIn.length > 0 && (
    <Section label="Still to come in" key="in">
      {toComeIn.map((m) => {
        const share = formatRupees(finalOf(m));
        const before = paidBefore(m);
        const said = m.topUp?.status === 'marked';
        return (
          <ActionRow
            key={m.id}
            title={before > 0 ? `${m.name}, ${formatRupees(m.topUp!.amountPaise)} more` : `${m.name}, ${share}`}
            detail={
              said
                ? `Says paid${m.topUp!.markedAt ? `, ${describeWhen(new Date(m.topUp!.markedAt))}` : ''}`
                : before > 0
                  ? `Share ${share}, paid ${formatRupees(before)}`
                  : `Hasn’t paid yet. Share came to ${share}`
            }
            action={said ? 'Confirm' : before > 0 ? 'Ask' : 'Nudge'}
            primary={said}
            busy={busy === m.id}
            onPress={() =>
              said
                ? ask(`Did ${formatRupees(m.topUp!.amountPaise)} from ${m.name} arrive?`, 'Check your UPI app first.', 'Yes, it arrived').then(
                    async (yes) => {
                      if (yes) await run(m.id, () => confirmTopUp(m.id), 'confirm the top-up');
                    },
                  )
                : askForTopUp(m)
            }
          />
        );
      })}
    </Section>
  );

  const sendBack = toSendBack.length > 0 && (
    <Section label="Send back from your UPI app" key="out">
      {toSendBack.map((m) => (
        <ActionRow
          key={m.id}
          title={`${m.name}, ${formatRupees(m.refund!.amountPaise)} back`}
          detail={`Share ${formatRupees(finalOf(m))}, paid ${formatRupees(paidBefore(m))}. ${m.refundUpiId ? `Send to ${m.refundUpiId}` : 'No UPI ID from them yet'}`}
          action="Mark sent"
          busy={busy === m.id}
          onPress={() => run(m.id, () => markRefundSent(m.id), 'mark the refund as sent')}
        />
      ))}
    </Section>
  );

  return (
    <Screen
      title="Settle up"
      back
      footer={
        <>
          {square ? null : <Note>The kitty stays open until everyone is square, or you choose to let an amount go.</Note>}
          <ErrorText>{error}</ErrorText>
          <Button variant={square ? 'primary' : 'secondary'} onPress={close} loading={busy === 'close'}>
            {square ? 'Close the kitty' : 'Close anyway and write off what’s left'}
          </Button>
        </>
      }
    >
      <View style={styles.summary}>
        <SummaryRow label="Final bill" value={formatRupees(kitty.finalBillPaise ?? 0)} bold />
        <SummaryRow
          label={neverPaid ? `Collected so far, ${paidCount} of ${others.length + 1}` : 'Collected before'}
          value={formatRupees(collected)}
          last={covering === 0}
        />
        {covering > 0 ? <SummaryRow label="You are covering for now" value={formatRupees(covering)} bold last /> : null}
      </View>

      {/* Screen 13 leads with money still to come in when someone never paid; screen 12 leads with refunds. */}
      {neverPaid ? [comeIn, sendBack] : [sendBack, comeIn]}

      {settled.length > 0 ? (
        <Section label="Square">
          {settled.map((m) => (
            <View key={m.id} style={styles.row}>
              <Text style={[type.bodyInk, styles.flex]}>{m.name}</Text>
              <Text style={type.metaMuted}>
                {m.refund ? `Got ${formatRupees(m.refund.amountPaise)} back ✓` : m.topUp ? `Topped up ${formatRupees(m.topUp.amountPaise)} ✓` : 'Square ✓'}
              </Text>
            </View>
          ))}
        </Section>
      ) : null}

      {me?.finalSharePaise != null ? <Text style={[type.metaMuted, styles.own]}>Your own share is {formatRupees(finalOf(me))}.</Text> : null}
    </Screen>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Label>{label}</Label>
      <View style={styles.list}>{children}</View>
    </View>
  );
}

function SummaryRow({ label, value, bold, last }: { label: string; value: string; bold?: boolean; last?: boolean }) {
  return (
    <View style={[styles.summaryRow, !last && styles.rule]}>
      <Text style={type.body}>{label}</Text>
      <Text style={bold ? type.bodyBold : type.bodyInk}>{value}</Text>
    </View>
  );
}

function ActionRow(props: { title: string; detail: string; action: string; primary?: boolean; busy?: boolean; onPress: () => void }) {
  return (
    <View style={styles.row}>
      <View style={styles.flex}>
        <Text style={type.bodyBold}>{props.title}</Text>
        <Text style={type.note}>{props.detail}</Text>
      </View>
      <Pressable
        onPress={props.onPress}
        disabled={props.busy}
        accessibilityRole="button"
        accessibilityLabel={`${props.action} ${props.title}`}
        style={({ pressed }) => [styles.action, props.primary ? styles.actionPrimary : styles.actionSecondary, (pressed || props.busy) && styles.pressed]}
      >
        <Text style={[type.meta, props.primary && styles.onDark]}>{props.action}</Text>
      </Pressable>
    </View>
  );
}

// Measured from screens 12 and 13.
const styles = StyleSheet.create({
  flex: { flex: 1 },
  summary: { backgroundColor: colors.surface, borderWidth: layout.border, borderColor: colors.line, paddingHorizontal: layout.cardPadding },
  summaryRow: { minHeight: 46, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  rule: { borderBottomWidth: layout.border, borderBottomColor: colors.line },
  section: { marginTop: 26 },
  list: { marginTop: 12, borderTopWidth: layout.border, borderTopColor: colors.line },
  row: {
    minHeight: 61,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
    borderBottomWidth: layout.border,
    borderBottomColor: colors.line,
  },
  action: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 15, borderWidth: layout.border, maxWidth: 110 },
  actionPrimary: { backgroundColor: colors.ink, borderColor: colors.ink },
  actionSecondary: { backgroundColor: colors.surface, borderColor: colors.line },
  onDark: { color: colors.inkOnDark, fontFamily: type.bodyBold.fontFamily },
  pressed: { opacity: 0.6 },
  own: { marginTop: 16 },
});
