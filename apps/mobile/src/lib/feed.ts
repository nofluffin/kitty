import { memberPayState, type KittyKind, type KittyStatus, type MemberPayState, type PaymentStatus } from '@kitty/core';

import { supabase } from './supabase';

/** Everything screens 7, 8 and 23 need about one kitty. */
export interface FeedKitty {
  id: string;
  title: string;
  kind: KittyKind;
  status: KittyStatus;
  dueDate: string;
  totalPaise: number;
  upiId: string;
  slug: string;
  remindDayBefore: boolean;
  remindOnDay: boolean;
  members: FeedMember[];
}

export interface FeedMember {
  id: string;
  name: string;
  phone: string | null;
  isOrganiser: boolean;
  sortOrder: number;
  sharePaise: number;
  state: MemberPayState;
  /** Confirmed so far, net of refunds. */
  paidPaise: number;
  markedAt: string | null;
  upiRef: string | null;
  lastOpenedAt: string | null;
}

export async function loadFeed(kittyId: string): Promise<FeedKitty> {
  const { data, error } = await supabase
    .from('kitties')
    .select(
      'id, title, kind, status, due_date, total_paise, upi_id, share_slug, remind_day_before, remind_on_day, members(id, name, phone, is_organiser, sort_order, share_paise, last_opened_at, payments(kind, direction, status, amount_paise, marked_at, upi_ref))',
    )
    .eq('id', kittyId)
    .single();
  if (error) throw error;

  return {
    id: data.id,
    title: data.title,
    kind: data.kind,
    status: data.status,
    dueDate: data.due_date,
    totalPaise: data.total_paise,
    upiId: data.upi_id,
    slug: data.share_slug,
    remindDayBefore: data.remind_day_before,
    remindOnDay: data.remind_on_day,
    members: data.members.map((m) => {
      const shares = m.payments.filter((p) => p.direction === 'in' && (p.kind === 'share' || p.kind === 'part'));
      const marked = shares.map((p) => p.marked_at).filter((t): t is string => !!t).sort();
      return {
        id: m.id,
        name: m.name,
        phone: m.phone,
        isOrganiser: m.is_organiser,
        sortOrder: m.sort_order,
        sharePaise: m.share_paise,
        state: m.share_paise === 0 ? 'paid' : memberPayState(shares.map((p) => p.status as PaymentStatus)),
        paidPaise: m.payments
          .filter((p) => p.status === 'confirmed')
          .reduce((sum, p) => sum + (p.direction === 'in' ? p.amount_paise : -p.amount_paise), 0),
        markedAt: marked.at(-1) ?? null,
        upiRef: shares.map((p) => p.upi_ref).find(Boolean) ?? null,
        lastOpenedAt: m.last_opened_at,
      };
    }),
  };
}

/**
 * Screen 8, "Yes, it arrived". Also works for someone who paid in cash and
 * never marked it. Returns the error, if any, for explainFailure().
 */
export async function confirmShare(memberId: string) {
  const { data, error } = await supabase
    .from('payments')
    .update({ status: 'confirmed' })
    .eq('member_id', memberId)
    .eq('direction', 'in')
    .in('kind', ['share', 'part'])
    .in('status', ['requested', 'marked', 'not_received'])
    .select('id');
  if (error) return error;
  // An update that changed nothing means the login didn't reach the row.
  return data.length === 0 ? new Error('nothing confirmed') : null;
}

/** Screen 8, "Not yet, ask Dev to check". The member then sees screen 26. */
export async function markNotReceived(memberId: string) {
  const { data, error } = await supabase
    .from('payments')
    .update({ status: 'not_received' })
    .eq('member_id', memberId)
    .eq('direction', 'in')
    .in('kind', ['share', 'part'])
    .eq('status', 'marked')
    .select('id');
  if (error) return error;
  return data.length === 0 ? new Error('nothing changed') : null;
}

/** Screen 23 reminder switches. The reminders themselves are push notifications (later in step 6). */
export async function setReminder(kittyId: string, which: 'dayBefore' | 'onDay', on: boolean) {
  const { error } = await supabase
    .from('kitties')
    .update(which === 'dayBefore' ? { remind_day_before: on } : { remind_on_day: on })
    .eq('id', kittyId);
  return error;
}
