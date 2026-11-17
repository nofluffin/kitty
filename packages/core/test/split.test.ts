import { describe, expect, it } from 'vitest';
import { adjustedSplit, equalSplit, isEqualSplit, MoneyError, splitExact } from '../src';
import { sum } from './fixtures';

describe('splitExact (exact amounts rule)', () => {
  it('gives leftover paise one at a time in sort order', () => {
    expect(splitExact(100000, 3)).toEqual([33334, 33333, 33333]);
    expect(splitExact(100002, 4)).toEqual([25001, 25001, 25000, 25000]);
  });

  it('splits evenly with nothing left over', () => {
    expect(splitExact(600000, 6)).toEqual(Array(6).fill(100000));
  });

  it('handles fewer paise than people', () => {
    expect(splitExact(2, 3)).toEqual([1, 1, 0]);
    expect(splitExact(0, 3)).toEqual([0, 0, 0]);
  });

  it('always adds up to the total', () => {
    for (const total of [1, 99, 100000, 123457, 9999999]) {
      for (let n = 1; n <= 13; n++) {
        const parts = splitExact(total, n);
        expect(sum(parts)).toBe(total);
        expect(Math.max(...parts) - Math.min(...parts)).toBeLessThanOrEqual(1);
      }
    }
  });

  it('rejects bad input', () => {
    expect(() => splitExact(100, 0)).toThrow(MoneyError);
    expect(() => splitExact(-100, 2)).toThrow(MoneyError);
    expect(() => splitExact(100.5, 2)).toThrow(MoneyError);
  });
});

describe('equalSplit', () => {
  it('maps amounts to members in order (screen 2: ₹6,000 across 6)', () => {
    const ids = ['you', 'aisha', 'kabir', 'meera', 'dev', 'zoya'];
    expect(equalSplit(600000, ids).map((s) => s.sharePaise)).toEqual(Array(6).fill(100000));
  });

  it('needs at least one member', () => {
    expect(() => equalSplit(100, [])).toThrow(MoneyError);
  });
});

describe('adjustedSplit (screen 4)', () => {
  const six = ['aisha', 'you', 'kabir', 'meera', 'dev', 'zoya'];

  it('splits the rest across members who are not fixed', () => {
    const r = adjustedSplit(
      600000,
      six.map((id) => (id === 'aisha' ? { id, fixedPaise: 60000 } : { id })),
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.shares.map((s) => s.sharePaise)).toEqual([60000, 108000, 108000, 108000, 108000, 108000]);
    expect(r.value.shares[0]!.fixed).toBe(true);
    expect(r.value.remainderPaise).toBe(540000);
    expect(r.value.unfixedCount).toBe(5);
  });

  it('uses the exact amounts rule for the rest', () => {
    const r = adjustedSplit(100000, [{ id: 'a', fixedPaise: 0 }, { id: 'b' }, { id: 'c' }, { id: 'd' }]);
    expect(r.ok && r.value.shares.map((s) => s.sharePaise)).toEqual([0, 33334, 33333, 33333]);
  });

  it('errors when fixed amounts add up to more than the total', () => {
    const r = adjustedSplit(100000, [{ id: 'a', fixedPaise: 70000 }, { id: 'b', fixedPaise: 40000 }, { id: 'c' }]);
    expect(r).toEqual({ ok: false, error: { code: 'fixed_over_total', fixedTotal: 110000, total: 100000 } });
  });

  it('allows fixed amounts equal to the total, leaving others at zero', () => {
    const r = adjustedSplit(100000, [{ id: 'a', fixedPaise: 100000 }, { id: 'b' }]);
    expect(r.ok && r.value.shares.map((s) => s.sharePaise)).toEqual([100000, 0]);
  });

  it('errors when everyone is fixed and it does not add up', () => {
    const r = adjustedSplit(100000, [{ id: 'a', fixedPaise: 50000 }, { id: 'b', fixedPaise: 40000 }]);
    expect(r.ok).toBe(false);
    expect(!r.ok && r.error.code).toBe('all_fixed_mismatch');
  });

  it('accepts everyone fixed when it adds up', () => {
    const r = adjustedSplit(100000, [{ id: 'a', fixedPaise: 60000 }, { id: 'b', fixedPaise: 40000 }]);
    expect(r.ok).toBe(true);
  });

  it('matches equal split when nothing is fixed (reset to an equal split)', () => {
    const r = adjustedSplit(100000, [{ id: 'a' }, { id: 'b' }, { id: 'c' }]);
    expect(r.ok && r.value.shares.map((s) => s.sharePaise)).toEqual(splitExact(100000, 3));
  });
});

describe('isEqualSplit', () => {
  it('treats a one paisa difference as equal', () => {
    expect(isEqualSplit([33334, 33333, 33333])).toBe(true);
    expect(isEqualSplit([100000, 100000])).toBe(true);
  });

  it('treats real differences as different', () => {
    expect(isEqualSplit([125000, 85000, 40000])).toBe(false);
    expect(isEqualSplit([33335, 33333])).toBe(false);
  });
});
