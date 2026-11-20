import { describeWhen, formatRupees } from '@kitty/core';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Linking, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { loadActivity, markActivityRead, type ActivityItem, type WaitingPayment } from '@/lib/activity';
import { explainFailure } from '@/lib/errors';
import { notificationsOn, pushSupported, registerForPush } from '@/lib/push';
import { Button, CenteredState, Header, InfoBox, Label, SmallButton } from '@/ui/components';
import { colors, layout, type } from '@/ui/theme';

type Load = { state: 'loading' } | { state: 'error' } | { state: 'ready'; waiting: WaitingPayment[]; recent: ActivityItem[] };

/**
 * Activity (decided with Raj, 20 Nov 2026; not in the wires): payments waiting for
 * you across every kitty, then recent notifications.
 */
export default function Activity() {
  const [load, setLoad] = useState<Load>({ state: 'loading' });
  const [refreshing, setRefreshing] = useState(false);
  const [pushOff, setPushOff] = useState(false);

  const fetchActivity = useCallback(async () => {
    try {
      const a = await loadActivity();
      setLoad({ state: 'ready', ...a });
      markActivityRead().catch(() => {});
    } catch (e) {
      await explainFailure(e, 'load your activity');
      setLoad({ state: 'error' });
    }
    if (pushSupported) setPushOff(!(await notificationsOn()));
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchActivity();
    }, [fetchActivity]),
  );

  async function turnOn() {
    if (!(await registerForPush({ ask: true }))) await Linking.openSettings();
    setPushOff(!(await notificationsOn()));
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <Header title="Activity" />
      {load.state === 'loading' ? (
        <CenteredState />
      ) : load.state === 'error' ? (
        <CenteredState
          title="Couldn’t load your activity"
          body="Check your connection and try again."
          action={<Button onPress={fetchActivity}>Try again</Button>}
        />
      ) : (
        <ScrollView
          contentContainerStyle={styles.body}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={async () => {
                setRefreshing(true);
                await fetchActivity();
                setRefreshing(false);
              }}
            />
          }
        >
          {pushOff ? (
            <View style={styles.gapBottom}>
              <InfoBox>
                <Text style={type.body}>Turn on notifications to hear when people pay, and get reminders before the pay by date.</Text>
                <View style={styles.infoAction}>
                  <SmallButton onPress={turnOn}>Turn on notifications</SmallButton>
                </View>
              </InfoBox>
            </View>
          ) : null}

          <Label>Waiting for you</Label>
          {load.waiting.length === 0 ? (
            <Text style={[type.note, styles.empty]}>Nothing waiting. When someone says they’ve paid, it shows up here.</Text>
          ) : (
            <View style={styles.list}>
              {load.waiting.map((p) => (
                <WaitingRow key={p.id} payment={p} />
              ))}
            </View>
          )}

          {load.recent.length > 0 ? (
            <View style={styles.section}>
              <Label>Recent</Label>
              <View style={styles.list}>
                {load.recent.map((n) => (
                  <Pressable
                    key={n.id}
                    disabled={!n.url}
                    onPress={() => n.url && router.push(n.url as never)}
                    accessibilityRole={n.url ? 'button' : 'text'}
                    style={({ pressed }) => [styles.row, pressed && styles.pressed]}
                  >
                    <View style={styles.flex}>
                      <Text style={n.read ? type.bodyInk : type.bodyBold}>{n.title}</Text>
                      <Text style={type.note}>{n.body}</Text>
                      <Text style={type.small}>{describeWhen(new Date(n.createdAt))}</Text>
                    </View>
                  </Pressable>
                ))}
              </View>
            </View>
          ) : null}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function WaitingRow({ payment: p }: { payment: WaitingPayment }) {
  const amount = formatRupees(p.amountPaise);
  const what = p.kind === 'topup' ? `${amount} top-up` : amount;
  const title = p.status === 'marked' ? `${p.memberName} says they paid ${what}` : `${p.memberName} is checking ${what}`;
  const detail = [p.kittyTitle, p.markedAt ? describeWhen(new Date(p.markedAt)) : null, p.upiRef ? `UPI ref ${p.upiRef}` : null]
    .filter(Boolean)
    .join(', ');
  // Top-ups are confirmed on the settle up screen; shares and parts on the confirm screen (screen 8).
  const open = () =>
    p.kind === 'topup'
      ? router.push({ pathname: '/kitty/[id]/settle', params: { id: p.kittyId } })
      : router.push({ pathname: '/kitty/[id]/confirm/[memberId]', params: { id: p.kittyId, memberId: p.memberId } });
  return (
    <View style={styles.row}>
      <View style={styles.flex}>
        <Text style={type.bodyInk}>{title}</Text>
        <Text style={type.note}>{detail}</Text>
      </View>
      <Pressable
        onPress={open}
        accessibilityRole="button"
        accessibilityLabel={`Confirm ${p.memberName}, ${p.kittyTitle}`}
        style={({ pressed }) => [styles.action, pressed && styles.pressed]}
      >
        <Text style={[type.meta, styles.onDark]}>Confirm</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.page },
  body: { padding: layout.gutter, paddingBottom: 32 },
  flex: { flex: 1, gap: 2 },
  gapBottom: { marginBottom: 24 },
  infoAction: { marginTop: 12, alignItems: 'flex-start' },
  empty: { paddingVertical: 12 },
  section: { marginTop: 32 },
  list: { marginTop: 12, borderTopWidth: layout.border, borderTopColor: colors.line },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: layout.border,
    borderBottomColor: colors.line,
  },
  action: { backgroundColor: colors.action, paddingHorizontal: 14, height: 40, justifyContent: 'center' },
  onDark: { color: colors.surface },
  pressed: { opacity: 0.8 },
});
