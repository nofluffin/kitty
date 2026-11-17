import { describe, expect, it } from 'vitest';
import { buildUpiAppLinks, buildUpiUri, isValidUpiId, kittyPaymentNote } from '../src';

const payment = {
  payeeUpiId: 'rohan@okicici',
  payeeName: 'Rohan',
  amountPaise: 100000,
  note: kittyPaymentNote('Friday dinner'),
};

describe('buildUpiUri', () => {
  it('builds the link from spec section 5', () => {
    expect(buildUpiUri(payment)).toBe(
      'upi://pay?pa=rohan@okicici&pn=Rohan&am=1000.00&cu=INR&tn=Kitty%20Friday%20dinner',
    );
  });

  it('sends exact paise', () => {
    expect(buildUpiUri({ ...payment, amountPaise: 33334 })).toContain('am=333.34&');
  });

  it('encodes names and notes safely', () => {
    const uri = buildUpiUri({ ...payment, payeeName: 'Rohan & Co', note: 'Kitty Dinner #2 = fun?' });
    expect(uri).toContain('pn=Rohan%20%26%20Co');
    expect(uri).toContain('tn=Kitty%20Dinner%20%232%20%3D%20fun%3F');
  });

  it('normalises the UPI ID and trims long notes to 50 characters', () => {
    const uri = buildUpiUri({ ...payment, payeeUpiId: '  Rohan@OKICICI ', note: `Kitty ${'x'.repeat(80)}` });
    expect(uri).toContain('pa=rohan@okicici&');
    const tn = decodeURIComponent(uri.split('tn=')[1]!);
    expect(tn.length).toBe(50);
  });

  it('refuses a bad UPI ID or a zero amount', () => {
    expect(() => buildUpiUri({ ...payment, payeeUpiId: 'rohan' })).toThrow(RangeError);
    expect(() => buildUpiUri({ ...payment, amountPaise: 0 })).toThrow(RangeError);
  });
});

describe('buildUpiAppLinks', () => {
  it('uses the same query for each app', () => {
    const links = buildUpiAppLinks(payment);
    const query = buildUpiUri(payment).split('?')[1];
    expect(links.gpay).toBe(`gpay://upi/pay?${query}`);
    expect(links.phonepe).toBe(`phonepe://pay?${query}`);
    expect(links.paytm).toBe(`paytmmp://pay?${query}`);
  });
});

describe('isValidUpiId', () => {
  it('accepts common formats', () => {
    for (const id of ['rohan@okicici', '9876543210@ybl', 'rohan.k-1_2@paytm', 'name@oksbi']) {
      expect(isValidUpiId(id), id).toBe(true);
    }
  });

  it('rejects typos', () => {
    for (const id of ['rohan', '@okicici', 'rohan@', 'ro han@ybl', 'rohan@@ybl', 'r@1bank']) {
      expect(isValidUpiId(id), id).toBe(false);
    }
  });
});
