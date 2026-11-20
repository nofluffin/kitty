import { describe, expect, it } from 'vitest';
import { addDays, addMonths, daysBetween, describeDay, describeWhen, formatShortDate, goalParts, localIsoDate, parseIsoDate, timeToGo } from '../src';
import { sum } from './fixtures';

describe('goalParts', () => {
  it('splits a share into monthly parts ending on the due date', () => {
    // Goa trip: ₹10,000 each, due Tue 12 Jan 2027, in 2 parts.
    const r = goalParts(1000000, 2, '2027-01-12', '2026-11-17');
    expect(r).toEqual({
      ok: true,
      value: [
        { partNumber: 1, amountPaise: 500000, dueDate: '2026-12-12' },
        { partNumber: 2, amountPaise: 500000, dueDate: '2027-01-12' },
      ],
    });
  });

  it('puts leftover paise on the last part', () => {
    const r = goalParts(1000000, 3, '2027-03-31', '2026-11-17');
    expect(r.ok && r.value.map((p) => p.amountPaise)).toEqual([333333, 333333, 333334]);
    expect(r.ok && sum(r.value.map((p) => p.amountPaise))).toBe(1000000);
  });

  it('clamps to the end of shorter months', () => {
    const r = goalParts(300, 3, '2027-03-31', '2026-11-17');
    expect(r.ok && r.value.map((p) => p.dueDate)).toEqual(['2027-01-31', '2027-02-28', '2027-03-31']);
  });

  it('allows one part, due on the due date', () => {
    const r = goalParts(1000000, 1, '2027-01-12', '2026-11-17');
    expect(r.ok && r.value).toEqual([{ partNumber: 1, amountPaise: 1000000, dueDate: '2027-01-12' }]);
  });

  it('refuses parts that would start in the past and says how many fit', () => {
    const r = goalParts(1000000, 4, '2027-01-12', '2026-11-17');
    expect(r).toEqual({
      ok: false,
      error: { code: 'first_part_in_past', firstDueDate: '2026-10-12', maxParts: 2 },
    });
  });

  it('counts today as a valid first due date', () => {
    expect(goalParts(100, 2, '2026-12-17', '2026-11-17').ok).toBe(true);
  });
});

describe('dates', () => {
  it('formats short dates for messages', () => {
    expect(formatShortDate('2026-11-20')).toBe('Fri 20 Nov');
    expect(formatShortDate('2027-01-12')).toBe('Tue 12 Jan');
    expect(formatShortDate('2026-11-21')).toBe('Sat 21 Nov');
  });

  it('does maths on calendar dates', () => {
    expect(addMonths('2027-01-31', 1)).toBe('2027-02-28');
    expect(addMonths('2028-01-31', 1)).toBe('2028-02-29');
    expect(addMonths('2027-01-12', -2)).toBe('2026-11-12');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(daysBetween('2026-11-16', '2026-11-20')).toBe(4); // "4 days to go"
  });

  it('rejects dates that do not exist', () => {
    expect(() => parseIsoDate('2026-02-30')).toThrow(RangeError);
    expect(() => parseIsoDate('20 Nov')).toThrow(RangeError);
  });
});

describe('localIsoDate and timeToGo', () => {
  it('uses the device date, not UTC', () => {
    expect(localIsoDate(new Date(2026, 10, 17, 23, 59))).toBe('2026-11-17');
    expect(localIsoDate(new Date(2027, 0, 1, 0, 1))).toBe('2027-01-01');
  });

  it('describes how long is left like the wireframes', () => {
    expect(timeToGo('2026-11-16', '2026-11-20')).toBe('4 days to go');
    expect(timeToGo('2026-11-17', '2027-01-12')).toBe('8 weeks to go');
    expect(timeToGo('2026-11-20', '2026-11-20')).toBe('today');
    expect(timeToGo('2026-11-19', '2026-11-20')).toBe('tomorrow');
    expect(timeToGo('2026-11-21', '2026-11-20')).toBe('1 day late');
    expect(timeToGo('2026-11-25', '2026-11-20')).toBe('5 days late');
    expect(timeToGo('2026-11-01', '2026-11-14')).toBe('13 days to go');
  });
});

describe('describeWhen and describeDay', () => {
  const now = new Date(2026, 10, 19, 21, 0);
  it('says today, yesterday or the date, with a 12 hour clock', () => {
    expect(describeWhen(new Date(2026, 10, 19, 19, 42), now)).toBe('today 7:42 pm');
    expect(describeWhen(new Date(2026, 10, 18, 9, 5), now)).toBe('yesterday 9:05 am');
    expect(describeWhen(new Date(2026, 10, 16, 0, 15), now)).toBe('Mon 16 Nov 12:15 am');
    expect(describeWhen(new Date(2026, 10, 19, 12, 0), now)).toBe('today 12:00 pm');
  });
  it('describes a day on its own', () => {
    expect(describeDay(new Date(2026, 10, 18, 22, 0), now)).toBe('yesterday');
    expect(describeDay(new Date(2026, 10, 12, 10, 0), now)).toBe('on Thu 12 Nov');
  });
});
