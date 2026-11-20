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

import { useAuth } from '@/lib/auth';

import { colors, fonts, layout, space, TOUCH, type } from './theme';

// ---------------------------------------------------------------------------
// Screen: 56 pt header, 20 pt gutters, footer pinned 20 pt above the bottom.
// ---------------------------------------------------------------------------

interface ScreenProps {
  title: string;
  close?: () => void;
  /** Shows a back arrow and the smaller screen title (e.g. "Enter the code"). */
  back?: boolean;
  /** Right side of the header, e.g. a "Log in" link or the avatar. */
  headerRight?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  /** A tab screen: the tab bar below already keeps clear of the bottom edge. */
  inTabs?: boolean;
  hideAvatar?: boolean;
}

export function Screen({ title, back, close, headerRight, children, footer, inTabs, hideAvatar }: ScreenProps) {
  return (
    <SafeAreaView style={styles.safe} edges={inTabs ? ['top'] : ['top', 'bottom']}>
      <Header title={title} back={back} close={close} right={headerRight} hideAvatar={hideAvatar} />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          {children}
        </ScrollView>
        {footer ? <View style={styles.footer}>{footer}</View> : null}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

export function Header({
  title,
  back,
  close,
  right,
  hideAvatar,
}: {
  title: string;
  back?: boolean;
  /** Shows ✗ instead of ←, for leaving a finished flow (screen 6). */
  close?: () => void;
  right?: ReactNode;
  /** The You picture shows on every screen once logged in (Raj, 20 Nov 2026), except your own details. */
  hideAvatar?: boolean;
}) {
  const { session } = useAuth();
  const avatar = session && !hideAvatar ? <Avatar text="You" onPress={() => router.push('/profile')} /> : null;
  return (
    <View style={styles.header}>
      {back || close ? (
        <Pressable
          onPress={close ?? (() => router.back())}
          accessibilityRole="button"
          accessibilityLabel={close ? 'Close' : 'Back'}
          hitSlop={12}
          style={styles.back}
        >
          <Text style={[type.appTitle, styles.arrow]}>{close ? '✕' : '←'}</Text>
        </Pressable>
      ) : null}
      <Text style={[back || close ? type.screenTitle : type.appTitle, styles.flex]} accessibilityRole="header" numberOfLines={1}>
        {title}
      </Text>
      {right || avatar ? (
        <View style={[styles.headerRight, styles.headerRightRow]}>
          {right}
          {avatar}
        </View>
      ) : null}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Text
// ---------------------------------------------------------------------------

export function Title({ children }: { children: ReactNode }) {
  return (
    <Text style={[type.title, styles.titleGap]} accessibilityRole="header">
      {children}
    </Text>
  );
}

/** Paragraph under a title: 16 pt, 10 pt below it. */
export function Body({ children, ink }: { children: ReactNode; ink?: boolean }) {
  return <Text style={[ink ? type.bodyInk : type.body, styles.bodyGap]}>{children}</Text>;
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
    <Pressable onPress={onPress} disabled={disabled} accessibilityRole="link" hitSlop={12}>
      {/* The wires keep a counting-down link black and underlined; it just can't be tapped yet. */}
      <Text style={type.link}>{children}</Text>
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// Buttons: 51 pt, square corners. Primary is filled ink, secondary is outlined.
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
        <Text style={primary ? [type.button, styles.textOnDark] : [type.buttonSecondary, styles.textInk]}>{children}</Text>
      )}
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// Fields: label, then a 47 pt input 6 pt below it, then an optional hint.
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
        {/* A single symbol (₹) sits tight to the number; "+91" keeps a space after it. */}
        {prefix ? <Text style={[type.input, prefix.length === 1 ? styles.prefixTight : styles.prefix]}>{prefix}</Text> : null}
        <TextInput
          ref={ref}
          style={[type.input, styles.input, style]}
          placeholderTextColor={colors.muted}
          accessibilityLabel={label}
          accessibilityHint={hint}
          {...input}
        />
      </View>
      {error ? <ErrorText>{error}</ErrorText> : hint ? <Text style={[type.small, styles.hint]}>{hint}</Text> : null}
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
      <Text style={type.note}>{children}</Text>
    </View>
  );
}

/** White box with a 1 pt border and 16 pt padding. */
export function Card({ children }: { children: ReactNode }) {
  return <View style={styles.card}>{children}</View>;
}

/** Outlined tag, e.g. "MOMENT" or "GOAL". */
export function Badge({ children }: { children: string }) {
  return (
    <View style={styles.badge}>
      <Text style={type.badge}>{children}</Text>
    </View>
  );
}

export function Avatar({ text, onPress }: { text: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel="Your details" style={styles.avatar}>
      <Text style={[type.meta, styles.avatarText]}>{text}</Text>
    </Pressable>
  );
}

/** Loading, offline and error states share this. */
export function CenteredState({ title, body, action }: { title?: string; body?: string; action?: ReactNode }) {
  return (
    <View style={styles.centered}>
      {title ? <Text style={[type.title, styles.centerText]}>{title}</Text> : <ActivityIndicator color={colors.ink} />}
      {body ? <Text style={[type.body, styles.centerText]}>{body}</Text> : null}
      {action ? <View style={styles.centeredAction}>{action}</View> : null}
    </View>
  );
}

export const Gap = ({ size = 'lg' }: { size?: keyof typeof space }) => <View style={{ height: space[size] }} />;

// ---------------------------------------------------------------------------
// Step 4 building blocks, sized from screens 2 to 4.
// ---------------------------------------------------------------------------

/** Two-option toggle, 44 pt tall (Moment/Goal, Veg/Non-veg, Drinks/Doesn't drink). */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  label: string;
}) {
  return (
    <View style={styles.segmented} accessibilityRole="radiogroup" accessibilityLabel={label}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            accessibilityRole="radio"
            accessibilityState={{ checked: on }}
            style={[styles.segment, on ? styles.segmentOn : styles.segmentOff]}
          >
            <Text style={on ? [type.button, styles.textInk] : [type.buttonSecondary, styles.textInk]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Name pill, 35 pt tall. The organiser's own chip is filled. */
export function Chip({ children, filled, onPress }: { children: string; filled?: boolean; onPress?: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : 'text'}
      style={[styles.chip, filled && styles.chipFilled]}
    >
      <Text style={type.meta}>{children}</Text>
    </Pressable>
  );
}

/** Dashed full-width button, 46 pt tall ("Add or edit people"). */
export function DashedButton({ children, onPress }: { children: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={({ pressed }) => [styles.dashedButton, pressed && styles.buttonPressed]}>
      <Text style={[type.meta, styles.centerText]}>{children}</Text>
    </Pressable>
  );
}

/** Small outlined button, 44 pt tall ("Adjust", "Edit message"). */
export function SmallButton({ children, onPress, disabled }: { children: string; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      style={({ pressed }) => [styles.smallButton, disabled && styles.buttonDisabled, pressed && styles.buttonPressed]}
    >
      <Text style={type.meta}>{children}</Text>
    </Pressable>
  );
}

/** Light grey explanation box (screen 4: "You set Aisha to ₹600..."). */
export function InfoBox({ children }: { children: ReactNode }) {
  return (
    <View style={styles.infoBox}>
      <Text style={type.note}>{children}</Text>
    </View>
  );
}

/** A full-width row with a rule underneath (screen 3 "In this kitty", screen 24). */
export function Row({ left, right, onPress }: { left: string; right?: string; onPress?: () => void }) {
  return (
    <Pressable onPress={onPress} disabled={!onPress} accessibilityRole={onPress ? 'button' : 'text'} style={styles.row}>
      <Text style={[type.bodyInk, styles.flex]} numberOfLines={1}>
        {left}
      </Text>
      {right ? <Text style={type.note}>{right}</Text> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  safe: { flex: 1, backgroundColor: colors.page },
  header: {
    height: layout.headerHeight,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: layout.gutter,
    backgroundColor: colors.surface,
    borderBottomWidth: layout.border,
    borderBottomColor: colors.line,
  },
  back: { width: layout.backWidth, minHeight: TOUCH, justifyContent: 'center' },
  arrow: { fontFamily: fonts.regular },
  headerRightRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  headerRight: { marginLeft: space.md },
  body: { paddingHorizontal: layout.gutter, paddingTop: layout.top, paddingBottom: space.xl, flexGrow: 1 },
  footer: { paddingHorizontal: layout.gutter, paddingTop: space.lg, paddingBottom: layout.gutter, gap: space.lg },
  // Measured against screens 19 to 21: titles sit 5 pt lower, paragraphs 6 pt under them.
  titleGap: { marginTop: 5 },
  bodyGap: { marginTop: 6 },
  error: { fontFamily: type.small.fontFamily, color: colors.danger, fontSize: 14, lineHeight: 20, marginTop: 6 },
  button: {
    height: layout.buttonHeight,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space.lg,
    borderWidth: layout.border,
  },
  buttonPrimary: { backgroundColor: colors.action, borderColor: colors.action },
  buttonSecondary: { backgroundColor: colors.surface, borderColor: colors.line },
  buttonDisabled: { opacity: 0.4 },
  buttonPressed: { opacity: 0.8 },
  textOnDark: { color: colors.inkOnDark },
  textInk: { color: colors.ink },
  field: { marginTop: 14 },
  inputBox: {
    marginTop: 6,
    height: layout.inputHeight,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: layout.border,
    borderColor: colors.line,
    borderRadius: layout.radius,
    paddingHorizontal: 12,
  },
  inputBoxError: { borderColor: colors.danger },
  prefix: { marginRight: 5 },
  prefixTight: { marginRight: 1 },
  input: { flex: 1, height: '100%', paddingVertical: 0 },
  hint: { marginTop: 7 },
  note: {
    borderWidth: layout.border,
    borderStyle: 'dashed',
    borderColor: colors.line,
    paddingHorizontal: 13,
    paddingVertical: 14,
  },
  card: {
    backgroundColor: colors.surface,
    borderWidth: layout.border,
    borderColor: colors.line,
    padding: layout.cardPadding,
  },
  badge: {
    height: 23,
    justifyContent: 'center',
    paddingHorizontal: 6,
    borderWidth: layout.border,
    borderColor: colors.line,
    borderRadius: layout.radius,
  },
  avatar: {
    width: layout.avatar,
    height: layout.avatar,
    borderRadius: layout.avatar / 2,
    borderWidth: layout.border,
    borderColor: colors.line,
    backgroundColor: colors.sunken,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontFamily: type.bodyBold.fontFamily },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: layout.gutter, gap: space.sm },
  centeredAction: { marginTop: space.lg, alignSelf: 'stretch' },
  centerText: { textAlign: 'center' },
  segmented: { flexDirection: 'row', height: 44 },
  segment: { flex: 1, alignItems: 'center', justifyContent: 'center', borderWidth: layout.border },
  segmentOn: { backgroundColor: colors.selected, borderColor: colors.selected },
  segmentOff: { backgroundColor: colors.surface, borderColor: colors.line },
  chip: {
    height: 35,
    justifyContent: 'center',
    paddingHorizontal: 12,
    borderWidth: layout.border,
    borderColor: colors.line,
    borderRadius: 17.5,
    backgroundColor: colors.surface,
  },
  chipFilled: { backgroundColor: colors.selected, borderColor: colors.selected },
  dashedButton: {
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: layout.border,
    borderStyle: 'dashed',
    borderColor: colors.line,
    paddingHorizontal: 12,
  },
  smallButton: {
    height: 44,
    justifyContent: 'center',
    paddingHorizontal: 15,
    borderWidth: layout.border,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  infoBox: { backgroundColor: colors.sunken, paddingHorizontal: 12, paddingVertical: 9 },
  row: {
    minHeight: 49,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderBottomWidth: layout.border,
    borderBottomColor: colors.line,
  },
});
