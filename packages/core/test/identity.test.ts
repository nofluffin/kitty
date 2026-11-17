import { describe, expect, it } from 'vitest';
import { cleanName, formatIndianMobile, initials, isValidEmail, normaliseEmail, normaliseIndianMobile } from '../src';

describe('normaliseIndianMobile', () => {
  it('accepts the ways people type a mobile number', () => {
    for (const input of ['9876543210', '98765 43210', '+91 98765 43210', '+91-98765-43210', '919876543210', '09876543210', '(98765) 43210']) {
      expect(normaliseIndianMobile(input), input).toBe('+919876543210');
    }
  });

  it('rejects numbers that are not Indian mobiles', () => {
    for (const input of ['', '12345', '5876543210', '98765432101', '+1 415 555 0100', '98765abcde']) {
      expect(normaliseIndianMobile(input), input).toBeNull();
    }
  });
});

describe('formatIndianMobile', () => {
  it('groups the digits for display', () => {
    expect(formatIndianMobile('+919876543210')).toBe('+91 98765 43210');
    expect(formatIndianMobile('+14155550100')).toBe('+14155550100');
  });
});

describe('email', () => {
  it('normalises and checks addresses', () => {
    expect(normaliseEmail('  Rohan@Example.COM ')).toBe('rohan@example.com');
    expect(isValidEmail('rohan@example.com')).toBe(true);
    expect(isValidEmail('rohan.k+kitty@mail.co.in')).toBe(true);
    for (const bad of ['', 'rohan', 'rohan@', '@example.com', 'rohan@example', 'ro han@example.com']) {
      expect(isValidEmail(bad), bad).toBe(false);
    }
  });
});

describe('cleanName', () => {
  it('collapses spaces and rejects empty or long names', () => {
    expect(cleanName('  Rohan   Mehta ')).toBe('Rohan Mehta');
    expect(cleanName('   ')).toBeNull();
    expect(cleanName('x'.repeat(81))).toBeNull();
  });
});

describe('initials', () => {
  it('uses the first and last names', () => {
    expect(initials('Rohan Mehta')).toBe('RM');
    expect(initials('zoya')).toBe('Z');
    expect(initials('Anna Maria Lopez')).toBe('AL');
    expect(initials('')).toBe('');
  });
});
