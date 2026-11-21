// Turns raw bank-statement narrations into readable merchant names and guesses
// a category from them. Imported statements kept titles like
// "UPI/Zomato/XXpayu@hdfcban/UPIIntent/HDFC BANK/0000151…" and landed in
// "Other", so most of a user's spending showed up uncategorised.

/** Words that add nothing to a merchant name. */
const NOISE_WORDS = /\b(pvt|private|ltd|limited|llp|inc|india|technologies|retail)\b\.?/gi;
/** Masked card/account numbers such as 4616XXXXXXXX6334 or ******8347. */
const MASKED_NUMBER = /\b\d*[X*]{4,}\w*\b/gi;

/** True if the text looks like a bank narration rather than something a person typed. */
export const isBankNarration = (raw: string) =>
  /^(UPI|POS|NEFT|IMPS|ACH|ATM)[/\s-]/i.test(raw) || /-UPI$|@[A-Z]{2,}|[X*]{4,}/i.test(raw);

/** "SWIGGY LTD" → "Swiggy". Words of 3+ letters without vowels (GST, BMRCL) and words with digits stay as they are. */
const tidyWords = (s: string) =>
  s.replace(NOISE_WORDS, ' ')
    .replace(/[^\p{L}\p{N}&' .]/gu, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .map(w => (/\d/.test(w) || (w.length >= 3 && !/[aeiou]/i.test(w)) ? w.toUpperCase() : w[0].toUpperCase() + w.slice(1).toLowerCase()))
    .join(' ')
    .trim();

/** Pull the merchant or person out of the common Indian statement formats. */
function extractName(raw: string): string {
  const text = raw.trim();

  // UPI/<merchant>/<vpa>/... and UPI/P2A/<ref>/<person>/<bank>/...
  if (/^UPI\//i.test(text)) {
    const parts = text.split('/').map(p => p.trim());
    if (/^P2[AM]$/i.test(parts[1] || '')) return parts[3] || parts[1];
    return parts[1] || text;
  }

  // POS <card> <ref> <date> <time> <id> WWWBIGBASKETCOM: the merchant is the last word.
  if (/^POS\s/i.test(text)) {
    const last = text.split(/\s+/).pop() || text;
    return last.replace(/^www\.?/i, '').replace(/\.?(com|in|co)$/i, '');
  }

  // NAME-<vpa>@BANK-<ifsc>-<ref>-UPI: the name comes before the first hyphen.
  if (/-UPI$|@/i.test(text) && text.includes('-')) return text.split('-')[0];

  return text.replace(MASKED_NUMBER, ' ');
}

/**
 * Readable merchant name for a statement narration. Titles that don't look
 * like bank narrations are returned unchanged, so typed titles are never touched.
 */
export function cleanMerchantName(raw: string): string {
  if (!raw || !isBankNarration(raw)) return raw;
  const name = tidyWords(extractName(raw));
  return name || raw;
}

/** Keywords per category. Matched as whole words in the cleaned name. */
const CATEGORY_KEYWORDS: Record<string, string[]> = {
  Food: ['zomato', 'swiggy', 'cafe', 'café', 'restaurant', 'bakery', 'bakers', 'mithai', 'sweets', 'dominos', 'pizza', 'kfc',
    'mcdonalds', 'starbucks', 'chai', 'tea', 'coffee', 'wok', 'biryani', 'brew', 'kitchen', 'dhaba', 'food', 'foods',
    'blinkit', 'zepto', 'bigbasket', 'instamart', 'dmart', 'grofers', 'eatclub', 'faasos', 'haldiram', 'canteen'],
  Transportation: ['uber', 'ola', 'rapido', 'metro', 'bmrcl', 'dmrc', 'irctc', 'railway', 'railways', 'petrol', 'fuel', 'hpcl',
    'bpcl', 'iocl', 'fastag', 'redbus', 'trav', 'travel', 'parking', 'namma yatri'],
  Shopping: ['amazon', 'flipkart', 'myntra', 'ajio', 'mart', 'mall', 'decathlon', 'meesho', 'nykaa', 'ikea', 'croma', 'lifestyle'],
  Entertainment: ['netflix', 'spotify', 'hotstar', 'bookmyshow', 'pvr', 'inox', 'youtube', 'steam', 'playstation', 'turf'],
  Health: ['pharmacy', 'pharma', 'apollo', 'medplus', 'hospital', 'clinic', '1mg', 'pharmeasy', 'netmeds', 'diagnostics', 'medical'],
  Utilities: ['airtel', 'jio', 'vodafone', 'bescom', 'electricity', 'recharge', 'broadband', 'fibernet', 'water', 'gas', 'laundry', 'bill'],
  Rent: ['rent', 'nobroker', 'housing'],
};

/**
 * Guess a category from a merchant name, limited to `allowed` (the user's own
 * categories). Returns null when nothing matches.
 */
export function guessCategory(name: string, allowed: Iterable<string>): string | null {
  const allowedSet = new Set(allowed);
  const lower = ` ${name.toLowerCase().replace(/[^\p{L}\p{N} ]/gu, ' ')} `;
  for (const [category, words] of Object.entries(CATEGORY_KEYWORDS)) {
    if (!allowedSet.has(category)) continue;
    if (words.some(w => lower.includes(` ${w} `))) return category;
  }
  return null;
}

/** A suggested fix for one already-saved transaction. */
export interface TidyUp {
  id: string;
  oldTitle: string;
  title: string;
  oldCategory: string;
  category: string;
  /** Note with the original narration appended, when the title changes. */
  note: string;
}

interface TidyInput { id: string; title: string; category: string; type: 'income' | 'expense'; note?: string }

/**
 * Suggestions for saved transactions: readable names for bank narrations, and a
 * category for ones filed under "Other" (or a category that no longer exists)
 * when the merchant clearly matches. Nothing is changed here; the caller shows
 * these and saves only what the user confirms.
 */
export function suggestTidyUps(
  transactions: TidyInput[],
  expenseCategories: string[],
  incomeCategories: string[],
): TidyUp[] {
  const out: TidyUp[] = [];
  for (const t of transactions) {
    const title = cleanMerchantName(t.title);
    const allowed = t.type === 'income' ? incomeCategories : expenseCategories;
    const needsCategory = t.category === 'Other' || !allowed.includes(t.category);
    const category = needsCategory ? guessCategory(title, allowed) ?? t.category : t.category;
    if (title === t.title && category === t.category) continue;
    const note = title !== t.title
      ? [t.note, `Bank ref: ${t.title}`].filter(Boolean).join(' · ')
      : t.note || '';
    out.push({ id: t.id, oldTitle: t.title, title, oldCategory: t.category, category, note });
  }
  return out;
}
