import { formatRupees, formatShortDate, localIsoDate, timeToGo } from '@kitty/core';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { loadKittySummaries, type KittySummary } from '@/lib/kitties';
import { Avatar, Badge, Body, Button, CenteredState, Header, Label, Title } from '@/ui/components';
import { colors, layout, type } from '@/ui/theme';

type Load = { state: 'loading' } | { state: 'error' } | { state: 'ready'; kitties: KittySummary[] };

/** Screen 1 (kitties) and screen 21 (no kitties yet). Spacing measured from the wires. */
export default function Home() {
  const [load, setLoad] = useState<Load>({ state: 'loading' });
  const [refreshing, setRefreshing] = useState(false);

  const fetchKitties = useCallback(async () => {
    try {
      setLoad({ state: 'ready', kitties: await loadKittySummaries() });
    } catch {
      setLoad({ state: 'error' });
    }
  }, []);

  // Reload whenever home comes back into view, e.g. after editing details.
  useFocusEffect(
    useCallback(() => {
      fetchKitties();
    }, [fetchKitties]),
  );

  const startKitty = () => Alert.alert('Coming next', 'Creating a kitty is step 4 of the build.');

  const kitties = load.state === 'ready' ? load.kitties : [];
  const collecting = kitties.filter((k) => k.status !== 'closed');
  const done = kitties.filter((k) => k.status === 'closed');
  const today = localIsoDate();

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <Header title="Kitty" right={<Avatar text="You" onPress={() => router.push('/profile')} />} />

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
          {kitties.length === 0 ? (
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
      onPress={() => Alert.alert('Coming soon', 'The kitty feed is step 6 of the build.')}
    >
      <View style={styles.cardTop}>
        <Text style={[type.cardTitle, styles.cardTitle]}>{kitty.title}</Text>
        <Badge>{isDraft ? 'Draft' : kitty.kind}</Badge>
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
  safe: { flex: 1, backgroundColor: colors.page },
  body: { paddingHorizontal: layout.gutter, paddingTop: layout.top, paddingBottom: 24, flexGrow: 1 },
  footer: { paddingHorizontal: layout.gutter, paddingTop: 16, paddingBottom: layout.gutter },
  // Cards start 16 pt under the section label and sit 16 pt apart.
  list: { marginTop: 16, gap: 16 },
  card: {
    backgroundColor: colors.surface,
    borderWidth: layout.border,
    borderColor: colors.line,
    padding: layout.cardPadding,
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
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
