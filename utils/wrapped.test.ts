import { describe, expect, it } from 'vitest';
import { buildWrapped, defaultWrappedMonth, monthsWithData, moodFor } from './wrapped';
import type { Transaction } from '../context/Store';

let n = 0;
const tx = (date: string, amount: number, type: Transaction['type'], category = 'Food', title = 'x'): Transaction =>
  ({ id: String(n++), date, amount, type, category, title });

const DATA = [
  tx('2026-10-01', 50000, 'income', 'Salary'),
  tx('2026-10-03', 12000, 'expense', 'Rent', 'October rent'), // Saturday
  tx('2026-10-04', 450, 'expense', 'Food', 'Zomato'),          // Sunday
  tx('2026-10-10', 800, 'expense', 'Food', 'Dinner'),          // Saturday
  tx('2026-10-10', 300, 'expense', 'Transportation', 'Uber'),
  tx('2026-09-15', 10000, 'expense', 'Rent'),
  tx('2026-11-02', 999, 'expense', 'Shopping'),
];

describe('buildWrapped', () => {
  const w = buildWrapped(DATA, new Date(2026, 9, 20));
  it('totals only that month', () => {
    expect(w.monthName).toBe('October');
    expect(w.income).toBe(50000);
    expect(w.expense).toBe(13550);
    expect(w.net).toBe(36450);
    expect(w.savingsRate).toBe(73);
    expect(w.transactionCount).toBe(5);
    expect(w.daysLogged).toBe(4);
    expect(w.daysInMonth).toBe(31);
  });
  it('finds the top category, biggest spend and busiest weekday', () => {
    expect(w.topCategory).toEqual({ name: 'Rent', amount: 12000, share: 89 });
    expect(w.biggestExpense).toMatchObject({ title: 'October rent', amount: 12000 });
    expect(w.busiestWeekday).toBe('Saturday');
    expect(w.byWeekday[5]).toBe(13100); // Sat (index 5, Monday = 0): rent + dinner + Uber
  });
  it('compares spending with the month before', () => {
    expect(w.spendChange).toBeCloseTo(35.5, 1);
  });
  it('is gentle with an empty month', () => {
    const empty = buildWrapped(DATA, new Date(2026, 6, 1));
    expect(empty.transactionCount).toBe(0);
    expect(empty.topCategory).toBeNull();
    expect(empty.busiestWeekday).toBeNull();
    expect(empty.mood).toBe('okay');
  });
});

describe('moodFor', () => {
  it('is thrilled above 30% saved, worried when spending beats income', () => {
    expect(moodFor(100, 60)).toBe('thrilled');
    expect(moodFor(100, 85)).toBe('happy');
    expect(moodFor(100, 99)).toBe('okay');
    expect(moodFor(100, 120)).toBe('worried');
  });
});

describe('defaultWrappedMonth', () => {
  it('wraps last month during the first week of a new month', () => {
    expect(defaultWrappedMonth(DATA, new Date(2026, 10, 3)).getMonth()).toBe(9);
  });
  it('wraps the current month later in the month', () => {
    expect(defaultWrappedMonth(DATA, new Date(2026, 10, 20)).getMonth()).toBe(10);
  });
});

describe('monthsWithData', () => {
  it('lists months with transactions, newest first', () => {
    expect(monthsWithData(DATA)).toEqual(['2026-11-01', '2026-10-01', '2026-09-01']);
  });
});
