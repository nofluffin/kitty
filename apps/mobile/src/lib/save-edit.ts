import { normaliseUpiId } from '@kitty/core';
import { router } from 'expo-router';
import { useState } from 'react';

import { useAuth } from './auth';
import { useDraftKitty } from './draft-kitty';
import { explainFailure } from './errors';
import { supabase } from './supabase';
import { useToast } from './toast';

/** A draft with no pay by date yet: the database takes null, though the generated type says string. */
const NO_DATE = null as unknown as string;

/**
 * Saving a kitty that already exists (Raj, 22 Nov 2026). Editing is split into Details, People
 * and Amounts, and each screen saves the whole kitty with this, then goes back to where the edit
 * started. `parts` is the goal's number of monthly parts, when it's paid in parts.
 */
export function useSaveEdit() {
  const k = useDraftKitty();
  const toast = useToast();
  const { refreshProfile } = useAuth();
  const [saving, setSaving] = useState(false);

  /** Resolves to an error to show, or null once saved. */
  async function save(parts: number | null = k.partsCount): Promise<string | null> {
    if (!k.editing) return null;
    // No total yet: everyone's share is ₹0 until there is one.
    if (k.split.state !== 'ok' && !(k.split.state === 'no-total' && !k.totalPaise)) {
      return k.split.state === 'error' ? 'The amounts you set don’t add up to the total.' : 'Add at least one other person.';
    }
    const shares = new Map(
      k.split.state === 'ok'
        ? k.split.shares.map((s) => [s.memberId, s])
        : k.people.map((p) => [p.key, { memberId: p.key, sharePaise: 0, fixed: false }]),
    );
    const goal = k.kind === 'goal';
    setSaving(true);
    const { error } = await supabase.rpc('update_kitty', {
      p_kitty_id: k.editing.id,
      p_kind: k.kind,
      ...(goal ? { p_goal_plan: k.goalPlan, ...(k.goalPlan === 'parts' && parts ? { p_parts_count: parts } : {}) } : {}),
      p_title: k.title.trim(),
      p_due_date: k.dueDate ?? NO_DATE,
      p_total_paise: k.totalPaise ?? 0,
      p_upi_id: normaliseUpiId(k.upiId),
      p_members: k.people.map((p) => ({
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
      })),
    });
    setSaving(false);
    if (error) return explainFailure(error, 'save your changes');
    refreshProfile(); // picks up a changed UPI ID
    toast('Changes saved');
    // Back to where the edit started (the kitty or its share screen), which reloads on focus.
    router.back();
    return null;
  }

  return { save, saving };
}
