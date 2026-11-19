import type { PaymentStatus } from './types';

/**
 * How a member stands on their share, as the member page shows it.
 * paid: the organiser confirmed it. waiting: the member said they paid.
 * not_received: the organiser said "Not yet" (screen 26). unpaid: nothing yet.
 */
export type MemberPayState = 'paid' | 'waiting' | 'not_received' | 'unpaid';

/** From the statuses of a member's share payments (one for a moment kitty). */
export function memberPayState(statuses: readonly PaymentStatus[]): MemberPayState {
  const owed = statuses.filter((s) => s !== 'written_off');
  if (owed.length > 0 && owed.every((s) => s === 'confirmed')) return 'paid';
  if (owed.some((s) => s === 'not_received')) return 'not_received';
  if (owed.some((s) => s === 'marked')) return 'waiting';
  if (owed.length === 0 && statuses.length > 0) return 'paid'; // everything written off: nothing left to pay
  return 'unpaid';
}

export interface MemberLike {
  id: string;
  isOrganiser: boolean;
  sortOrder: number;
  state: MemberPayState;
}

const PICK_ORDER: Record<MemberPayState, number> = { unpaid: 0, not_received: 0, waiting: 1, paid: 2 };

/**
 * "Who are you?" on screen 14: everyone but the organiser, people who still
 * have to pay first, then those waiting for confirmation, then those who've paid.
 */
export function pickList<T extends MemberLike>(members: readonly T[]): T[] {
  return members
    .filter((m) => !m.isOrganiser)
    .sort((a, b) => PICK_ORDER[a.state] - PICK_ORDER[b.state] || a.sortOrder - b.sortOrder);
}

/** Screen 16's list: you first, then people waiting, then everyone else in sort order. */
export function statusList<T extends MemberLike>(members: readonly T[], meId: string): T[] {
  const rank = (m: T) => (m.id === meId ? 0 : m.state === 'waiting' ? 1 : m.state === 'paid' ? 3 : 2);
  return [...members].sort((a, b) => rank(a) - rank(b) || a.sortOrder - b.sortOrder);
}

/** "4 of 6 have paid" and "2 waiting for Rohan". The organiser's own share counts. */
export function payProgress(members: readonly { state: MemberPayState }[]): {
  paid: number;
  waiting: number;
  total: number;
} {
  return {
    paid: members.filter((m) => m.state === 'paid').length,
    waiting: members.filter((m) => m.state === 'waiting').length,
    total: members.length,
  };
}
