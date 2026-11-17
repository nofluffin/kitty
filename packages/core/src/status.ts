import type { KittyStatus, PaymentStatus } from './types';

/**
 * Allowed status changes. The database enforces the same rules with a trigger,
 * so the apps can check first and show a clear message.
 */
const KITTY_NEXT: Record<KittyStatus, readonly KittyStatus[]> = {
  draft: ['shared', 'cancelled'],
  shared: ['settling', 'closed', 'cancelled'],
  settling: ['closed'],
  closed: [],
  cancelled: [],
};

export function canMoveKitty(from: KittyStatus, to: KittyStatus): boolean {
  return KITTY_NEXT[from].includes(to);
}

/** Amounts and members can change only while a kitty is a draft (spec section 4, "Lock"). */
export function sharesEditable(status: KittyStatus): boolean {
  return status === 'draft';
}

const PAYMENT_NEXT: Record<PaymentStatus, readonly PaymentStatus[]> = {
  requested: ['marked', 'confirmed', 'written_off'],
  marked: ['confirmed', 'not_received', 'written_off'],
  not_received: ['marked', 'confirmed', 'written_off'],
  confirmed: [],
  written_off: [],
};

export function canMovePayment(from: PaymentStatus, to: PaymentStatus): boolean {
  return PAYMENT_NEXT[from].includes(to);
}
