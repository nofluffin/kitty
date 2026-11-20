import { formatRupees, isValidUpiId, localIsoDate, normaliseUpiId } from '@kitty/core';
import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useAuth } from '@/lib/auth';
import { useDraftKitty, type Split } from '@/lib/draft-kitty';
import { explainFailure } from '@/lib/errors';
import { notify } from '@/lib/notify';
import { supabase } from '@/lib/supabase';
import {
  Button,
  Chip,
  DashedButton,
  ErrorText,
  Field,
  Label,
  Screen,
  Segmented,
  SmallButton,
} from '@/ui/components';
import { DateField } from '@/ui/date-field';
import { colors, layout, type } from '@/ui/theme';

type Errors = Partial<Record<'title' | 'total' | 'date' | 'people' | 'upi' | 'form', string>>;

/** Screen 2. Goal kitties (screen 22) come in step 9. */
export default function NewKitty() {
  const { refreshProfile } = useAuth();
  const k = useDraftKitty();
  // Errors show after the first "Create kitty" tap, then update live as each field is fixed.
  const [tried, setTried] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [scanning, setScanning] = useState(false);
  // A draft saved by "Scan it" that the organiser then backed out of. Removed if they create normally.
  const scanDraft = useRef<string | null>(null);
  const today = localIsoDate();
  const upi = normaliseUpiId(k.upiId);
  const others = k.people.filter((p) => !p.isOrganiser).length;
  const problems: Errors = {
    ...(k.title.trim() ? {} : { title: 'Give it a name your friends will recognise.' }),
    ...(k.totalPaise ? {} : { total: 'Enter the total, like 6,000.' }),
    ...(k.dueDate ? {} : { date: 'Pick the day everyone should pay by.' }),
    ...(others > 0 ? {} : { people: 'Add at least one other person.' }),
    ...(isValidUpiId(upi) ? {} : { upi: 'Enter your UPI ID, like name@okicici.' }),
    ...(k.split.state === 'error' ? { people: 'The amounts you set add up to more than the total. Adjust them.' } : {}),
  };
  const errors: Errors = tried ? { ...problems, ...(formError ? { form: formError } : {}) } : {};

  async function create() {
    setTried(true);
    setFormError(null);
    if (Object.keys(problems).length > 0 || k.split.state !== 'ok' || !k.dueDate || !k.totalPaise) return;

    const shares = new Map(k.split.shares.map((s) => [s.memberId, s]));
    setSaving(true);
    if (scanDraft.current) {
      await supabase.from('kitties').delete().eq('id', scanDraft.current);
      scanDraft.current = null;
    }
    const { data, error } = await supabase.rpc('create_kitty', {
      p_kind: 'moment',
      p_title: k.title.trim(),
      p_due_date: k.dueDate,
      p_total_paise: k.totalPaise,
      p_upi_id: upi,
      p_members: k.people.map((p) => ({
        name: p.isOrganiser ? p.name : p.name.trim(),
        phone: p.phone,
        is_organiser: p.isOrganiser,
        diet: p.diet,
        drinks: p.drinks,
        share_paise: shares.get(p.key)!.sharePaise,
        share_fixed: shares.get(p.key)!.fixed,
      })),
    });
    setSaving(false);
    if (error || !data) {
      setFormError(await explainFailure(error, 'create the kitty'));
      return;
    }
    refreshProfile(); // picks up the remembered UPI ID
    router.replace({ pathname: '/kitty/[id]/share', params: { id: data.id, fresh: '1' } });
  }

  /** "Have the bill already? Scan it": save the draft now so the photos have a home; the scan sets the total. */
  async function scanFirst() {
    setTried(true);
    setFormError(null);
    const needed: (keyof Errors)[] = ['title', 'date', 'people', 'upi'];
    if (needed.some((key) => problems[key]) || !k.dueDate) return;
    setScanning(true);
    if (scanDraft.current) await supabase.from('kitties').delete().eq('id', scanDraft.current);
    const { data, error } = await supabase.rpc('create_kitty', {
      p_kind: 'moment',
      p_title: k.title.trim(),
      p_due_date: k.dueDate,
      p_total_paise: 0,
      p_upi_id: upi,
      p_members: k.people.map((p) => ({
        name: p.name.trim(),
        phone: p.phone,
        is_organiser: p.isOrganiser,
        diet: p.diet,
        drinks: p.drinks,
        share_paise: 0,
        share_fixed: false,
      })),
    });
    setScanning(false);
    if (error || !data) {
      setFormError(await explainFailure(error, 'save the kitty'));
      return;
    }
    scanDraft.current = data.id;
    refreshProfile();
    router.push({ pathname: '/kitty/[id]/scan', params: { id: data.id, mode: 'draft' } });
  }

  return (
    <Screen
      title="New kitty"
      back
      footer={
        <>
          <ErrorText>{errors.form}</ErrorText>
          <Button onPress={create} loading={saving}>
            Create kitty
          </Button>
        </>
      }
    >
      <Segmented
        label="Kind of kitty"
        options={[
          { value: 'moment', label: 'Moment' },
          { value: 'goal', label: 'Goal' },
        ]}
        value="moment"
        onChange={(v) => {
          if (v === 'goal') notify('Coming soon', 'Goal kitties, saved up over weeks, come in step 9 of the build.');
        }}
      />

      <Field
        label="What is it for"
        value={k.title}
        onChangeText={k.setTitle}
        placeholder="Friday dinner"
        autoCapitalize="sentences"
        maxLength={80}
        error={errors.title ?? null}
      />

      <View style={styles.pair}>
        <View style={styles.flex}>
          <Field
            label="Total"
            prefix="₹"
            value={k.totalText}
            onChangeText={k.setTotalText}
            onBlur={() => k.totalPaise && k.setTotalText(formatRupees(k.totalPaise).replace('₹', ''))}
            placeholder="6,000"
            keyboardType="decimal-pad"
            error={errors.total ?? null}
          />
        </View>
        <View style={[styles.flex, styles.dateTop]}>
          <DateField label="Pay by" value={k.dueDate} onChange={k.setDueDate} minDate={today} error={errors.date ?? null} />
        </View>
      </View>

      <View style={styles.scanGap}>
        <DashedButton onPress={scanFirst}>
          {scanning ? 'Saving the kitty…' : 'Have the bill already? Scan it for exact shares'}
        </DashedButton>
      </View>

      <View style={styles.section}>
        <Label>Who is in</Label>
        <View style={styles.chips}>
          {k.people.map((p) => (
            <Chip
              key={p.key}
              filled={p.isOrganiser}
              onPress={() => router.push({ pathname: '/new/person', params: { key: p.key } })}
            >
              {p.isOrganiser ? 'You' : p.name}
            </Chip>
          ))}
        </View>
        <View style={styles.addGap}>
          <DashedButton onPress={() => router.push('/new/person')}>Add or edit people</DashedButton>
        </View>
        <ErrorText>{errors.people}</ErrorText>
      </View>

      <View style={styles.summaryGap}>
        <SplitSummary split={k.split} count={k.people.length} />
      </View>

      <Field
        label="Your UPI ID"
        value={k.upiId}
        onChangeText={k.setUpiId}
        placeholder="name@okicici"
        autoCapitalize="none"
        autoCorrect={false}
        hint="Everyone pays straight to this ID. Kitty never holds the money."
        error={errors.upi ?? null}
      />
    </Screen>
  );
}

function SplitSummary({ split, count }: { split: Split; count: number }) {
  const people = `${count} ${count === 1 ? 'person' : 'people'}`;
  let headline: React.ReactNode;
  let detail: string;
  if (split.state === 'ok' && split.equal) {
    headline = (
      <>
        <Text style={type.bodyBold}>{formatRupees(Math.min(...split.shares.map((s) => s.sharePaise)))}</Text> each
      </>
    );
    detail = `${people}, split equally. Editable until you share.`;
  } else if (split.state === 'ok') {
    headline = <Text style={type.bodyBold}>Amounts differ</Text>;
    detail = `${people}, some amounts set by you. Editable until you share.`;
  } else if (split.state === 'error') {
    headline = <Text style={[type.bodyBold, styles.danger]}>Amounts don’t add up</Text>;
    detail = 'The amounts you set are more than the total.';
  } else {
    headline = <Text style={type.bodyBold}>Shares</Text>;
    detail = 'Add a total to see what each person pays.';
  }
  return (
    <View style={styles.summary}>
      <View style={styles.flex}>
        <Text style={type.bodyInk}>{headline}</Text>
        <Text style={[type.metaMuted, styles.summaryDetail]}>{detail}</Text>
      </View>
      <SmallButton onPress={() => router.push('/new/shares')} disabled={split.state === 'no-total' || split.state === 'no-people'}>
        Adjust
      </SmallButton>
    </View>
  );
}

// Spacing measured from screen 2.
const styles = StyleSheet.create({
  flex: { flex: 1 },
  pair: { flexDirection: 'row', gap: 13 },
  dateTop: { marginTop: 14 },
  scanGap: { marginTop: 14 },
  section: { marginTop: 16 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 9, marginTop: 11 },
  addGap: { marginTop: 9 },
  summaryGap: { marginTop: 13 },
  summary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.surface,
    borderWidth: layout.border,
    borderColor: colors.line,
    padding: layout.cardPadding,
  },
  summaryDetail: { marginTop: 2 },
  danger: { color: colors.danger },
});
