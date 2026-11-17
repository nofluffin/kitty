import type { IsoDate } from './types';

/**
 * Calendar-date helpers. All maths is done in UTC on plain YYYY-MM-DD dates
 * so results never shift with the phone's time zone.
 */

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;

interface Ymd {
  y: number;
  m: number; // 1-12
  d: number;
}

export function parseIsoDate(date: IsoDate): Ymd {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match) throw new RangeError(`expected YYYY-MM-DD, got "${date}"`);
  const ymd = { y: Number(match[1]), m: Number(match[2]), d: Number(match[3]) };
  if (toIsoDate(ymd) !== date) throw new RangeError(`not a real date: "${date}"`);
  return ymd;
}

function toIsoDate({ y, m, d }: Ymd): IsoDate {
  const t = new Date(Date.UTC(y, m - 1, d));
  return t.toISOString().slice(0, 10);
}

function daysInMonth(y: number, m: number): number {
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

/** Adds whole months, keeping the day but clamping to the month's end (31 Mar - 1 month = 28/29 Feb). */
export function addMonths(date: IsoDate, months: number): IsoDate {
  const { y, m, d } = parseIsoDate(date);
  const index = y * 12 + (m - 1) + months;
  const ny = Math.floor(index / 12);
  const nm = (index % 12) + 1;
  return toIsoDate({ y: ny, m: nm, d: Math.min(d, daysInMonth(ny, nm)) });
}

export function addDays(date: IsoDate, days: number): IsoDate {
  const { y, m, d } = parseIsoDate(date);
  return toIsoDate({ y, m, d: d + days });
}

/** Whole days from `from` to `to`. Negative if `to` is earlier. */
export function daysBetween(from: IsoDate, to: IsoDate): number {
  const a = parseIsoDate(from);
  const b = parseIsoDate(to);
  return Math.round((Date.UTC(b.y, b.m - 1, b.d) - Date.UTC(a.y, a.m - 1, a.d)) / 86_400_000);
}

/** "Fri 20 Nov", as used in messages and on screens. */
export function formatShortDate(date: IsoDate): string {
  const { y, m, d } = parseIsoDate(date);
  const weekday = WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
  return `${weekday} ${d} ${MONTHS[m - 1]}`;
}

/** The calendar date on this device right now (local time zone, not UTC). */
export function localIsoDate(now: Date = new Date()): IsoDate {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** "4 days to go", "8 weeks to go", "today", "2 days late", as on the home screen (screen 1). */
export function timeToGo(today: IsoDate, due: IsoDate): string {
  const days = daysBetween(today, due);
  if (days === 0) return 'today';
  if (days === 1) return 'tomorrow';
  if (days < 0) return days === -1 ? '1 day late' : `${-days} days late`;
  if (days < 14) return `${days} days to go`;
  return `${Math.floor(days / 7)} weeks to go`;
}
