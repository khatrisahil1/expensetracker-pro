// Tests for the route guards in AppRoutes.tsx.
//
// The real store connects to Firebase, so it's replaced with a stub whose state
// each test sets. Screens are replaced with labelled placeholders: these tests
// are about which page appears for a URL, not what the page looks like.
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter, Outlet, useLocation } from 'react-router';
import { ROUTES } from '../routes';

type StoreState = {
  user: { uid: string } | null;
  loading: boolean;
  isAppLocked: boolean;
  userSettings: { hasCompletedOnboarding: boolean } | null;
};
let store: StoreState;

vi.mock('../context/Store', () => ({ useStore: () => store }));

const stub = (label: string) => () => <div>{label}</div>;
vi.mock('../components/LoginScreen', () => ({ default: stub('LOGIN PAGE') }));
vi.mock('../components/OnboardingScreen', () => ({ default: stub('ONBOARDING PAGE') }));
vi.mock('../components/LoadingScreen', () => ({ LoadingScreen: stub('LOADING'), PageLoader: stub('PAGE LOADING') }));
vi.mock('../components/PinLockScreen', () => ({ PinLockScreen: stub('PIN LOCK') }));
vi.mock('../components/AppLayout', () => ({ default: () => <Outlet /> }));
vi.mock('../components/DashboardScreen', () => ({ default: stub('DASHBOARD PAGE') }));
vi.mock('../components/TransactionsScreen', () => ({ TransactionsScreen: stub('TRANSACTIONS PAGE') }));
vi.mock('../components/TransactionsCalendarScreen', () => ({ default: stub('HISTORY PAGE') }));
vi.mock('../components/ImpulseVaultScreen', () => ({ default: stub('VAULT PAGE') }));
vi.mock('../components/SubscriptionsScreen', () => ({ default: stub('SUBSCRIPTIONS PAGE') }));
vi.mock('../components/BudgetGoalsScreen', () => ({ default: stub('BUDGET PAGE') }));
vi.mock('../components/SettingsScreen', () => ({ default: stub('SETTINGS PAGE') }));
vi.mock('../components/SimulatorScreen', () => ({ default: stub('SIMULATOR PAGE') }));
vi.mock('../components/SplitBillScreen', () => ({ default: stub('SPLIT BILL PAGE') }));

// Imported after the mocks so it picks them up.
const { default: AppRoutes } = await import('./AppRoutes');

/** Shows the current URL so tests can assert on redirects. */
const CurrentPath = () => <div data-testid="path">{useLocation().pathname}</div>;

const renderAt = (url: string) =>
  render(
    <MemoryRouter initialEntries={[url]}>
      <React.Suspense fallback={<div>LAZY LOADING</div>}>
        <AppRoutes />
      </React.Suspense>
      <CurrentPath />
    </MemoryRouter>
  );

const path = () => screen.getByTestId('path').textContent;

const signedIn = (overrides: Partial<StoreState> = {}): StoreState => ({
  user: { uid: 'u1' },
  loading: false,
  isAppLocked: false,
  userSettings: { hasCompletedOnboarding: true },
  ...overrides,
});

beforeEach(() => { store = signedIn(); });
afterEach(cleanup);

describe('signed out', () => {
  beforeEach(() => { store = signedIn({ user: null, userSettings: null }); });

  it('sends a deep link to /login', async () => {
    renderAt(ROUTES.BUDGET);
    expect(await screen.findByText('LOGIN PAGE')).toBeTruthy();
    expect(path()).toBe(ROUTES.LOGIN);
  });

  it('shows the login page at /login', async () => {
    renderAt(ROUTES.LOGIN);
    expect(await screen.findByText('LOGIN PAGE')).toBeTruthy();
  });
});

describe('signing in', () => {
  it('returns to the page the user originally asked for', async () => {
    store = signedIn({ user: null, userSettings: null });
    const { rerender } = renderAt(ROUTES.SETTINGS);
    expect(path()).toBe(ROUTES.LOGIN);

    store = signedIn();
    rerender(
      <MemoryRouter initialEntries={[{ pathname: ROUTES.LOGIN, state: { from: ROUTES.SETTINGS } }]}>
        <React.Suspense fallback={null}><AppRoutes /></React.Suspense>
        <CurrentPath />
      </MemoryRouter>
    );
    expect(await screen.findByText('SETTINGS PAGE')).toBeTruthy();
    expect(path()).toBe(ROUTES.SETTINGS);
  });

  it('goes to the dashboard when there is nowhere to return to', async () => {
    renderAt(ROUTES.LOGIN);
    expect(await screen.findByText('DASHBOARD PAGE')).toBeTruthy();
    expect(path()).toBe(ROUTES.DASHBOARD);
  });
});

describe('onboarding', () => {
  it('sends a new account from any page to /onboarding', async () => {
    store = signedIn({ userSettings: { hasCompletedOnboarding: false } });
    renderAt(ROUTES.BUDGET);
    expect(await screen.findByText('ONBOARDING PAGE')).toBeTruthy();
    expect(path()).toBe(ROUTES.ONBOARDING);
  });

  it('sends an onboarded user away from /onboarding', async () => {
    renderAt(ROUTES.ONBOARDING);
    expect(await screen.findByText('DASHBOARD PAGE')).toBeTruthy();
    expect(path()).toBe(ROUTES.DASHBOARD);
  });

  it('does not block pages while settings have not loaded (guest mode after refresh)', async () => {
    store = signedIn({ userSettings: null });
    renderAt(ROUTES.VAULT);
    expect(await screen.findByText('VAULT PAGE')).toBeTruthy();
  });
});

describe('PIN lock', () => {
  it('shows the lock screen in place and keeps the deep-link URL', async () => {
    store = signedIn({ isAppLocked: true });
    renderAt(ROUTES.SUBSCRIPTIONS);
    expect(await screen.findByText('PIN LOCK')).toBeTruthy();
    expect(screen.queryByText('SUBSCRIPTIONS PAGE')).toBeNull();
    expect(path()).toBe(ROUTES.SUBSCRIPTIONS);
  });

  it('shows the same page after unlocking', async () => {
    store = signedIn({ isAppLocked: true });
    const { rerender } = renderAt(ROUTES.SUBSCRIPTIONS);
    store = signedIn({ isAppLocked: false });
    rerender(
      <MemoryRouter initialEntries={[ROUTES.SUBSCRIPTIONS]}>
        <React.Suspense fallback={null}><AppRoutes /></React.Suspense>
        <CurrentPath />
      </MemoryRouter>
    );
    expect(await screen.findByText('SUBSCRIPTIONS PAGE')).toBeTruthy();
  });
});

describe('every page route', () => {
  const pages: [string, string][] = [
    [ROUTES.DASHBOARD, 'DASHBOARD PAGE'],
    [ROUTES.TRANSACTIONS, 'TRANSACTIONS PAGE'],
    [ROUTES.TRANSACTION_HISTORY, 'HISTORY PAGE'],
    [ROUTES.VAULT, 'VAULT PAGE'],
    [ROUTES.SUBSCRIPTIONS, 'SUBSCRIPTIONS PAGE'],
    [ROUTES.BUDGET, 'BUDGET PAGE'],
    [ROUTES.SETTINGS, 'SETTINGS PAGE'],
    [ROUTES.SIMULATOR, 'SIMULATOR PAGE'],
    [ROUTES.SPLIT_BILL, 'SPLIT BILL PAGE'],
  ];
  it.each(pages)('%s renders %s', async (url, label) => {
    renderAt(url);
    expect(await screen.findByText(label)).toBeTruthy();
    expect(path()).toBe(url);
  });

  it('redirects unknown URLs to the dashboard', async () => {
    renderAt('/does-not-exist');
    expect(await screen.findByText('DASHBOARD PAGE')).toBeTruthy();
    expect(path()).toBe(ROUTES.DASHBOARD);
  });
});

describe('loading', () => {
  it('shows the loading screen until auth state is known', async () => {
    store = signedIn({ loading: true, user: null });
    renderAt(ROUTES.BUDGET);
    expect(screen.getByText('LOADING')).toBeTruthy();
  });
});
