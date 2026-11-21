// App Lock in Profile → Sign-In & Security. Turning it off used window.confirm,
// which embedded browsers can block, so the switch did nothing.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';

const setAppPin = vi.fn();
const removeAppPin = vi.fn();
const store: Record<string, unknown> = {};
vi.mock('../context/Store', () => ({ useStore: () => store }));

const { default: SettingsScreen } = await import('./SettingsScreen');
const { DialogProvider } = await import('./ui/DialogProvider');

const renderSecurity = (appPin: string | null) => {
  Object.assign(store, {
    user: { email: 'test@example.com', emailVerified: true, providerData: [{ providerId: 'password' }], metadata: {} },
    userSettings: { displayName: 'Test', currency: 'INR', theme: 'dark', appPin, paymentMethods: [], expenseCategories: [], incomeCategories: [] },
    transactions: [],
    setAppPin, removeAppPin,
    updateUserSettings: vi.fn(), logout: vi.fn(), toggleTheme: vi.fn(), updatePassword: vi.fn(), deleteAccount: vi.fn(),
    sendVerificationEmail: vi.fn(), refreshUser: vi.fn(), clearAllTransactions: vi.fn(),
  });
  return render(
    <MemoryRouter initialEntries={['/settings?section=security']}>
      <DialogProvider><SettingsScreen /></DialogProvider>
    </MemoryRouter>,
  );
};

const pinSwitch = () => screen.getAllByRole('switch', { name: 'Require PIN' })[0];
const typePin = async (digits: string) => {
  for (const d of digits) await act(async () => { fireEvent.click(screen.getByRole('button', { name: d })); });
};

beforeEach(() => {
  setAppPin.mockReset().mockResolvedValue(undefined);
  removeAppPin.mockReset().mockResolvedValue(undefined);
  vi.spyOn(window, 'confirm').mockReturnValue(false); // a blocked native dialog must not matter
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe('App Lock', () => {
  it('turns off through the in-app dialog, without window.confirm', async () => {
    renderSecurity('hashed-pin');
    expect(pinSwitch().getAttribute('aria-checked')).toBe('true');
    await act(async () => { fireEvent.click(pinSwitch()); });
    expect(screen.getByRole('alertdialog').textContent).toContain('Turn off App Lock?');
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Turn Off' })); });
    await waitFor(() => expect(removeAppPin).toHaveBeenCalledTimes(1));
    expect(window.confirm).not.toHaveBeenCalled();
  });

  it('stays on when the dialog is cancelled', async () => {
    renderSecurity('hashed-pin');
    await act(async () => { fireEvent.click(pinSwitch()); });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Cancel' })); });
    await new Promise(r => setTimeout(r, 250));
    expect(removeAppPin).not.toHaveBeenCalled();
  });

  it('turns on after entering the same PIN twice', async () => {
    renderSecurity(null);
    await act(async () => { fireEvent.click(pinSwitch()); });
    await typePin('1234');
    await waitFor(() => expect(screen.getByText('Confirm your PIN')).toBeTruthy());
    await typePin('1234');
    await waitFor(() => expect(setAppPin).toHaveBeenCalledWith('1234'));
  });

  it('explains a mismatch in the keypad and saves nothing', async () => {
    renderSecurity(null);
    await act(async () => { fireEvent.click(pinSwitch()); });
    await typePin('1234');
    await waitFor(() => expect(screen.getByText('Confirm your PIN')).toBeTruthy());
    await typePin('9999');
    expect(screen.getByRole('alert').textContent).toContain('didn’t match');
    expect(setAppPin).not.toHaveBeenCalled();
  });

  it('changes the PIN from "Change PIN"', async () => {
    renderSecurity('hashed-pin');
    await act(async () => { fireEvent.click(screen.getAllByRole('button', { name: /Change PIN/ })[0]); });
    await typePin('4321');
    await waitFor(() => expect(screen.getByText('Confirm your PIN')).toBeTruthy());
    await typePin('4321');
    await waitFor(() => expect(setAppPin).toHaveBeenCalledWith('4321'));
  });
});
