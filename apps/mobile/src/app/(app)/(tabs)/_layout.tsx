import Feather from '@expo/vector-icons/Feather';
import { Tabs, type BottomTabBarProps } from 'expo-router/tabs';
import type { ComponentProps } from 'react';
import { useEffect, useState } from 'react';
import { AppState, Pressable, StyleSheet, Text, View } from 'react-native';

import { countWaiting } from '@/lib/activity';
import { colors, layout, type } from '@/ui/theme';

/**
 * The footer (decided with Raj, 20 Nov 2026): Kitties, Groups, Activity and Help, each with a line icon (Groups added 20 Nov; You is the picture at the top right).
 * Only on these three screens; creating a kitty, scanning, settling up and a
 * kitty's feed open on top without it, so they stay focused.
 */
export default function TabsLayout() {
  return (
    <Tabs screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: colors.page } }} tabBar={(props) => <TabBar {...props} />}>
      <Tabs.Screen name="home" options={{ title: 'Kitties' }} />
      <Tabs.Screen name="groups" options={{ title: 'Groups' }} />
      <Tabs.Screen name="activity" options={{ title: 'Activity' }} />
      <Tabs.Screen name="help" options={{ title: 'Help' }} />
    </Tabs>
  );
}

/** Line icons for each tab (Raj, 20 Nov 2026). */
const ICONS: Record<string, ComponentProps<typeof Feather>['name']> = { home: 'layers', groups: 'users', activity: 'bell', help: 'help-circle' };

function TabBar({ state, descriptors, emitter, navigateToTab, insets }: BottomTabBarProps) {
  const waiting = useWaitingCount(state.index);

  return (
    <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, 8) }]} accessibilityRole="tablist">
      {state.routes.map((route, i) => {
        const focused = state.index === i;
        const label = descriptors[route.key]!.options.title ?? route.name;
        const count = route.name === 'activity' ? waiting : 0;
        return (
          <Pressable
            key={route.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: focused }}
            accessibilityLabel={count > 0 ? `${label}, ${count} waiting` : label}
            onPress={() => {
              const event = emitter.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
              if (!focused && !event.defaultPrevented) navigateToTab(route.key);
            }}
            style={[styles.tab, focused && styles.tabOn]}
          >
            <View style={styles.iconRow}>
              <Feather name={ICONS[route.name] ?? 'circle'} size={20} color={focused ? colors.ink : colors.muted} />
              {count > 0 ? (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{count > 9 ? '9+' : count}</Text>
                </View>
              ) : null}
            </View>
            <View style={styles.labelRow}>
              <Text style={[focused ? type.bodyBold : type.body, styles.label]}>{label}</Text>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Payments waiting for the organiser, refreshed on every tab change and when the app comes back. */
function useWaitingCount(tabIndex: number): number {
  const [count, setCount] = useState(0);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => s === 'active' && setTick((t) => t + 1));
    return () => sub.remove();
  }, []);
  useEffect(() => {
    let current = true;
    countWaiting()
      .then((n) => current && setCount(n))
      .catch(() => {});
    return () => {
      current = false;
    };
  }, [tabIndex, tick]);
  return count;
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderTopWidth: layout.border,
    borderTopColor: colors.line,
  },
  iconRow: { flexDirection: 'row', alignItems: 'flex-start', height: 22 },
  label: { fontSize: 13, lineHeight: 18 },
  tab: { flex: 1, alignItems: 'center', gap: 2, paddingTop: 10, paddingBottom: 2, borderTopWidth: 2, borderTopColor: 'transparent', marginTop: -1 },
  tabOn: { borderTopColor: colors.ink },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  badge: { position: 'absolute', left: 14, top: -4, minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 4, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  badgeText: { ...type.small, fontFamily: type.bodyBold.fontFamily, color: colors.surface },
});
