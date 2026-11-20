import type { PaymentStatus } from '@kitty/core';

import { supabase } from './supabase';

/** A payment someone says they've made, waiting for the organiser (or asked to check). */
export interface WaitingPayment {
  id: string;
  kittyId: string;
  kittyTitle: string;
  memberId: string;
  memberName: string;
  kind: 'share' | 'part' | 'topup';
  status: Extract<PaymentStatus, 'marked' | 'not_received'>;
  amountPaise: number;
  markedAt: string | null;
  upiRef: string | null;
}

export interface ActivityItem {
  id: string;
  title: string;
  body: string;
  url: string | null;
  createdAt: string;
  read: boolean;
}

const waitingQuery = () =>
  supabase
    .from('payments')
    .select('id, kind, status, amount_paise, marked_at, upi_ref, members!inner(id, name), kitties!inner(id, title, status)')
    .eq('direction', 'in')
    .in('kind', ['share', 'part', 'topup'])
    .in('status', ['marked', 'not_received'])
    .in('kitties.status', ['shared', 'settling']);

/** The Activity screen: what's waiting for you, then recent notifications. */
export async function loadActivity(): Promise<{ waiting: WaitingPayment[]; recent: ActivityItem[] }> {
  const [w, n] = await Promise.all([
    waitingQuery().order('marked_at', { ascending: false, nullsFirst: false }),
    supabase.from('notifications').select('id, title, body, url, created_at, read_at').order('created_at', { ascending: false }).limit(30),
  ]);
  if (w.error) throw w.error;
  if (n.error) throw n.error;
  return {
    waiting: w.data.map((p) => ({
      id: p.id,
      kittyId: p.kitties.id,
      kittyTitle: p.kitties.title,
      memberId: p.members.id,
      memberName: p.members.name,
      kind: p.kind as WaitingPayment['kind'],
      status: p.status as WaitingPayment['status'],
      amountPaise: p.amount_paise,
      markedAt: p.marked_at,
      upiRef: p.upi_ref,
    })),
    recent: n.data.map((x) => ({ id: x.id, title: x.title, body: x.body, url: x.url, createdAt: x.created_at, read: !!x.read_at })),
  };
}

/** The number on the Activity tab: payments people say they've made, not yet confirmed. */
export async function countWaiting(): Promise<number> {
  const { count, error } = await supabase
    .from('payments')
    .select('id, kitties!inner(status)', { count: 'exact', head: true })
    .eq('direction', 'in')
    .in('kind', ['share', 'part', 'topup'])
    .eq('status', 'marked')
    .in('kitties.status', ['shared', 'settling']);
  if (error) throw error;
  return count ?? 0;
}

export async function markActivityRead() {
  await supabase.from('notifications').update({ read_at: new Date().toISOString() }).is('read_at', null);
}
