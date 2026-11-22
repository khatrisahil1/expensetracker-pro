// Regression tests for adding a transaction on the Transactions page.
// Bug: saving without a receipt photo sent `attachment: undefined`, Firestore
// rejected the whole write, and the error was swallowed, so nothing happened.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';

const addTransaction = vi.fn();
// One object, like the real store's state. A new object per render would re-run
// the page's settings effect forever.
const store = {
  addTransaction,
  transactions: [] as { id: string; title: string; category: string; type: 'expense' | 'income'; date: string; amount: number }[],
  setViewingTransaction: vi.fn(),
  userSettings: {
    currency: 'INR',
    expenseCategories: ['Food', 'Rent'],
    incomeCategories: ['Salary'],
    paymentMethods: ['UPI', 'Cash'],
  },
};
vi.mock('../context/Store', () => ({ useStore: () => store }));
// The page imports the Gemini client for receipt scanning; not needed here.
vi.mock('../utils/gemini', () => ({ createGeminiClient: vi.fn(), GEMINI_MODEL: 'test' }));

const { TransactionsScreen } = await import('./TransactionsScreen');

const renderPage = () =>
  render(<MemoryRouter><TransactionsScreen /></MemoryRouter>);

/** Fill amount and merchant, then submit the form. */
const fillAndSave = async (container: HTMLElement, amount: string, merchant: string) => {
  fireEvent.change(screen.getByPlaceholderText('0.00'), { target: { value: amount } });
  fireEvent.change(container.querySelector('form input[type="text"]')!, { target: { value: merchant } });
  await act(async () => { fireEvent.submit(container.querySelector('form')!); });
};

/** True if any value in the object (at any depth) is undefined. */
const hasUndefined = (obj: object): boolean =>
  Object.values(obj).some(v => v === undefined || (v && typeof v === 'object' && hasUndefined(v)));

beforeEach(() => { addTransaction.mockReset(); addTransaction.mockResolvedValue(undefined); });
afterEach(cleanup);

describe('adding a transaction', () => {
  it('saves without any undefined fields (Firestore rejects those)', async () => {
    const { container } = renderPage();
    await fillAndSave(container, '250', 'Groceries');

    expect(addTransaction).toHaveBeenCalledTimes(1);
    const saved = addTransaction.mock.calls[0][0];
    expect(saved).toMatchObject({ title: 'Groceries', amount: 250, type: 'expense', category: 'Food', paymentMethod: 'UPI' });
    expect(saved).not.toHaveProperty('attachment');
    expect(saved).not.toHaveProperty('subscriptionFrequency');
    expect(hasUndefined(saved)).toBe(false);
  });

  it('confirms the save and clears the form', async () => {
    const { container } = renderPage();
    await fillAndSave(container, '99', 'Coffee');

    expect(screen.getByRole('status').textContent).toContain('Saved "Coffee"');
    expect((screen.getByPlaceholderText('0.00') as HTMLInputElement).value).toBe('');
  });

  it('shows the error when saving fails instead of doing nothing', async () => {
    addTransaction.mockRejectedValue(new Error('Missing or insufficient permissions.'));
    const { container } = renderPage();
    await fillAndSave(container, '50', 'Taxi');

    expect(screen.getByRole('status').textContent).toContain('Missing or insufficient permissions.');
    // The form keeps what was typed so the user can retry.
    expect((screen.getByPlaceholderText('0.00') as HTMLInputElement).value).toBe('50');
  });

  it('rejects a zero or negative amount without saving', async () => {
    const { container } = renderPage();
    await fillAndSave(container, '-5', 'Refund');

    expect(addTransaction).not.toHaveBeenCalled();
    expect(screen.getByRole('status').textContent).toContain('greater than 0');
  });

  it('trims the description', async () => {
    const { container } = renderPage();
    await fillAndSave(container, '10', '  Tea  ');
    expect(addTransaction.mock.calls[0][0].title).toBe('Tea');
  });
});

describe('automatic category', () => {
  afterEach(() => { store.transactions = []; });
  const merchantInput = (c: HTMLElement) => c.querySelector('form input[type="text"]') as HTMLInputElement;
  const categorySelect = (c: HTMLElement) => [...c.querySelectorAll('form select')].find(s => [...(s as HTMLSelectElement).options].some(o => o.value === 'Rent')) as HTMLSelectElement;

  it('picks the category used for that merchant before', () => {
    store.transactions = [{ id: 'x', title: 'Cafe 31', category: 'Rent', type: 'expense', date: '2026-11-01', amount: 10 }];
    const { container } = renderPage();
    fireEvent.change(merchantInput(container), { target: { value: 'Cafe 31' } });
    expect(categorySelect(container).value).toBe('Rent');
    expect(screen.getByText('Picked for you')).toBeTruthy();
  });

  it('stops once the user picks a category themselves', () => {
    store.transactions = [{ id: 'x', title: 'Cafe 31', category: 'Rent', type: 'expense', date: '2026-11-01', amount: 10 }];
    const { container } = renderPage();
    fireEvent.change(categorySelect(container), { target: { value: 'Food' } });
    fireEvent.change(merchantInput(container), { target: { value: 'Cafe 31' } });
    expect(categorySelect(container).value).toBe('Food');
  });
});
