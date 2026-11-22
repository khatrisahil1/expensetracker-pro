// Numbers for the Monthly Wrapped story (components/wrapped/MonthlyWrapped.tsx).
// Pure and tested: give it transactions and a month, get back everything the
// slides show.
import type { Transaction } from '../context/Store';
import { parseLocalDate, toLocalISODate } from './date';
import { getPeriodRange, isInRange, shiftPeriod } from './period';
import { percentChange, sumTotals } from './transactionStats';

export type PiggyMood = 'thrilled' | 'happy' | 'okay' | 'worried';

export interface WrappedStats {
  /** First day of the month, local. */
  month: Date;
  monthName: string; // "October"
  income: number;
  expense: number;
  net: number;
  /** Share of income kept, 0–100 (0 when there was no income). */
  savingsRate: number;
  transactionCount: number;
  daysLogged: number;
  daysInMonth: number;
  topCategory: { name: string; amount: number; share: number } | null;
  categories: { name: string; amount: number }[];
  biggestExpense: { title: string; amount: number; date: string; category: string } | null;
  /** Spending per weekday, Monday first. */
  byWeekday: number[];
  busiestWeekday: string | null;
  /** % change in spending vs the month before (null when nothing to compare). */
  spendChange: number | null;
  mood: PiggyMood;
}

const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

/** How the piggy feels about the month. */
export const moodFor = (income: number, expense: number): PiggyMood => {
  if (income <= 0) return expense > 0 ? 'worried' : 'okay';
  const rate = (income - expense) / income;
  if (rate >= 0.3) return 'thrilled';
  if (rate >= 0.1) return 'happy';
  if (rate >= 0) return 'okay';
  return 'worried';
};

export function buildWrapped(transactions: Transaction[], anyDayInMonth: Date): WrappedStats {
  const range = getPeriodRange(anyDayInMonth, 'month');
  const month = range.start;
  const inMonth = transactions.filter(t => isInRange(t.date, range));
  const { income, expense, balance } = sumTotals(inMonth);
  const expenses = inMonth.filter(t => t.type === 'expense');

  const byCat = new Map<string, number>();
  expenses.forEach(t => byCat.set(t.category, (byCat.get(t.category) ?? 0) + t.amount));
  const categories = [...byCat.entries()].map(([name, amount]) => ({ name, amount })).sort((a, b) => b.amount - a.amount);
  const top = categories[0];

  const biggest = expenses.reduce<Transaction | null>((max, t) => (!max || t.amount > max.amount ? t : max), null);

  const byWeekday = Array(7).fill(0) as number[];
  expenses.forEach(t => { byWeekday[(parseLocalDate(t.date).getDay() + 6) % 7] += t.amount; });
  const busiestIdx = byWeekday.some(v => v > 0) ? byWeekday.indexOf(Math.max(...byWeekday)) : -1;

  const previous = getPeriodRange(shiftPeriod(month, 'month', -1), 'month');
  const prevExpense = sumTotals(transactions.filter(t => isInRange(t.date, previous))).expense;

  return {
    month,
    monthName: month.toLocaleDateString('en-GB', { month: 'long' }),
    income,
    expense,
    net: balance,
    savingsRate: income > 0 ? Math.max(0, Math.round(((income - expense) / income) * 100)) : 0,
    transactionCount: inMonth.length,
    daysLogged: new Set(inMonth.map(t => t.date)).size,
    daysInMonth: range.end.getDate(),
    topCategory: top ? { name: top.name, amount: top.amount, share: expense > 0 ? Math.round((top.amount / expense) * 100) : 0 } : null,
    categories: categories.slice(0, 5),
    biggestExpense: biggest ? { title: biggest.title, amount: biggest.amount, date: biggest.date, category: biggest.category } : null,
    byWeekday,
    busiestWeekday: busiestIdx >= 0 ? WEEKDAYS[busiestIdx] : null,
    spendChange: percentChange(expense, prevExpense),
    mood: moodFor(income, expense),
  };
}

/**
 * Which month to wrap: last month in the first week of a new month (it's
 * complete and freshly over), otherwise the current month so far.
 * Falls back to the current month when last month has no data.
 */
export function defaultWrappedMonth(transactions: Transaction[], today = new Date()): Date {
  const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  const lastRange = getPeriodRange(lastMonth, 'month');
  const hasLast = transactions.some(t => isInRange(t.date, lastRange));
  return today.getDate() <= 7 && hasLast ? lastMonth : new Date(today.getFullYear(), today.getMonth(), 1);
}

/** Months that have any transactions, newest first ("YYYY-MM-01" local dates). */
export const monthsWithData = (transactions: Transaction[]): string[] =>
  [...new Set(transactions.map(t => `${t.date.slice(0, 7)}-01`))].sort().reverse()
    .filter(m => !Number.isNaN(parseLocalDate(m).getTime()));

/** A fun, honest comparison for an amount (chai at ~₹20 a cup). */
export const chaiEquivalent = (amount: number) => Math.round(amount / 20);

export { toLocalISODate };
