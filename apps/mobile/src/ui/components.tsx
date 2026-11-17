import { router } from 'expo-router';
import type { ComponentRef, ReactNode, Ref } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, space, TOUCH, type } from './theme';

// ---------------------------------------------------------------------------
// Screen: header, scrolling body and a footer pinned above the keyboard.
// ---------------------------------------------------------------------------

interface ScreenProps {
  title: string;
  /** Shows a back arrow. */
  back?: boolean;
  /** Right side of the header, e.g. a "Log in" link or the avatar. */
  headerRight?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}

export function Screen({ title, back, headerRight, children, footer }: ScreenProps) {
  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        {back ? (
          <Pressable
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Back"
            hitSlop={12}
            style={styles.back}
          >
            <Text style={styles.backArrow}>←</Text>
          </Pressable>
        ) : null}
        <Text style={styles.headerTitle} accessibilityRole="header" numberOfLines={1}>
          {title}
        </Text>
        <View style={styles.headerRight}>{headerRight}</View>
      </View>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          {children}
        </ScrollView>
        {footer ? <View style={styles.footer}>{footer}</View> : null}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// Text
// ---------------------------------------------------------------------------

export function Title({ children }: { children: ReactNode }) {
  return (
    <Text style={type.title} accessibilityRole="header">
      {children}
    </Text>
  );
}

export function Body({ children, ink }: { children: ReactNode; ink?: boolean }) {
  return <Text style={[ink ? type.bodyInk : type.body, styles.mtXs]}>{children}</Text>;
}

export function Small({ children }: { children: ReactNode }) {
  return <Text style={type.small}>{children}</Text>;
}

export function Label({ children }: { children: ReactNode }) {
  return <Text style={type.label}>{children}</Text>;
}

export function ErrorText({ children }: { children: ReactNode }) {
  if (!children) return null;
  return (
    <Text style={styles.error} accessibilityRole="alert" accessibilityLiveRegion="polite">
      {children}
    </Text>
  );
}

export function TextLink({ children, onPress, disabled }: { children: ReactNode; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable onPress={onPress} disabled={disabled} accessibilityRole="link" hitSlop={10}>
      <Text style={[styles.link, disabled && styles.linkDisabled]}>{children}</Text>
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// Buttons
// ---------------------------------------------------------------------------

interface ButtonProps {
  children: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary';
  disabled?: boolean;
  loading?: boolean;
}

export function Button({ children, onPress, variant = 'primary', disabled, loading }: ButtonProps) {
  const primary = variant === 'primary';
  const inactive = disabled || loading;
  return (
    <Pressable
      onPress={onPress}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!inactive, busy: !!loading }}
      style={({ pressed }) => [
        styles.button,
        primary ? styles.buttonPrimary : styles.buttonSecondary,
        inactive && styles.buttonDisabled,
        pressed && !inactive && styles.buttonPressed,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={primary ? colors.inkOnDark : colors.ink} />
      ) : (
        <Text style={[styles.buttonText, primary ? styles.buttonTextPrimary : styles.buttonTextSecondary]}>
          {children}
        </Text>
      )}
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// Fields
// ---------------------------------------------------------------------------

export type TextInputRef = ComponentRef<typeof TextInput>;

interface FieldProps extends TextInputProps {
  ref?: Ref<TextInputRef>;
  label: string;
  hint?: string;
  error?: string | null;
  /** Fixed text before the input, e.g. "+91". */
  prefix?: string;
}

export function Field({ ref, label, hint, error, prefix, style, ...input }: FieldProps) {
  return (
    <View style={styles.field}>
      <Label>{label}</Label>
      <View style={[styles.inputBox, error ? styles.inputBoxError : null]}>
        {prefix ? <Text style={styles.prefix}>{prefix}</Text> : null}
        <TextInput
          ref={ref}
          style={[styles.input, style]}
          placeholderTextColor={colors.faint}
          accessibilityLabel={label}
          accessibilityHint={hint}
          {...input}
        />
      </View>
      {error ? <ErrorText>{error}</ErrorText> : hint ? <Text style={[type.small, styles.mtXs]}>{hint}</Text> : null}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Containers
// ---------------------------------------------------------------------------

/** Dashed box for explanations, as in the wireframes. */
export function Note({ children }: { children: ReactNode }) {
  return (
    <View style={styles.note}>
      <Text style={type.small}>{children}</Text>
    </View>
  );
}

export function Card({ children }: { children: ReactNode }) {
  return <View style={styles.card}>{children}</View>;
}

export function Avatar({ text, onPress }: { text: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel="Your details" style={styles.avatar}>
      <Text style={styles.avatarText}>{text}</Text>
    </Pressable>
  );
}

/** Loading, offline and error states share this. */
export function CenteredState({ title, body, action }: { title?: string; body?: string; action?: ReactNode }) {
  return (
    <View style={styles.centered}>
      {title ? <Text style={type.heading}>{title}</Text> : <ActivityIndicator color={colors.ink} />}
      {body ? <Text style={[type.body, styles.centerText]}>{body}</Text> : null}
      {action ? <View style={styles.mtLg}>{action}</View> : null}
    </View>
  );
}

export const Gap = ({ size = 'lg' }: { size?: keyof typeof space }) => <View style={{ height: space[size] }} />;

const styles = StyleSheet.create({
  flex: { flex: 1 },
  safe: { flex: 1, backgroundColor: colors.page },
  header: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space.xl,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  back: { marginRight: space.md, minWidth: 32, minHeight: TOUCH, justifyContent: 'center' },
  backArrow: { fontSize: 24, color: colors.ink },
  headerTitle: { flex: 1, fontSize: 20, fontWeight: '700', color: colors.ink },
  headerRight: { marginLeft: space.md },
  body: { padding: space.xl, flexGrow: 1 },
  footer: { paddingHorizontal: space.xl, paddingTop: space.md, paddingBottom: space.lg, gap: space.md },
  mtXs: { marginTop: space.xs },
  mtLg: { marginTop: space.lg },
  error: { color: colors.danger, fontSize: 14, marginTop: space.xs },
  link: { color: colors.ink, fontSize: 15, textDecorationLine: 'underline', paddingVertical: space.xs },
  linkDisabled: { color: colors.faint, textDecorationLine: 'none' },
  button: {
    minHeight: 56,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space.lg,
    borderWidth: 1,
  },
  buttonPrimary: { backgroundColor: colors.ink, borderColor: colors.ink },
  buttonSecondary: { backgroundColor: colors.surface, borderColor: colors.line },
  buttonDisabled: { opacity: 0.4 },
  buttonPressed: { opacity: 0.8 },
  buttonText: { fontSize: 16 },
  buttonTextPrimary: { color: colors.inkOnDark, fontWeight: '700' },
  buttonTextSecondary: { color: colors.ink },
  field: { marginTop: space.lg },
  inputBox: {
    marginTop: space.sm,
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    paddingHorizontal: space.md,
  },
  inputBoxError: { borderColor: colors.danger },
  prefix: { fontSize: 17, color: colors.ink, marginRight: space.sm },
  input: { flex: 1, fontSize: 17, color: colors.ink, paddingVertical: space.md },
  note: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.line,
    padding: space.lg,
  },
  card: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, padding: space.lg },
  avatar: {
    width: TOUCH,
    height: TOUCH,
    borderRadius: TOUCH / 2,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.sunken,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: 14, fontWeight: '700', color: colors.ink },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: space.xl, gap: space.sm },
  centerText: { textAlign: 'center' },
});
