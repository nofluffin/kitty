import { assertPaise, sumPaise } from './money';
import { adjustedSplit } from './split';
import type { Paise, PaymentDirection, PaymentStatus } from './types';

/** A payment as far as settle up cares. */
export interface PaymentForTotals {
  memberId: string;
  direction: PaymentDirection;
  status: PaymentStatus;
  amountPaise: Paise;
}

/**
 * What a member has actually paid in, net of refunds already sent.
 * Only `confirmed` counts: the organiser is the source of truth.
 */
export function confirmedNetPaid(payments: readonly PaymentForTotals[], memberId: string): Paise {
  let net = 0;
  for (const p of payments) {
    if (p.memberId !== memberId || p.status !== 'confirmed') continue;
    net += p.direction === 'in' ? p.amountPaise : -p.amountPaise;
  }
  return net;
}

export interface SettleMemberInput {
  memberId: string;
  isOrganiser: boolean;
  newSharePaise: Paise;
  confirmedPaidPaise: Paise;
}

export type SettleAction =
  /** Member owes more. Covers both top-ups and members who never paid (they owe the full new share). */
  | { kind: 'topup'; amountPaise: Paise; neverPaid: boolean }
  /** Organiser sends money back. */
  | { kind: 'refund'; amountPaise: Paise }
  | { kind: 'square' }
  /** The organiser's own share. Nothing to send: it's their own money. */
  | { kind: 'organiser' };

export interface SettleLine extends SettleMemberInput {
  /** newShare - confirmedPaid. Positive: top-up. Negative: refund. */
  differencePaise: Paise;
  action: SettleAction;
}

export interface Settlement {
  finalBillPaise: Paise;
  lines: SettleLine[];
  /** Total confirmed in, including the organiser's own auto-confirmed share. */
  collectedPaise: Paise;
  /** Still owed by members (screen 13, "You are covering for now"). */
  toComeInPaise: Paise;
  /** Still to send back. */
  toRefundPaise: Paise;
  /** True when no member owes or is owed anything. */
  square: boolean;
}

/**
 * Settle up (screens 12 and 13, spec section 4).
 * For each member: difference = new share - confirmed amount paid.
 */
export function settleUp(finalBillPaise: Paise, members: readonly SettleMemberInput[]): Settlement {
  assertPaise(finalBillPaise, 'final bill');
  const lines = members.map((m): SettleLine => {
    assertPaise(m.newSharePaise, `new share for ${m.memberId}`);
    const differencePaise = m.newSharePaise - m.confirmedPaidPaise;
    let action: SettleAction;
    if (m.isOrganiser) action = { kind: 'organiser' };
    else if (differencePaise > 0)
      action = { kind: 'topup', amountPaise: differencePaise, neverPaid: m.confirmedPaidPaise <= 0 };
    else if (differencePaise < 0) action = { kind: 'refund', amountPaise: -differencePaise };
    else action = { kind: 'square' };
    return { ...m, differencePaise, action };
  });

  const toComeInPaise = sumPaise(
    lines.flatMap((l) => (l.action.kind === 'topup' ? [l.action.amountPaise] : [])),
  );
  const toRefundPaise = sumPaise(
    lines.flatMap((l) => (l.action.kind === 'refund' ? [l.action.amountPaise] : [])),
  );

  return {
    finalBillPaise,
    lines,
    collectedPaise: sumPaise(members.map((m) => m.confirmedPaidPaise)),
    toComeInPaise,
    toRefundPaise,
    square: toComeInPaise === 0 && toRefundPaise === 0,
  };
}

export interface TypedBillMember {
  id: string;
  /** What they were asked for when the kitty was shared. */
  sharePaise: Paise;
  /** True when the organiser typed this amount by hand (`share_fixed`). */
  fixed: boolean;
}

/**
 * New shares when the organiser types the final bill (spec section 4, settle up step 2).
 * Decided 20 Nov 2026: amounts the organiser typed by hand stay as they were, and the
 * rest of the final bill is split equally across everyone else (the screen 4 rule).
 */
export function typedBillShares(finalBillPaise: Paise, members: readonly TypedBillMember[]) {
  return adjustedSplit(
    finalBillPaise,
    members.map((m) => ({ id: m.id, fixedPaise: m.fixed ? m.sharePaise : null })),
  );
}
