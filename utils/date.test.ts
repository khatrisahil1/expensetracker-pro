import { describe, expect, it } from 'vitest';
import { addInterval, formatDisplayDate, parseLocalDate, toLocalISODate } from './date';

describe('toLocalISODate', () => {
  it('uses the local calendar day, even just after midnight', () => {
    // toISOString() would give the previous day here in UTC+ zones such as IST.
    expect(toLocalISODate(new Date(2026, 10, 21, 0, 30))).toBe('2026-11-21');
  });
  it('round-trips with parseLocalDate', () => {
    expect(toLocalISODate(parseLocalDate('2026-03-01'))).toBe('2026-03-01');
  });
});

describe('parseLocalDate', () => {
  it('parses to local midnight', () => {
    const d = parseLocalDate('2026-11-15');
    expect([d.getFullYear(), d.getMonth(), d.getDate(), d.getHours()]).toEqual([2026, 10, 15, 0]);
  });
  it('returns an invalid date for bad input', () => {
    expect(isNaN(parseLocalDate('15/11/2026').getTime())).toBe(true);
    expect(isNaN(parseLocalDate('').getTime())).toBe(true);
  });
});

describe('addInterval', () => {
  it('keeps the day of month across a year of monthly renewals (no drift)', () => {
    let d = '2026-11-15';
    for (let i = 0; i < 12; i++) d = addInterval(d, 'monthly');
    expect(d).toBe('2027-11-15');
  });
  it('clamps month steps to the last day instead of overflowing', () => {
    expect(addInterval('2026-01-31', 'monthly')).toBe('2026-02-28');
    expect(addInterval('2028-01-31', 'monthly')).toBe('2028-02-29');
    expect(addInterval('2026-03-31', 'monthly')).toBe('2026-04-30');
    expect(addInterval('2028-02-29', 'yearly')).toBe('2029-02-28');
  });
  it('handles daily, weekly and multi-step intervals across boundaries', () => {
    expect(addInterval('2026-02-28', 'daily')).toBe('2026-03-01');
    expect(addInterval('2026-12-28', 'weekly')).toBe('2027-01-04');
    expect(addInterval('2026-11-15', 'monthly', 3)).toBe('2027-02-15');
  });
  it('returns bad input unchanged', () => {
    expect(addInterval('bad', 'monthly')).toBe('bad');
  });
});

describe('formatDisplayDate', () => {
  it('shows the day, short month and year instead of the raw ISO string', () => {
    const out = formatDisplayDate('2027-03-01');
    expect(out).not.toBe('2027-03-01');
    expect(out).toContain('2027');
    expect(out).toMatch(/\b1\b/);
  });
  it('returns invalid input unchanged', () => {
    expect(formatDisplayDate('soon')).toBe('soon');
  });
});
