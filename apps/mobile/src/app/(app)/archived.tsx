import { formatRupees, formatShortDate } from '@kitty/core';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { explainFailure } from '@/lib/errors';
import { loadKittySummaries, setArchived, type KittySummary } from '@/lib/kitties';
import { Body, CenteredState, Screen, SmallButton } from '@/ui/components';
import { colors, layout, type } from '@/ui/theme';

/** Archived kitties (Raj, 20 Nov 2026; not in the wires). Reached from the bottom of home. */
export default function Archived() {
  const [kitties, setKitties] = useState<KittySummary[] | null>(null);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    try {
      setKitties((await loadKittySummaries()).filter((k) => k.archivedAt));
    } catch (e) {
      await explainFailure(e, 'load your archived kitties');
      setFailed(true);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  if (!kitties) {
    return (
      <Screen title="Archived kitties" back>
        {failed ? <CenteredState title="Couldn’t load them" body="Go back and try again." /> : <CenteredState />}
      </Screen>
    );
  }

  return (
    <Screen title="Archived kitties" back>
      <Body>Kitties you’ve archived. Their links still work for your friends. Unarchive one to put it back on your list.</Body>
      {kitties.length === 0 ? (
        <Text style={[type.note, styles.empty]}>Nothing archived.</Text>
      ) : (
        <View style={styles.list}>
          {kitties.map((k) => (
            <View key={k.id} style={styles.row}>
              <Pressable
                style={styles.flex}
                accessibilityRole="button"
                onPress={() => router.push({ pathname: '/kitty/[id]', params: { id: k.id } })}
              >
                <Text style={type.bodyInk}>{k.title}</Text>
                <Text style={type.note}>
                  {k.status === 'closed'
                    ? 'Settled ✓'
                    : `${formatRupees(k.collectedPaise)} of ${formatRupees(k.totalPaise)}, ${k.paidCount} of ${k.memberCount} paid`}
                  {k.archivedAt ? `. Archived ${formatShortDate(k.archivedAt.slice(0, 10))}` : ''}
                </Text>
              </Pressable>
              <SmallButton
                onPress={async () => {
                  const e = await setArchived(k.id, false);
                  if (e) await explainFailure(e, 'unarchive the kitty');
                  await load();
                }}
              >
                Unarchive
              </SmallButton>
            </View>
          ))}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, gap: 2 },
  empty: { paddingVertical: 12 },
  list: { marginTop: 16, borderTopWidth: layout.border, borderTopColor: colors.line },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: layout.border, borderBottomColor: colors.line },
});
