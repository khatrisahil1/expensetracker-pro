// Every URL in the app is defined here. Navigate with these constants
// (navigate(ROUTES.SETTINGS), <Link to={ROUTES.BUDGET}>) rather than string literals,
// so a path can be renamed in one place.
export const ROUTES = {
  LOGIN: '/login',
  ONBOARDING: '/onboarding',

  DASHBOARD: '/',
  TRANSACTIONS: '/transactions',
  TRANSACTION_HISTORY: '/transactions/history',
  VAULT: '/vault',
  SUBSCRIPTIONS: '/subscriptions',
  BUDGET: '/budget',
  SETTINGS: '/settings',
  SIMULATOR: '/simulator',
  SPLIT_BILL: '/split-bill',
} as const;

export type AppRoute = (typeof ROUTES)[keyof typeof ROUTES];

export interface NavItem {
  to: AppRoute;
  label: string;
  /** Shorter label for the mobile bottom bar. */
  shortLabel: string;
  /** Material Symbols icon name. */
  icon: string;
}

/** Main navigation, shared by the desktop sidebar and the mobile bottom bar. */
export const NAV_ITEMS: NavItem[] = [
  { to: ROUTES.DASHBOARD, label: 'Dashboard', shortLabel: 'Home', icon: 'home' },
  { to: ROUTES.TRANSACTIONS, label: 'Transactions', shortLabel: 'Trans', icon: 'receipt_long' },
  { to: ROUTES.VAULT, label: 'Vault', shortLabel: 'Vault', icon: 'savings' },
  { to: ROUTES.SUBSCRIPTIONS, label: 'Subscriptions', shortLabel: 'Subs', icon: 'subscriptions' },
  { to: ROUTES.BUDGET, label: 'Budget', shortLabel: 'Budget', icon: 'money_bag' },
];

/** Bottom bar on phones: a subset of NAV_ITEMS plus the profile/settings page. */
export const MOBILE_NAV_ITEMS: NavItem[] = [
  ...NAV_ITEMS.filter(item => item.to !== ROUTES.VAULT),
  { to: ROUTES.SETTINGS, label: 'Settings', shortLabel: 'Profile', icon: 'person' },
];

/** Browser tab titles per page. */
export const PAGE_TITLES: Record<string, string> = {
  [ROUTES.DASHBOARD]: 'Dashboard',
  [ROUTES.TRANSACTIONS]: 'Transactions',
  [ROUTES.TRANSACTION_HISTORY]: 'Transaction History',
  [ROUTES.VAULT]: 'Impulse Vault',
  [ROUTES.SUBSCRIPTIONS]: 'Subscriptions',
  [ROUTES.BUDGET]: 'Budget & Goals',
  [ROUTES.SETTINGS]: 'Settings',
  [ROUTES.SIMULATOR]: 'Simulator',
  [ROUTES.SPLIT_BILL]: 'Split Bill',
  [ROUTES.LOGIN]: 'Sign in',
  [ROUTES.ONBOARDING]: 'Welcome',
};
