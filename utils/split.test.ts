import { describe, expect, it } from 'vitest';
import { YOU, balanceTotals, computeShares, friendBalances, isFullySettled, settleWithFriend, type SplitBill } from './split';

const bill = (over: Partial<SplitBill>): SplitBill => ({
  id: Math.random().toString(), title: 'Dinner', total: 900, date: '2026-11-20', paidBy: YOU,
  people: [YOU, 'Mike', 'Sara'], shares: { [YOU]: 300, Mike: 300, Sara: 300 }, settled: {}, method: 'equal', createdAt: 0, ...over,
});

describe('computeShares', () => {
  it('splits equally and hands leftover paise to the first people', () => {
    expect(computeShares(100, ['A', 'B', 'C'], 'equal').shares).toEqual({ A: 33.34, B: 33.33, C: 33.33 });
  });
  it('checks exact amounts add up', () => {
    expect(computeShares(100, ['A', 'B'], 'exact', { A: 60, B: 40 }).error).toBeNull();
    expect(computeShares(100, ['A', 'B'], 'exact', { A: 60, B: 30 }).error).toBe('₹10 still to assign.');
    expect(computeShares(100, ['A', 'B'], 'exact', { A: 80, B: 30 }).error).toBe('₹10 too much assigned.');
  });
  it('converts percentages and keeps the total exact', () => {
    const r = computeShares(100, ['A', 'B', 'C'], 'percent', { A: 33.33, B: 33.33, C: 33.34 });
    expect(r.error).toBeNull();
    expect(Object.values(r.shares).reduce((a, b) => a + b, 0)).toBeCloseTo(100, 2);
    expect(computeShares(100, ['A', 'B'], 'percent', { A: 50, B: 40 }).error).toMatch(/90%/);
  });
  it('needs people and an amount', () => {
    expect(computeShares(100, [], 'equal').error).toMatch(/person/);
    expect(computeShares(0, ['A'], 'equal').error).toMatch(/amount/);
  });
});

describe('friendBalances', () => {
  it('counts what friends owe you and what you owe them', () => {
    const b = friendBalances([
      bill({}),                                                                    // Mike, Sara each owe 300
      bill({ paidBy: 'Mike', total: 400, people: [YOU, 'Mike'], shares: { [YOU]: 200, Mike: 200 } }), // you owe Mike 200
    ]);
    expect(b).toEqual({ Mike: 100, Sara: 300 });
    expect(balanceTotals(b)).toEqual({ owedToYou: 400, youOwe: 0 });
  });
  it('ignores settled shares and friend-to-friend debts', () => {
    const b = friendBalances([
      bill({ settled: { Mike: true } }),
      bill({ paidBy: 'Mike', people: ['Mike', 'Sara'], shares: { Mike: 450, Sara: 450 } }),
    ]);
    expect(b).toEqual({ Sara: 300 });
  });
});

describe('settling up', () => {
  it('settles every share with one friend, both directions', () => {
    const splits = [bill({}), bill({ paidBy: 'Mike', people: [YOU, 'Mike'], shares: { [YOU]: 50, Mike: 50 } })];
    const after = settleWithFriend(splits, 'Mike');
    expect(friendBalances(after)).toEqual({ Sara: 300 });
    expect(isFullySettled(after[1])).toBe(true);
    expect(isFullySettled(after[0])).toBe(false);
  });
});
