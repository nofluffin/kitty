import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { AccessibilityInfo, StyleSheet, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { popIn, popOut } from '@/ui/motion';
import { colors, layout, type } from '@/ui/theme';

/**
 * A short message after an action, like "School deleted for everyone" (Raj, 21 Nov 2026).
 * It shows just under the page header for a few seconds, clear of footer buttons and the
 * tab bar, then goes.
 */

const SHOW_FOR = 2600;

const Context = createContext<(message: string) => void>(() => {});

export function useToast() {
  return useContext(Context);
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const insets = useSafeAreaInsets();
  const [toast, setToast] = useState<{ id: number; message: string } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const nextId = useRef(1);

  const show = useCallback((message: string) => {
    if (timer.current) clearTimeout(timer.current);
    setToast({ id: nextId.current++, message });
    AccessibilityInfo.announceForAccessibility(message);
    timer.current = setTimeout(() => setToast(null), SHOW_FOR);
  }, []);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  return (
    <Context.Provider value={show}>
      {children}
      <View pointerEvents="none" style={[styles.layer, { top: insets.top + TOP }]}>
        {toast ? (
          <Animated.View key={toast.id} entering={popIn} exiting={popOut} style={styles.toast} accessibilityLiveRegion="polite">
            <Text style={[type.meta, styles.text]}>{toast.message}</Text>
          </Animated.View>
        ) : null}
      </View>
    </Context.Provider>
  );
}

/** Just under the 56 pt header. */
const TOP = 56 + 12;

const styles = StyleSheet.create({
  layer: { position: 'absolute', left: layout.gutter, right: layout.gutter, alignItems: 'center', zIndex: 1000, elevation: 8 },
  toast: { backgroundColor: colors.ink, paddingHorizontal: 16, paddingVertical: 12, maxWidth: '100%' },
  text: { color: colors.inkOnDark, textAlign: 'center' },
});
