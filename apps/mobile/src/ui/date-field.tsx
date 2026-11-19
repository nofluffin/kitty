import { addDays, formatShortDate, parseIsoDate } from '@kitty/core';
import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { ErrorText, Label } from './components';
import { colors, layout, space, type } from './theme';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

const iso = (y: number, m: number, d: number) =>
  `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

/**
 * "Pay by" field (screen 2). Looks like the other inputs and opens a small
 * month calendar. Built from plain views so it works on phones and the web preview.
 */
export function DateField({
  label,
  value,
  onChange,
  minDate,
  error,
}: {
  label: string;
  value: string | null;
  onChange: (date: string) => void;
  /** Earliest date that can be picked, YYYY-MM-DD. */
  minDate: string;
  error?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const start = parseIsoDate(value ?? minDate);
  const [month, setMonth] = useState({ y: start.y, m: start.m });

  const min = parseIsoDate(minDate);
  const canGoBack = month.y > min.y || (month.y === min.y && month.m > min.m);

  const first = new Date(Date.UTC(month.y, month.m - 1, 1));
  const lead = (first.getUTCDay() + 6) % 7; // Monday first
  const days = new Date(Date.UTC(month.y, month.m, 0)).getUTCDate();
  const cells: (number | null)[] = [...Array(lead).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)];
  while (cells.length % 7 !== 0) cells.push(null);

  const shift = (by: number) => {
    const i = month.y * 12 + (month.m - 1) + by;
    setMonth({ y: Math.floor(i / 12), m: (i % 12) + 1 });
  };

  return (
    <View style={styles.field}>
      <Label>{label}</Label>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={`${label}, ${value ? formatShortDate(value) : 'not set'}`}
        style={[styles.box, error ? styles.boxError : null]}
      >
        <Text style={value ? type.input : [type.input, styles.placeholder]}>{value ? formatShortDate(value) : 'Pick a date'}</Text>
      </Pressable>
      {error ? <ErrorText>{error}</ErrorText> : null}

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)} accessibilityLabel="Close calendar">
          <Pressable style={styles.sheet} onPress={() => {}} accessible={false}>
            <View style={styles.monthRow}>
              <Pressable onPress={() => canGoBack && shift(-1)} disabled={!canGoBack} hitSlop={12} accessibilityLabel="Previous month">
                <Text style={[type.appTitle, styles.arrow, !canGoBack && styles.faded]}>‹</Text>
              </Pressable>
              <Text style={type.bodyBold}>
                {MONTHS[month.m - 1]} {month.y}
              </Text>
              <Pressable onPress={() => shift(1)} hitSlop={12} accessibilityLabel="Next month">
                <Text style={[type.appTitle, styles.arrow]}>›</Text>
              </Pressable>
            </View>
            <View style={styles.grid}>
              {WEEKDAYS.map((w, i) => (
                <Text key={`h${i}`} style={[type.small, styles.cell, styles.weekday]}>
                  {w}
                </Text>
              ))}
              {cells.map((d, i) => {
                if (d === null) return <View key={`e${i}`} style={styles.cell} />;
                const date = iso(month.y, month.m, d);
                const disabled = date < minDate;
                const selected = date === value;
                return (
                  <Pressable
                    key={date}
                    disabled={disabled}
                    onPress={() => {
                      onChange(date);
                      setOpen(false);
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={formatShortDate(date)}
                    accessibilityState={{ disabled, selected }}
                    style={[styles.cell, selected && styles.selected]}
                  >
                    <Text style={[type.meta, selected && styles.selectedText, disabled && styles.faded]}>{d}</Text>
                  </Pressable>
                );
              })}
            </View>
            <View style={styles.quick}>
              {[
                ['Today', minDate],
                ['Tomorrow', addDays(minDate, 1)],
                ['In a week', addDays(minDate, 7)],
              ].map(([text, date]) => (
                <Pressable
                  key={text}
                  onPress={() => {
                    onChange(date!);
                    setOpen(false);
                  }}
                  style={styles.quickButton}
                  accessibilityRole="button"
                >
                  <Text style={type.meta}>{text}</Text>
                </Pressable>
              ))}
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  field: { flex: 1 },
  box: {
    marginTop: 6,
    height: layout.inputHeight,
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderWidth: layout.border,
    borderColor: colors.line,
    borderRadius: layout.radius,
    paddingHorizontal: 12,
  },
  boxError: { borderColor: colors.danger },
  placeholder: { color: colors.muted },
  backdrop: { flex: 1, backgroundColor: 'rgba(10,10,10,0.35)', justifyContent: 'center', padding: layout.gutter },
  sheet: { backgroundColor: colors.surface, borderWidth: layout.border, borderColor: colors.line, padding: space.lg },
  monthRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: space.md },
  arrow: { fontFamily: type.meta.fontFamily, paddingHorizontal: space.sm },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: `${100 / 7}%`, height: 42, alignItems: 'center', justifyContent: 'center' },
  weekday: { textAlign: 'center', lineHeight: 42 },
  selected: { backgroundColor: colors.ink, borderRadius: 21 },
  selectedText: { color: colors.inkOnDark },
  faded: { color: colors.track },
  quick: { flexDirection: 'row', gap: space.sm, marginTop: space.md },
  quickButton: {
    flex: 1,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: layout.border,
    borderColor: colors.line,
  },
});
