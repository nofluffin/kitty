import { toUpiAmount } from './money';
import type { Paise } from './types';

/**
 * UPI IDs look like name@bank. This catches typos, not whether the ID exists.
 * Handle: letters, digits, dot, hyphen, underscore. Bank handle: starts with a letter.
 */
const UPI_ID = /^[a-zA-Z0-9._-]{2,256}@[a-zA-Z][a-zA-Z0-9.-]{1,64}$/;

export function normaliseUpiId(input: string): string {
  return input.trim().toLowerCase();
}

export function isValidUpiId(input: string): boolean {
  return UPI_ID.test(normaliseUpiId(input));
}

/** UPI apps are strict about notes. Keep them short and plain. */
const MAX_NOTE_LENGTH = 50;

/**
 * Percent-encodes a value for a UPI URI. Spaces become %20 (not +), and @ is
 * left as is because some UPI apps fail to decode %40 in the payee address.
 */
function encodeUpiValue(value: string): string {
  return encodeURIComponent(value).replace(/%40/g, '@');
}

export interface UpiPayment {
  /** Organiser's UPI ID (the kitty's `upi_id` snapshot). */
  payeeUpiId: string;
  payeeName: string;
  amountPaise: Paise;
  /** Short note, e.g. "Kitty Friday dinner". Trimmed to 50 characters. */
  note: string;
}

function upiQuery(p: UpiPayment): string {
  if (!isValidUpiId(p.payeeUpiId)) throw new RangeError(`not a valid UPI ID: "${p.payeeUpiId}"`);
  if (p.amountPaise <= 0) throw new RangeError('a UPI payment needs an amount above zero');
  const note = p.note.replace(/\s+/g, ' ').trim().slice(0, MAX_NOTE_LENGTH).trim();
  const params: [string, string][] = [
    ['pa', normaliseUpiId(p.payeeUpiId)],
    ['pn', p.payeeName.trim()],
    ['am', toUpiAmount(p.amountPaise)],
    ['cu', 'INR'],
    ['tn', note],
  ];
  return params.map(([k, v]) => `${k}=${encodeUpiValue(v)}`).join('&');
}

/**
 * The generic UPI deep link (spec section 5). Used for the "Pay with a UPI app"
 * button and the QR code. On Android this opens the system's UPI app chooser.
 */
export function buildUpiUri(p: UpiPayment): string {
  return `upi://pay?${upiQuery(p)}`;
}

export type UpiApp = 'gpay' | 'phonepe' | 'paytm';

/**
 * App-specific links for iPhone, where generic upi:// links are unreliable.
 * UNVERIFIED: these schemes come from public reports, not the apps' documentation.
 * Spec section 5 requires testing each on real phones before relying on them.
 */
const APP_PREFIX: Record<UpiApp, string> = {
  gpay: 'gpay://upi/pay?',
  phonepe: 'phonepe://pay?',
  paytm: 'paytmmp://pay?',
};

export function buildUpiAppLinks(p: UpiPayment): Record<UpiApp, string> {
  const query = upiQuery(p);
  return {
    gpay: APP_PREFIX.gpay + query,
    phonepe: APP_PREFIX.phonepe + query,
    paytm: APP_PREFIX.paytm + query,
  };
}

/** Default note for a kitty payment: "Kitty Friday dinner". */
export function kittyPaymentNote(kittyTitle: string): string {
  return `Kitty ${kittyTitle}`;
}
