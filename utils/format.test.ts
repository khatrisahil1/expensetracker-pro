import { describe, expect, it } from 'vitest';
import { formatMoney } from './format';

describe('formatMoney', () => {
  it('uses Indian grouping for rupees and drops .00 on whole amounts', () => {
    expect(formatMoney(150000, '₹')).toBe('₹1,50,000');
    expect(formatMoney(1700, '₹')).toBe('₹1,700');
  });
  it('shows two decimals when there are paise/cents', () => {
    expect(formatMoney(128.39, '₹')).toBe('₹128.39');
    expect(formatMoney(128.5, '$')).toBe('$128.50');
  });
  it('signs amounts on request', () => {
    expect(formatMoney(6, '₹', { signed: true })).toBe('+₹6');
    expect(formatMoney(-89, '₹', { signed: true })).toBe('-₹89');
    expect(formatMoney(0, '₹', { signed: true })).toBe('₹0');
  });
  it('compacts large amounts but keeps the symbol', () => {
    expect(formatMoney(46263.87, '₹', { compact: true })).toBe('₹46.3k');
    expect(formatMoney(-28025, '₹', { compact: true, signed: true })).toBe('-₹28.0k');
    expect(formatMoney(2500000, '£', { compact: true })).toBe('£2.5M');
    expect(formatMoney(250, '₹', { compact: true })).toBe('₹250');
  });
});
