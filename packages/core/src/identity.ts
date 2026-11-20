/**
 * Checks for what organisers type at sign up and on their profile.
 * These catch typos. They don't prove a number or address exists.
 */

/**
 * Normalises an Indian mobile number to E.164 (+919876543210).
 * Accepts spaces, dashes, a leading 0, or +91 / 91. Indian mobiles start with 6 to 9.
 * Returns null when it isn't a valid Indian mobile number.
 */
export function normaliseIndianMobile(input: string): string | null {
  // Keep digits and a leading +. Phone contacts often carry invisible direction marks
  // (U+202A, U+202C), non-breaking spaces or other punctuation around the number.
  let digits = input.replace(/[^\d+]/g, '');
  if (digits.startsWith('+91')) digits = digits.slice(3);
  else if (digits.startsWith('0091')) digits = digits.slice(4);
  else if (digits.length === 12 && digits.startsWith('91')) digits = digits.slice(2);
  else if (digits.length === 11 && digits.startsWith('0')) digits = digits.slice(1);
  return /^[6-9]\d{9}$/.test(digits) ? `+91${digits}` : null;
}

/** "+919876543210" -> "+91 98765 43210" for display. */
export function formatIndianMobile(e164: string): string {
  const match = /^\+91(\d{5})(\d{5})$/.exec(e164);
  return match ? `+91 ${match[1]} ${match[2]}` : e164;
}

export function normaliseEmail(input: string): string {
  return input.trim().toLowerCase();
}

/** Deliberately loose: something@something.tld with no spaces. */
export function isValidEmail(input: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(normaliseEmail(input));
}

export const MAX_NAME_LENGTH = 80;

/** Collapses spaces. Returns null for an empty or over-long name. */
export function cleanName(input: string): string | null {
  const name = input.replace(/\s+/g, ' ').trim();
  return name.length > 0 && name.length <= MAX_NAME_LENGTH ? name : null;
}

/** "Rohan Mehta" -> "RM", "zoya" -> "Z". For the avatar on the home screen. */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? '';
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : '';
  return (first + last).toUpperCase();
}
