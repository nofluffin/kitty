import { confirmedNetPaid, type KittyKind, type KittyStatus, type Paise, type PaymentForTotals } from '@kitty/core';

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
}

/** Everything the home screen (screen 1) needs, newest due date first within each group. */
export async function loadKittySummaries(): Promise<KittySummary[]> {
  const { data, error } = await supabase
    .from('kitties')
    .select(
      'id, title, kind, status, due_date, total_paise, members(id, share_paise), payments(member_id, direction, status, amount_paise)',
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
    const paid = k.members.map((m) => ({ share: m.share_paise, net: confirmedNetPaid(payments, m.id) }));
    return {
      id: k.id,
      title: k.title,
      kind: k.kind,
      status: k.status,
      dueDate: k.due_date,
      totalPaise: k.total_paise,
      collectedPaise: paid.reduce((sum, m) => sum + m.net, 0),
      paidCount: paid.filter((m) => m.share > 0 && m.net >= m.share).length,
      memberCount: k.members.length,
    };
  });
}
