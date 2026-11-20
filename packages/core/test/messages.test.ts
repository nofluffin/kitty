import { describe, expect, it } from 'vitest';
import { canMoveKitty, canMovePayment, groupReminderMessage, nudgeMessage, shareMessage, sharesEditable, whatsAppUrl } from '../src';

const link = 'https://kitty.example/k/abc123def456';

describe('shareMessage', () => {
  it('uses the equal message from spec section 9 (screen 6)', () => {
    const m = shareMessage({
      kind: 'moment',
      title: 'Friday dinner',
      totalPaise: 600000,
      dueDate: '2026-11-20',
      sharesPaise: Array(6).fill(100000),
      link,
    });
    expect(m).toEqual({
      variant: 'equal',
      text: `Friday dinner is ₹1,000 each. Pay your share by Fri 20 Nov so the bill is covered before we sit down. ${link}`,
    });
  });

  it('treats shares a paisa apart as equal and quotes the lower amount', () => {
    const m = shareMessage({
      kind: 'moment',
      title: 'Cab',
      totalPaise: 100000,
      dueDate: '2026-11-20',
      sharesPaise: [33334, 33333, 33333],
      link,
    });
    expect(m.variant).toBe('equal');
    expect(m.text).toContain('Cab is ₹333.33 each.');
  });

  it('uses the different amounts message (screen 24)', () => {
    const m = shareMessage({
      kind: 'moment',
      title: 'Friday dinner',
      totalPaise: 540000,
      dueDate: '2026-11-20',
      sharesPaise: [125000, 125000, 125000, 85000, 40000, 40000],
      link,
    });
    expect(m).toEqual({
      variant: 'differ',
      text: `Friday dinner came to ₹5,400. Open the link, pick your name and pay your share: ${link}`,
    });
  });

  it('drops the dinner line for goals', () => {
    const m = shareMessage({
      kind: 'goal',
      title: 'Goa trip',
      totalPaise: 5000000,
      dueDate: '2027-01-12',
      sharesPaise: Array(5).fill(1000000),
      link,
    });
    expect(m.text).toBe(`Goa trip is ₹10,000 each. Pay your share by Tue 12 Jan. ${link}`);
  });
});

describe('nudgeMessage', () => {
  it('matches spec section 9 (screen 23)', () => {
    expect(nudgeMessage({ memberName: 'Zoya', title: 'Friday dinner', amountPaise: 100000, link })).toBe(
      `Hi Zoya, ₹1,000 for Friday dinner is still open. It takes a minute to pay: ${link}`,
    );
  });
});

describe('whatsAppUrl', () => {
  it('adds +91 to ten digit numbers', () => {
    expect(whatsAppUrl('98765 43210', 'Hi there')).toBe('https://wa.me/919876543210?text=Hi%20there');
    expect(whatsAppUrl('+91 98765-43210', 'x')).toBe('https://wa.me/919876543210?text=x');
    expect(whatsAppUrl('09876543210', 'x')).toBe('https://wa.me/919876543210?text=x');
  });

  it('returns null for numbers it cannot use', () => {
    expect(whatsAppUrl('12345', 'x')).toBeNull();
    expect(whatsAppUrl('', 'x')).toBeNull();
  });
});

describe('status rules', () => {
  it('locks shares once the link is shared', () => {
    expect(sharesEditable('draft')).toBe(true);
    expect(sharesEditable('shared')).toBe(false);
  });

  it('only allows forward kitty moves', () => {
    expect(canMoveKitty('draft', 'shared')).toBe(true);
    expect(canMoveKitty('shared', 'settling')).toBe(true);
    expect(canMoveKitty('settling', 'closed')).toBe(true);
    expect(canMoveKitty('shared', 'draft')).toBe(false);
    expect(canMoveKitty('closed', 'shared')).toBe(false);
  });

  it('lets a member pay again after "not yet" (screen 26)', () => {
    expect(canMovePayment('requested', 'marked')).toBe(true);
    expect(canMovePayment('marked', 'not_received')).toBe(true);
    expect(canMovePayment('not_received', 'marked')).toBe(true);
    expect(canMovePayment('confirmed', 'marked')).toBe(false);
  });
});

describe('groupReminderMessage', () => {
  it('reminds the group without naming anyone', () => {
    expect(groupReminderMessage({ title: 'Friday dinner', link })).toBe(
      `Quick reminder for Friday dinner: if you haven’t paid your share yet, it takes a minute: ${link}`,
    );
  });
});
