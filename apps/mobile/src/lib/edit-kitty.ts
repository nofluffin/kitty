import type { Diet } from '@kitty/core';

import type { ExistingKitty } from './draft-kitty';
import { supabase } from './supabase';

/**
 * Decided 20 Nov 2026: a kitty can be edited as a draft, and after sharing until
 * anyone other than the organiser has marked or paid anything. The database
 * enforces the same rule (update_kitty, and the lock triggers).
 */
export function isEditable(status: string, payments: readonly { isOrganiser: boolean; status: string }[]): boolean {
  if (status === 'draft') return true;
  return status === 'shared' && payments.every((p) => p.isOrganiser || p.status === 'requested');
}

/** The kitty as the edit form needs it, or null when it can no longer be edited. */
export async function loadEditableKitty(id: string): Promise<ExistingKitty | null> {
  const { data, error } = await supabase
    .from('kitties')
    .select(
      'id, status, kind, goal_plan, parts_count, title, total_paise, due_date, upi_id, members(id, name, phone, is_organiser, diet, drinks, share_paise, share_fixed, sort_order, payments(status))',
    )
    .eq('id', id)
    .single();
  if (error) throw error;

  const payments = data.members.flatMap((m) => m.payments.map((p) => ({ isOrganiser: m.is_organiser, status: p.status })));
  if (!isEditable(data.status, payments) || (data.status !== 'draft' && data.status !== 'shared')) return null;

  return {
    id: data.id,
    status: data.status,
    kind: data.kind,
    goalPlan: data.goal_plan ?? 'single',
    partsCount: data.parts_count,
    title: data.title,
    totalPaise: data.total_paise,
    dueDate: data.due_date,
    upiId: data.upi_id,
    people: [...data.members]
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((m) => ({
        memberId: m.id,
        name: m.name,
        phone: m.phone,
        isOrganiser: m.is_organiser,
        diet: m.diet as Diet,
        drinks: m.drinks,
        fixedPaise: m.share_fixed ? m.share_paise : null,
      })),
  };
}
