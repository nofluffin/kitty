import { describe, expect, it } from 'vitest';
import { cleanName, distinctNames, youLabel, formatIndianMobile, initials, isValidEmail, normaliseEmail, normaliseIndianMobile } from '../src';

describe('normaliseIndianMobile', () => {
  it('accepts the ways people type a mobile number', () => {
    for (const input of ['9876543210', '98765 43210', '+91 98765 43210', '+91-98765-43210', '919876543210', '09876543210', '(98765) 43210']) {
      expect(normaliseIndianMobile(input), input).toBe('+919876543210');
    }
  });

  it('accepts numbers as phone contacts store them', () => {
    // iPhone wraps numbers in invisible direction marks; some contacts use 0091 or non-breaking spaces.
    for (const input of ['\u202a+91 98765 43210\u202c', '+91\u00a098765\u00a043210', '0091 98765 43210', '+91 (987) 654-3210', '+91 98765.43210']) {
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

describe('distinctNames', () => {
  it('adds the last four digits only where names clash', () => {
    expect(
      distinctNames([
        { name: 'Biba Bajaj', phone: '+919811114321' },
        { name: 'biba  bajaj', phone: '+919822229876' },
        { name: 'Gaurav', phone: '+919800000001' },
        { name: 'Kabir' },
      ]),
    ).toEqual(['Biba Bajaj (…4321)', 'biba  bajaj (…9876)', 'Gaurav', 'Kabir']);
  });
  it('leaves a clashing name without a number as it is', () => {
    expect(distinctNames([{ name: 'Api' }, { name: 'Api', phone: '+919811110000' }])).toEqual(['Api', 'Api (…0000)']);
  });
});

describe('youLabel', () => {
  it('shows the name with (You)', () => {
    expect(youLabel(' Raj  Rana ')).toBe('Raj Rana (You)');
  });
  it('falls back to You', () => {
    expect(youLabel('')).toBe('You');
    expect(youLabel(null)).toBe('You');
    expect(youLabel('You')).toBe('You');
  });
});
