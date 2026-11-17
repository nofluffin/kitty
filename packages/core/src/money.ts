import type { Paise } from './types';

export class MoneyError extends Error {
  override name = 'MoneyError';
}

/** Throws unless `value` is a whole, safe, non-negative number of paise. */
export function assertPaise(value: number, label = 'amount'): asserts value is Paise {
  if (!Number.isSafeInteger(value)) {
    throw new MoneyError(`${label} must be a whole number of paise, got ${value}`);
  }
  if (value < 0) {
    throw new MoneyError(`${label} cannot be negative, got ${value}`);
  }
}

/** Like assertPaise but allows negative values, for differences and discounts. */
export function assertSignedPaise(value: number, label = 'amount'): asserts value is Paise {
  if (!Number.isSafeInteger(value)) {
    throw new MoneyError(`${label} must be a whole number of paise, got ${value}`);
  }
}

/** Indian digit grouping: 1234567 -> "12,34,567". */
function groupIndian(digits: string): string {
  if (digits.length <= 3) return digits;
  const last3 = digits.slice(-3);
  let rest = digits.slice(0, -3);
  const groups: string[] = [];
  while (rest.length > 2) {
    groups.unshift(rest.slice(-2));
    rest = rest.slice(0, -2);
  }
  if (rest.length > 0) groups.unshift(rest);
  return `${groups.join(',')},${last3}`;
}

/**
 * Formats paise for display.
 * Shows paise only when there are any: ₹1,031.67 but ₹1,000.
 * Uses Indian grouping: ₹1,00,000.
 */
export function formatRupees(paise: Paise): string {
  assertSignedPaise(paise);
  const sign = paise < 0 ? '-' : '';
  const abs = Math.abs(paise);
  const rupees = Math.floor(abs / 100);
  const rem = abs % 100;
  const whole = `${sign}₹${groupIndian(String(rupees))}`;
  return rem === 0 ? whole : `${whole}.${String(rem).padStart(2, '0')}`;
}

/** Rupees with exactly two decimals and no symbol or grouping, as UPI's `am` field wants: "1000.00". */
export function toUpiAmount(paise: Paise): string {
  assertPaise(paise);
  return `${Math.floor(paise / 100)}.${String(paise % 100).padStart(2, '0')}`;
}

/**
 * Parses what an organiser types into a rupee field.
 * Accepts "1000", "1,000", "₹1,031.67", "1031.5". Rejects more than two decimals.
 * Returns null when the text is not a valid amount.
 */
export function parseRupees(input: string): Paise | null {
  const cleaned = input.trim().replace(/^₹\s*/, '').replace(/,/g, '');
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(cleaned);
  if (!match) return null;
  const rupees = Number(match[1]);
  const fraction = (match[2] ?? '').padEnd(2, '0');
  const paise = rupees * 100 + Number(fraction);
  return Number.isSafeInteger(paise) ? paise : null;
}

export function sumPaise(values: readonly Paise[]): Paise {
  let total = 0;
  for (const v of values) total += v;
  return total;
}
