import { describe, expect, it } from 'vitest';
import { getPeriodRange, isInRange, shiftPeriod } from './period';
import { toLocalISODate } from './date';

const iso = toLocalISODate;
const range = (anchor: Date, ...args: Parameters<typeof getPeriodRange> extends [Date, ...infer R] ? R : never) => {
  const r = getPeriodRange(anchor, ...args);
  return [iso(r.start), iso(r.end)];
};

describe('getPeriodRange: month', () => {
  it('covers the whole month', () => {
    expect(range(new Date(2026, 10, 21), 'month')).toEqual(['2026-11-01', '2026-11-30']);
  });
  it('stays in March when the anchor is 31 March (used to run into April)', () => {
    expect(range(new Date(2026, 2, 31), 'month')).toEqual(['2026-03-01', '2026-03-31']);
  });
  it('handles February in leap and non-leap years', () => {
    expect(range(new Date(2028, 1, 10), 'month')).toEqual(['2028-02-01', '2028-02-29']);
    expect(range(new Date(2026, 1, 10), 'month')).toEqual(['2026-02-01', '2026-02-28']);
  });
  it('ends at the last millisecond of the last day', () => {
    const { end } = getPeriodRange(new Date(2026, 10, 5), 'month');
    expect([end.getHours(), end.getMinutes(), end.getSeconds(), end.getMilliseconds()]).toEqual([23, 59, 59, 999]);
  });
});

describe('getPeriodRange: week', () => {
  it('starts on Monday by default', () => {
    // Saturday 21 Nov 2026
    expect(range(new Date(2026, 10, 21), 'week')).toEqual(['2026-11-16', '2026-11-22']);
  });
  it('treats Sunday as the end of a Monday-start week', () => {
    expect(range(new Date(2026, 10, 22), 'week')).toEqual(['2026-11-16', '2026-11-22']);
  });
  it('can start on Sunday', () => {
    expect(range(new Date(2026, 10, 21), 'week', 0)).toEqual(['2026-11-15', '2026-11-21']);
  });
  it('ends in the right month when the week crosses a boundary (used to end on the 29th of the wrong month)', () => {
    // Sunday 1 Mar 2026 → week of Mon 23 Feb – Sun 1 Mar
    expect(range(new Date(2026, 2, 1), 'week')).toEqual(['2026-02-23', '2026-03-01']);
    // Tue 30 Dec 2025 → crosses into the new year
    expect(range(new Date(2025, 11, 30), 'week')).toEqual(['2025-12-29', '2026-01-04']);
  });
});

describe('getPeriodRange: year', () => {
  it('covers 1 Jan – 31 Dec', () => {
    expect(range(new Date(2026, 5, 15), 'year')).toEqual(['2026-01-01', '2026-12-31']);
  });
});

describe('shiftPeriod', () => {
  it('does not skip February when moving on from 31 January', () => {
    expect(iso(shiftPeriod(new Date(2026, 0, 31), 'month', 1)).slice(0, 7)).toBe('2026-02');
  });
  it('moves back across a year boundary', () => {
    expect(iso(shiftPeriod(new Date(2026, 0, 15), 'month', -1)).slice(0, 7)).toBe('2025-12');
  });
  it('moves weeks by seven days', () => {
    expect(iso(shiftPeriod(new Date(2026, 10, 21), 'week', -1))).toBe('2026-11-14');
  });
  it('moves years', () => {
    expect(new Date(shiftPeriod(new Date(2028, 1, 29), 'year', 1)).getFullYear()).toBe(2029);
  });
});

describe('isInRange', () => {
  const nov = getPeriodRange(new Date(2026, 10, 10), 'month');
  it('includes the first and last day', () => {
    expect(isInRange('2026-11-01', nov)).toBe(true);
    expect(isInRange('2026-11-30', nov)).toBe(true);
  });
  it('excludes neighbouring days', () => {
    expect(isInRange('2026-10-31', nov)).toBe(false);
    expect(isInRange('2026-12-01', nov)).toBe(false);
  });
});
