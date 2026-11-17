import { assertPaise, MoneyError, sumPaise } from './money';
import { err, ok, type Result } from './result';
import type { MemberShare, Paise } from './types';

/**
 * The exact amounts rule (spec section 4).
 * Splits `total` into `count` parts that add up to `total` exactly.
 * Leftover paise go one at a time to the first parts, which callers
 * map to members in sort order: ₹1,000 / 3 -> 333.34, 333.33, 333.33.
 */
export function splitExact(total: Paise, count: number): Paise[] {
  assertPaise(total, 'total');
  if (!Number.isSafeInteger(count) || count < 1) {
    throw new MoneyError(`count must be a positive whole number, got ${count}`);
  }
  const base = Math.floor(total / count);
  const leftover = total - base * count;
  return Array.from({ length: count }, (_, i) => base + (i < leftover ? 1 : 0));
}

/** Equal split across members, in the order given (their sort order). */
export function equalSplit(total: Paise, memberIds: readonly string[]): MemberShare[] {
  if (memberIds.length === 0) throw new MoneyError('a kitty needs at least one member');
  const amounts = splitExact(total, memberIds.length);
  return memberIds.map((memberId, i) => ({ memberId, sharePaise: amounts[i]! }));
}

export interface AdjustMember {
  id: string;
  /** Set when the organiser typed this member's amount by hand (`share_fixed`). */
  fixedPaise?: Paise | null;
}

export type AdjustError =
  | { code: 'fixed_over_total'; fixedTotal: Paise; total: Paise }
  | { code: 'all_fixed_mismatch'; fixedTotal: Paise; total: Paise }
  | { code: 'no_members' };

export interface AdjustedSplit {
  shares: (MemberShare & { fixed: boolean })[];
  /** What the members who are not fixed share between them. */
  remainderPaise: Paise;
  unfixedCount: number;
}

/**
 * Adjust one person (screen 4). Fixed members keep their typed amount.
 * The rest of the total is split equally across everyone else, using the exact amounts rule.
 */
export function adjustedSplit(
  total: Paise,
  members: readonly AdjustMember[],
): Result<AdjustedSplit, AdjustError> {
  assertPaise(total, 'total');
  if (members.length === 0) return err({ code: 'no_members' });

  const fixed = members.filter((m) => m.fixedPaise != null);
  for (const m of fixed) assertPaise(m.fixedPaise!, `fixed amount for ${m.id}`);
  const fixedTotal = sumPaise(fixed.map((m) => m.fixedPaise!));

  if (fixedTotal > total) return err({ code: 'fixed_over_total', fixedTotal, total });

  const unfixed = members.filter((m) => m.fixedPaise == null);
  const remainderPaise = total - fixedTotal;
  if (unfixed.length === 0 && remainderPaise !== 0) {
    return err({ code: 'all_fixed_mismatch', fixedTotal, total });
  }

  const unfixedAmounts = unfixed.length > 0 ? splitExact(remainderPaise, unfixed.length) : [];
  let next = 0;
  const shares = members.map((m) =>
    m.fixedPaise != null
      ? { memberId: m.id, sharePaise: m.fixedPaise, fixed: true }
      : { memberId: m.id, sharePaise: unfixedAmounts[next++]!, fixed: false },
  );

  return ok({ shares, remainderPaise, unfixedCount: unfixed.length });
}

/**
 * True when shares differ only by leftover paise from the exact amounts rule
 * (at most 1 paisa apart). Decided Nov 2026: these use the "equal" share message.
 */
export function isEqualSplit(shares: readonly Paise[]): boolean {
  if (shares.length === 0) return true;
  return Math.max(...shares) - Math.min(...shares) <= 1;
}
