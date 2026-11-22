// Pure calculations over transactions, kept out of components so they can be
// unit-tested and shared.
import type { Transaction } from '../context/Store';
import { toLocalISODate } from './date';

export interface Totals {
  income: number;
  expense: number;
  /** income − expense */
  balance: number;
}

/** Sum income and expense. */
export function sumTotals(transactions: Pick<Transaction, 'type' | 'amount'>[]): Totals {
  let income = 0;
  let expense = 0;
  for (const t of transactions) {
    if (t.type === 'income') income += t.amount;
    else expense += t.amount;
  }
  return { income, expense, balance: income - expense };
}

/** Signed amount: income counts up, expense counts down. */
export const signedAmount = (t: Pick<Transaction, 'type' | 'amount'>) => (t.type === 'income' ? t.amount : -t.amount);

/**
 * Percentage change from `previous` to `current`, or null when `previous` is 0:
 * there is nothing to compare against, and showing "+0.0%" there was misleading.
 */
export const percentChange = (current: number, previous: number): number | null =>
  previous !== 0 ? ((current - previous) / Math.abs(previous)) * 100 : null;

/**
 * Badge text for a change: "+12.5%" / "-3.0%", "New" when there was nothing
 * before, or "—" when both values are 0.
 */
export const formatPercentChange = (current: number, previous: number): string => {
  const pct = percentChange(current, previous);
  if (pct === null) return current === 0 ? '—' : 'New';
  return `${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%`;
};

/**
 * Number of consecutive days, ending today, with at least one transaction.
 * A streak still counts if today has nothing yet but yesterday does, so it
 * doesn't reset first thing in the morning.
 */
export function calculateStreak(dates: string[], today: Date = new Date()): number {
  const active = new Set(dates);
  const day = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  if (!active.has(toLocalISODate(day))) day.setDate(day.getDate() - 1);

  let count = 0;
  while (active.has(toLocalISODate(day))) {
    count++;
    day.setDate(day.getDate() - 1);
  }
  return count;
}

/**
 * Category totals for one transaction type: the five largest categories, with
 * everything else added to "Other".
 */
export function topCategories(transactions: Transaction[], type: Transaction['type'], limit = 5) {
  const byCategory: Record<string, number> = {};
  let total = 0;
  for (const t of transactions) {
    if (t.type !== type) continue;
    byCategory[t.category] = (byCategory[t.category] || 0) + t.amount;
    total += t.amount;
  }
  const sorted = Object.entries(byCategory).sort(([, a], [, b]) => b - a);
  const data: Record<string, number> = Object.fromEntries(sorted.slice(0, limit));
  const rest = sorted.slice(limit).reduce((sum, [, v]) => sum + v, 0);
  if (rest > 0) data.Other = (data.Other || 0) + rest;
  return { data, total };
}

/** Money in, money out and the net for one payment method. */
export interface MethodBalance {
  method: string;
  income: number;
  expense: number;
  net: number;
  /** True for methods in the user's own list; false for ones that only appear in imported rows. */
  configured: boolean;
}

/**
 * Net balance per payment method across all transactions. The user's own
 * methods come first (largest balance first), then methods that only appear in
 * imported rows, which are often notes that landed in the Method column.
 */
export function balancesByPaymentMethod(
  transactions: Pick<Transaction, 'type' | 'amount' | 'paymentMethod'>[],
  configuredMethods: string[],
): { rows: MethodBalance[]; total: number } {
  const byKey = new Map<string, MethodBalance>();
  const configuredLower = new Map(configuredMethods.map(m => [m.toLowerCase(), m]));
  for (const m of configuredMethods) byKey.set(m.toLowerCase(), { method: m, income: 0, expense: 0, net: 0, configured: true });

  for (const t of transactions) {
    const name = (t.paymentMethod || '').trim() || configuredMethods[0] || 'Cash';
    const key = name.toLowerCase();
    let row = byKey.get(key);
    if (!row) {
      row = { method: configuredLower.get(key) ?? name, income: 0, expense: 0, net: 0, configured: configuredLower.has(key) };
      byKey.set(key, row);
    }
    if (t.type === 'income') row.income += t.amount; else row.expense += t.amount;
    row.net = row.income - row.expense;
  }

  const rows = [...byKey.values()].sort((a, b) =>
    a.configured !== b.configured ? (a.configured ? -1 : 1) : Math.abs(b.net) - Math.abs(a.net));
  return { rows, total: rows.reduce((sum, r) => sum + r.net, 0) };
}
