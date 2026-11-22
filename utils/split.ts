// Split Bill maths. Friends are names (they don't need an account). A split
// records who paid and each person's share; balances say who owes whom.
// "Me" is always written as YOU.

export const YOU = 'You';

export type SplitMethod = 'equal' | 'exact' | 'percent';

export interface SplitBill {
  id: string;
  title: string;
  total: number;
  date: string; // YYYY-MM-DD
  /** YOU or a friend's name. */
  paidBy: string;
  /** Everyone sharing the bill, including YOU when you're part of it. */
  people: string[];
  /** Amount each person owes towards the total. Sums to `total`. */
  shares: Record<string, number>;
  /** People who have paid back the payer. */
  settled: Record<string, boolean>;
  method: SplitMethod;
  createdAt: number;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Work out each person's share.
 *  equal   → total / n, with any leftover paise given to the first people so it adds up exactly
 *  exact   → `inputs` are amounts
 *  percent → `inputs` are percentages
 * Returns the shares and an error message if the inputs don't add up.
 */
export function computeShares(
  total: number,
  people: string[],
  method: SplitMethod,
  inputs: Record<string, number> = {},
): { shares: Record<string, number>; error: string | null } {
  const shares: Record<string, number> = {};
  if (people.length === 0) return { shares, error: 'Add at least one person.' };
  if (!(total > 0)) return { shares, error: 'Enter the bill amount.' };

  if (method === 'equal') {
    const cents = Math.round(total * 100);
    const base = Math.floor(cents / people.length);
    let extra = cents - base * people.length;
    for (const p of people) { shares[p] = (base + (extra > 0 ? 1 : 0)) / 100; if (extra > 0) extra--; }
    return { shares, error: null };
  }

  if (method === 'exact') {
    let sum = 0;
    for (const p of people) { shares[p] = round2(inputs[p] || 0); sum += shares[p]; }
    const diff = round2(total - sum);
    return { shares, error: Math.abs(diff) < 0.01 ? null : diff > 0 ? `₹${diff} still to assign.` : `₹${-diff} too much assigned.` };
  }

  // percent
  let pctSum = 0;
  for (const p of people) pctSum += inputs[p] || 0;
  if (Math.abs(pctSum - 100) > 0.01) {
    for (const p of people) shares[p] = round2((total * (inputs[p] || 0)) / 100);
    return { shares, error: `Percentages add up to ${round2(pctSum)}%, not 100%.` };
  }
  // Fix rounding so shares sum exactly to the total.
  let assigned = 0;
  people.forEach((p, i) => {
    shares[p] = i === people.length - 1 ? round2(total - assigned) : round2((total * (inputs[p] || 0)) / 100);
    assigned = round2(assigned + shares[p]);
  });
  return { shares, error: null };
}

/**
 * Net balance with each friend across all splits.
 * Positive: they owe you. Negative: you owe them. Settled shares don't count.
 */
export function friendBalances(splits: SplitBill[]): Record<string, number> {
  const net: Record<string, number> = {};
  const add = (name: string, amount: number) => { net[name] = round2((net[name] ?? 0) + amount); };
  for (const s of splits) {
    for (const person of s.people) {
      if (person === s.paidBy || s.settled[person]) continue;
      const share = s.shares[person] ?? 0;
      if (s.paidBy === YOU) add(person, share);          // they owe you
      else if (person === YOU) add(s.paidBy, -share);   // you owe the payer
      // friend-to-friend debts aren't yours to track
    }
  }
  for (const k of Object.keys(net)) if (Math.abs(net[k]) < 0.01) delete net[k];
  return net;
}

/** Totals for the summary card. */
export const balanceTotals = (balances: Record<string, number>) => ({
  owedToYou: round2(Object.values(balances).filter(v => v > 0).reduce((a, b) => a + b, 0)),
  youOwe: round2(Object.values(balances).filter(v => v < 0).reduce((a, b) => a - b, 0)),
});

/** True when everyone who owes the payer has settled. */
export const isFullySettled = (s: SplitBill) => s.people.every(p => p === s.paidBy || s.settled[p]);

/** Mark every share between YOU and `friend` as settled. */
export function settleWithFriend(splits: SplitBill[], friend: string): SplitBill[] {
  return splits.map(s => {
    if (s.paidBy === YOU && s.people.includes(friend) && !s.settled[friend]) return { ...s, settled: { ...s.settled, [friend]: true } };
    if (s.paidBy === friend && s.people.includes(YOU) && !s.settled[YOU]) return { ...s, settled: { ...s.settled, [YOU]: true } };
    return s;
  });
}
