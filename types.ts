
export enum View {
  LOGIN = 'LOGIN',
  DASHBOARD = 'DASHBOARD',
  SIMULATOR = 'SIMULATOR',
  VAULT = 'VAULT',
  SPLIT_BILL = 'SPLIT_BILL',
  SCANNER = 'SCANNER',
  GOALS = 'GOALS', // Mapped to Reports in nav for demo
  SETTINGS = 'SETTINGS',
  ONBOARDING = 'ONBOARDING',
  TRANSACTIONS_CALENDAR = 'TRANSACTIONS_CALENDAR'
}

export interface NavItem {
  id: View;
  label: string;
  icon: string;
}

export interface User {
  name: string;
  email: string;
  avatar: string;
  plan: string;
}