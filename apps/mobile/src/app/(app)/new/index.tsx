import { formatRupees, formatShortDate, goalParts, isValidUpiId, localIsoDate, maxGoalParts, normaliseUpiId } from '@kitty/core';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useAuth } from '@/lib/auth';
import { useDraftKitty, type GoalPlan, type Split } from '@/lib/draft-kitty';
import { explainFailure } from '@/lib/errors';
import { loadGroups, type SavedGroup } from '@/lib/groups';
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
  Small,
  SmallButton,
  TextLink,
} from '@/ui/components';
import { DateField } from '@/ui/date-field';
import { colors, layout, type } from '@/ui/theme';

type Errors = Partial<Record<'title' | 'total' | 'date' | 'plan' | 'people' | 'upi' | 'form', string>>;

/** Most parts offered on screen 22: a year of monthly payments. */
const MAX_PARTS_OFFERED = 12;

/** Screen 2 (moment) and screen 22 (goal). */
export default function NewKitty() {
  const { refreshProfile, profile } = useAuth();
  const k = useDraftKitty();
  // Errors show after the first "Create kitty" tap, then update live as each field is fixed.
  const [tried, setTried] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [scanning, setScanning] = useState(false);
  // Saved groups (Raj, 20 Nov 2026): add everyone in one tap, then add or remove people as usual.
  const [groups, setGroups] = useState<SavedGroup[]>([]);
  const [groupNote, setGroupNote] = useState<string | null>(null);
  useFocusEffect(
    useCallback(() => {
      loadGroups()
        .then(setGroups)
        .catch(() => setGroups([]));
    }, []),
  );
  // A draft saved by "Scan it" that the organiser then backed out of. Removed if they create normally.
  const scanDraft = useRef<string | null>(null);
  const today = localIsoDate();
  const upi = normaliseUpiId(k.upiId);
  const others = k.people.filter((p) => !p.isOrganiser).length;
  const goal = k.kind === 'goal';
  const inParts = goal && k.goalPlan === 'parts';
  // Parts offered: as many monthly parts as fit before the pay by date, up to a year.
  const maxParts = k.dueDate ? Math.min(maxGoalParts(k.dueDate, today), MAX_PARTS_OFFERED) : 0;
  const parts = inParts && maxParts >= 2 ? Math.min(k.partsCount ?? Math.min(maxParts, 3), maxParts) : null;
  const planProblem = !inParts
    ? null
    : !k.dueDate
      ? 'Pick a pay by date to see the parts.'
      : maxParts < 2
        ? 'Pick a pay by date at least a month away to pay in parts.'
        : k.split.state === 'ok' && k.split.shares.some((x) => x.sharePaise > 0 && x.sharePaise < parts!)
          ? 'A share is too small to split into parts.'
          : null;
  const problems: Errors = {
    ...(k.title.trim() ? {} : { title: goal ? 'Say what you’re saving for.' : 'Give it a name your friends will recognise.' }),
    ...(k.totalPaise ? {} : { total: goal ? 'Enter the target, like 50,000.' : 'Enter the total, like 6,000.' }),
    ...(planProblem ? { plan: planProblem } : {}),
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
    const people = k.people.map((p) => ({
      ...(p.memberId ? { id: p.memberId } : {}),
      name: p.isOrganiser ? p.name : p.name.trim(),
      phone: p.phone,
      is_organiser: p.isOrganiser,
      diet: p.diet,
      drinks: p.drinks,
      share_paise: shares.get(p.key)!.sharePaise,
      share_fixed: shares.get(p.key)!.fixed,
      // Paying for someone else: the payer's place in the list.
      ...(p.paidByKey ? { paid_by_index: k.people.findIndex((x) => x.key === p.paidByKey) } : {}),
    }));
    if (k.editing) {
      const { error } = await supabase.rpc('update_kitty', {
        p_kitty_id: k.editing.id,
        p_kind: k.kind,
        ...(goal ? { p_goal_plan: k.goalPlan, ...(parts ? { p_parts_count: parts } : {}) } : {}),
        p_title: k.title.trim(),
        p_due_date: k.dueDate,
        p_total_paise: k.totalPaise,
        p_upi_id: upi,
        p_members: people,
      });
      setSaving(false);
      if (error) {
        setFormError(await explainFailure(error, 'save your changes'));
        return;
      }
      refreshProfile();
      // Back to where the edit started (the share screen or the feed), which reloads on focus.
      router.back();
      return;
    }
    const { data, error } = await supabase.rpc('create_kitty', {
      p_kind: k.kind,
      ...(goal ? { p_goal_plan: k.goalPlan, ...(parts ? { p_parts_count: parts } : {}) } : {}),
      p_title: k.title.trim(),
      p_due_date: k.dueDate,
      p_total_paise: k.totalPaise,
      p_upi_id: upi,
      p_members: people,
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
      title={k.editing ? 'Edit kitty' : 'New kitty'}
      back
      footer={
        <>
          <ErrorText>{errors.form}</ErrorText>
          {k.editing?.status === 'shared' ? (
            <Small>Everyone’s link updates straight away. You can only edit until someone pays.</Small>
          ) : null}
          <Button onPress={create} loading={saving}>
            {k.editing ? 'Save changes' : 'Create kitty'}
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
        value={k.kind}
        onChange={k.setKind}
      />

      <Field
        label={goal ? 'What are you saving for' : 'What is it for'}
        value={k.title}
        onChangeText={k.setTitle}
        placeholder={goal ? 'Goa trip' : 'Friday dinner'}
        autoCapitalize="sentences"
        maxLength={80}
        error={errors.title ?? null}
      />

      <View style={styles.pair}>
        <View style={styles.flex}>
          <Field
            label={goal ? 'Target' : 'Total'}
            prefix="₹"
            value={k.totalText}
            onChangeText={k.setTotalText}
            onBlur={() => k.totalPaise && k.setTotalText(formatRupees(k.totalPaise).replace('₹', ''))}
            placeholder={goal ? '50,000' : '6,000'}
            keyboardType="decimal-pad"
            error={errors.total ?? null}
          />
        </View>
        <View style={[styles.flex, styles.dateTop]}>
          <DateField label="Pay by" value={k.dueDate} onChange={k.setDueDate} minDate={today} error={errors.date ?? null} />
        </View>
      </View>

      {goal ? (
        <View style={styles.scanGap}>
          <Segmented
            label="How people pay"
            options={[
              { value: 'single', label: 'One payment' },
              { value: 'parts', label: 'In parts' },
            ]}
            value={k.goalPlan}
            onChange={(v: GoalPlan) => k.setGoalPlan(v)}
          />
          <Small>In parts splits each share into monthly payments, with a nudge before each one.</Small>
          {inParts && maxParts >= 2 ? (
            <View style={styles.section}>
              <Label>Number of parts</Label>
              <View style={styles.chips}>
                {Array.from({ length: maxParts - 1 }, (_, i) => i + 2).map((n) => (
                  <Chip key={n} filled={n === parts} onPress={() => k.setPartsCount(n)}>
                    {String(n)}
                  </Chip>
                ))}
              </View>
            </View>
          ) : null}
          <ErrorText>{inParts ? planProblem : null}</ErrorText>
        </View>
      ) : k.editing ? null : (
        <View style={styles.scanGap}>
          <DashedButton onPress={scanFirst}>
            {scanning ? 'Saving the kitty…' : 'Have the bill already? Scan it for exact shares'}
          </DashedButton>
        </View>
      )}

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
        {groups.length > 0 ? (
          <View style={styles.groups}>
            <Small>Add a saved group</Small>
            <View style={styles.chips}>
              {groups.map((g) => (
                <Chip
                  key={g.id}
                  onPress={() => {
                    // You're already in as You: leave out your own row (by login, or by your mobile number).
                    const added = k.addGroup(
                      g.people.map(({ profileId, ...p }) => ({
                        ...p,
                        isMe: profileId === profile?.id || (!!p.phone && p.phone === profile?.phone),
                      })),
                    );
                    setGroupNote(added > 0 ? `Added ${added} from ${g.name}.` : `Everyone in ${g.name} is already in.`);
                  }}
                >
                  {g.name}
                </Chip>
              ))}
            </View>
            {groupNote ? <Small>{groupNote}</Small> : null}
          </View>
        ) : null}
        {others > 0 ? (
          <View style={styles.saveGroup}>
            <TextLink onPress={() => router.push('/new/save-group')}>Save these people as a group</TextLink>
          </View>
        ) : null}
        <ErrorText>{errors.people}</ErrorText>
      </View>

      <View style={styles.summaryGap}>
        <SplitSummary split={k.split} count={k.people.length} parts={parts && k.dueDate ? { count: parts, dueDate: k.dueDate, today } : null} />
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

function SplitSummary({
  split,
  count,
  parts,
}: {
  split: Split;
  count: number;
  parts: { count: number; dueDate: string; today: string } | null;
}) {
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
    if (parts) {
      const plan = goalParts(Math.max(...split.shares.map((s) => s.sharePaise)), parts.count, parts.dueDate, parts.today);
      if (plan.ok) {
        detail = `${people}, split equally, in ${parts.count} monthly parts of about ${formatRupees(plan.value[0]!.amountPaise)}, from ${formatShortDate(plan.value[0]!.dueDate)}.`;
      }
    }
  } else if (split.state === 'ok') {
    headline = <Text style={type.bodyBold}>Amounts differ</Text>;
    detail = parts
      ? `${people}, some amounts set by you, each paid in ${parts.count} monthly parts.`
      : `${people}, some amounts set by you. Editable until you share.`;
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
  groups: { marginTop: 14, gap: 4 },
  saveGroup: { marginTop: 12, alignItems: 'flex-start' },
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
