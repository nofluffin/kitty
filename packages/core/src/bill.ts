import { assertPaise, assertSignedPaise, MoneyError, sumPaise } from './money';
import { err, ok, type Result } from './result';
import type { BillCategory, MemberShare, Paise, SplitMember } from './types';

export interface BillLineInput {
  id: string;
  amountPaise: Paise;
  category: BillCategory;
}

export type SplitCategory = Exclude<BillCategory, 'unsure'>;

const CATEGORIES: readonly SplitCategory[] = ['veg', 'nonveg', 'alcohol'];

/** Who shares each category (spec section 4, scanned bill step 2). */
export function isEligible(member: SplitMember, category: SplitCategory): boolean {
  switch (category) {
    case 'veg':
      return true;
    case 'nonveg':
      return member.diet === 'nonveg';
    case 'alcohol':
      return member.drinks;
  }
}

export type BillSplitError =
  /** Step 5: lines still marked unsure. Send the organiser to screen 10. */
  | { code: 'unsure_lines'; lineIds: string[] }
  /** Step 4: a category has lines but nobody eligible, e.g. alcohol but nobody drinks. */
  | { code: 'no_one_eligible'; category: SplitCategory; lineIds: string[] }
  | { code: 'no_members' }
  | { code: 'empty_bill' }
  /** Discounts bigger than the bill. */
  | { code: 'negative_total'; totalPaise: Paise };

export interface CategorySummary {
  category: SplitCategory;
  /** Lines in this category, before extras. */
  linesPaise: Paise;
  /** Lines plus this category's part of extras. Category totals add up to the bill total. */
  totalPaise: Paise;
  memberIds: string[];
  /** For display ("₹400 each"). Rounded, so it may differ from real shares by a paisa. */
  perHeadPaise: Paise;
}

export interface BillSplit {
  totalPaise: Paise;
  subtotalPaise: Paise;
  extrasPaise: Paise;
  shares: MemberShare[];
  categories: CategorySummary[];
}

const gcd = (a: bigint, b: bigint): bigint => (b === 0n ? a : gcd(b, a % b));
const lcm = (a: bigint, b: bigint): bigint => (a / gcd(a, b)) * b;

/**
 * Rounds exact fractions num[i] / den down to whole paise, then hands out the
 * leftover paise one at a time in order, skipping parts that were already whole.
 * Sum of the result equals `target` exactly.
 */
function roundInOrder(numerators: readonly bigint[], den: bigint, target: number): Paise[] {
  const floors = numerators.map((n) => n / den);
  const hasFraction = numerators.map((n) => n % den !== 0n);
  let leftover = target - Number(floors.reduce((a, b) => a + b, 0n));
  const out = floors.map(Number);
  for (let i = 0; i < out.length && leftover > 0; i++) {
    if (hasFraction[i]) {
      out[i]! += 1;
      leftover--;
    }
  }
  if (leftover !== 0) throw new MoneyError('rounding failed to reach the total'); // unreachable by maths
  return out;
}

/**
 * Split from a scanned bill (screens 5 and 11, spec section 4).
 * 1. Extras (tax, service, minus discounts) are spread across lines in proportion to their amount.
 * 2. Veg lines are shared by everyone, non-veg by non-veg eaters, alcohol by drinkers.
 * 3. Each person's exact share is summed across lines and rounded once, with leftover
 *    paise given one at a time in sort order, so shares add up to the bill exactly.
 */
export function billSplit(
  lines: readonly BillLineInput[],
  extrasPaise: Paise,
  members: readonly SplitMember[],
): Result<BillSplit, BillSplitError> {
  if (members.length === 0) return err({ code: 'no_members' });
  for (const l of lines) assertPaise(l.amountPaise, `line ${l.id}`);
  assertSignedPaise(extrasPaise, 'extras');

  const unsure = lines.filter((l) => l.category === 'unsure');
  if (unsure.length > 0) return err({ code: 'unsure_lines', lineIds: unsure.map((l) => l.id) });

  const subtotalPaise = sumPaise(lines.map((l) => l.amountPaise));
  if (subtotalPaise === 0) return err({ code: 'empty_bill' });
  const totalPaise = subtotalPaise + extrasPaise;
  if (totalPaise < 0) return err({ code: 'negative_total', totalPaise });

  const byCategory = CATEGORIES.map((category) => {
    const catLines = lines.filter((l) => l.category === category);
    return {
      category,
      lineIds: catLines.map((l) => l.id),
      linesPaise: sumPaise(catLines.map((l) => l.amountPaise)),
      memberIds: members.filter((m) => isEligible(m, category)).map((m) => m.id),
    };
  });

  for (const c of byCategory) {
    if (c.lineIds.length > 0 && c.memberIds.length === 0) {
      return err({ code: 'no_one_eligible', category: c.category, lineIds: c.lineIds });
    }
  }

  // Exact share of member m = T/S * sum over their categories of (category lines / eligible count).
  // Put everything over one denominator D = S * L, where L is the lcm of the eligible counts.
  const used = byCategory.filter((c) => c.linesPaise > 0);
  const S = BigInt(subtotalPaise);
  const T = BigInt(totalPaise);
  const L = used.reduce((acc, c) => lcm(acc, BigInt(c.memberIds.length)), 1n);
  const D = S * L;

  const numerators = members.map((m) => {
    let n = 0n;
    for (const c of used) {
      if (c.memberIds.includes(m.id)) n += BigInt(c.linesPaise) * (L / BigInt(c.memberIds.length));
    }
    return n * T;
  });
  const amounts = roundInOrder(numerators, D, totalPaise);
  const shares = members.map((m, i) => ({ memberId: m.id, sharePaise: amounts[i]! }));

  const catTotals = roundInOrder(
    byCategory.map((c) => BigInt(c.linesPaise) * T),
    S,
    totalPaise,
  );
  const categories = byCategory
    .map((c, i) => ({
      category: c.category,
      linesPaise: c.linesPaise,
      totalPaise: catTotals[i]!,
      memberIds: c.memberIds,
      perHeadPaise: c.memberIds.length > 0 ? Math.round(catTotals[i]! / c.memberIds.length) : 0,
    }))
    .filter((c) => c.linesPaise > 0);

  return ok({ totalPaise, subtotalPaise, extrasPaise, shares, categories });
}

/** Lines below this confidence become `unsure` and go to screen 10 (spec section 8). */
export const UNSURE_CONFIDENCE = 0.7;

export function categoryFromScan(category: BillCategory, confidence: number): BillCategory {
  return confidence < UNSURE_CONFIDENCE ? 'unsure' : category;
}

/** Lines plus extras must match the printed total within ₹1, or the bill needs review. */
export const SCAN_TOLERANCE_PAISE = 100;

export function checkScannedTotal(
  linesPaise: readonly Paise[],
  extrasPaise: Paise,
  printedTotalPaise: Paise,
): { matches: boolean; differencePaise: Paise } {
  const differencePaise = sumPaise(linesPaise) + extrasPaise - printedTotalPaise;
  return { matches: Math.abs(differencePaise) <= SCAN_TOLERANCE_PAISE, differencePaise };
}
