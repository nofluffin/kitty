import { formatRupees, parseRupees, type Paise } from '@kitty/core';
import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { describePerson, useDraftKitty, type DraftPerson } from '@/lib/draft-kitty';
import { Button, DashedButton, ErrorText, InfoBox, Note, Screen, TextLink } from '@/ui/components';
import { colors, layout, type } from '@/ui/theme';

const WORDS = ['no one', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];
const count = (n: number) => WORDS[n] ?? String(n);

/** Screen 4, the adjust rule from spec section 4. */
export default function AdjustShares() {
  const k = useDraftKitty();
  const split = k.split;
  const shareOf = new Map(split.state === 'ok' ? split.shares.map((s) => [s.memberId, s.sharePaise]) : []);
  const fixed = k.people.filter((p) => p.fixedPaise !== null);
  const unfixed = k.people.filter((p) => p.fixedPaise === null);

  let info: string | null = null;
  if (split.state === 'ok' && fixed.length > 0) {
    const who = fixed.length === 1 ? `${nameOf(fixed[0]!)} to ${formatRupees(fixed[0]!.fixedPaise!)}` : `${count(fixed.length)} amounts`;
    if (unfixed.length === 0) {
      info = `You set every amount by hand.`;
    } else if (unfixed.length === 1) {
      info = `You set ${who}. The other ${formatRupees(split.remainderPaise)} goes to ${nameOf(unfixed[0]!)}.`;
    } else {
      const each = Math.min(...unfixed.map((p) => shareOf.get(p.key) ?? 0));
      info = `You set ${who}. The other ${formatRupees(split.remainderPaise)} is split across the other ${count(unfixed.length)}, ${formatRupees(each)} each.`;
    }
  }
  const error =
    split.state === 'error'
      ? split.error.code === 'fixed_over_total'
        ? `The amounts you set add up to ${formatRupees(split.error.fixedTotal)}, more than the ${formatRupees(split.error.total)} total.`
        : split.error.code === 'all_fixed_mismatch'
          ? `The amounts you set add up to ${formatRupees(split.error.fixedTotal)}, not the ${formatRupees(split.error.total)} total.`
          : null
      : null;

  return (
    <Screen
      title="Shares"
      back
      footer={
        <>
          <Note>
            You can change amounts until someone pays. Scan the bill and Kitty works out each person’s exact share from what they
            had, replacing these amounts.
          </Note>
          {k.kind === 'moment' ? (
            <DashedButton
              onPress={() => {
                // Screen 2 saves the kitty and opens the camera: it has the name, date and UPI ID.
                k.setScanRequested(true);
                router.back();
              }}
            >
              Have the bill already? Scan it for exact shares
            </DashedButton>
          ) : null}
          <Button onPress={() => router.back()} disabled={split.state !== 'ok'}>
            Done
          </Button>
        </>
      }
    >
      <View style={styles.top}>
        <Text style={type.title}>{k.totalPaise ? `${formatRupees(k.totalPaise)} total` : 'No total yet'}</Text>
        <Text style={type.note}>
          {k.people.length} {k.people.length === 1 ? 'person' : 'people'}
        </Text>
      </View>

      <View style={styles.rows}>
        {k.people.map((p) => (
          <View key={p.key}>
            <ShareRow person={p} sharePaise={shareOf.get(p.key) ?? null} onSet={(v) => k.setFixed(p.key, v)} />
            {/* The explanation sits under the first row you changed, as on screen 4. */}
            {info && p.key === fixed[0]?.key ? (
              <View style={styles.info}>
                <InfoBox>{info}</InfoBox>
              </View>
            ) : null}
          </View>
        ))}
      </View>
      <ErrorText>{error}</ErrorText>

      {fixed.length > 0 ? (
        <View style={styles.reset}>
          <TextLink onPress={k.resetFixed}>Reset to an equal split</TextLink>
        </View>
      ) : null}
    </Screen>
  );
}

const nameOf = (p: DraftPerson) => (p.isOrganiser ? 'yourself' : p.name);

function ShareRow({
  person,
  sharePaise,
  onSet,
}: {
  person: DraftPerson;
  sharePaise: Paise | null;
  onSet: (paise: Paise | null) => void;
}) {
  // While typing, show exactly what was typed. Otherwise show the worked-out share.
  const [draft, setDraft] = useState<string | null>(null);
  const shown = draft ?? (person.fixedPaise !== null ? person.fixedPaise : sharePaise);
  const text = typeof shown === 'number' ? formatRupees(shown) : (shown ?? '');

  function commit() {
    if (draft === null) return;
    const t = draft.trim();
    const p = t === '' ? null : parseRupees(t);
    // Empty clears a typed amount. Retyping the worked-out share doesn't fix it in place.
    if (t === '') onSet(null);
    else if (p !== null && !(person.fixedPaise === null && p === sharePaise)) onSet(p);
    setDraft(null);
  }

  return (
    <View style={styles.row}>
      <View style={styles.flex}>
        <Text style={type.bodyInk}>{person.isOrganiser ? 'You' : person.name}</Text>
        <Text style={type.note}>{describePerson(person)}</Text>
      </View>
      <TextInput
        value={text}
        onFocus={() => setDraft(text.replace('₹', ''))}
        onChangeText={setDraft}
        onBlur={commit}
        onSubmitEditing={commit}
        keyboardType="decimal-pad"
        returnKeyType="done"
        selectTextOnFocus
        accessibilityLabel={`Amount for ${person.isOrganiser ? 'you' : person.name}`}
        style={[type.input, styles.amount, person.fixedPaise !== null && styles.amountFixed]}
      />
    </View>
  );
}

// Spacing measured from screen 4: rows 61 pt apart, 103 x 43 amount boxes.
const styles = StyleSheet.create({
  flex: { flex: 1 },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  rows: { marginTop: 16, borderTopWidth: layout.border, borderTopColor: colors.line },
  row: {
    minHeight: 61,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderBottomWidth: layout.border,
    borderBottomColor: colors.line,
    paddingVertical: 8,
  },
  amount: {
    width: 103,
    height: 43,
    textAlign: 'right',
    paddingHorizontal: 12,
    backgroundColor: colors.surface,
    borderWidth: layout.border,
    borderColor: colors.line,
  },
  amountFixed: { borderColor: colors.ink, borderWidth: 2 },
  info: { paddingBottom: 8 },
  reset: { marginTop: 24 },
});
