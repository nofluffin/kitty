import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Linking, Platform, Pressable, Share, StyleSheet, Text, View } from 'react-native';

import { ask } from '@/lib/ask';
import { useAuth } from '@/lib/auth';
import { config } from '@/lib/config';
import { explainFailure } from '@/lib/errors';
import { leaveGroup, loadGroups, setFavourite, type SavedGroup } from '@/lib/groups';

import { CenteredState, SmallButton } from './components';
import { colors, layout, type } from './theme';

const RECENT = 3;

/**
 * The groups screen (Raj, 20 Nov 2026): favourites, recently used, then all groups,
 * each with a star, Share and Leave. With onUse, tapping a group picks it.
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

  async function share(g: SavedGroup) {
    const text = `${profile?.name || 'I'} shared the group ${g.name} on Kitty. Open this to add it to your Kitty: ${config.memberPageUrl}/g/${g.shareToken}`;
    try {
      await Linking.openURL(`https://wa.me/?text=${encodeURIComponent(text)}`);
    } catch {
      if (Platform.OS !== 'web') await Share.share({ message: text });
    }
  }

  async function leave(g: SavedGroup) {
    if (!(await ask(`Leave ${g.name}?`, 'It goes from your groups. Anyone else who has it keeps it.', 'Leave'))) return;
    const e = await leaveGroup(g.id);
    if (e) await explainFailure(e, 'leave the group');
    await load();
  }

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
            <View key={g.id} style={styles.row}>
              <Pressable
                onPress={() => star(g)}
                accessibilityRole="button"
                accessibilityLabel={g.favourite ? `Remove ${g.name} from favourites` : `Add ${g.name} to favourites`}
                hitSlop={8}
                style={styles.star}
              >
                <Text style={[type.bodyInk, styles.starText]}>{g.favourite ? '★' : '☆'}</Text>
              </Pressable>
              <Pressable
                style={styles.flex}
                disabled={!onUse}
                onPress={() => onUse?.(g)}
                accessibilityRole={onUse ? 'button' : 'text'}
                accessibilityLabel={onUse ? `Add ${g.name}` : g.name}
              >
                <Text style={type.bodyInk}>{g.name}</Text>
                <Text style={type.note}>
                  {g.people.map((p) => (p.profileId === profile?.id ? 'You' : p.name)).join(', ')}
                  {g.createdBy.id === profile?.id ? '' : `. From ${g.createdBy.name || 'a friend'}`}
                </Text>
              </Pressable>
              <View style={styles.actions}>
                <SmallButton onPress={() => share(g)}>Share</SmallButton>
                <SmallButton onPress={() => leave(g)}>Leave</SmallButton>
              </View>
            </View>
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
  flex: { flex: 1, gap: 2 },
  actions: { flexDirection: 'row', gap: 6 },
});
