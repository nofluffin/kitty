/**
 * Shared domain types. Enum values match the Postgres enums in
 * supabase/migrations so rows can be passed straight through.
 */

/** Money is always a whole number of paise. ₹1 = 100 paise. */
export type Paise = number;

/** Calendar date with no time zone, as stored in Postgres `date`: YYYY-MM-DD. */
export type IsoDate = string;

export type KittyKind = 'moment' | 'goal';
export type AmountSource = 'typed' | 'scanned';
export type GoalPlan = 'single' | 'parts';
export type KittyStatus = 'draft' | 'shared' | 'settling' | 'closed' | 'cancelled';

export type Diet = 'veg' | 'nonveg';

export type PaymentKind = 'share' | 'topup' | 'refund' | 'part';
export type PaymentDirection = 'in' | 'out';
export type PaymentStatus = 'requested' | 'marked' | 'confirmed' | 'not_received' | 'written_off';

export type BillStatus = 'processing' | 'needs_review' | 'confirmed' | 'failed';
export type BillCategory = 'veg' | 'nonveg' | 'alcohol' | 'unsure';

/** The parts of a member that the money rules need. Arrays of these are always in sort order. */
export interface SplitMember {
  id: string;
  diet: Diet;
  drinks: boolean;
}

export interface MemberShare {
  memberId: string;
  sharePaise: Paise;
}
