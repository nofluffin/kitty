import { addMonths } from './dates';
import { assertPaise, MoneyError } from './money';
import { err, ok, type Result } from './result';
import type { IsoDate, Paise, PaymentStatus } from './types';

export interface GoalPart {
  /** 1-based, for "Part 2 of 3". */
  partNumber: number;
  amountPaise: Paise;
  dueDate: IsoDate;
}

export type GoalPartsError = {
  code: 'first_part_in_past';
  firstDueDate: IsoDate;
  /** Most parts that still fit between today and the due date. */
  maxParts: number;
};

/**
 * Goals paid in parts (spec section 4).
 * One member's share is split into `partsCount` equal monthly parts.
 * The last part falls on the kitty's due date and carries any leftover paise.
 */
export function goalParts(
  sharePaise: Paise,
  partsCount: number,
  dueDate: IsoDate,
  today: IsoDate,
): Result<GoalPart[], GoalPartsError> {
  assertPaise(sharePaise, 'share');
  if (!Number.isSafeInteger(partsCount) || partsCount < 1) {
    throw new MoneyError(`parts count must be a positive whole number, got ${partsCount}`);
  }

  const firstDueDate = addMonths(dueDate, -(partsCount - 1));
  if (firstDueDate < today) {
    let maxParts = 0;
    while (addMonths(dueDate, -maxParts) >= today) maxParts++;
    return err({ code: 'first_part_in_past', firstDueDate, maxParts });
  }

  const base = Math.floor(sharePaise / partsCount);
  const last = sharePaise - base * (partsCount - 1);
  return ok(
    Array.from({ length: partsCount }, (_, i) => ({
      partNumber: i + 1,
      amountPaise: i === partsCount - 1 ? last : base,
      dueDate: addMonths(dueDate, -(partsCount - 1 - i)),
    })),
  );
}

/** The most monthly parts that fit between today and the due date (the last part falls on it). */
export function maxGoalParts(dueDate: IsoDate, today: IsoDate): number {
  let n = 0;
  while (addMonths(dueDate, -n) >= today) n++;
  return n;
}

export interface PartPayment {
  amountPaise: Paise;
  dueDate: IsoDate;
  status: PaymentStatus;
}

export interface NextPart extends PartPayment {
  partNumber: number;
}

export interface PartsProgress {
  /** Parts the organiser has confirmed. */
  paid: number;
  /** Parts still asked for (written-off parts don't count). */
  total: number;
  /** The earliest part not yet confirmed: the one to pay (or that is waiting) now. */
  next: NextPart | null;
}

/** "Part 1 of 3 paid, next ₹3,334 by Sat 12 Dec" for a member's goal parts. */
export function partsProgress(parts: readonly PartPayment[]): PartsProgress {
  const ordered = [...parts].sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  const live = ordered.filter((p) => p.status !== 'written_off');
  const nextIndex = ordered.findIndex((p) => p.status !== 'confirmed' && p.status !== 'written_off');
  return {
    paid: live.filter((p) => p.status === 'confirmed').length,
    total: live.length,
    next: nextIndex === -1 ? null : { ...ordered[nextIndex]!, partNumber: nextIndex + 1 },
  };
}
