import { describeWhen, formatRupees } from '@kitty/core';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { explainFailure } from '@/lib/errors';
import { confirmShare, loadFeed, markNotReceived, type FeedKitty, type FeedMember } from '@/lib/feed';
import { Body, Button, CenteredState, ErrorText, Screen, Title } from '@/ui/components';
import { colors, layout, type } from '@/ui/theme';

/**
 * Screen 8. The organiser checks their own UPI app, then says whether it arrived.
 * Kitty never sees payments (spec section 5), so this is the source of truth.
 */
export default function ConfirmPayment() {
  const { id, memberId } = useLocalSearchParams<{ id: string; memberId: string }>();
  const [data, setData] = useState<{ kitty: FeedKitty; member: FeedMember } | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let current = true;
    loadFeed(id)
      .then((kitty) => {
        const member = kitty.members.find((m) => m.id === memberId);
        if (!current) return;
        if (member) setData({ kitty, member });
        else setFailed(true);
      })
      .catch(() => current && setFailed(true));
    return () => {
      current = false;
    };
  }, [id, memberId]);

  if (!data) {
    return (
      <Screen title="Confirm payment" back>
        {failed ? <CenteredState title="Couldn’t load this payment" body="Go back and try again." /> : <CenteredState />}
      </Screen>
    );
  }
  return <ConfirmReady kitty={data.kitty} member={data.member} />;
}

function ConfirmReady({ kitty, member }: { kitty: FeedKitty; member: FeedMember }) {
  const [busy, setBusy] = useState<'yes' | 'no' | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Goals in parts: the part being confirmed, not the whole share.
  const next = member.parts?.next ?? null;
  const amount = formatRupees(next?.amountPaise ?? member.sharePaise);
  const saidPaid = member.state === 'waiting' || member.state === 'not_received';

  async function answer(arrived: boolean) {
    setError(null);
    setBusy(arrived ? 'yes' : 'no');
    const e = arrived ? await confirmShare(member.id) : await markNotReceived(member.id);
    setBusy(null);
    if (e) {
      setError(await explainFailure(e, arrived ? 'confirm the payment' : 'update the payment'));
      return;
    }
    router.back();
  }

  const rows: [string, string][] = [
    ['From', member.name],
    ['Amount', next && member.parts ? `${amount}, part ${next.partNumber} of ${member.parts.total}` : amount],
    ...(member.markedAt ? ([['Marked paid', capitalise(describeWhen(new Date(member.markedAt)))]] as [string, string][]) : []),
    ...(member.upiRef ? ([['UPI reference', member.upiRef]] as [string, string][]) : []),
    ['Paid to', kitty.upiId],
  ];

  return (
    <Screen
      title="Confirm payment"
      back
      footer={
        <>
          <ErrorText>{error}</ErrorText>
          <Button onPress={() => answer(true)} loading={busy === 'yes'} disabled={busy !== null}>
            Yes, it arrived
          </Button>
          {member.state === 'waiting' ? (
            <Button variant="secondary" onPress={() => answer(false)} loading={busy === 'no'} disabled={busy !== null}>
              {`Not yet, ask ${member.name} to check`}
            </Button>
          ) : null}
        </>
      }
    >
      <Title>
        Did {amount} from {member.name} arrive?
      </Title>
      <Body>
        {saidPaid
          ? `${member.name} marked it as paid. Check your UPI app, then confirm.`
          : `${member.name} hasn’t marked it as paid. If they paid you another way, like cash, you can confirm it here.`}
      </Body>

      <View style={styles.card}>
        {rows.map(([label, value], i) => (
          <View key={label} style={[styles.detail, i < rows.length - 1 && styles.detailRule]}>
            <Text style={type.body}>{label}</Text>
            <Text style={[type.bodyInk, styles.value]}>{value}</Text>
          </View>
        ))}
      </View>
    </Screen>
  );
}

const capitalise = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

// Measured from screen 8: a 349 pt card, 49 pt rows.
const styles = StyleSheet.create({
  card: {
    marginTop: 24,
    backgroundColor: colors.surface,
    borderWidth: layout.border,
    borderColor: colors.line,
    paddingHorizontal: layout.cardPadding,
  },
  detail: { minHeight: 49, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  detailRule: { borderBottomWidth: layout.border, borderBottomColor: colors.line },
  value: { flexShrink: 1, textAlign: 'right' },
});
