import { formatRupees, formatShortDate, localIsoDate, timeToGo } from '@kitty/core';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { explainFailure } from '@/lib/errors';
import { loadKittySummaries, type KittySummary } from '@/lib/kitties';
import { Badge, TextLink, Body, Button, CenteredState, Header, Label, Title } from '@/ui/components';
import { colors, layout, page, type } from '@/ui/theme';

type Load = { state: 'loading' } | { state: 'error' } | { state: 'ready'; kitties: KittySummary[] };

/** Screen 1 (kitties) and screen 21 (no kitties yet). Spacing measured from the wires. */
export default function Home() {
  const [load, setLoad] = useState<Load>({ state: 'loading' });
  const [refreshing, setRefreshing] = useState(false);

  const fetchKitties = useCallback(async () => {
    try {
      setLoad({ state: 'ready', kitties: await loadKittySummaries() });
    } catch (e) {
      await explainFailure(e, 'load your kitties'); // logs out cleanly if the login has ended
      setLoad({ state: 'error' });
    }
  }, []);

  // Reload whenever home comes back into view, e.g. after editing details.
  useFocusEffect(
    useCallback(() => {
      fetchKitties();
    }, [fetchKitties]),
  );

  const startKitty = () => router.push('/new');

  const all = load.state === 'ready' ? load.kitties : [];
  // Archived kitties live on their own list (Raj, 20 Nov 2026).
  const kitties = all.filter((k) => !k.archivedAt);
  const archivedCount = all.length - kitties.length;
  const collecting = kitties.filter((k) => k.status !== 'closed');
  const done = kitties.filter((k) => k.status === 'closed');
  const today = localIsoDate();

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <Header title="Kitty" />

      {load.state === 'loading' ? (
        <CenteredState />
      ) : load.state === 'error' ? (
        <CenteredState
          title="Couldn't load your kitties"
          body="Check your connection and try again."
          action={
            <Button
              onPress={() => {
                setLoad({ state: 'loading' });
                fetchKitties();
              }}
            >
              Try again
            </Button>
          }
        />
      ) : (
        <ScrollView
          contentContainerStyle={styles.body}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={async () => {
                setRefreshing(true);
                await fetchKitties();
                setRefreshing(false);
              }}
            />
          }
        >
          {all.length === 0 ? (
            <EmptyHome />
          ) : (
            <>
              {collecting.length > 0 ? (
                <>
                  <Label>Collecting now</Label>
                  <View style={styles.list}>
                    {collecting.map((k) => (
                      <KittyCard key={k.id} kitty={k} today={today} />
                    ))}
                  </View>
                </>
              ) : null}
              {done.length > 0 ? (
                <View style={collecting.length > 0 ? styles.doneSection : null}>
                  <Label>Done</Label>
                  <View style={styles.doneList}>
                    {done.map((k) => (
                      <View key={k.id} style={styles.doneRow}>
                        <Text style={type.bodyInk}>{k.title}</Text>
                        <Text style={type.metaMuted}>Settled ✓</Text>
                      </View>
                    ))}
                  </View>
                </View>
              ) : null}
              {kitties.length === 0 ? <Text style={type.note}>Nothing on your list. Your kitties are all archived.</Text> : null}
              {archivedCount > 0 ? (
                <View style={styles.archivedLink}>
                  <TextLink onPress={() => router.push('/archived')}>{`Archived kitties (${archivedCount})`}</TextLink>
                </View>
              ) : null}
            </>
          )}
        </ScrollView>
      )}

      <View style={styles.footer}>
        <Button onPress={startKitty}>Start a kitty</Button>
      </View>
    </SafeAreaView>
  );
}

function EmptyHome() {
  const steps = [
    ['Set the amount', 'Type a total, or scan the bill for exact shares.'],
    ['Share the link on WhatsApp', 'Friends pick their name. No app needed.'],
    ['Get paid first', 'Each share lands in your UPI. Then you pay the bill.'],
  ];
  return (
    <View>
      <Title>No kitties yet</Title>
      <Body>Collect from the group before you pay the bill.</Body>
      <View style={styles.steps}>
        {steps.map(([title, body], i) => (
          <View key={title} style={styles.step}>
            <View style={styles.stepNumber}>
              <Text style={[type.meta, styles.stepNumberText]}>{i + 1}</Text>
            </View>
            <View style={styles.stepText}>
              <Text style={type.bodyBold}>{title}</Text>
              <Text style={type.note}>{body}</Text>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

function KittyCard({ kitty, today }: { kitty: KittySummary; today: string }) {
  const progress = kitty.totalPaise > 0 ? Math.min(kitty.collectedPaise / kitty.totalPaise, 1) : 0;
  const isDraft = kitty.status === 'draft';
  return (
    <Pressable
      style={styles.card}
      accessibilityRole="button"
      accessibilityLabel={`${kitty.title}, ${formatRupees(kitty.collectedPaise)} of ${formatRupees(kitty.totalPaise)} collected`}
      // Drafts haven't been shared yet, so they open the share screen. Everything else opens the feed (screen 7).
      onPress={() =>
        isDraft
          ? router.push({ pathname: '/kitty/[id]/share', params: { id: kitty.id } })
          : kitty.status === 'settling'
            ? router.push({ pathname: '/kitty/[id]/settle', params: { id: kitty.id } })
            : router.push({ pathname: '/kitty/[id]', params: { id: kitty.id } })
      }
    >
      <View style={styles.cardTop}>
        <Text style={[type.cardTitle, styles.cardTitle]}>{kitty.title}</Text>
        <View style={styles.cardBadge}>
          <Badge small tone={!isDraft && kitty.status !== 'settling' ? kitty.kind : undefined}>
            {isDraft ? 'Draft' : kitty.status === 'settling' ? 'Settling' : kitty.kind}
          </Badge>
        </View>
      </View>
      <Text style={[type.metaMuted, styles.cardDate]}>
        {formatShortDate(kitty.dueDate)}, {timeToGo(today, kitty.dueDate)}
      </Text>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${progress * 100}%` }]} />
      </View>
      <View style={styles.cardBottom}>
        <Text style={type.meta}>
          {formatRupees(kitty.collectedPaise)} of {formatRupees(kitty.totalPaise)}
        </Text>
        <Text style={type.meta}>{isDraft ? 'Not shared yet' : `${kitty.paidCount} of ${kitty.memberCount} paid`}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  archivedLink: { marginTop: 28, alignItems: 'flex-start' },
  safe: { flex: 1, backgroundColor: colors.page },
  body: page.body,
  footer: page.footer,
  // Cards start 16 pt under the section label and sit 16 pt apart.
  list: { marginTop: 16, gap: 16 },
  card: {
    backgroundColor: colors.surface,
    borderWidth: layout.border,
    borderColor: colors.line,
    padding: layout.cardPadding,
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 },
  // The tag sits nearer the card's top right corner (Raj, 21 Nov 2026).
  cardBadge: { marginTop: -8, marginRight: -8 },
  cardTitle: { flex: 1 },
  cardDate: { marginTop: 12 },
  track: { height: 8, backgroundColor: colors.track, marginTop: 12 },
  fill: { height: 8, backgroundColor: colors.ink },
  cardBottom: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 12 },
  doneSection: { marginTop: 26 },
  doneList: { marginTop: 16, borderTopWidth: layout.border, borderTopColor: colors.line },
  doneRow: {
    height: 57,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: layout.border,
    borderBottomColor: colors.line,
  },
  // Screen 21: 24 pt below the intro, 16 pt padding, 27 pt number circles, 242 pt tall in the wire.
  steps: {
    marginTop: 24,
    backgroundColor: colors.surface,
    borderWidth: layout.border,
    borderColor: colors.line,
    paddingHorizontal: layout.cardPadding,
    paddingTop: layout.cardPadding,
    paddingBottom: 20,
    gap: 16,
  },
  step: { flexDirection: 'row', gap: 12 },
  stepNumber: {
    width: 27,
    height: 27,
    borderRadius: 13.5,
    borderWidth: layout.border,
    borderColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumberText: { fontFamily: type.bodyBold.fontFamily, lineHeight: 17 },
  stepText: { flex: 1, gap: 1 },
});
