// The renewal prompt must never write on its own: only "Add" books charges,
// "Skip" only moves the next date, and "Later" writes nothing.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { toLocalISODate, addInterval } from '../utils/date';

const today = toLocalISODate();
const threeCyclesAgo = addInterval(today, 'monthly', -2);
const addTransaction = vi.fn();
const updateTransaction = vi.fn();
const store = {
  addTransaction,
  updateTransaction,
  userSettings: { currency: 'INR' },
  transactions: [{
    id: 'sub1', title: 'YouTube Premium', date: '2026-01-01', amount: 89, type: 'expense', category: 'Entertainment',
    isSubscription: true, subscriptionFrequency: 'monthly', subscriptionStatus: 'active', nextRenewalDate: threeCyclesAgo,
  }],
};
vi.mock('../context/Store', () => ({ useStore: () => store }));

const { default: RenewalPrompt } = await import('./RenewalPrompt');

beforeEach(() => {
  addTransaction.mockReset().mockResolvedValue(undefined);
  updateTransaction.mockReset().mockResolvedValue(undefined);
});
afterEach(cleanup);

describe('RenewalPrompt', () => {
  it('asks instead of booking, and writes nothing just by showing', () => {
    render(<RenewalPrompt />);
    expect(screen.getByRole('dialog').textContent).toContain('3 renewals are due: YouTube Premium');
    expect(addTransaction).not.toHaveBeenCalled();
    expect(updateTransaction).not.toHaveBeenCalled();
  });

  it('"Add" books each missed renewal on its own date, then moves the next date', async () => {
    render(<RenewalPrompt />);
    await act(async () => { fireEvent.click(screen.getByText('Add 3 renewals')); });
    expect(addTransaction.mock.calls.map(c => c[0].date)).toEqual([threeCyclesAgo, addInterval(threeCyclesAgo, 'monthly'), addInterval(threeCyclesAgo, 'monthly', 2)]);
    expect(updateTransaction).toHaveBeenCalledWith('sub1', { nextRenewalDate: addInterval(threeCyclesAgo, 'monthly', 3) });
  });

  it('"Skip" moves the next date without booking anything', async () => {
    render(<RenewalPrompt />);
    await act(async () => { fireEvent.click(screen.getByText('Skip')); });
    expect(addTransaction).not.toHaveBeenCalled();
    expect(updateTransaction).toHaveBeenCalledTimes(1);
  });

  it('"Later" hides it without writing', async () => {
    render(<RenewalPrompt />);
    await act(async () => { fireEvent.click(screen.getByText('Later')); });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(addTransaction).not.toHaveBeenCalled();
    expect(updateTransaction).not.toHaveBeenCalled();
  });
});
