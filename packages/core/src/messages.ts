import { formatShortDate } from './dates';
import { formatRupees } from './money';
import { isEqualSplit } from './split';
import type { IsoDate, KittyKind, Paise } from './types';

/**
 * Default WhatsApp message text (spec section 9). The organiser can edit it
 * before sending. Kitty never sends messages itself in v1.
 */

export interface ShareMessageInput {
  kind: KittyKind;
  title: string;
  totalPaise: Paise;
  dueDate: IsoDate;
  /** Every member's share, in sort order. */
  sharesPaise: readonly Paise[];
  link: string;
  /** Goals paid in parts: how many monthly parts, and when the first is due. */
  parts?: { count: number; firstDueDate: IsoDate };
}

export interface ShareMessage {
  /** Screen 6 (equal amounts) or screen 24 (amounts differ). */
  variant: 'equal' | 'differ';
  text: string;
}

export function shareMessage(input: ShareMessageInput): ShareMessage {
  const { kind, title, totalPaise, dueDate, sharesPaise, link, parts } = input;

  if (sharesPaise.length > 0 && isEqualSplit(sharesPaise)) {
    // Shares a paisa apart (₹333.34 and ₹333.33) count as equal. Quote the lower amount;
    // each member sees their own exact amount on the link.
    const each = formatRupees(Math.min(...sharesPaise));
    const by = formatShortDate(dueDate);
    // The "before we sit down" line suits a dinner, not a trip, so goals get a plainer line.
    const why = kind === 'moment' ? ' so the bill is covered before we sit down' : '';
    if (parts) {
      // Not worded in the spec (goals paid in parts, step 9).
      return {
        variant: 'equal',
        text: `${title} is ${each} each, paid in ${parts.count} monthly parts. The first is due ${formatShortDate(parts.firstDueDate)}, the last ${by}. ${link}`,
      };
    }
    return { variant: 'equal', text: `${title} is ${each} each. Pay your share by ${by}${why}. ${link}` };
  }

  if (parts) {
    return {
      variant: 'differ',
      text: `${title} is ${formatRupees(totalPaise)} in all. Open the link, pick your name and pay your share in ${parts.count} monthly parts: ${link}`,
    };
  }

  return {
    variant: 'differ',
    text: `${title} came to ${formatRupees(totalPaise)}. Open the link, pick your name and pay your share: ${link}`,
  };
}

export interface NudgeMessageInput {
  memberName: string;
  title: string;
  amountPaise: Paise;
  link: string;
  /** Goals paid in parts: the part being asked for. */
  part?: { partNumber: number; partsCount: number; dueDate: IsoDate };
}

export function nudgeMessage({ memberName, title, amountPaise, link, part }: NudgeMessageInput): string {
  if (part) {
    return `Hi ${memberName}, part ${part.partNumber} of ${part.partsCount} for ${title} (${formatRupees(amountPaise)}) is due ${formatShortDate(part.dueDate)}. It takes a minute to pay: ${link}`;
  }
  return `Hi ${memberName}, ${formatRupees(amountPaise)} for ${title} is still open. It takes a minute to pay: ${link}`;
}

/**
 * wa.me link to message one person. Ten-digit Indian mobile numbers get +91 added.
 * Returns null when the number can't be used, so the caller falls back to the share sheet.
 */
export function whatsAppUrl(phone: string, text: string): string | null {
  let digits = phone.replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('0')) digits = digits.slice(1);
  if (digits.length === 10) digits = `91${digits}`;
  if (digits.length < 11 || digits.length > 15) return null;
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}

/**
 * "Post a reminder in the group instead" (screen 23). Not worded in the spec;
 * written to match the nudge's tone without naming who hasn't paid.
 */
export function groupReminderMessage({ title, link }: { title: string; link: string }): string {
  return `Quick reminder for ${title}: if you haven’t paid your share yet, it takes a minute: ${link}`;
}

export interface TopUpMessageInput {
  memberName: string;
  title: string;
  newSharePaise: Paise;
  paidPaise: Paise;
  link: string;
}

/**
 * "Ask" for a top-up on screens 12 and 13. Not worded in the spec; written in
 * the nudge's tone. Someone who paid nothing gets the plain nudge instead.
 */
export function topUpMessage({ memberName, title, newSharePaise, paidPaise, link }: TopUpMessageInput): string {
  if (paidPaise <= 0) return nudgeMessage({ memberName, title, amountPaise: newSharePaise, link });
  return `Hi ${memberName}, ${title} came to a bit more. Your share is ${formatRupees(newSharePaise)} and you paid ${formatRupees(paidPaise)}, so it’s ${formatRupees(newSharePaise - paidPaise)} more: ${link}`;
}
