import Feather from '@expo/vector-icons/Feather';
import { distinctNames, youLabel } from '@kitty/core';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { useAuth } from '@/lib/auth';
import { explainFailure } from '@/lib/errors';
import { loadGroups, setFavourite, type SavedGroup } from '@/lib/groups';

import { CenteredState } from './components';
import { riseIn, settle } from './motion';
import { colors, layout, type } from './theme';

const RECENT = 3;

/**
 * The groups screen (Raj, 20 Nov 2026): favourites, recently used, then all groups,
 * each with a star. Tapping a group opens it, where it can be shared, changed, left or deleted
 * (Raj, 22 Nov 2026: no Share and Edit buttons on the list). With onUse, tapping a group picks it.
 */
export function GroupsList({ onUse }: { onUse?: (g: SavedGroup) => void }) {
  const { profile } = useAuth();
  const [groups, setGroups] = useState<SavedGroup[] | null>(null);

  const load = useCallback(async () => {
    setGroups(await loadGroups().catch(() => []));
  }, []);
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  if (!groups) return <CenteredState />;
  if (groups.length === 0) {
    return (
      <CenteredState
        title="No groups yet"
        body="Tap “New group”, or save the people in a kitty as a group. Groups friends share with you show here too."
      />
    );
  }

  const favourites = groups.filter((g) => g.favourite);
  const recent = groups
    .filter((g) => !g.favourite && g.lastUsedAt)
    .sort((a, b) => (b.lastUsedAt ?? '').localeCompare(a.lastUsedAt ?? ''))
    .slice(0, RECENT);
  const shown = new Set([...favourites, ...recent].map((g) => g.id));
  const rest = groups.filter((g) => !shown.has(g.id));

  const edit = (g: SavedGroup) => router.push({ pathname: '/new-group', params: { edit: g.id } });

  async function star(g: SavedGroup) {
    const e = await setFavourite(g.id, !g.favourite);
    if (e) await explainFailure(e, 'change the favourite');
    await load();
  }

  const section = (title: string, list: SavedGroup[]) =>
    list.length === 0 ? null : (
      <View style={styles.section}>
        <Text style={type.label}>{title}</Text>
        <View style={styles.list}>
          {list.map((g) => (
            <Animated.View key={g.id} style={styles.row} entering={riseIn} layout={settle}>
              <Pressable
                onPress={() => star(g)}
                accessibilityRole="button"
                accessibilityLabel={g.favourite ? `Remove ${g.name} from favourites` : `Add ${g.name} to favourites`}
                hitSlop={8}
                style={styles.star}
              >
                <Text style={[type.bodyInk, styles.starText]}>{g.favourite ? '★' : '☆'}</Text>
              </Pressable>
              {/* Raj, 21 Nov 2026: tapping a group opens it to edit (or picks it, on a new kitty). */}
              <Pressable
                style={({ pressed }) => [styles.open, pressed && styles.pressed]}
                onPress={() => (onUse ? onUse(g) : edit(g))}
                accessibilityRole="button"
                accessibilityLabel={onUse ? `Add ${g.name}` : `Open ${g.name}`}
              >
                <View style={styles.flex}>
                  <Text style={type.bodyInk}>{g.name}</Text>
                  <Text style={type.note}>
                    {/* Raj, 21 Nov 2026: your name, with (You), rather than just You. */}
                    {distinctNames(g.people)
                      .map((label, i) => (g.people[i]!.profileId === profile?.id ? youLabel(profile?.name || g.people[i]!.name) : label))
                      .join(', ')}
                    {g.createdBy.id === profile?.id ? '' : `. From ${g.createdBy.name || 'a friend'}`}
                  </Text>
                </View>
                <Feather name="chevron-right" size={18} color={colors.muted} />
              </Pressable>
            </Animated.View>
          ))}
        </View>
      </View>
    );

  return (
    <View>
      {onUse ? <Text style={[type.body, styles.intro]}>Tap a group to add everyone in it. You can still add or remove people after.</Text> : null}
      {section('Favourites', favourites)}
      {section('Recent', recent)}
      {section(favourites.length + recent.length > 0 ? 'All groups' : 'Your groups', rest)}
    </View>
  );
}

const styles = StyleSheet.create({
  intro: { marginBottom: 16 },
  section: { marginBottom: 24 },
  list: { marginTop: 10, borderTopWidth: layout.border, borderTopColor: colors.line },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, borderBottomWidth: layout.border, borderBottomColor: colors.line },
  star: { width: 28, alignItems: 'center' },
  starText: { fontSize: 22, lineHeight: 26 },
  open: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  flex: { flex: 1, gap: 2 },
  pressed: { opacity: 0.6 },
});
