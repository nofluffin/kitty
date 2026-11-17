import type { BillLineInput, SplitMember } from '../src';

/** The Friday dinner group from the wireframes, in sort order. */
export const fridayDinner: SplitMember[] = [
  { id: 'you', diet: 'nonveg', drinks: true },
  { id: 'kabir', diet: 'nonveg', drinks: true },
  { id: 'dev', diet: 'nonveg', drinks: true },
  { id: 'zoya', diet: 'nonveg', drinks: false },
  { id: 'aisha', diet: 'veg', drinks: false },
  { id: 'meera', diet: 'veg', drinks: false },
];

/** The scanned bill on screen 11: ₹5,400, no extras. */
export const fridayBill: BillLineInput[] = [
  { id: 'paneer', amountPaise: 54000, category: 'veg' },
  { id: 'dal', amountPaise: 46000, category: 'veg' },
  { id: 'biryani', amountPaise: 72000, category: 'veg' },
  { id: 'naan', amountPaise: 68000, category: 'veg' },
  { id: 'butter-chicken', amountPaise: 82000, category: 'nonveg' },
  { id: 'mutton-seekh', amountPaise: 98000, category: 'nonveg' },
  { id: 'beer', amountPaise: 120000, category: 'alcohol' },
];

export const sharesById = (shares: { memberId: string; sharePaise: number }[]) =>
  Object.fromEntries(shares.map((s) => [s.memberId, s.sharePaise]));

export const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
