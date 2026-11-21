import { describe, expect, it } from 'vitest';
import { matchesSearch, searchTokens } from './search';
import type { Transaction } from '../context/Store';

const tx = (over: Partial<Transaction> = {}): Transaction => ({
  id: '1', title: 'Zomato', date: '2026-10-14', amount: 128.39, type: 'expense', category: 'Food', paymentMethod: 'UPI',
  note: 'Bank ref: UPI/Zomato/XXpayu@hdfcban/UPIIntent', ...over,
});
const find = (q: string, t = tx()) => matchesSearch(t, searchTokens(q));

describe('matchesSearch', () => {
  it('ignores case, extra spaces and word order', () => {
    expect(find('  ZOMATO ')).toBe(true);
    expect(find('upi food')).toBe(true);
    expect(find('food zomato upi')).toBe(true);
  });
  it('matches the start of words, so partial typing works', () => {
    expect(find('zom')).toBe(true);
    expect(find('mato')).toBe(false);
  });
  it('finds by amount without matching inside other numbers', () => {
    expect(find('128')).toBe(true);
    expect(find('128.39')).toBe(true);
    expect(find('28')).toBe(false);
  });
  it('finds by date, written either way', () => {
    expect(find('oct')).toBe(true);
    expect(find('14 oct')).toBe(true);
    expect(find('2026-10')).toBe(true);
  });
  it('finds by payment method, type and the original bank text', () => {
    expect(find('expense')).toBe(true);
    expect(find('hdfcban')).toBe(true);
  });
  it('needs every word to match', () => {
    expect(find('zomato swiggy')).toBe(false);
  });
  it('matches everything for an empty query', () => {
    expect(find('')).toBe(true);
    expect(searchTokens('   ')).toEqual([]);
  });
  it('ignores accents and punctuation', () => {
    expect(find('cafe', tx({ title: 'Café Coffee Day' }))).toBe(true);
    expect(find('coffee-day', tx({ title: 'Café Coffee Day' }))).toBe(true);
  });
});
