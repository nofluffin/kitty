import Feather from '@expo/vector-icons/Feather';
import type { ComponentProps } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { colors, layout, type } from './theme';

/**
 * Why Kitty (Raj, 21 Nov 2026): what it saves you from, at the top of Help and on an empty
 * Kitties tab. Only claims what the app actually does.
 */

type IconName = ComponentProps<typeof Feather>['name'];

const POINTS: { icon: IconName; title: string; body: string }[] = [
  { icon: 'smartphone', title: 'Only you need the app', body: 'Friends pay from a WhatsApp link. No app to install, nothing to sign up for.' },
  { icon: 'arrow-down-circle', title: 'Money comes straight to you', body: 'Every share lands in your UPI. Kitty never holds it.' },
  { icon: 'file-text', title: 'Fair splits, no maths', body: 'Scan the bill. Veg eaters skip the Non-Veg dishes, and only people having Alcohol pay for it.' },
  { icon: 'bell', title: 'No chasing', body: 'See who’s paid at a glance. Kitty sends the reminders, so you don’t have to.' },
  { icon: 'users', title: 'Set up once', body: 'Save your groups, pay for a child or partner, or collect for a goal in parts.' },
];

export function WhyKitty({ boxed }: { boxed?: boolean }) {
  return (
    <View style={[styles.wrap, boxed && styles.box]} accessibilityRole="summary">
      {POINTS.map((p) => (
        <View key={p.title} style={styles.point}>
          <View style={styles.icon}>
            <Feather name={p.icon} size={18} color={colors.ink} />
          </View>
          <View style={styles.text}>
            <Text style={type.bodyBold}>{p.title}</Text>
            <Text style={type.note}>{p.body}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 14 },
  box: { borderWidth: layout.border, borderColor: colors.line, backgroundColor: colors.surface, padding: layout.cardPadding },
  point: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  icon: { width: 22, paddingTop: 2, alignItems: 'center' },
  text: { flex: 1, gap: 2 },
});
