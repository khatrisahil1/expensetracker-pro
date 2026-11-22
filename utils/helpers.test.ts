// Tests for the small helpers: transaction stats, currency and JSON extraction.
import { describe, expect, it } from 'vitest';
import { balancesByPaymentMethod, calculateStreak, formatPercentChange, percentChange, sumTotals, topCategories } from './transactionStats';
import { getCurrencySymbol } from './currency';
import { extractJsonObject } from './json';
import type { Transaction } from '../context/Store';

const tx = (amount: number, type: Transaction['type'], category = 'Food', date = '2026-11-21'): Transaction =>
  ({ id: String(Math.random()), title: 't', date, amount, type, category });

describe('sumTotals', () => {
  it('adds income and expense separately', () => {
    expect(sumTotals([tx(1000, 'income'), tx(300, 'expense'), tx(200, 'expense')])).toEqual({ income: 1000, expense: 500, balance: 500 });
  });
  it('is all zeros for no transactions', () => {
    expect(sumTotals([])).toEqual({ income: 0, expense: 0, balance: 0 });
  });
});

describe('percentChange', () => {
  it('measures change relative to the previous value', () => {
    expect(percentChange(150, 100)).toBe(50);
    expect(percentChange(-50, -100)).toBe(50);
  });
  it('is null when there is no previous value', () => {
    expect(percentChange(100, 0)).toBeNull();
  });
});

describe('formatPercentChange', () => {
  it('signs the percentage', () => {
    expect(formatPercentChange(150, 100)).toBe('+50.0%');
    expect(formatPercentChange(75, 100)).toBe('-25.0%');
  });
  it('says "New" instead of +0.0% when the previous value was 0', () => {
    expect(formatPercentChange(500, 0)).toBe('New');
  });
  it('shows a dash when both values are 0', () => {
    expect(formatPercentChange(0, 0)).toBe('—');
  });
});

describe('calculateStreak', () => {
  const today = new Date(2026, 10, 21, 0, 30); // just after local midnight
  it('counts consecutive days ending today', () => {
    expect(calculateStreak(['2026-11-21', '2026-11-20', '2026-11-19', '2026-11-17'], today)).toBe(3);
  });
  it('still counts when today has nothing yet but yesterday does', () => {
    expect(calculateStreak(['2026-11-20', '2026-11-19'], today)).toBe(2);
  });
  it('is 0 after a missed day', () => {
    expect(calculateStreak(['2026-11-19'], today)).toBe(0);
  });
  it('ignores duplicate dates', () => {
    expect(calculateStreak(['2026-11-21', '2026-11-21'], today)).toBe(1);
  });
});

describe('topCategories', () => {
  it('keeps the five largest and groups the rest as Other', () => {
    const list = ['A', 'B', 'C', 'D', 'E', 'F', 'G'].map((c, i) => tx(100 - i, 'expense', c));
    const { data, total } = topCategories(list, 'expense');
    expect(Object.keys(data)).toEqual(['A', 'B', 'C', 'D', 'E', 'Other']);
    expect(data.Other).toBe(95 + 94);
    expect(total).toBe(list.reduce((s, t) => s + t.amount, 0));
  });
  it('adds the remainder to a real "Other" category instead of overwriting it', () => {
    const list = [tx(500, 'expense', 'Other'), ...['A', 'B', 'C', 'D', 'E'].map(c => tx(100, 'expense', c))];
    expect(topCategories(list, 'expense').data.Other).toBe(600);
  });
  it('only counts the requested type', () => {
    expect(topCategories([tx(100, 'income'), tx(50, 'expense')], 'expense').total).toBe(50);
  });
});

describe('getCurrencySymbol', () => {
  it('maps every supported currency, including GBP', () => {
    expect(['INR', 'USD', 'EUR', 'GBP'].map(getCurrencySymbol)).toEqual(['₹', '$', '€', '£']);
  });
  it('falls back to ₹ for unknown or missing codes', () => {
    expect(getCurrencySymbol(undefined)).toBe('₹');
    expect(getCurrencySymbol('XYZ')).toBe('₹');
  });
});

describe('extractJsonObject', () => {
  it('parses plain JSON', () => {
    expect(extractJsonObject('{"a":1}')).toEqual({ a: 1 });
  });
  it('finds JSON wrapped in prose or code fences', () => {
    expect(extractJsonObject('Here you go:\n```json\n{"name":"Laptop","price":999}\n```')).toEqual({ name: 'Laptop', price: 999 });
  });
  it('returns null when there is no valid object', () => {
    expect(extractJsonObject('no json here')).toBeNull();
    expect(extractJsonObject('{broken')).toBeNull();
    expect(extractJsonObject(null)).toBeNull();
  });
});

describe('balancesByPaymentMethod', () => {
  const t = (amount: number, type: Transaction['type'], paymentMethod?: string) => ({ amount, type, paymentMethod });
  it('nets income minus spending per method, own methods first', () => {
    const { rows, total } = balancesByPaymentMethod(
      [t(1000, 'income', 'UPI'), t(300, 'expense', 'UPI'), t(50, 'expense', 'Cash'), t(20, 'expense', 'Groceries/household purchase.')],
      ['Cash', 'UPI'],
    );
    expect(rows.map(r => [r.method, r.net, r.configured])).toEqual([
      ['UPI', 700, true], ['Cash', -50, true], ['Groceries/household purchase.', -20, false],
    ]);
    expect(total).toBe(630);
  });
  it('matches method names case-insensitively and keeps the user\'s spelling', () => {
    const { rows } = balancesByPaymentMethod([t(10, 'expense', 'upi')], ['UPI']);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ method: 'UPI', expense: 10, configured: true });
  });
  it('puts rows with no method under the first configured method', () => {
    expect(balancesByPaymentMethod([t(5, 'expense')], ['Cash', 'UPI']).rows[0]).toMatchObject({ method: 'Cash', net: -5 });
  });
});
