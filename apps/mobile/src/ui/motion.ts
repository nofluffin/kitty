import { useEffect } from 'react';
import { Platform } from 'react-native';
import { Easing, FadeIn, FadeOut, Keyframe, LinearTransition, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

/**
 * Motion rules (Raj, 21 Nov 2026), the same as his other app:
 * - Opening decelerates into place; closing accelerates away and is quicker.
 * - Only opacity and transform move. The one exception is collapsible sections, whose
 *   neighbours ease into their new place.
 * - Short and quiet: nothing bounces or overshoots.
 * - Reduce Motion on the phone (or prefers-reduced-motion on the web) skips it all: Reanimated's
 *   animations follow the system setting by default, so everything appears in its final place.
 * - Animations only describe where things start. Their normal styles are where they end.
 */

export const ease = {
  open: Easing.bezier(0, 0, 0.2, 1),
  close: Easing.bezier(0.4, 0, 1, 1),
  out: Easing.bezier(0.2, 0.8, 0.3, 1),
  std: Easing.bezier(0.4, 0, 0.2, 1),
} as const;

/** Milliseconds. */
export const dur = { open: 220, close: 170, fast: 120, base: 180 } as const;

/**
 * Entering and exiting animations run on the phones only. On the web (app.thekitty.app),
 * Reanimated 4.7 leaves elements with these hidden, so there they simply appear in place.
 */
const native = Platform.OS !== 'web';

export const fadeIn = native ? FadeIn.duration(dur.open).easing(ease.open) : undefined;
export const fadeOut = native ? FadeOut.duration(dur.close).easing(ease.close) : undefined;

/** Lists and cards arriving: up 4 pt and in. */
export const riseIn = !native ? undefined : new Keyframe({
  0: { opacity: 0, transform: [{ translateY: 4 }] },
  100: { opacity: 1, transform: [{ translateY: 0 }], easing: ease.open },
}).duration(dur.open);

/** Messages arriving under the header: down 6 pt, a touch small, and in. */
export const popIn = !native ? undefined : new Keyframe({
  0: { opacity: 0, transform: [{ translateY: -6 }, { scale: 0.985 }] },
  100: { opacity: 1, transform: [{ translateY: 0 }, { scale: 1 }], easing: ease.open },
}).duration(dur.open);

/** Messages leaving: quicker, accelerating away the way they came. */
export const popOut = !native ? undefined : new Keyframe({
  0: { opacity: 1, transform: [{ translateY: 0 }, { scale: 1 }] },
  100: { opacity: 0, transform: [{ translateY: -6 }, { scale: 0.985 }], easing: ease.close },
}).duration(dur.close);

/** Rows below an opening or closing section ease into their new place. */
export const settle = native ? LinearTransition.duration(dur.open).easing(ease.open) : undefined;

/**
 * A quick fade while a button is held, easing back on release. `rest` is the opacity when
 * not pressed (lower for a disabled button).
 */
export function usePressFade(rest = 1) {
  const opacity = useSharedValue(rest);
  useEffect(() => {
    opacity.set(withTiming(rest, { duration: dur.base, easing: ease.std }));
  }, [rest, opacity]);
  const style = useAnimatedStyle(() => ({ opacity: opacity.get() }));
  return {
    style,
    onPressIn: () => opacity.set(withTiming(rest * 0.8, { duration: dur.fast, easing: ease.std })),
    onPressOut: () => opacity.set(withTiming(rest, { duration: dur.base, easing: ease.out })),
  };
}
