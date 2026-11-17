import { addMonths } from './dates';
import { assertPaise, MoneyError } from './money';
import { err, ok, type Result } from './result';
import type { IsoDate, Paise } from './types';

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
