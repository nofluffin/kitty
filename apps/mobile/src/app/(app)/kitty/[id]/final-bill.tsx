import { formatRupees, parseRupees, settleUp, typedBillShares } from '@kitty/core';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { explainFailure } from '@/lib/errors';
import { loadFeed, type FeedKitty } from '@/lib/feed';
import { settleKitty } from '@/lib/settle';
import { Body, Button, CenteredState, ErrorText, Field, Note, Screen, TextLink, Title } from '@/ui/components';
import { colors, layout, type } from '@/ui/theme';

/**
 * Settle up with a typed final bill (spec section 4, step 1). Not drawn in the
 * wires: it's the "enter the total by hand" path from screen 9, which step 8
 * puts in front of the bill scan.
 */
export default function FinalBill() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [kitty, setKitty] = useState<FeedKitty | null>(null);
  const [failed, setFailed] = useState(false);

  // Reload on focus, e.g. after confirming a payment from here.
  useFocusEffect(
    useCallback(() => {
      let current = true;
      loadFeed(id)
        .then((k) => current && setKitty(k))
        .catch(() => current && setFailed(true));
      return () => {
        current = false;
      };
    }, [id]),
  );

  if (!kitty) {
    return (
      <Screen title="Final bill" back>
        {failed ? <CenteredState title="Couldn’t load this kitty" body="Go back and try again." /> : <CenteredState />}
      </Screen>
    );
  }
  return <FinalBillForm kitty={kitty} />;
}

function FinalBillForm({ kitty }: { kitty: FeedKitty }) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bill = parseRupees(text);
  const waiting = kitty.members.filter((m) => m.state === 'waiting');
  const collected = kitty.members.reduce((sum, m) => sum + m.paidPaise, 0);

  const shares = bill && bill > 0 ? typedBillShares(bill, kitty.members.map((m) => ({ id: m.id, sharePaise: m.sharePaise, fixed: m.shareFixed }))) : null;
  const plan =
    bill && shares?.ok
      ? settleUp(
          bill,
          // One line per payer: their new share plus those of anyone they pay for.
          kitty.members
            .filter((m) => !m.paidById)
            .map((m) => ({
              memberId: m.id,
              isOrganiser: m.isOrganiser,
              newSharePaise: kitty.members
                .filter((x) => x.id === m.id || x.paidById === m.id)
                .reduce((sum, x) => sum + shares.value.shares.find((s) => s.memberId === x.id)!.sharePaise, 0),
              confirmedPaidPaise: m.paidPaise,
            })),
        )
      : null;

  async function settle() {
    if (!bill || !shares?.ok) return;
    setError(null);
    setBusy(true);
    const e = await settleKitty(kitty.id, bill, shares.value.shares);
    setBusy(false);
    if (e) {
      setError(await explainFailure(e, 'settle up'));
      return;
    }
    router.replace({ pathname: '/kitty/[id]/settle', params: { id: kitty.id } });
  }

  const shareError =
    shares && !shares.ok
      ? shares.error.code === 'fixed_over_total'
        ? `The amounts you typed by hand add up to ${formatRupees(shares.error.fixedTotal)}, more than this bill.`
        : 'These amounts don’t add up to the bill.'
      : null;

  return (
    <Screen
      title="Final bill"
      back
      footer={
        <>
          <Note>A typed total keeps any amounts you set by hand and splits the rest equally. Scan the bill instead to split veg, non-veg and alcohol exactly.</Note>
          <ErrorText>{error}</ErrorText>
          <Button onPress={settle} loading={busy} disabled={!plan || waiting.length > 0}>
            Work out top-ups and refunds
          </Button>
        </>
      }
    >
      <Title>What did the bill come to?</Title>
      <Body>Enter the total you paid, including tax and service. You collected {formatRupees(collected)} before.</Body>

      {waiting.length > 0 ? (
        <View style={styles.block}>
          <Text style={type.bodyBold}>Confirm these payments first</Text>
          <Text style={[type.note, styles.blockText]}>
            Kitty works out top-ups and refunds from money that really arrived.
          </Text>
          {waiting.map((m) => (
            <View key={m.id} style={styles.blockLink}>
              <TextLink onPress={() => router.push({ pathname: '/kitty/[id]/confirm/[memberId]', params: { id: kitty.id, memberId: m.id } })}>
                {`${m.name} says they paid ${formatRupees(m.sharePaise)}. Confirm`}
              </TextLink>
            </View>
          ))}
        </View>
      ) : null}

      <Field label="Final bill" prefix="₹" value={text} onChangeText={setText} placeholder="5,400" keyboardType="decimal-pad" error={shareError} />

      {plan ? (
        <View style={styles.preview}>
          <Row label="Collected so far" value={formatRupees(plan.collectedPaise)} />
          <Row label="To send back" value={formatRupees(plan.toRefundPaise)} />
          <Row label="To ask for" value={formatRupees(plan.toComeInPaise)} last />
          {plan.square ? <Text style={[type.note, styles.square]}>Everyone is already square.</Text> : null}
        </View>
      ) : null}
    </Screen>
  );
}

function Row({ label, value, last }: { label: string; value: string; last?: boolean }) {
  return (
    <View style={[styles.row, !last && styles.rule]}>
      <Text style={type.body}>{label}</Text>
      <Text style={type.bodyInk}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  block: { marginTop: 20, backgroundColor: colors.sunken, padding: 14 },
  blockText: { marginTop: 4 },
  blockLink: { marginTop: 8 },
  preview: { marginTop: 20, backgroundColor: colors.surface, borderWidth: layout.border, borderColor: colors.line, paddingHorizontal: layout.cardPadding },
  row: { minHeight: 46, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  rule: { borderBottomWidth: layout.border, borderBottomColor: colors.line },
  square: { paddingBottom: 12 },
});
