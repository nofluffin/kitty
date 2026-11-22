import {
  memberPayState,
  partsProgress,
  type Diet,
  type KittyKind,
  type KittyStatus,
  type MemberPayState,
  type PartsProgress,
  type PaymentStatus,
} from '@kitty/core';

import { isEditable } from './edit-kitty';
import { supabase } from './supabase';

/** Everything screens 7, 8 and 23 need about one kitty. */
export interface FeedKitty {
  id: string;
  title: string;
  kind: KittyKind;
  status: KittyStatus;
  /** Shared kitties always have one; a draft may not yet (Raj, 22 Nov 2026). */
  dueDate: string | null;
  totalPaise: number;
  upiId: string;
  slug: string;
  amountSource: 'typed' | 'scanned';
  remindDayBefore: boolean;
  remindOnDay: boolean;
  /** Set once the organiser settles up (step 7). */
  finalBillPaise: number | null;
  /** Goals paid in parts. */
  partsCount: number | null;
  /** Nobody but the organiser has paid yet, so amounts can still be edited (decided 20 Nov 2026). */
  editable: boolean;
  /** A bill has been scanned and checked, so the button says "Rescan the bill". */
  hasBill: boolean;
  /** Filed away by the organiser (Archived kitties). */
  archivedAt: string | null;
  members: FeedMember[];
}

/** A top-up or refund after settle up. */
export interface Adjustment {
  status: PaymentStatus;
  amountPaise: number;
  markedAt: string | null;
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
  /** True when the organiser typed this share by hand. */
  shareFixed: boolean;
  diet: Diet;
  drinks: boolean;
  /** New share after settle up. */
  finalSharePaise: number | null;
  /** Where the member asked for their refund to go (screen 18). */
  refundUpiId: string | null;
  topUp: Adjustment | null;
  refund: Adjustment | null;
  /** Goals paid in parts: how many are paid and which is next. */
  parts: PartsProgress | null;
  /** Who pays this person's share, if someone else does (e.g. a parent). */
  paidById: string | null;
  /** The people this person pays for, by name. */
  paysFor: string[];
  /** What this person is asked for: their own share plus those they pay for. Zero if someone else pays. */
  askPaise: number;
}

export async function loadFeed(kittyId: string): Promise<FeedKitty> {
  const { data, error } = await supabase
    .from('kitties')
    .select(
      'id, title, kind, status, due_date, total_paise, upi_id, share_slug, amount_source, remind_day_before, remind_on_day, final_bill_paise, parts_count, archived_at, bills(status), members(id, name, phone, is_organiser, sort_order, share_paise, share_fixed, diet, drinks, final_share_paise, refund_upi_id, last_opened_at, paid_by_member_id, payments(kind, direction, status, amount_paise, due_date, marked_at, upi_ref))',
    )
    .eq('id', kittyId)
    .single();
  if (error) throw error;

  const members: FeedMember[] = data.members.map((m) => {
    const adjustment = (kind: 'topup' | 'refund'): Adjustment | null => {
      const p = m.payments.find((x) => x.kind === kind);
      return p ? { status: p.status as PaymentStatus, amountPaise: p.amount_paise, markedAt: p.marked_at } : null;
    };
    const shares = m.payments.filter((p) => p.direction === 'in' && (p.kind === 'share' || p.kind === 'part'));
    const marked = shares.map((p) => p.marked_at).filter((t): t is string => !!t).sort();
    const dependants = data.members.filter((x) => x.paid_by_member_id === m.id);
    return {
      id: m.id,
      name: m.name,
      phone: m.phone,
      isOrganiser: m.is_organiser,
      sortOrder: m.sort_order,
      sharePaise: m.share_paise,
      state: m.share_paise + dependants.reduce((s, d) => s + d.share_paise, 0) === 0 ? 'paid' : memberPayState(shares.map((p) => p.status as PaymentStatus)),
      paidPaise: m.payments
        .filter((p) => p.status === 'confirmed')
        .reduce((sum, p) => sum + (p.direction === 'in' ? p.amount_paise : -p.amount_paise), 0),
      markedAt: marked.at(-1) ?? null,
      upiRef: shares.map((p) => p.upi_ref).find(Boolean) ?? null,
      lastOpenedAt: m.last_opened_at,
      shareFixed: m.share_fixed,
      diet: m.diet,
      drinks: m.drinks,
      finalSharePaise: m.final_share_paise,
      refundUpiId: m.refund_upi_id,
      topUp: adjustment('topup'),
      refund: adjustment('refund'),
      parts: data.parts_count
        ? partsProgress(
            m.payments
              .filter((p) => p.kind === 'part' && p.due_date)
              .map((p) => ({ amountPaise: p.amount_paise, dueDate: p.due_date!, status: p.status as PaymentStatus })),
          )
        : null,
      paidById: m.paid_by_member_id,
      paysFor: [...dependants].sort((a, b) => a.sort_order - b.sort_order).map((d) => d.name),
      askPaise: m.paid_by_member_id ? 0 : m.share_paise + dependants.reduce((s, d) => s + d.share_paise, 0),
    };
  });
  // Someone paid for by another person stands wherever their payer stands.
  for (const m of members) {
    const payer = m.paidById ? members.find((x) => x.id === m.paidById) : null;
    if (payer) m.state = payer.state;
  }

  return {
    id: data.id,
    title: data.title,
    kind: data.kind,
    status: data.status,
    dueDate: data.due_date,
    totalPaise: data.total_paise,
    upiId: data.upi_id,
    slug: data.share_slug,
    amountSource: data.amount_source,
    remindDayBefore: data.remind_day_before,
    remindOnDay: data.remind_on_day,
    finalBillPaise: data.final_bill_paise,
    partsCount: data.parts_count,
    hasBill: data.bills.some((b) => b.status === 'confirmed'),
    archivedAt: data.archived_at,
    editable: isEditable(
      data.status,
      data.members.flatMap((m) => m.payments.map((p) => ({ isOrganiser: m.is_organiser, status: p.status }))),
    ),
    members,
  };
}

/**
 * Screen 8, "Yes, it arrived". Also works for someone who paid in cash and
 * never marked it. Returns the error, if any, for explainFailure().
 */
export async function confirmShare(memberId: string) {
  // Confirm what the member said they paid. If they never marked it (cash), confirm the
  // earliest open payment only, so a goal's later parts stay open.
  const open = await supabase
    .from('payments')
    .select('id, status, due_date')
    .eq('member_id', memberId)
    .eq('direction', 'in')
    .in('kind', ['share', 'part'])
    .in('status', ['requested', 'marked', 'not_received'])
    .order('due_date', { ascending: true, nullsFirst: true });
  if (open.error) return open.error;
  const marked = open.data.filter((p) => p.status === 'marked' || p.status === 'not_received');
  const ids = (marked.length > 0 ? marked : open.data.slice(0, 1)).map((p) => p.id);
  if (ids.length === 0) return new Error('nothing to confirm');
  const { data, error } = await supabase.from('payments').update({ status: 'confirmed' }).in('id', ids).select('id');
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

/** Food and drink matter for the scanned split; organisers can fix them on screen 11. */
export async function setMemberDietDrinks(memberId: string, change: { diet?: Diet; drinks?: boolean }) {
  const { error } = await supabase.from('members').update(change).eq('id', memberId);
  return error;
}
