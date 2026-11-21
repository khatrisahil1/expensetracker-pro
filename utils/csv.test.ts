import { describe, expect, it } from 'vitest';
import { escapeCsvField, normaliseDate, parseAmount, parseCsvLine, transactionsToCsv } from './csv';
import type { Transaction } from '../context/Store';

const tx = (over: Partial<Transaction> = {}): Transaction => ({
  id: '1', title: 'Coffee', date: '2026-11-21', amount: 120, type: 'expense', category: 'Food',
  paymentMethod: 'UPI', note: '', ...over,
});

describe('export → import round trip', () => {
  it('reads back titles containing commas and quotes', () => {
    const csv = transactionsToCsv([tx({ title: 'Dinner, "Pizza" place', note: 'with Sam, Ali' })]);
    const [, row] = csv.split('\n');
    expect(parseCsvLine(row)).toEqual(['2026-11-21', 'Dinner, "Pizza" place', '120', 'expense', 'Food', 'UPI', 'with Sam, Ali']);
  });
  it('always writes the same 7 columns (History used to leave out Method)', () => {
    const [header, row] = transactionsToCsv([tx({ paymentMethod: undefined })]).split('\n');
    expect(header).toBe('Date,Title,Amount,Type,Category,Method,Note');
    expect(parseCsvLine(row)).toHaveLength(7);
  });
});

describe('escapeCsvField', () => {
  it('neutralises spreadsheet formulas', () => {
    expect(escapeCsvField('=HYPERLINK("x")')).toBe(`"'=HYPERLINK(""x"")"`);
    expect(escapeCsvField('+1')).toBe(`"'+1"`);
  });
  it('leaves numbers unquoted and handles empty values', () => {
    expect(escapeCsvField(42)).toBe('42');
    expect(escapeCsvField(undefined)).toBe('""');
  });
});

describe('normaliseDate', () => {
  it('accepts ISO dates and rejects impossible ones', () => {
    expect(normaliseDate('2026-11-21')).toBe('2026-11-21');
    expect(normaliseDate('2026-02-31')).toBeNull();
  });
  it('reads slashed dates day-first', () => {
    expect(normaliseDate('05/03/2026')).toBe('2026-03-05');
    expect(normaliseDate('5-3-2026')).toBe('2026-03-05');
  });
  it('reads month-first when the second number can only be a day', () => {
    expect(normaliseDate('03/25/2026')).toBe('2026-03-25');
  });
  it('reads text dates without shifting the day', () => {
    expect(normaliseDate('19 Jul 2025')).toBe('2025-07-19');
  });
  it('returns null for unreadable input', () => {
    expect(normaliseDate('')).toBeNull();
    expect(normaliseDate('not a date')).toBeNull();
    expect(normaliseDate('31/31/2026')).toBeNull();
  });
});

describe('parseAmount', () => {
  it('strips currency symbols, spaces and separators', () => {
    expect(parseAmount('₹1,250.50')).toBe(1250.5);
    expect(parseAmount(' $ 99 ')).toBe(99);
  });
  it('returns NaN for non-numbers', () => {
    expect(parseAmount('abc')).toBeNaN();
  });
});
