// Category and payment-method lists and their colours/icons. These used to be
// copied (with small differences) into five screens and the store; edit them here.

/** Categories a new account starts with. Users can add or remove their own in Settings. */
export const DEFAULT_EXPENSE_CATEGORIES = ['Food', 'Rent', 'Transportation', 'Shopping', 'Entertainment', 'Health', 'Utilities', 'Home', 'Other'];
export const DEFAULT_INCOME_CATEGORIES = ['Salary', 'Freelance', 'Investments', 'Gifts', 'Refunds', 'Rental', 'Home', 'Other'];
export const DEFAULT_PAYMENT_METHODS = ['Cash', 'UPI', 'Savings Account'];

/** Every default category, for filters that span income and expense. */
export const ALL_DEFAULT_CATEGORIES = Array.from(new Set([...DEFAULT_EXPENSE_CATEGORIES, ...DEFAULT_INCOME_CATEGORIES]));

/** Categories offered when adding a subscription. */
export const SUBSCRIPTION_CATEGORIES = ['Food', 'Housing', 'Transportation', 'Entertainment', 'Shopping', 'Health', 'Utilities', 'Subscription', 'Other'];

export interface CategoryStyle {
  /** Material Symbols icon name. */
  icon: string;
  /** Hex colour, for SVG charts. */
  hex: string;
  /** Tailwind text colour class. */
  color: string;
  /** Tailwind background tint class. */
  bg: string;
  /** Text, background and border classes together, for badges. */
  colorClass: string;
}

/** Builds the Tailwind classes for one colour, e.g. tw('orange-500'). */
const tw = (shade: string, icon: string, hex: string): CategoryStyle => ({
  icon,
  hex,
  color: `text-${shade}`,
  bg: `bg-${shade}/10`,
  colorClass: `text-${shade} bg-${shade}/10 border-${shade}/20`,
});

// Tailwind only generates classes it can see as complete strings in the source.
// The CDN build used here compiles at runtime, so built-up names like these work;
// if the project moves to a compiled Tailwind build, add them to its safelist.
export const CATEGORY_STYLES: Record<string, CategoryStyle> = {
  Food: tw('orange-500', 'restaurant', '#f97316'),
  Housing: tw('blue-500', 'home', '#3b82f6'),
  Rent: tw('indigo-400', 'real_estate_agent', '#818cf8'),
  Transportation: tw('purple-500', 'directions_car', '#a855f7'),
  Entertainment: tw('pink-500', 'movie', '#ec4899'),
  Shopping: tw('yellow-500', 'shopping_bag', '#eab308'),
  Subscription: tw('red-500', 'subscriptions', '#ad1c43'),
  Health: tw('red-400', 'medical_services', '#f87171'),
  Utilities: tw('cyan-400', 'bolt', '#22d3ee'),
  Home: tw('indigo-500', 'home', '#6366f1'),
  Salary: tw('emerald-500', 'payments', '#10b981'),
  Freelance: tw('cyan-500', 'work', '#06b6d4'),
  Investments: tw('violet-500', 'trending_up', '#8b5cf6'),
  Gifts: tw('pink-400', 'card_giftcard', '#f472b6'),
  Refunds: tw('amber-500', 'currency_exchange', '#f59e0b'),
  Rental: tw('blue-400', 'house', '#60a5fa'),
  Other: tw('gray-400', 'receipt', '#9ca3af'),
};

/** Style for a category, falling back to "Other" for user-created categories. */
export const getCategoryStyle = (category: string | undefined): CategoryStyle =>
  (category && CATEGORY_STYLES[category]) || CATEGORY_STYLES.Other;

/** Chart colours for payment methods; unknown methods cycle through FALLBACK_CHART_COLORS. */
export const PAYMENT_METHOD_COLORS: Record<string, string> = {
  Cash: '#10b981',
  UPI: '#3b82f6',
  'Savings Account': '#f59e0b',
  'Credit Card': '#ef4444',
  'Debit Card': '#06b6d4',
  Unspecified: '#9ca3af',
};

export const FALLBACK_CHART_COLORS = ['#10b981', '#3b82f6', '#8b5cf6', '#f59e0b', '#ef4444', '#06b6d4', '#FF0000'];
