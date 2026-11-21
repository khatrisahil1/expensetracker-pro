// Week / month / year ranges for the Dashboard and History screens. Both used
// to compute these inline, with two bugs:
//   - Month end was built by setMonth() on the current date, so from the 31st of
//     a month followed by a 30-day month (e.g. 31 Mar) the range ran into the
//     next month, and "next month" from 31 Jan skipped February.
//   - Week end was set on a copy of the anchor date, so a week crossing a month
//     boundary ended in the wrong month.
import { parseLocalDate } from './date';

export type PeriodMode = 'week' | 'month' | 'year';

/** 0 = weeks start on Sunday, 1 = Monday. */
export type WeekStart = 0 | 1;

export interface PeriodRange {
  /** Local midnight on the first day. */
  start: Date;
  /** Last millisecond of the last day. */
  end: Date;
}

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const endOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);

/** The week, month or year containing `anchor`. */
export function getPeriodRange(anchor: Date, mode: PeriodMode, weekStartsOn: WeekStart = 1): PeriodRange {
  const y = anchor.getFullYear();
  const m = anchor.getMonth();

  if (mode === 'week') {
    const daysSinceWeekStart = (anchor.getDay() - weekStartsOn + 7) % 7;
    const start = new Date(y, m, anchor.getDate() - daysSinceWeekStart);
    // Derive the end from the start, not from the anchor, so month boundaries work.
    const end = endOfDay(new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6));
    return { start, end };
  }
  if (mode === 'month') {
    // Day 0 of next month = last day of this month.
    return { start: new Date(y, m, 1), end: endOfDay(new Date(y, m + 1, 0)) };
  }
  return { start: new Date(y, 0, 1), end: endOfDay(new Date(y, 11, 31)) };
}

/**
 * Move `anchor` one period forward (+1) or back (-1). Month and year steps go
 * via the 1st so the 31st never rolls over into the following month.
 */
export function shiftPeriod(anchor: Date, mode: PeriodMode, direction: 1 | -1): Date {
  if (mode === 'week') {
    return new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate() + 7 * direction);
  }
  if (mode === 'month') return new Date(anchor.getFullYear(), anchor.getMonth() + direction, 1);
  return new Date(anchor.getFullYear() + direction, 0, 1);
}

/** True if a 'YYYY-MM-DD' date falls inside the range (inclusive). */
export const isInRange = (dateStr: string, { start, end }: PeriodRange): boolean => {
  const d = parseLocalDate(dateStr);
  return d >= startOfDay(start) && d <= end;
};
