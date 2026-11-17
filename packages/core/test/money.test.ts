import { describe, expect, it } from 'vitest';
import { formatRupees, MoneyError, parseRupees, toUpiAmount } from '../src';

describe('formatRupees', () => {
  it('shows paise only when there are any', () => {
    expect(formatRupees(103167)).toBe('₹1,031.67');
    expect(formatRupees(100000)).toBe('₹1,000');
    expect(formatRupees(33334)).toBe('₹333.34');
    expect(formatRupees(105)).toBe('₹1.05');
    expect(formatRupees(5)).toBe('₹0.05');
    expect(formatRupees(0)).toBe('₹0');
  });

  it('uses Indian digit grouping', () => {
    expect(formatRupees(5000000)).toBe('₹50,000');
    expect(formatRupees(10000000)).toBe('₹1,00,000');
    expect(formatRupees(123456789)).toBe('₹12,34,567.89');
    expect(formatRupees(10000000000)).toBe('₹10,00,00,000');
  });

  it('formats negative differences', () => {
    expect(formatRupees(-60000)).toBe('-₹600');
  });

  it('rejects fractions of a paisa', () => {
    expect(() => formatRupees(10.5)).toThrow(MoneyError);
  });
});

describe('toUpiAmount', () => {
  it('always has two decimals and no grouping', () => {
    expect(toUpiAmount(100000)).toBe('1000.00');
    expect(toUpiAmount(103167)).toBe('1031.67');
    expect(toUpiAmount(5)).toBe('0.05');
  });
});

describe('parseRupees', () => {
  it('reads what an organiser types', () => {
    expect(parseRupees('6000')).toBe(600000);
    expect(parseRupees('6,000')).toBe(600000);
    expect(parseRupees('₹1,031.67')).toBe(103167);
    expect(parseRupees(' ₹ 1031.5 ')).toBe(103150);
    expect(parseRupees('0.05')).toBe(5);
  });

  it('rejects anything that is not an amount', () => {
    for (const bad of ['', 'abc', '10.555', '-5', '1e3', '.5', '10.']) {
      expect(parseRupees(bad), bad).toBeNull();
    }
  });
});
