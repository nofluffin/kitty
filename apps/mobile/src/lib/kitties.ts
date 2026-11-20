import { combineByPayer, confirmedNetPaid, payerIdOf, type KittyKind, type KittyStatus, type Paise, type PaymentForTotals } from '@kitty/core';

import { supabase } from './supabase';

export interface KittySummary {
  id: string;
  title: string;
  kind: KittyKind;
  status: KittyStatus;
  dueDate: string;
  totalPaise: Paise;
  collectedPaise: Paise;
  paidCount: number;
  memberCount: number;
  /** Filed away by the organiser (Archived kitties). */
  archivedAt: string | null;
}

/** Everything the home screen (screen 1) needs, newest due date first within each group. */
export async function loadKittySummaries(): Promise<KittySummary[]> {
  const { data, error } = await supabase
    .from('kitties')
    .select(
      'id, title, kind, status, due_date, total_paise, archived_at, members(id, share_paise, paid_by_member_id), payments(member_id, direction, status, amount_paise)',
    )
    .neq('status', 'cancelled')
    .order('due_date', { ascending: true });
  if (error) throw error;

  return data.map((k) => {
    const payments: PaymentForTotals[] = k.payments.map((p) => ({
      memberId: p.member_id,
      direction: p.direction,
      status: p.status,
      amountPaise: p.amount_paise,
    }));
    // Someone paying for others (e.g. a child) is asked for everyone's share together,
    // so a person counts as paid once whoever pays for them has paid the lot.
    const people = k.members.map((m) => ({ id: m.id, paidById: m.paid_by_member_id }));
    const groupShare = combineByPayer(people, (m) => k.members.find((x) => x.id === m.id)!.share_paise);
    const paid = people.map((m) => ({ share: groupShare.get(payerIdOf(m)) ?? 0, net: confirmedNetPaid(payments, payerIdOf(m)) }));
    const collected = [...groupShare.keys()].reduce((sum, payer) => sum + confirmedNetPaid(payments, payer), 0);
    return {
      id: k.id,
      title: k.title,
      kind: k.kind,
      status: k.status,
      dueDate: k.due_date,
      totalPaise: k.total_paise,
      collectedPaise: collected,
      paidCount: paid.filter((m) => m.share > 0 && m.net >= m.share).length,
      memberCount: k.members.length,
      archivedAt: k.archived_at,
    };
  });
}

/** Archive: off the kitty list, into Archived kitties. Friends' links keep working. */
export async function setArchived(kittyId: string, archived: boolean) {
  const { error } = await supabase
    .from('kitties')
    .update({ archived_at: archived ? new Date().toISOString() : null })
    .eq('id', kittyId);
  return error;
}
