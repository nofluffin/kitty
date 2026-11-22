import Feather from '@expo/vector-icons/Feather';
import { formatRupees, formatShortDate } from '@kitty/core';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Label } from './components';
import { colors, layout, type } from './theme';

/**
 * Editing a kitty in three parts (Raj, 22 Nov 2026), so each screen does one job:
 * Details (name, total, date, UPI ID), People, and Amounts. Shown until someone pays.
 */
export function EditRows({
  kitty,
}: {
  kitty: { id: string; totalPaise: number; dueDate: string | null; members: unknown[] };
}) {
  const people = kitty.members.length;
  const details = [kitty.totalPaise ? formatRupees(kitty.totalPaise) : 'No amount yet', kitty.dueDate ? `by ${formatShortDate(kitty.dueDate)}` : 'no date yet'];
  const rows = [
    { label: 'Details', note: details.join(', '), path: '/new' as const },
    { label: 'People', note: `${people} ${people === 1 ? 'person' : 'people'}`, path: '/new/person' as const },
    // Amounts need a total to share out.
    { label: 'Amounts', note: kitty.totalPaise ? 'Who pays what' : 'Add an amount first', path: '/new/shares' as const, off: !kitty.totalPaise },
  ];
  return (
    <View>
      <Label>Nobody has paid yet, so you can still edit</Label>
      <View style={styles.list}>
        {rows.map((r) => (
          <Pressable
            key={r.label}
            disabled={r.off}
            onPress={() => router.push({ pathname: r.path, params: { edit: kitty.id } })}
            accessibilityRole="button"
            accessibilityLabel={`Edit ${r.label.toLowerCase()}, ${r.note}`}
            accessibilityState={{ disabled: !!r.off }}
            style={({ pressed }) => [styles.row, pressed && styles.pressed, r.off && styles.off]}
          >
            <Text style={[type.bodyInk, styles.label]} numberOfLines={1}>
              {r.label}
            </Text>
            <Text style={[type.note, styles.note]} numberOfLines={1}>
              {r.note}
            </Text>
            <Feather name="chevron-right" size={18} color={colors.muted} />
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  list: { marginTop: 8, borderTopWidth: layout.border, borderTopColor: colors.line },
  row: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderBottomWidth: layout.border,
    borderBottomColor: colors.line,
  },
  label: { flexShrink: 0 },
  note: { flex: 1, textAlign: 'right' },
  pressed: { opacity: 0.6 },
  off: { opacity: 0.4 },
});
