import { formatRupees, formatShortDate, initials, localIsoDate, timeToGo } from '@kitty/core';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/lib/auth';
import { loadKittySummaries, type KittySummary } from '@/lib/kitties';
import { Avatar, Button, CenteredState, Label } from '@/ui/components';
import { colors, space, type } from '@/ui/theme';

type Load = { state: 'loading' } | { state: 'error' } | { state: 'ready'; kitties: KittySummary[] };

/** Screen 1 (kitties) and screen 21 (no kitties yet). */
export default function Home() {
  const { profile } = useAuth();
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
      <View style={styles.header}>
        <Text style={styles.headerTitle} accessibilityRole="header">
          Kitty
        </Text>
        <Avatar text={initials(profile?.name ?? '') || 'You'} onPress={() => router.push('/profile')} />
      </View>

      {load.state === 'loading' ? (
        <CenteredState />
      ) : load.state === 'error' ? (
        <CenteredState
          title="Couldn't load your kitties"
          body="Check your connection and try again."
          action={<Button onPress={() => { setLoad({ state: 'loading' }); fetchKitties(); }}>Try again</Button>}
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
                <View style={styles.doneSection}>
                  <Label>Done</Label>
                  {done.map((k) => (
                    <View key={k.id} style={styles.doneRow}>
                      <Text style={type.bodyInk}>{k.title}</Text>
                      <Text style={type.small}>Settled ✓</Text>
                    </View>
                  ))}
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
      <Text style={type.title} accessibilityRole="header">
        No kitties yet
      </Text>
      <Text style={[type.body, styles.mtXs]}>Collect from the group before you pay the bill.</Text>
      <View style={styles.steps}>
        {steps.map(([title, body], i) => (
          <View key={title} style={styles.step}>
            <View style={styles.stepNumber}>
              <Text style={styles.stepNumberText}>{i + 1}</Text>
            </View>
            <View style={styles.flex}>
              <Text style={styles.stepTitle}>{title}</Text>
              <Text style={type.small}>{body}</Text>
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
        <Text style={styles.cardTitle}>{kitty.title}</Text>
        <Text style={styles.badge}>{isDraft ? 'DRAFT' : kitty.kind.toUpperCase()}</Text>
      </View>
      <Text style={[type.small, styles.mtXs]}>
        {formatShortDate(kitty.dueDate)}, {timeToGo(today, kitty.dueDate)}
      </Text>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${progress * 100}%` }]} />
      </View>
      <View style={styles.cardBottom}>
        <Text style={type.bodyInk}>
          {formatRupees(kitty.collectedPaise)} of {formatRupees(kitty.totalPaise)}
        </Text>
        <Text style={type.bodyInk}>{isDraft ? 'Not shared yet' : `${kitty.paidCount} of ${kitty.memberCount} paid`}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  safe: { flex: 1, backgroundColor: colors.page },
  header: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.xl,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  headerTitle: { fontSize: 20, fontWeight: '700', color: colors.ink },
  body: { padding: space.xl, flexGrow: 1 },
  footer: { paddingHorizontal: space.xl, paddingVertical: space.lg },
  mtXs: { marginTop: space.xs },
  list: { marginTop: space.md, gap: space.lg },
  card: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, padding: space.lg },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: space.sm },
  cardTitle: { fontSize: 18, fontWeight: '700', color: colors.ink, flex: 1 },
  badge: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    color: colors.ink,
    borderWidth: 1,
    borderColor: colors.ink,
    paddingHorizontal: space.sm,
    paddingVertical: 3,
  },
  track: { height: 8, backgroundColor: colors.lineSoft, marginTop: space.lg },
  fill: { height: 8, backgroundColor: colors.ink },
  cardBottom: { flexDirection: 'row', justifyContent: 'space-between', marginTop: space.md },
  doneSection: { marginTop: space.xxl },
  doneRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: 56,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  steps: {
    marginTop: space.xl,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    padding: space.lg,
    gap: space.lg,
  },
  step: { flexDirection: 'row', gap: space.md },
  stepNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumberText: { fontSize: 13, fontWeight: '700', color: colors.ink },
  stepTitle: { fontSize: 16, fontWeight: '700', color: colors.ink, marginBottom: 2 },
});
