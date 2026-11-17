import { describe, expect, it } from 'vitest';
import { billSplit, categoryFromScan, checkScannedTotal, type BillLineInput, type SplitMember } from '../src';
import { fridayBill, fridayDinner, sharesById, sum } from './fixtures';

describe('billSplit', () => {
  it('matches the wireframes (screens 5 and 11)', () => {
    const r = billSplit(fridayBill, 0, fridayDinner);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(sharesById(r.value.shares)).toEqual({
      you: 125000,
      kabir: 125000,
      dev: 125000,
      zoya: 85000,
      aisha: 40000,
      meera: 40000,
    });
    expect(r.value.totalPaise).toBe(540000);
    expect(r.value.categories.map((c) => [c.category, c.totalPaise, c.memberIds.length, c.perHeadPaise])).toEqual([
      ['veg', 240000, 6, 40000],
      ['nonveg', 180000, 4, 45000],
      ['alcohol', 120000, 3, 40000],
    ]);
  });

  it('spreads extras in proportion to each line', () => {
    // 10% service on the same bill: every share goes up by exactly 10%.
    const r = billSplit(fridayBill, 54000, fridayDinner);
    expect(r.ok && sharesById(r.value.shares)).toEqual({
      you: 137500,
      kabir: 137500,
      dev: 137500,
      zoya: 93500,
      aisha: 44000,
      meera: 44000,
    });
  });

  it('handles discounts as negative extras', () => {
    const r = billSplit(fridayBill, -54000, fridayDinner);
    expect(r.ok && r.value.totalPaise).toBe(486000);
    expect(r.ok && sum(r.value.shares.map((s) => s.sharePaise))).toBe(486000);
  });

  it('always adds up to the bill exactly, with awkward numbers', () => {
    const members: SplitMember[] = [
      { id: 'a', diet: 'nonveg', drinks: true },
      { id: 'b', diet: 'veg', drinks: true },
      { id: 'c', diet: 'nonveg', drinks: false },
      { id: 'd', diet: 'veg', drinks: false },
      { id: 'e', diet: 'nonveg', drinks: true },
      { id: 'f', diet: 'veg', drinks: false },
      { id: 'g', diet: 'nonveg', drinks: false },
    ];
    const lines: BillLineInput[] = [
      { id: '1', amountPaise: 33317, category: 'veg' },
      { id: '2', amountPaise: 47911, category: 'nonveg' },
      { id: '3', amountPaise: 89903, category: 'alcohol' },
      { id: '4', amountPaise: 1, category: 'veg' },
    ];
    for (const extras of [0, 1, 9999, 17771, -3333]) {
      const r = billSplit(lines, extras, members);
      expect(r.ok).toBe(true);
      if (!r.ok) continue;
      expect(sum(r.value.shares.map((s) => s.sharePaise))).toBe(sum(lines.map((l) => l.amountPaise)) + extras);
      expect(sum(r.value.categories.map((c) => c.totalPaise))).toBe(r.value.totalPaise);
    }
  });

  it('gives leftover paise in sort order, not always to the same person per line', () => {
    // ₹10 veg across 3 = 333.33 each with 1 paisa over. Same again on a second line.
    // Rounding once at the end means the first member gets 667 not 668.
    const three: SplitMember[] = ['a', 'b', 'c'].map((id) => ({ id, diet: 'veg', drinks: false }));
    const r = billSplit(
      [
        { id: '1', amountPaise: 1000, category: 'veg' },
        { id: '2', amountPaise: 1000, category: 'veg' },
      ],
      0,
      three,
    );
    expect(r.ok && r.value.shares.map((s) => s.sharePaise)).toEqual([667, 667, 666]);
  });

  it('never gives a leftover paisa to someone who owes nothing', () => {
    const members: SplitMember[] = [
      { id: 'veg-first', diet: 'veg', drinks: false },
      { id: 'n1', diet: 'nonveg', drinks: false },
      { id: 'n2', diet: 'nonveg', drinks: false },
      { id: 'n3', diet: 'nonveg', drinks: false },
    ];
    const r = billSplit([{ id: '1', amountPaise: 1000, category: 'nonveg' }], 0, members);
    expect(r.ok && r.value.shares.map((s) => s.sharePaise)).toEqual([0, 334, 333, 333]);
  });

  it('blocks while lines are unsure (screen 10)', () => {
    const lines: BillLineInput[] = [...fridayBill, { id: 'mtn-skh', amountPaise: 98000, category: 'unsure' }];
    expect(billSplit(lines, 0, fridayDinner)).toEqual({
      ok: false,
      error: { code: 'unsure_lines', lineIds: ['mtn-skh'] },
    });
  });

  it('blocks an alcohol line when nobody is marked as drinking', () => {
    const sober = fridayDinner.map((m) => ({ ...m, drinks: false }));
    expect(billSplit(fridayBill, 0, sober)).toEqual({
      ok: false,
      error: { code: 'no_one_eligible', category: 'alcohol', lineIds: ['beer'] },
    });
  });

  it('blocks a non-veg line when everyone is veg', () => {
    const veg = fridayDinner.map((m) => ({ ...m, diet: 'veg' as const }));
    const r = billSplit(fridayBill, 0, veg);
    expect(!r.ok && r.error.code).toBe('no_one_eligible');
  });

  it('ignores an empty category, so nobody needs to drink when there is no alcohol', () => {
    const sober = fridayDinner.map((m) => ({ ...m, drinks: false }));
    const r = billSplit(fridayBill.filter((l) => l.category !== 'alcohol'), 0, sober);
    expect(r.ok).toBe(true);
  });

  it('rejects an empty bill, no members and discounts over the total', () => {
    expect(billSplit([], 0, fridayDinner)).toEqual({ ok: false, error: { code: 'empty_bill' } });
    expect(billSplit(fridayBill, 0, [])).toEqual({ ok: false, error: { code: 'no_members' } });
    const r = billSplit(fridayBill, -600000, fridayDinner);
    expect(!r.ok && r.error.code).toBe('negative_total');
  });
});

describe('scan checks (spec section 8)', () => {
  it('marks low confidence lines as unsure', () => {
    expect(categoryFromScan('nonveg', 0.69)).toBe('unsure');
    expect(categoryFromScan('nonveg', 0.7)).toBe('nonveg');
  });

  it('allows a ₹1 difference from the printed total', () => {
    expect(checkScannedTotal([50000, 40000], 5000, 95100)).toEqual({ matches: true, differencePaise: -100 });
    expect(checkScannedTotal([50000, 40000], 5000, 95101).matches).toBe(false);
  });
});
