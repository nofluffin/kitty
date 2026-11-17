import { useRef } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import type { TextInputRef } from './components';

import { colors, layout, type } from './theme';

/**
 * Six boxes backed by one hidden input, so paste and the phone's
 * "fill code from messages" suggestion both work (screen 20).
 */
export function CodeInput({
  value,
  onChange,
  length = 6,
  invalid,
}: {
  value: string;
  onChange: (code: string) => void;
  length?: number;
  invalid?: boolean;
}) {
  const input = useRef<TextInputRef>(null);
  const digits = value.split('');

  return (
    <Pressable onPress={() => input.current?.focus()} accessible={false}>
      <View style={styles.row} importantForAccessibility="no-hide-descendants">
        {Array.from({ length }, (_, i) => (
          <View
            key={i}
            style={[styles.box, i === digits.length && styles.boxActive, invalid && styles.boxInvalid]}
          >
            <Text style={type.codeDigit}>{digits[i] ?? ''}</Text>
          </View>
        ))}
      </View>
      <TextInput
        ref={input}
        value={value}
        onChangeText={(text) => onChange(text.replace(/\D/g, '').slice(0, length))}
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        autoComplete="one-time-code"
        maxLength={length}
        autoFocus
        accessibilityLabel={`${length} digit code`}
        style={styles.hidden}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // Six 47 x 55 boxes spread across the 350 pt content width (60 pt apart), 20 pt below the text.
  row: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 20 },
  box: {
    width: 47,
    height: 55,
    borderWidth: layout.border,
    borderColor: colors.line,
    borderRadius: layout.radius,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxActive: { borderColor: colors.ink, borderWidth: 2 },
  boxInvalid: { borderColor: colors.danger },
  // Kept on screen (not display: none) so the OS still offers code autofill.
  hidden: { position: 'absolute', opacity: 0, width: 1, height: 1 },
});
