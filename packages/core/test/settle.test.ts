import { describe, expect, it } from 'vitest';
import { confirmedNetPaid, settleUp, typedBillShares, type PaymentForTotals, type SettleMemberInput } from '../src';

const member = (memberId: string, newSharePaise: number, confirmedPaidPaise: number, isOrganiser = false): SettleMemberInput => ({
  memberId,
  newSharePaise,
  confirmedPaidPaise,
  isOrganiser,
});

describe('settleUp', () => {
  it('matches screen 12: everyone paid ₹1,000, bill came to ₹5,400', () => {
    const s = settleUp(540000, [
      member('you', 125000, 100000, true),
      member('kabir', 125000, 100000),
      member('dev', 125000, 100000),
      member('zoya', 85000, 100000),
      member('aisha', 40000, 100000),
      member('meera', 40000, 100000),
    ]);
    expect(s.lines.map((l) => [l.memberId, l.action])).toEqual([
      ['you', { kind: 'organiser' }],
      ['kabir', { kind: 'topup', amountPaise: 25000, neverPaid: false }],
      ['dev', { kind: 'topup', amountPaise: 25000, neverPaid: false }],
      ['zoya', { kind: 'refund', amountPaise: 15000 }],
      ['aisha', { kind: 'refund', amountPaise: 60000 }],
      ['meera', { kind: 'refund', amountPaise: 60000 }],
    ]);
    expect(s.collectedPaise).toBe(600000);
    expect(s.toRefundPaise).toBe(135000);
    expect(s.toComeInPaise).toBe(50000);
    expect(s.square).toBe(false);
  });

  it('matches screen 13: Zoya never paid and owes her full new share', () => {
    const s = settleUp(540000, [
      member('you', 125000, 100000, true),
      member('kabir', 125000, 100000),
      member('dev', 125000, 100000),
      member('zoya', 85000, 0),
      member('aisha', 40000, 100000),
      member('meera', 40000, 100000),
    ]);
    expect(s.lines.find((l) => l.memberId === 'zoya')!.action).toEqual({
      kind: 'topup',
      amountPaise: 85000,
      neverPaid: true,
    });
    expect(s.collectedPaise).toBe(500000);
    expect(s.toComeInPaise).toBe(135000); // "You are covering for now ₹1,350"
  });

  it('is square when shares already match the bill (scanned before sharing)', () => {
    const s = settleUp(200000, [member('you', 100000, 100000, true), member('a', 100000, 100000)]);
    expect(s.square).toBe(true);
    expect(s.lines[1]!.action).toEqual({ kind: 'square' });
  });

  it('never asks the organiser to pay or refund themselves', () => {
    const s = settleUp(300000, [member('you', 200000, 100000, true), member('a', 100000, 100000)]);
    expect(s.lines[0]!.action).toEqual({ kind: 'organiser' });
    expect(s.square).toBe(true);
  });
});

describe('confirmedNetPaid', () => {
  const p = (memberId: string, direction: 'in' | 'out', status: PaymentForTotals['status'], amountPaise: number): PaymentForTotals => ({
    memberId,
    direction,
    status,
    amountPaise,
  });

  it('counts only confirmed payments, net of refunds sent', () => {
    const payments = [
      p('a', 'in', 'confirmed', 100000),
      p('a', 'in', 'marked', 25000),
      p('a', 'out', 'confirmed', 15000),
      p('a', 'in', 'not_received', 5000),
      p('b', 'in', 'confirmed', 99999),
    ];
    expect(confirmedNetPaid(payments, 'a')).toBe(85000);
    expect(confirmedNetPaid(payments, 'c')).toBe(0);
  });
});

describe('typedBillShares', () => {
  it('keeps typed amounts and splits the rest equally', () => {
    // ₹6,000 kitty where Aisha was fixed at ₹600; the bill came to ₹5,400.
    const r = typedBillShares(540000, [
      { id: 'you', sharePaise: 135000, fixed: false },
      { id: 'aisha', sharePaise: 60000, fixed: true },
      { id: 'kabir', sharePaise: 135000, fixed: false },
      { id: 'dev', sharePaise: 135000, fixed: false },
      { id: 'zoya', sharePaise: 135000, fixed: false },
    ]);
    expect(r.ok && r.value.shares.map((s) => s.sharePaise)).toEqual([120000, 60000, 120000, 120000, 120000]);
  });

  it('splits equally with leftover paise in sort order when nothing was typed', () => {
    const r = typedBillShares(100000, ['a', 'b', 'c'].map((id) => ({ id, sharePaise: 50000, fixed: false })));
    expect(r.ok && r.value.shares.map((s) => s.sharePaise)).toEqual([33334, 33333, 33333]);
  });

  it('refuses a bill smaller than the typed amounts', () => {
    const r = typedBillShares(50000, [
      { id: 'a', sharePaise: 60000, fixed: true },
      { id: 'b', sharePaise: 10000, fixed: false },
    ]);
    expect(!r.ok && r.error.code).toBe('fixed_over_total');
  });
});
