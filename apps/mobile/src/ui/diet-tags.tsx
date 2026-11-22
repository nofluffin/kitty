import Feather from '@expo/vector-icons/Feather';
import type { Diet } from '@kitty/core';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, layout, type } from './theme';

/** Raj, 21 Nov 2026: Veg green, Non-Veg red, Alcohol black, No Alcohol stone, all white text. */
const TONE = {
  veg: { backgroundColor: colors.veg, borderColor: colors.veg },
  nonVeg: { backgroundColor: colors.nonVeg, borderColor: colors.nonVeg },
  alcohol: { backgroundColor: colors.ink, borderColor: colors.ink },
  noAlcohol: { backgroundColor: colors.selected, borderColor: colors.selected },
} as const;

function Tag({ children, tone }: { children: string; tone: keyof typeof TONE }) {
  return (
    <View style={[styles.tag, TONE[tone]]}>
      <Text style={styles.tagText}>{children}</Text>
    </View>
  );
}

/** Someone's food and drink as two pills. */
export function DietTags({ diet, drinks }: { diet: Diet; drinks: boolean }) {
  return (
    <View style={styles.tags}>
      <Tag tone={diet === 'veg' ? 'veg' : 'nonVeg'}>{diet === 'veg' ? 'Veg' : 'Non-Veg'}</Tag>
      {drinks ? <Tag tone="alcohol">Alcohol</Tag> : <Tag tone="noAlcohol">No Alcohol</Tag>}
    </View>
  );
}

/**
 * A person in a list of people (Raj, 22 Nov 2026): name, their pills underneath, and an arrow
 * so it's clear the row opens them.
 */
export function PersonRow({
  name,
  diet,
  drinks,
  note,
  current,
  onPress,
}: {
  name: string;
  diet: Diet;
  drinks: boolean;
  /** Extra line, like who pays for them. */
  note?: string | null;
  /** The person being edited right now: greyed out, and not tappable (Raj, 22 Nov 2026). */
  current?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={current}
      accessibilityState={{ disabled: !!current, selected: !!current }}
      accessibilityRole="button"
      accessibilityLabel={`${name}, ${diet === 'veg' ? 'Veg' : 'Non-Veg'}, ${drinks ? 'Alcohol' : 'No Alcohol'}${note ? `, ${note}` : ''}`}
      style={({ pressed }) => [styles.row, pressed && styles.pressed, current && styles.current]}
    >
      <View style={styles.text}>
        <Text style={type.bodyInk} numberOfLines={1}>
          {name}
        </Text>
        <DietTags diet={diet} drinks={drinks} />
        {note ? <Text style={type.note}>{note}</Text> : null}
      </View>
      <Feather name="chevron-right" size={18} color={colors.muted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tags: { flexDirection: 'row', gap: 6 },
  tag: { borderWidth: layout.border, borderRadius: 3, paddingHorizontal: 7, height: 22, justifyContent: 'center' },
  // A size down from small text, so the pills don't look tight (Raj, 21 Nov 2026).
  tagText: { ...type.small, fontSize: 11, lineHeight: 14, color: colors.inkOnDark },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: layout.border,
    borderBottomColor: colors.line,
  },
  text: { flex: 1, gap: 6 },
  pressed: { opacity: 0.6 },
  current: { opacity: 0.4 },
});
