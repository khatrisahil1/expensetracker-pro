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

/** Key used to recognise the same merchant across rows: the tidy name, lowercased, single-spaced. */
export const merchantKey = (title: string) => cleanMerchantName(title).toLowerCase().replace(/\s+/g, ' ').trim();

/** Categories learned from the user's own history: merchant key → category. */
export type LearnedCategories = Map<string, string>;

/**
 * Learn categories from how the user has already filed things. For each
 * merchant, the category used most often (ignoring "Other") wins. So once
 * "Cafe 31" has been put in Food, other "Cafe 31" rows can follow.
 */
export function learnCategories(transactions: { title: string; category: string; type: 'income' | 'expense' }[]): LearnedCategories {
  const counts = new Map<string, Map<string, number>>();
  for (const t of transactions) {
    if (!t.category || t.category === 'Other') continue;
    const key = `${t.type}|${merchantKey(t.title)}`;
    if (key.endsWith('|')) continue;
    const perCat = counts.get(key) ?? new Map<string, number>();
    perCat.set(t.category, (perCat.get(t.category) ?? 0) + 1);
    counts.set(key, perCat);
  }
  const learned: LearnedCategories = new Map();
  for (const [key, perCat] of counts) {
    const [best] = [...perCat.entries()].sort((a, b) => b[1] - a[1]);
    learned.set(key, best[0]);
  }
  return learned;
}

/**
 * Guess a category from a merchant name, limited to `allowed` (the user's own
 * categories). The user's own history comes first, then the keyword list.
 * Returns null when nothing matches.
 */
export function guessCategory(
  name: string,
  allowed: Iterable<string>,
  learned?: LearnedCategories,
  type: 'income' | 'expense' = 'expense',
): string | null {
  const allowedSet = new Set(allowed);
  const fromHistory = learned?.get(`${type}|${merchantKey(name)}`);
  if (fromHistory && allowedSet.has(fromHistory)) return fromHistory;
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

interface TidyInput { id: string; title: string; category: string; type: 'income' | 'expense'; note?: string; paymentMethod?: string }

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
  const learned = learnCategories(transactions);
  const out: TidyUp[] = [];
  for (const t of transactions) {
    const title = cleanMerchantName(t.title);
    const allowed = t.type === 'income' ? incomeCategories : expenseCategories;
    const needsCategory = t.category === 'Other' || !allowed.includes(t.category);
    const category = needsCategory ? guessCategory(title, allowed, learned, t.type) ?? t.category : t.category;
    if (title === t.title && category === t.category) continue;
    const note = title !== t.title
      ? [t.note, `Bank ref: ${t.title}`].filter(Boolean).join(' · ')
      : t.note || '';
    out.push({ id: t.id, oldTitle: t.title, title, oldCategory: t.category, category, note });
  }
  return out;
}

/** Rows whose payment method isn't one of the user's, grouped by that value. */
export interface MethodFix {
  /** The value found in the Method column, e.g. "Salary credit." */
  value: string;
  ids: string[];
  /** Best guess among the user's methods, from the statement text. */
  suggested: string;
}

/**
 * Pick one of the user's payment methods from a row's text. Bank narrations
 * say how the money moved: "UPI/…" → UPI, "POS …" → a card, NEFT/IMPS/salary
 * → the bank account. Falls back to the user's first method.
 */
export function inferPaymentMethod(text: string, methods: string[]): string {
  const find = (re: RegExp) => methods.find(m => re.test(m));
  const t = text.toUpperCase();
  if (/\bUPI\b|@[A-Z]{2,}/.test(t)) return find(/upi/i) ?? methods[0];
  if (/\bPOS\b|\bCARD\b|X{4,}\d{4}/.test(t)) return find(/card|credit|debit/i) ?? find(/bank|sav|acc/i) ?? methods[0];
  if (/\b(NEFT|IMPS|RTGS|ACH|ATM|SALARY|INTEREST)\b/.test(t)) return find(/bank|sav|acc/i) ?? methods[0];
  if (/\bCASH\b/.test(t)) return find(/cash/i) ?? methods[0];
  return methods[0];
}

/**
 * Imported statements sometimes put a note in the Method column ("Salary
 * credit.", "Groceries/household purchase."), creating dozens of fake payment
 * methods. Group those rows by value and suggest a real method for each group
 * (the most common guess among its rows).
 */
export function suggestMethodFixes(transactions: TidyInput[], methods: string[]): MethodFix[] {
  if (methods.length === 0) return [];
  const known = new Set(methods.map(m => m.toLowerCase()));
  const groups = new Map<string, { value: string; ids: string[]; votes: Map<string, number> }>();
  for (const t of transactions) {
    const value = (t.paymentMethod || '').trim();
    if (!value || known.has(value.toLowerCase())) continue;
    const g = groups.get(value) ?? { value, ids: [], votes: new Map() };
    g.ids.push(t.id);
    const guess = inferPaymentMethod(`${value} ${t.title} ${t.note ?? ''}`, methods);
    g.votes.set(guess, (g.votes.get(guess) ?? 0) + 1);
    groups.set(value, g);
  }
  return [...groups.values()]
    .map(g => ({ value: g.value, ids: g.ids, suggested: [...g.votes.entries()].sort((a, b) => b[1] - a[1])[0][0] }))
    .sort((a, b) => b.ids.length - a.ids.length);
}

/** The note to save when a row's fake method is replaced: keep the old text. */
export const noteWithOldMethod = (note: string | undefined, oldMethod: string) =>
  [oldMethod.replace(/\.$/, ''), note].filter(Boolean).join(' · ');
