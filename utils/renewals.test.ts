import { describe, expect, it } from 'vitest';
import { findMissedRenewals, renewalTransaction } from './renewals';
import type { Transaction } from '../context/Store';

const sub = (over: Partial<Transaction> = {}): Transaction => ({
  id: 's1', title: 'YouTube Premium', date: '2026-07-21', amount: 89, type: 'expense', category: 'Entertainment',
  isSubscription: true, subscriptionFrequency: 'monthly', subscriptionStatus: 'active', nextRenewalDate: '2026-09-21', ...over,
});

describe('findMissedRenewals', () => {
  it('lists every missed cycle up to today and the next date after it', () => {
    const [r] = findMissedRenewals([sub()], '2026-11-22');
    expect(r.dueDates).toEqual(['2026-09-21', '2026-10-21', '2026-11-21']);
    expect(r.nextRenewalDate).toBe('2026-12-21');
  });
  it('counts a renewal due today', () => {
    expect(findMissedRenewals([sub({ nextRenewalDate: '2026-11-22' })], '2026-11-22')[0].dueDates).toEqual(['2026-11-22']);
  });
  it('ignores future, paused and non-subscription entries', () => {
    const list = [
      sub({ id: 'a', nextRenewalDate: '2026-12-01' }),
      sub({ id: 'b', subscriptionStatus: 'paused' }),
      sub({ id: 'c', isSubscription: false }),
      sub({ id: 'd', nextRenewalDate: undefined }),
    ];
    expect(findMissedRenewals(list, '2026-11-22')).toEqual([]);
  });
  it('steps yearly and weekly subscriptions correctly', () => {
    expect(findMissedRenewals([sub({ subscriptionFrequency: 'yearly', nextRenewalDate: '2025-02-28' })], '2026-11-22')[0].dueDates)
      .toEqual(['2025-02-28', '2026-02-28']);
    expect(findMissedRenewals([sub({ subscriptionFrequency: 'weekly', nextRenewalDate: '2026-11-08' })], '2026-11-22')[0].dueDates)
      .toEqual(['2026-11-08', '2026-11-15', '2026-11-22']);
  });
  it('stops after a safe number of cycles for very old dates', () => {
    const [r] = findMissedRenewals([sub({ subscriptionFrequency: 'weekly', nextRenewalDate: '2000-01-01' })], '2026-11-22');
    expect(r.dueDates.length).toBe(120);
  });
});

describe('renewalTransaction', () => {
  it('is a plain expense on the due date, without subscription fields', () => {
    const tx = renewalTransaction(sub(), '2026-10-21');
    expect(tx).toMatchObject({ title: 'YouTube Premium (Renewal)', amount: 89, date: '2026-10-21', type: 'expense' });
    expect(tx).not.toHaveProperty('isSubscription');
    expect(Object.values(tx)).not.toContain(undefined);
  });
});
