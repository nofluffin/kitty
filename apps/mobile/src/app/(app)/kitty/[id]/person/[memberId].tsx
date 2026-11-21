import { billSplit, describeWhen, formatRupees, formatShortDate, type CategorySummary } from '@kitty/core';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { loadFeed, type FeedKitty, type FeedMember } from '@/lib/feed';
import { loadConfirmedBill, type ScannedBill } from '@/lib/scan';
import { Button, CenteredState, Label, Screen, TextLink } from '@/ui/components';
import { colors, layout, type } from '@/ui/theme';

/**
 * One person in a kitty, for the organiser (Raj, 20 Nov 2026; not in the wires):
 * their food and drink, amount, status, and how their share was worked out,
 * the same breakdown they see on their pay page.
 */
export default function Person() {
  const { id, memberId } = useLocalSearchParams<{ id: string; memberId: string }>();
  const [data, setData] = useState<{ kitty: FeedKitty; bill: ScannedBill | null } | null>(null);
  const [failed, setFailed] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let current = true;
      Promise.all([loadFeed(id), loadConfirmedBill(id)])
        .then(([kitty, bill]) => current && setData({ kitty, bill }))
        .catch(() => current && setFailed(true));
      return () => {
        current = false;
      };
    }, [id]),
  );

  const member = data?.kitty.members.find((m) => m.id === memberId);
  if (!data || !member) {
    return (
      <Screen title="Person" back>
        {failed || (data && !member) ? <CenteredState title="Couldn’t load this person" body="Go back and try again." /> : <CenteredState />}
      </Screen>
    );
  }
  return <PersonReady kitty={data.kitty} bill={data.bill} member={member} />;
}

const CATEGORY_NAME = { veg: 'Veg dishes', nonveg: 'Non-Veg dishes', alcohol: 'Alcohol' } as const;

function PersonReady({ kitty, bill, member: m }: { kitty: FeedKitty; bill: ScannedBill | null; member: FeedMember }) {
  const payer = m.paidById ? kitty.members.find((x) => x.id === m.paidById) : null;
  const group = [m, ...kitty.members.filter((x) => x.paidById === m.id)];
  const split = bill
    ? billSplit(
        bill.lines.map((l) => ({ id: l.id, amountPaise: l.amountPaise, category: l.category })),
        bill.extrasPaise,
        [...kitty.members].sort((a, b) => a.sortOrder - b.sortOrder).map((x) => ({ id: x.id, diet: x.diet, drinks: x.drinks })),
      )
    : null;
  const categories = split?.ok ? split.value.categories : null;
  const settled = kitty.status === 'settling' || kitty.status === 'closed';
  const shareOf = (x: FeedMember) => (settled && x.finalSharePaise !== null ? x.finalSharePaise : x.sharePaise);
  const total = group.reduce((sum, x) => sum + shareOf(x), 0);
  const name = m.isOrganiser ? 'You' : m.name;
  const needsConfirm = !m.isOrganiser && !m.paidById && (m.state === 'waiting' || m.state === 'not_received');
  const canNudge = !m.isOrganiser && !m.paidById && m.state === 'unpaid' && kitty.status === 'shared';

  const status = m.isOrganiser
    ? 'Your own share, counted as paid'
    : payer
      ? `${payer.isOrganiser ? 'You pay' : `${payer.name} pays`} for them`
      : m.state === 'paid'
        ? 'Paid, confirmed ✓'
        : m.state === 'waiting'
          ? `Says paid${m.markedAt ? `, ${describeWhen(new Date(m.markedAt))}` : ''}. Waiting for you to confirm`
          : m.state === 'not_received'
            ? `You said it hasn’t arrived${m.upiRef ? `. UPI ref ${m.upiRef}` : ''}`
            : m.lastOpenedAt
              ? 'Not paid yet, opened the link'
              : 'Not paid yet, hasn’t opened the link';

  return (
    <Screen
      title={m.isOrganiser ? 'You' : m.name}
      back
      footer={
        needsConfirm ? (
          <Button onPress={() => router.push({ pathname: '/kitty/[id]/confirm/[memberId]', params: { id: kitty.id, memberId: m.id } })}>
            Confirm
          </Button>
        ) : canNudge ? (
          <Button variant="secondary" onPress={() => router.push({ pathname: '/kitty/[id]/nudge/[memberId]', params: { id: kitty.id, memberId: m.id } })}>
            {`Nudge ${m.name}`}
          </Button>
        ) : undefined
      }
    >
      <View style={styles.tags}>
        <Tag>{m.diet === 'veg' ? 'Veg' : 'Non-Veg'}</Tag>
        {m.drinks ? <Tag>Alcohol</Tag> : <Tag>No Alcohol</Tag>}
      </View>

      <View style={styles.card}>
        <Text style={type.note}>{group.length > 1 ? `${name === 'You' ? 'Your' : `${m.name}’s`} share, with ${group.slice(1).map((x) => x.name).join(', ')}` : `${name === 'You' ? 'Your' : 'Their'} share`}</Text>
        <Text style={styles.amount}>{formatRupees(payer ? shareOf(m) : total)}</Text>
        <Text style={type.note}>{status}</Text>
        {m.parts?.next ? (
          <Text style={type.note}>{`${m.parts.paid} of ${m.parts.total} parts paid. Next ${formatRupees(m.parts.next.amountPaise)} by ${formatShortDate(m.parts.next.dueDate)}`}</Text>
        ) : null}
      </View>

      <View style={styles.section}>
        <Label>How the share was worked out</Label>
        {(payer ? [m] : group).map((x, i, all) => (
          <View key={x.id} style={styles.block}>
            {all.length > 1 ? <Text style={[type.bodyBold, styles.blockTitle]}>{i === 0 ? `For ${x.isOrganiser ? 'you' : x.name}` : `For ${x.name}`}</Text> : null}
            <View style={styles.breakdown}>
              {categories ? (
                <CategoryRows categories={categories} bill={bill!} memberId={x.id} share={shareOf(x)} />
              ) : (
                <TypedRows kitty={kitty} x={x} share={shareOf(x)} settled={settled} />
              )}
            </View>
          </View>
        ))}
      </View>

      {payer ? (
        <View style={styles.section}>
          <TextLink onPress={() => router.replace({ pathname: '/kitty/[id]/person/[memberId]', params: { id: kitty.id, memberId: payer.id } })}>
            {payer.isOrganiser ? 'See your share' : `See ${payer.name}`}
          </TextLink>
        </View>
      ) : null}
    </Screen>
  );
}

function CategoryRows({ categories, bill, memberId, share }: { categories: CategorySummary[]; bill: ScannedBill; memberId: string; share: number }) {
  return (
    <>
      {(['veg', 'nonveg', 'alcohol'] as const).map((c) => {
        const cat = categories.find((x) => x.category === c);
        if (!cat) return null;
        const charged = cat.memberIds.includes(memberId);
        return (
          <View key={c} style={styles.row}>
            <View style={styles.rowTop}>
              <Text style={[type.body, styles.flex]}>
                {charged ? `${CATEGORY_NAME[c]} ${formatRupees(cat.totalPaise)}, split ${cat.memberIds.length} ways` : CATEGORY_NAME[c]}
              </Text>
              <Text style={type.bodyInk}>{charged ? formatRupees(cat.perHeadPaise) : 'Not charged'}</Text>
            </View>
            {bill.lines
              .filter((l) => l.category === c)
              .map((l) => (
                <View key={l.id} style={styles.dish}>
                  <Text style={[type.note, styles.flex]}>{l.label || l.rawText}</Text>
                  <Text style={type.note}>{formatRupees(l.amountPaise)}</Text>
                </View>
              ))}
          </View>
        );
      })}
      <View style={[styles.row, styles.last]}>
        <View style={styles.rowTop}>
          <Text style={[type.body, styles.flex]}>Share</Text>
          <Text style={type.bodyBold}>{formatRupees(share)}</Text>
        </View>
      </View>
    </>
  );
}

function TypedRows({ kitty, x, share, settled }: { kitty: FeedKitty; x: FeedMember; share: number; settled: boolean }) {
  const fixed = kitty.members.filter((m) => m.shareFixed);
  const base = settled && kitty.finalBillPaise !== null ? kitty.finalBillPaise : kitty.totalPaise;
  const label = x.shareFixed
    ? 'Amount you set'
    : fixed.length > 0
      ? `${settled ? 'Final bill' : 'Total'} ${formatRupees(base)}, less ${formatRupees(fixed.reduce((s, m) => s + (settled ? (m.finalSharePaise ?? m.sharePaise) : m.sharePaise), 0))} you set, split ${kitty.members.length - fixed.length} ways`
      : `${settled ? 'Final bill' : 'Total'} ${formatRupees(base)}, split ${kitty.members.length} ways`;
  return (
    <View style={[styles.row, styles.last]}>
      <View style={styles.rowTop}>
        <Text style={[type.body, styles.flex]}>{label}</Text>
        <Text style={type.bodyBold}>{formatRupees(share)}</Text>
      </View>
    </View>
  );
}

function Tag({ children }: { children: string }) {
  return (
    <View style={styles.tag}>
      <Text style={type.small}>{children}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  tags: { flexDirection: 'row', gap: 6 },
  tag: { borderWidth: layout.border, borderColor: colors.line, borderRadius: 3, paddingHorizontal: 6, height: 22, justifyContent: 'center' },
  card: { marginTop: 16, backgroundColor: colors.surface, borderWidth: layout.border, borderColor: colors.line, padding: layout.cardPadding, gap: 4 },
  amount: { ...type.title, fontSize: 32, lineHeight: 40 },
  section: { marginTop: 28 },
  block: { marginTop: 12 },
  blockTitle: { marginBottom: 6 },
  breakdown: { backgroundColor: colors.surface, borderWidth: layout.border, borderColor: colors.line, paddingHorizontal: layout.cardPadding },
  row: { paddingVertical: 12, borderBottomWidth: layout.border, borderBottomColor: colors.line },
  last: { borderBottomWidth: 0 },
  rowTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  dish: { flexDirection: 'row', gap: 12, marginTop: 4 },
});
