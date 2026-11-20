import { describe, expect, it } from 'vitest';
import { combineByPayer, dependantsOf, feedOrder, memberPayState, payerIdOf, payProgress, pickList, statusList, type MemberLike } from '../src';

describe('memberPayState', () => {
  it('reads a single share payment', () => {
    expect(memberPayState(['requested'])).toBe('unpaid');
    expect(memberPayState(['marked'])).toBe('waiting');
    expect(memberPayState(['not_received'])).toBe('not_received');
    expect(memberPayState(['confirmed'])).toBe('paid');
  });

  it('needs every part confirmed to count as paid', () => {
    expect(memberPayState(['confirmed', 'requested'])).toBe('unpaid');
    expect(memberPayState(['confirmed', 'marked'])).toBe('waiting');
    expect(memberPayState(['confirmed', 'confirmed'])).toBe('paid');
  });

  it('treats written-off amounts as nothing left to pay', () => {
    expect(memberPayState(['written_off'])).toBe('paid');
    expect(memberPayState(['confirmed', 'written_off'])).toBe('paid');
  });

  it('is unpaid with no payments at all', () => {
    expect(memberPayState([])).toBe('unpaid');
  });
});

// Screen 14's Friday dinner: Rohan organised, Dev says he paid, Aisha, Kabir and Meera are confirmed.
const m = (id: string, sortOrder: number, state: MemberLike['state'], isOrganiser = false): MemberLike => ({
  id,
  sortOrder,
  state,
  isOrganiser,
});
const friday = [
  m('rohan', 0, 'paid', true),
  m('kabir', 1, 'paid'),
  m('dev', 2, 'waiting'),
  m('zoya', 3, 'unpaid'),
  m('aisha', 4, 'paid'),
  m('meera', 5, 'paid'),
];

describe('pickList', () => {
  it('matches screen 14: no organiser, unpaid first, then waiting, then paid', () => {
    expect(pickList(friday).map((x) => x.id)).toEqual(['zoya', 'dev', 'kabir', 'aisha', 'meera']);
  });
});

describe('statusList', () => {
  it('matches screen 16: you first, then waiting, then the rest', () => {
    expect(statusList(friday, 'zoya').map((x) => x.id)).toEqual(['zoya', 'dev', 'rohan', 'kabir', 'aisha', 'meera']);
  });
});

describe('payProgress', () => {
  it('counts the organiser and people waiting', () => {
    expect(payProgress(friday)).toEqual({ paid: 4, waiting: 1, total: 6 });
  });
});

describe('feedOrder', () => {
  it('matches screen 7: Dev (says paid), Zoya (unpaid), You, then everyone who paid', () => {
    expect(feedOrder(friday).map((x) => x.id)).toEqual(['dev', 'zoya', 'rohan', 'kabir', 'aisha', 'meera']);
  });

  it('puts "not received" between said-paid and unpaid', () => {
    const list = [m('a', 0, 'unpaid'), m('b', 1, 'not_received'), m('c', 2, 'waiting'), m('o', 3, 'unpaid', true)];
    expect(feedOrder(list).map((x) => x.id)).toEqual(['c', 'b', 'a', 'o']);
  });
});

describe('paying for someone else', () => {
  const people = [
    { id: 'kabir', paidById: null, share: 100000 },
    { id: 'aarav', paidById: 'kabir', share: 50000 },
    { id: 'zoya', paidById: null, share: 100000 },
  ];

  it('asks each payer for their own share plus those they pay for', () => {
    expect(Object.fromEntries(combineByPayer(people, (m) => m.share))).toEqual({ kabir: 150000, zoya: 100000 });
  });

  it('knows who pays and who is paid for', () => {
    expect(payerIdOf(people[1]!)).toBe('kabir');
    expect(payerIdOf(people[2]!)).toBe('zoya');
    expect(dependantsOf(people, 'kabir').map((m) => m.id)).toEqual(['aarav']);
  });
});
