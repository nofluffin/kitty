import { type BillCategory, billSplit, type BillSplit, formatRupees, parseRupees, type SplitCategory, youLabel } from '@kitty/core';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { describePerson } from '@/lib/draft-kitty';
import { explainFailure } from '@/lib/errors';
import { loadFeed, setMemberDietDrinks, type FeedKitty } from '@/lib/feed';
import { addLine, loadBill, updateLine, type BillLine, type ScannedBill } from '@/lib/scan';
import { settleKitty } from '@/lib/settle';
import { supabase } from '@/lib/supabase';
import { Body, Button, CenteredState, DashedButton, ErrorText, Field, InfoBox, Label, Note, Screen, SmallButton, TextLink, Title } from '@/ui/components';
import { colors, layout, type } from '@/ui/theme';

const CATEGORY_LABEL: Record<SplitCategory, string> = { veg: 'Veg', nonveg: 'Non-Veg', alcohol: 'Alcohol' };
const NEXT: Record<BillCategory, SplitCategory> = { veg: 'nonveg', nonveg: 'alcohol', alcohol: 'veg', unsure: 'veg' };

type Step = 'sort' | 'check' | 'shares';

/** Screens 10 (sort the unsure lines), 11 (check the lines) and 5 (shares from a scanned bill). */
export default function CheckBill() {
  const { id, billId, mode = 'settle' } = useLocalSearchParams<{ id: string; billId: string; mode?: 'settle' | 'draft' }>();
  const [bill, setBill] = useState<ScannedBill | null>(null);
  const [kitty, setKitty] = useState<FeedKitty | null>(null);
  const [failed, setFailed] = useState(false);
  const [step, setStep] = useState<Step | null>(null);

  const reload = useCallback(async () => {
    try {
      const [b, k] = await Promise.all([loadBill(billId), loadFeed(id)]);
      setBill(b);
      setKitty(k);
      setStep((s) => s ?? (b.lines.some((l) => l.category === 'unsure') ? 'sort' : 'check'));
    } catch {
      setFailed(true);
    }
  }, [billId, id]);

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload]),
  );

  if (!bill || !kitty || !step) {
    return (
      <Screen title="Scan the bill" back>
        {failed ? <CenteredState title="Couldn’t load the bill" body="Go back and try again." /> : <CenteredState />}
      </Screen>
    );
  }
  // Decided 20 Nov 2026: while nobody has paid, scanning the bill just replaces the
  // total and shares (screen 5). Once someone has paid, it goes through settle up.
  const effectiveMode = mode === 'settle' && kitty.editable ? 'draft' : mode;
  const props = { bill, kitty, mode: effectiveMode, reload, setStep };
  if (step === 'sort') return <SortLines {...props} />;
  if (step === 'shares') return <ScannedShares {...props} />;
  return <CheckLines {...props} />;
}

interface StepProps {
  bill: ScannedBill;
  kitty: FeedKitty;
  mode: 'settle' | 'draft';
  reload: () => Promise<void>;
  setStep: (s: Step) => void;
}

const sortedMembers = (k: FeedKitty) => [...k.members].sort((a, b) => a.sortOrder - b.sortOrder);
const splitFor = (bill: ScannedBill, kitty: FeedKitty) =>
  billSplit(
    bill.lines.map((l) => ({ id: l.id, amountPaise: l.amountPaise, category: l.category })),
    bill.extrasPaise,
    sortedMembers(kitty).map((m) => ({ id: m.id, diet: m.diet, drinks: m.drinks })),
  );

// ---------------------------------------------------------------------------
// Screen 10: sort the unsure lines
// ---------------------------------------------------------------------------

function SortLines({ bill, reload, setStep }: StepProps) {
  const unsure = bill.lines.filter((l) => l.category === 'unsure');
  const [error, setError] = useState<string | null>(null);

  async function change(line: BillLine, c: { label?: string; category?: BillCategory }) {
    const e = await updateLine(line.id, c);
    if (e) setError(await explainFailure(e, 'save the line'));
    else await reload();
  }

  return (
    <Screen
      title="Scan the bill"
      back
      footer={
        <>
          <ErrorText>{error}</ErrorText>
          {unsure.length > 0 ? (
            <Text style={type.small}>
              {unsure.length} {unsure.length === 1 ? 'line still needs' : 'lines still need'} a type before you can continue.
            </Text>
          ) : null}
          <Button onPress={() => setStep('check')} disabled={unsure.length > 0}>
            Continue
          </Button>
        </>
      }
    >
      <Title>
        {unsure.length > 0 ? `Kitty isn’t sure about ${unsure.length} ${unsure.length === 1 ? 'line' : 'lines'}` : 'All sorted'}
      </Title>
      <Body>
        {bill.lines.length - unsure.length} of {bill.lines.length} lines are sorted. Tell Kitty what {unsure.length === 1 ? 'this one is' : 'these are'}.
      </Body>
      {bill.lines
        .filter((l) => l.category === 'unsure' || l.label === '')
        .map((line) => (
          <UnsureCard key={line.id} line={line} onChange={(c) => change(line, c)} />
        ))}
      <View style={styles.gap}>
        <AddLine billId={bill.id} onAdded={reload} />
      </View>
    </Screen>
  );
}

function UnsureCard({ line, onChange }: { line: BillLine; onChange: (c: { label?: string; category?: BillCategory }) => void }) {
  const [label, setLabel] = useState(line.label);
  return (
    <View style={styles.card}>
      <View style={styles.cardTop}>
        <Label>On the bill</Label>
        <Text style={type.bodyBold}>{formatRupees(line.amountPaise)}</Text>
      </View>
      <Text style={[type.bodyInk, styles.raw]}>{line.rawText || line.label}</Text>
      <Field label="What is it" value={label} onChangeText={setLabel} onBlur={() => label.trim() && label !== line.label && onChange({ label: label.trim() })} />
      <View style={styles.gapSmall}>
        <Segmented3 value={line.category} onChange={(category) => onChange({ category })} label={`Type of ${line.rawText || line.label}`} />
      </View>
    </View>
  );
}

/** Veg / Non-veg / Alcohol, 44 pt tall (screen 10). */
function Segmented3({ value, onChange, label }: { value: BillCategory; onChange: (c: SplitCategory) => void; label: string }) {
  return (
    <View style={styles.seg3} accessibilityRole="radiogroup" accessibilityLabel={label}>
      {(['veg', 'nonveg', 'alcohol'] as const).map((c) => {
        const on = value === c;
        return (
          <Pressable
            key={c}
            onPress={() => onChange(c)}
            accessibilityRole="radio"
            accessibilityState={{ checked: on }}
            style={[styles.seg3Item, on ? styles.picked : styles.off]}
          >
            <Text style={[type.meta, on && styles.pickedText]}>{CATEGORY_LABEL[c]}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** "Add a line Kitty missed" (screen 10). */
function AddLine({ billId, onAdded }: { billId: string; onAdded: () => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState<SplitCategory>('veg');
  const [error, setError] = useState<string | null>(null);

  if (!open) return <DashedButton onPress={() => setOpen(true)}>Add a line Kitty missed</DashedButton>;

  async function save() {
    const paise = parseRupees(amount);
    if (!label.trim() || paise === null || paise <= 0) {
      setError('Add what it was and how much it cost.');
      return;
    }
    const e = await addLine(billId, label.trim(), paise, category);
    if (e) {
      setError(await explainFailure(e, 'add the line'));
      return;
    }
    setOpen(false);
    setLabel('');
    setAmount('');
    await onAdded();
  }

  return (
    <View style={styles.card}>
      <Field label="What was it" value={label} onChangeText={setLabel} placeholder="Garlic naan" />
      <Field label="Amount" prefix="₹" value={amount} onChangeText={setAmount} placeholder="120" keyboardType="decimal-pad" />
      <View style={styles.gapSmall}>
        <Segmented3 value={category} onChange={setCategory} label="Type of the new line" />
      </View>
      <ErrorText>{error}</ErrorText>
      <View style={styles.row2}>
        <SmallButton onPress={save}>Add line</SmallButton>
        <TextLink onPress={() => setOpen(false)}>Cancel</TextLink>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Screen 11: check the lines
// ---------------------------------------------------------------------------

function CheckLines({ bill, kitty, mode, reload, setStep }: StepProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const linesPaise = bill.lines.reduce((s, l) => s + l.amountPaise, 0);
  const mismatch = linesPaise + bill.extrasPaise - bill.totalPaise;
  const split = splitFor(bill, kitty);
  const waiting = kitty.members.filter((m) => m.state === 'waiting');

  async function retag(line: BillLine) {
    const e = await updateLine(line.id, { category: NEXT[line.category] });
    if (e) setError(await explainFailure(e, 'change the line'));
    else await reload();
  }

  async function looksRight() {
    if (!split.ok) return;
    if (mode === 'draft') {
      setStep('shares');
      return;
    }
    setError(null);
    setBusy(true);
    const e = await settleKitty(kitty.id, split.value.totalPaise, split.value.shares);
    if (!e) await supabase.from('bills').update({ status: 'confirmed' }).eq('id', bill.id);
    setBusy(false);
    if (e) {
      setError(await explainFailure(e, 'settle up'));
      return;
    }
    router.replace({ pathname: '/kitty/[id]/settle', params: { id: kitty.id } });
  }

  return (
    <Screen
      title="Scan the bill"
      back
      footer={
        <>
          <ErrorText>{error}</ErrorText>
          <Button onPress={looksRight} loading={busy} disabled={!split.ok || (mode === 'settle' && waiting.length > 0)}>
            Looks right, work out shares
          </Button>
        </>
      }
    >
      <View style={styles.billTop}>
        <View style={styles.billIcon}>
          <Text style={type.label}>Bill</Text>
        </View>
        <View style={styles.flex}>
          <Text style={type.bodyBold}>Bill total {formatRupees(linesPaise + bill.extrasPaise)}</Text>
          <Text style={type.note}>{bill.lines.length} lines found</Text>
        </View>
        <SmallButton onPress={() => router.replace({ pathname: '/kitty/[id]/scan', params: { id: kitty.id, mode } })}>Retake</SmallButton>
      </View>

      {Math.abs(mismatch) > 100 ? (
        <View style={styles.gap}>
          <InfoBox>
            The lines and extras add up to {formatRupees(linesPaise + bill.extrasPaise)}, but the bill says {formatRupees(bill.totalPaise)}. Kitty may have missed or misread a line. Check them, or add the one it missed.
          </InfoBox>
        </View>
      ) : null}

      {mode === 'settle' && waiting.length > 0 ? (
        <View style={styles.gap}>
          <InfoBox>
            Confirm the payments people have marked first: {waiting.map((m) => m.name).join(', ')}. Go back to the kitty to confirm them.
          </InfoBox>
        </View>
      ) : null}

      <View style={styles.section}>
        <Label>Tap a tag if Kitty got it wrong</Label>
        <View style={styles.list}>
          {bill.lines.map((line) => (
            <View key={line.id} style={styles.lineRow}>
              <Text style={[type.bodyInk, styles.flex]} numberOfLines={2}>
                {line.label || line.rawText}
              </Text>
              <Text style={type.bodyInk}>{formatRupees(line.amountPaise)}</Text>
              <Pressable
                onPress={() => retag(line)}
                accessibilityRole="button"
                accessibilityLabel={`${line.label}: ${line.category === 'unsure' ? 'not sorted' : CATEGORY_LABEL[line.category]}. Tap to change`}
                style={[styles.tag, line.category === 'alcohol' ? styles.on : line.category === 'nonveg' ? styles.tagGrey : styles.off]}
              >
                <Text style={[type.meta, line.category === 'alcohol' && styles.onText]}>
                  {line.category === 'unsure' ? '?' : CATEGORY_LABEL[line.category]}
                </Text>
              </Pressable>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.gap}>
        <AddLine billId={bill.id} onAdded={reload} />
      </View>

      {split.ok ? <CategorySummary split={split.value} /> : <SplitProblem kitty={kitty} bill={bill} problem={split.error} reload={reload} />}
      <Text style={[type.small, styles.gapSmall]}>Tax and service charge are spread across each line.</Text>
    </Screen>
  );
}

function CategorySummary({ split }: { split: BillSplit }) {
  return (
    <View style={[styles.card, styles.gap]}>
      {split.categories.map((c, i) => (
        <View key={c.category} style={[styles.sumRow, i < split.categories.length - 1 && styles.rule]}>
          <Text style={[type.body, styles.flex]}>
            {CATEGORY_LABEL[c.category]} {formatRupees(c.totalPaise)}, {c.memberIds.length === split.shares.length ? `all ${c.memberIds.length}` : `${c.memberIds.length} ${c.memberIds.length === 1 ? 'person' : 'people'}`}
          </Text>
          <Text style={type.bodyBold}>{formatRupees(c.perHeadPaise)} each</Text>
        </View>
      ))}
    </View>
  );
}

/** Spec section 4, scanned bill step 4: a category nobody is marked for blocks the split. */
function SplitProblem({ kitty, bill, problem, reload }: { kitty: FeedKitty; bill: ScannedBill; problem: { code: string; category?: SplitCategory; lineIds?: string[] }; reload: () => Promise<void> }) {
  if (problem.code !== 'no_one_eligible' || !problem.category) {
    return (
      <View style={styles.gap}>
        <InfoBox>{problem.code === 'unsure_lines' ? 'Some lines still need a type. Tap their tags above.' : 'Kitty can’t split this bill yet. Check the lines.'}</InfoBox>
      </View>
    );
  }
  const alcohol = problem.category === 'alcohol';
  const toShared = async () => {
    for (const lineId of problem.lineIds ?? []) await updateLine(lineId, { category: 'veg' });
    await reload();
  };
  return (
    <View style={[styles.card, styles.gap]}>
      <Text style={type.bodyBold}>{alcohol ? 'The bill has alcohol, but nobody is marked as drinking' : 'The bill has non-veg dishes, but everyone is marked veg'}</Text>
      <Text style={[type.note, styles.gapSmall]}>Mark who had it, or share {alcohol ? 'the drinks' : 'those dishes'} with everyone.</Text>
      {sortedMembers(kitty).map((m) => {
        const on = alcohol ? m.drinks : m.diet === 'nonveg';
        return (
          <Pressable
            key={m.id}
            onPress={async () => {
              await setMemberDietDrinks(m.id, alcohol ? { drinks: !on } : { diet: on ? 'veg' : 'nonveg' });
              await reload();
            }}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: on }}
            style={styles.checkRow}
          >
            <Text style={[type.bodyInk, styles.flex]}>{m.isOrganiser ? youLabel(m.name) : m.name}</Text>
            <Text style={type.meta}>{on ? '☑' : '☐'} {alcohol ? 'Alcohol' : 'Non-Veg'}</Text>
          </Pressable>
        );
      })}
      <View style={styles.gapSmall}>
        <TextLink onPress={toShared}>{`Share ${bill.lines.filter((l) => problem.lineIds?.includes(l.id)).length === 1 ? 'it' : 'them'} with everyone instead`}</TextLink>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Screen 5: shares from a scanned bill (before sharing)
// ---------------------------------------------------------------------------

function ScannedShares({ bill, kitty, setStep }: StepProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const split = splitFor(bill, kitty);
  if (!split.ok) {
    return (
      <Screen title="Shares" back>
        <CenteredState title="Kitty can’t split this bill yet" body="Check the bill lines first." action={<Button onPress={() => setStep('check')}>Check the lines</Button>} />
      </Screen>
    );
  }
  const share = new Map(split.value.shares.map((s) => [s.memberId, s.sharePaise]));
  const summary = split.value.categories
    .map((c) => `${CATEGORY_LABEL[c.category]} ${formatRupees(c.perHeadPaise)} each for ${c.memberIds.length === split.value.shares.length ? `all ${c.memberIds.length}` : c.memberIds.length}.`)
    .join(' ');

  async function done() {
    if (!split.ok) return;
    setError(null);
    setBusy(true);
    const { error: e } = await supabase.rpc('apply_scanned_shares', {
      p_kitty_id: kitty.id,
      p_bill_id: bill.id,
      p_shares: split.value.shares.map((s) => ({ member_id: s.memberId, share_paise: s.sharePaise })),
    });
    setBusy(false);
    if (e) {
      setError(await explainFailure(e, 'save the shares'));
      return;
    }
    router.replace({ pathname: '/kitty/[id]/share', params: { id: kitty.id, fresh: '1' } });
  }

  return (
    <Screen
      title="Shares"
      back
      footer={
        <>
          <Note>Each person is asked for their exact share, so nobody tops up or waits for a refund. To change who had what, check the bill lines again.</Note>
          <ErrorText>{error}</ErrorText>
          <Button onPress={done} loading={busy}>
            Done
          </Button>
        </>
      }
    >
      <View style={styles.cardTop}>
        <Text style={type.title}>{formatRupees(split.value.totalPaise)} total</Text>
        <Text style={type.note}>From your scanned bill</Text>
      </View>
      <View style={styles.gap}>
        <InfoBox>{summary}</InfoBox>
      </View>
      <View style={styles.list}>
        {sortedMembers(kitty)
          .sort((a, b) => (share.get(b.id) ?? 0) - (share.get(a.id) ?? 0))
          .map((m) => (
            <View key={m.id} style={styles.lineRow}>
              <View style={styles.flex}>
                <Text style={type.bodyInk}>{m.isOrganiser ? youLabel(m.name) : m.name}</Text>
                <Text style={type.note}>{describePerson(m)}</Text>
              </View>
              <View style={styles.amountBox}>
                <Text style={type.bodyInk}>{formatRupees(share.get(m.id) ?? 0)}</Text>
              </View>
            </View>
          ))}
      </View>
      <View style={styles.gap}>
        <TextLink onPress={() => setStep('check')}>Check the bill lines again</TextLink>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  gap: { marginTop: 16 },
  gapSmall: { marginTop: 10 },
  section: { marginTop: 22 },
  card: { marginTop: 16, backgroundColor: colors.surface, borderWidth: layout.border, borderColor: colors.line, padding: layout.cardPadding },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  raw: { fontFamily: 'Courier', marginTop: 4 },
  seg3: { flexDirection: 'row', height: 44 },
  seg3Item: { flex: 1, alignItems: 'center', justifyContent: 'center', borderWidth: layout.border },
  on: { backgroundColor: colors.ink, borderColor: colors.ink },
  // Selected option (Raj, 20 Nov 2026): stone with ink text.
  picked: { backgroundColor: colors.selected, borderColor: colors.selected },
  pickedText: { color: colors.ink, fontFamily: type.bodyBold.fontFamily },
  off: { backgroundColor: colors.surface, borderColor: colors.line },
  onText: { color: colors.inkOnDark, fontFamily: type.bodyBold.fontFamily },
  tagGrey: { backgroundColor: colors.track, borderColor: colors.line },
  billTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  billIcon: {
    width: 56,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.sunken,
    borderWidth: layout.border,
    borderStyle: 'dashed',
    borderColor: colors.line,
  },
  list: { marginTop: 12, borderTopWidth: layout.border, borderTopColor: colors.line },
  lineRow: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 6,
    borderBottomWidth: layout.border,
    borderBottomColor: colors.line,
  },
  tag: { minWidth: 92, height: 44, alignItems: 'center', justifyContent: 'center', borderWidth: layout.border, paddingHorizontal: 8 },
  sumRow: { minHeight: 42, flexDirection: 'row', alignItems: 'center', gap: 8 },
  rule: { borderBottomWidth: layout.border, borderBottomColor: colors.line },
  checkRow: { minHeight: 44, flexDirection: 'row', alignItems: 'center' },
  row2: { flexDirection: 'row', alignItems: 'center', gap: 16, marginTop: 10 },
  amountBox: {
    width: 103,
    height: 43,
    alignItems: 'flex-end',
    justifyContent: 'center',
    paddingHorizontal: 12,
    backgroundColor: colors.surface,
    borderWidth: layout.border,
    borderColor: colors.line,
  },
});
