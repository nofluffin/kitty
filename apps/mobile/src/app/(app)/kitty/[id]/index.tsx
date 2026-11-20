import { describeWhen, feedOrder, formatRupees, formatShortDate, localIsoDate, payProgress, timeToGo } from '@kitty/core';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { explainFailure } from '@/lib/errors';
import { loadFeed, type FeedKitty, type FeedMember } from '@/lib/feed';
import { registerForPush } from '@/lib/push';
import { ask } from '@/lib/ask';
import { setArchived } from '@/lib/kitties';
import { Button, CenteredState, Header, Note, TextLink } from '@/ui/components';
import { colors, layout, type } from '@/ui/theme';

type Load = { state: 'loading' } | { state: 'error' } | { state: 'ready'; kitty: FeedKitty };

/** Screen 7: who has paid, with Confirm and Nudge. */
export default function Feed() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [load, setLoad] = useState<Load>({ state: 'loading' });
  const [refreshing, setRefreshing] = useState(false);

  const fetchFeed = useCallback(async () => {
    try {
      setLoad({ state: 'ready', kitty: await loadFeed(id) });
    } catch (e) {
      await explainFailure(e, 'load this kitty');
      setLoad({ state: 'error' });
    }
  }, [id]);

  // Reload whenever the feed comes back into view, e.g. after confirming a payment.
  useFocusEffect(
    useCallback(() => {
      fetchFeed();
    }, [fetchFeed]),
  );

  const kitty = load.state === 'ready' ? load.kitty : null;

  async function toggleArchive(k: FeedKitty) {
    if (!k.archivedAt) {
      const sure = await ask(
        `Archive ${k.title}?`,
        'It moves off your kitty list into Archived kitties, at the bottom of home. Your friends’ link keeps working, and reminders stop.',
        'Archive',
      );
      if (!sure) return;
    }
    const e = await setArchived(k.id, !k.archivedAt);
    if (e) {
      await explainFailure(e, k.archivedAt ? 'unarchive the kitty' : 'archive the kitty');
      return;
    }
    if (k.archivedAt) await fetchFeed();
    else if (router.canGoBack()) router.back();
    else router.replace('/home');
  }

  // The moment "tell me when people pay" makes sense: the first look at a shared kitty.
  // The phone shows its permission prompt once; after that this only registers.
  const shared = kitty?.status === 'shared';
  useEffect(() => {
    if (shared) registerForPush({ ask: true });
  }, [shared]);

  const shareLink = (
    <TextLink onPress={() => router.push({ pathname: '/kitty/[id]/share', params: { id } })}>Share link</TextLink>
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <Header title={kitty?.title ?? 'Kitty'} back right={kitty ? shareLink : undefined} hideAvatar />
      {load.state === 'loading' ? (
        <CenteredState />
      ) : load.state === 'error' ? (
        <CenteredState
          title="Couldn’t load this kitty"
          body="Check your connection and try again."
          action={
            <Button
              onPress={() => {
                setLoad({ state: 'loading' });
                fetchFeed();
              }}
            >
              Try again
            </Button>
          }
        />
      ) : (
        <>
          <ScrollView
            contentContainerStyle={styles.body}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={async () => {
                  setRefreshing(true);
                  await fetchFeed();
                  setRefreshing(false);
                }}
              />
            }
          >
            <Summary kitty={load.kitty} />
            <View style={styles.rows}>
              {/* People paid for by someone else show under their payer, not as rows of their own. */}
              {feedOrder(load.kitty.members.filter((m) => !m.paidById)).map((m) => (
                <FeedRow key={m.id} kitty={load.kitty} member={m} />
              ))}
            </View>
          </ScrollView>
          <View style={styles.footer}>
            {load.kitty.editable ? (
              <TextLink onPress={() => router.push({ pathname: '/new', params: { edit: id } })}>
                Nobody has paid yet. Edit the amounts or people
              </TextLink>
            ) : null}
            {load.kitty.status === 'settling' ? (
              <Button onPress={() => router.push({ pathname: '/kitty/[id]/settle', params: { id } })}>Open settle up</Button>
            ) : load.kitty.kind === 'goal' ? (
              <>
                <Note>Once you’ve paid for it, enter what it really cost. Kitty works out who pays a bit more and who gets money back.</Note>
                <Button variant="secondary" onPress={() => router.push({ pathname: '/kitty/[id]/final-bill', params: { id } })}>
                  Enter the final cost
                </Button>
              </>
            ) : (
              <>
                <Note>
                  {!load.kitty.editable
                    ? 'Someone has paid, so the bill can’t be scanned any more. Everyone’s amount stays as it is.'
                    : load.kitty.hasBill
                      ? 'The bill is scanned. Rescan it if something changed, and Kitty works the shares out again.'
                      : 'Scan the bill before anyone pays, and Kitty splits veg, non-veg and alcohol into exact shares.'}
                </Note>
                {/* Raj, 20 Nov 2026: once anyone has paid, scanning is greyed out. */}
                <Button
                  variant="secondary"
                  disabled={!load.kitty.editable}
                  onPress={() => router.push({ pathname: '/kitty/[id]/scan', params: { id, mode: 'settle' } })}
                >
                  {load.kitty.hasBill ? 'Rescan the bill' : 'Scan the bill'}
                </Button>
              </>
            )}
            {/* Raj, 20 Nov 2026: file a kitty away from the list. Found again under Archived kitties on home. */}
            <Button variant="secondary" onPress={() => toggleArchive(load.kitty)}>
              {load.kitty.archivedAt ? 'Unarchive' : 'Archive'}
            </Button>
          </View>
        </>
      )}
    </SafeAreaView>
  );
}

function Summary({ kitty }: { kitty: FeedKitty }) {
  const progress = payProgress(kitty.members);
  const collected = kitty.members.reduce((sum, m) => sum + m.paidPaise, 0);
  return (
    <View style={styles.summary}>
      <Text style={styles.amountLine}>
        <Text style={styles.amount}>{formatRupees(collected)}</Text>
        <Text style={type.note}> of {formatRupees(kitty.totalPaise)}</Text>
      </Text>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${kitty.totalPaise ? Math.min(collected / kitty.totalPaise, 1) * 100 : 0}%` }]} />
      </View>
      <View style={styles.summaryBottom}>
        <Text style={type.note}>
          {progress.paid} of {progress.total} paid
        </Text>
        <Text style={type.note}>
          {formatShortDate(kitty.dueDate)}, {timeToGo(localIsoDate(), kitty.dueDate)}
        </Text>
      </View>
    </View>
  );
}

function FeedRow({ kitty, member: m }: { kitty: FeedKitty; member: FeedMember }) {
  const amount = formatRupees(m.askPaise);
  const paysFor = m.paysFor.length > 0 ? `Pays for ${m.paysFor.join(', ')} too` : null;
  const name = m.isOrganiser ? 'You' : m.name;
  // Goals in parts: talk about the part that's due, not the whole share.
  const next = m.parts?.next ?? null;
  const partLabel = next && m.parts ? `part ${next.partNumber} of ${m.parts.total}, ${formatRupees(next.amountPaise)}` : null;

  // Tapping the name shows how their share was worked out (Raj, 20 Nov 2026).
  const openPerson = () => router.push({ pathname: '/kitty/[id]/person/[memberId]', params: { id: kitty.id, memberId: m.id } });

  if (m.isOrganiser || m.state === 'paid') {
    return (
      <View style={styles.row}>
        <Pressable onPress={openPerson} accessibilityRole="button" accessibilityLabel={`See ${name === 'You' ? 'your share' : m.name}`} style={styles.flex}>
          <Text style={type.bodyInk}>{name}</Text>
          {paysFor ? <Text style={type.note}>{paysFor}</Text> : null}
        </Pressable>
        <Text style={type.metaMuted}>{m.isOrganiser ? `Your share, ${amount} ✓` : `Paid ${amount} ✓`}</Text>
      </View>
    );
  }

  const detail =
    m.state === 'waiting'
      ? `Says paid ${partLabel ?? amount}${m.markedAt ? `, ${describeWhen(new Date(m.markedAt))}` : ''}`
      : m.state === 'not_received'
        ? m.upiRef
          ? `Not received yet. Sent UPI ref ${m.upiRef}`
          : 'Not received yet, asked to check'
        : next && m.parts
          ? `${m.parts.paid} of ${m.parts.total} parts paid. Next ${formatRupees(next.amountPaise)} by ${formatShortDate(next.dueDate)}`
          : m.lastOpenedAt
            ? 'Not paid, opened the link'
            : 'Not paid, hasn’t opened the link';

  const needsConfirm = m.state === 'waiting' || m.state === 'not_received';
  const go = () =>
    needsConfirm
      ? router.push({ pathname: '/kitty/[id]/confirm/[memberId]', params: { id: kitty.id, memberId: m.id } })
      : router.push({ pathname: '/kitty/[id]/nudge/[memberId]', params: { id: kitty.id, memberId: m.id } });

  return (
    <View style={styles.row}>
      <Pressable onPress={openPerson} accessibilityRole="button" accessibilityLabel={`See ${m.name}`} style={styles.flex}>
        <Text style={type.bodyInk}>{name}</Text>
        {paysFor ? <Text style={type.note}>{paysFor}</Text> : null}
        <Text style={type.note}>{detail}</Text>
      </Pressable>
      <Pressable
        onPress={go}
        accessibilityRole="button"
        accessibilityLabel={`${needsConfirm ? 'Confirm' : 'Nudge'} ${m.name}`}
        style={({ pressed }) => [styles.action, needsConfirm ? styles.actionPrimary : styles.actionSecondary, pressed && styles.pressed]}
      >
        <Text style={[type.meta, needsConfirm && styles.onDark]}>{needsConfirm ? 'Confirm' : 'Nudge'}</Text>
      </Pressable>
    </View>
  );
}

// Measured from screen 7.
const styles = StyleSheet.create({
  flex: { flex: 1 },
  safe: { flex: 1, backgroundColor: colors.page },
  body: { paddingHorizontal: layout.gutter, paddingTop: 16, paddingBottom: 24 },
  footer: { paddingHorizontal: layout.gutter, paddingTop: 16, paddingBottom: layout.gutter, gap: 16 },
  summary: { backgroundColor: colors.surface, borderWidth: layout.border, borderColor: colors.line, padding: layout.cardPadding },
  amountLine: { lineHeight: 38 },
  amount: { ...type.title, fontSize: 32, lineHeight: 38 },
  track: { height: 8, backgroundColor: colors.track, marginTop: 10 },
  fill: { height: 8, backgroundColor: colors.ink },
  summaryBottom: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 },
  rows: { marginTop: 20 },
  row: {
    minHeight: 61,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
    borderBottomWidth: layout.border,
    borderBottomColor: colors.line,
  },
  action: { height: 44, justifyContent: 'center', paddingHorizontal: 15, borderWidth: layout.border },
  actionPrimary: { backgroundColor: colors.action, borderColor: colors.action },
  actionSecondary: { backgroundColor: colors.surface, borderColor: colors.line },
  onDark: { color: colors.inkOnDark, fontFamily: type.bodyBold.fontFamily },
  pressed: { opacity: 0.8 },
});
