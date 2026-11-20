import type { MemberShare } from '@kitty/core';

import { supabase } from './supabase';

/**
 * Settle up (step 7). The shares come from packages/core (typedBillShares); the
 * database checks they add up to the bill and creates the top-ups and refunds.
 * Each function returns the error, if any, for explainFailure().
 */

export async function settleKitty(kittyId: string, finalBillPaise: number, shares: MemberShare[]) {
  const { error } = await supabase.rpc('settle_kitty', {
    p_kitty_id: kittyId,
    p_final_bill_paise: finalBillPaise,
    p_shares: shares.map((s) => ({ member_id: s.memberId, share_paise: s.sharePaise })),
  });
  return error;
}

export async function closeKitty(kittyId: string, writeOff: boolean) {
  const { error } = await supabase.rpc('close_kitty', { p_kitty_id: kittyId, p_write_off: writeOff });
  return error;
}

/** Screen 12 "Mark sent". Decided 20 Nov 2026: this or the member's "I've got it" finishes a refund. */
export async function markRefundSent(memberId: string) {
  return updateOne(memberId, 'refund', ['requested', 'marked']);
}

/** "Yes, it arrived" for a top-up, including one paid another way. */
export async function confirmTopUp(memberId: string) {
  return updateOne(memberId, 'topup', ['requested', 'marked', 'not_received']);
}

async function updateOne(memberId: string, kind: 'topup' | 'refund', from: ('requested' | 'marked' | 'not_received')[]) {
  const { data, error } = await supabase
    .from('payments')
    .update({ status: 'confirmed' })
    .eq('member_id', memberId)
    .eq('kind', kind)
    .in('status', from)
    .select('id');
  if (error) return error;
  return data.length === 0 ? new Error('nothing changed') : null;
}
