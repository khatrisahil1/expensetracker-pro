// Transaction search for the History page.
// It used to look for the whole query as one phrase in the title, note or
// category, and only inside the period on screen, so "zomato" in November
// missed October's orders and "food upi" or "89" found nothing.
import type { Transaction } from '../context/Store';
import { formatDisplayDate } from './date';

/** Lowercase, strip accents, and treat punctuation as spaces. */
const normalise = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\p{L}\p{N}.]+/gu, ' ').trim();

/** Words in a query; empty when the query is blank. */
export const searchTokens = (query: string) => normalise(query).split(' ').filter(Boolean);

/** Everything a transaction can be found by, as one searchable string. */
const haystack = (t: Transaction) => normalise([
  t.title,
  t.note,
  t.category,
  t.paymentMethod,
  t.type,
  t.tags?.join(' '),
  t.date,                    // 2026-11-14
  formatDisplayDate(t.date), // 14 Nov 2026
  String(t.amount),          // 128.39
].filter(Boolean).join(' '));

/**
 * True when every word of the query appears somewhere in the transaction
 * (title, note, category, payment method, type, tags, date or amount), in any
 * order. Words match from their start, so "zom" finds "Zomato" and "89" finds
 * ₹89 and ₹89.50 but not ₹189.
 */
export function matchesSearch(t: Transaction, tokens: string[]): boolean {
  if (tokens.length === 0) return true;
  const text = ` ${haystack(t)}`;
  return tokens.every(token => text.includes(` ${token}`));
}
