// Calendar-date helpers that work in the user's local timezone.
//
// Transaction dates are stored as plain 'YYYY-MM-DD' strings. Two common
// shortcuts get these wrong outside UTC:
//   - new Date('YYYY-MM-DD') parses as UTC midnight, not local midnight.
//   - date.toISOString().split('T')[0] returns the UTC date, which is the
//     previous day for local midnight in UTC+ zones such as IST.
// Use these helpers instead whenever a value means "a day on the calendar".

export type Frequency = 'daily' | 'weekly' | 'monthly' | 'yearly';

const pad = (n: number) => String(n).padStart(2, '0');

/** Format a Date as 'YYYY-MM-DD' using its local calendar day. */
export const toLocalISODate = (d: Date = new Date()): string =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** Parse 'YYYY-MM-DD' as local midnight. Returns an Invalid Date for bad input. */
export const parseLocalDate = (s: string): Date => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || '');
  if (!m) return new Date(NaN);
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
};

/**
 * Advance a 'YYYY-MM-DD' date by `count` periods. Month and year steps clamp to
 * the last day of the target month (31 Jan + 1 month = 28/29 Feb, not 3 Mar).
 */
export const addInterval = (dateStr: string, freq: Frequency, count = 1): string => {
  const d = parseLocalDate(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  if (freq === 'daily') d.setDate(d.getDate() + count);
  else if (freq === 'weekly') d.setDate(d.getDate() + 7 * count);
  else {
    const months = freq === 'monthly' ? count : 12 * count;
    const day = d.getDate();
    d.setDate(1);
    d.setMonth(d.getMonth() + months);
    const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    d.setDate(Math.min(day, lastDay));
  }
  return toLocalISODate(d);
};

/**
 * Readable date for display, e.g. "1 Mar 2027", from a "YYYY-MM-DD" string.
 * Always day-month-year, matching the rest of the app. Anything that isn't a
 * valid date is returned unchanged.
 */
export const formatDisplayDate = (s: string): string => {
  const d = parseLocalDate(s);
  return isNaN(d.getTime()) ? s : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
};
