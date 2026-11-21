// One way to show money everywhere. Screens used to mix "+46.3k" (no symbol),
// "₹28,025", "+₹1700.00" (no separators) and "+₹12994 / mo".

/** Number locale per currency: Indian grouping (1,00,000) for INR. */
const localeFor = (symbol: string) => (symbol === '₹' ? 'en-IN' : 'en-GB');

export interface MoneyOptions {
  /** Prefix + for positive amounts and − for negative ones. */
  signed?: boolean;
  /** Short form for tight spaces: ₹46.3k, ₹1.2M. */
  compact?: boolean;
}

/**
 * Format an amount with its currency symbol and thousands separators.
 * Whole amounts show no decimals; others show two (₹89, ₹128.39).
 */
export function formatMoney(amount: number, symbol: string, { signed = false, compact = false }: MoneyOptions = {}): string {
  const abs = Math.abs(amount);
  let body: string;
  if (compact && abs >= 1_000_000) body = `${(abs / 1_000_000).toFixed(1)}M`;
  else if (compact && abs >= 1_000) body = `${(abs / 1_000).toFixed(1)}k`;
  else {
    const whole = Number.isInteger(Math.round(abs * 100) / 100);
    body = abs.toLocaleString(localeFor(symbol), {
      minimumFractionDigits: whole ? 0 : 2,
      maximumFractionDigits: 2,
    });
  }
  const sign = amount < 0 ? '-' : signed && amount > 0 ? '+' : '';
  return `${sign}${symbol}${body}`;
}
