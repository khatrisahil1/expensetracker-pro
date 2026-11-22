// Supported currencies. Previously each screen had its own ternary covering
// only INR/USD/EUR, so GBP (offered in Settings and onboarding) showed as ₹.

export const CURRENCIES = [
  { code: 'INR', symbol: '₹', name: 'Indian Rupee' },
  { code: 'USD', symbol: '$', name: 'US Dollar' },
  { code: 'EUR', symbol: '€', name: 'Euro' },
  { code: 'GBP', symbol: '£', name: 'British Pound' },
] as const;

export type CurrencyCode = (typeof CURRENCIES)[number]['code'];

export const DEFAULT_CURRENCY: CurrencyCode = 'INR';

/** Symbol for a currency code, e.g. 'USD' → '$'. Unknown or missing codes use the default (₹). */
export const getCurrencySymbol = (code: string | undefined | null): string =>
  (CURRENCIES.find(c => c.code === code) ?? CURRENCIES[0]).symbol;
