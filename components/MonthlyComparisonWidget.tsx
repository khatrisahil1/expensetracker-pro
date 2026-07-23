import React, { useMemo } from 'react';
import { useStore } from '../context/Store';

const MonthlyComparisonWidget: React.FC = () => {
  const { transactions, userSettings } = useStore();
  const currencySymbol = userSettings?.currency === 'USD' ? '$' : userSettings?.currency === 'EUR' ? '€' : '₹';

  const comparisonData = useMemo(() => {
    const now = new Date();
    
    // Current month start/end
    const currYear = now.getFullYear();
    const currMonth = now.getMonth();
    
    // Previous month start/end
    const prevDate = new Date(currYear, currMonth - 1, 1);
    const prevYear = prevDate.getFullYear();
    const prevMonth = prevDate.getMonth();

    let currExpense = 0;
    let currIncome = 0;
    let prevExpense = 0;
    let prevIncome = 0;

    const currCatMap: Record<string, number> = {};
    const prevCatMap: Record<string, number> = {};

    transactions.forEach((tx) => {
      const d = new Date(tx.date);
      const y = d.getFullYear();
      const m = d.getMonth();

      if (y === currYear && m === currMonth) {
        if (tx.type === 'expense') {
          currExpense += tx.amount;
          currCatMap[tx.category] = (currCatMap[tx.category] || 0) + tx.amount;
        } else {
          currIncome += tx.amount;
        }
      } else if (y === prevYear && m === prevMonth) {
        if (tx.type === 'expense') {
          prevExpense += tx.amount;
          prevCatMap[tx.category] = (prevCatMap[tx.category] || 0) + tx.amount;
        } else {
          prevIncome += tx.amount;
        }
      }
    });

    const expChangePct = prevExpense > 0 ? ((currExpense - prevExpense) / prevExpense) * 100 : 0;
    const incChangePct = prevIncome > 0 ? ((currIncome - prevIncome) / prevIncome) * 100 : 0;

    // Build category delta list
    const allCats = Array.from(new Set([...Object.keys(currCatMap), ...Object.keys(prevCatMap)]));
    const categoryDeltas = allCats.map((cat) => {
      const curr = currCatMap[cat] || 0;
      const prev = prevCatMap[cat] || 0;
      const diff = curr - prev;
      const pct = prev > 0 ? (diff / prev) * 100 : curr > 0 ? 100 : 0;
      return { category: cat, curr, prev, diff, pct };
    }).sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff)).slice(0, 5);

    const currMonthName = now.toLocaleString('default', { month: 'short' });
    const prevMonthName = prevDate.toLocaleString('default', { month: 'short' });

    return {
      currMonthName,
      prevMonthName,
      currExpense,
      currIncome,
      prevExpense,
      prevIncome,
      expChangePct,
      incChangePct,
      categoryDeltas,
    };
  }, [transactions]);

  const { currMonthName, prevMonthName, currExpense, currIncome, prevExpense, prevIncome, expChangePct, incChangePct, categoryDeltas } = comparisonData;

  return (
    <div className="col-span-2 md:col-span-2 lg:col-span-12 bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark rounded-[2.5rem] p-6 lg:p-8 flex flex-col gap-6 shadow-card-light dark:shadow-card">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="size-10 rounded-full border border-border-light dark:border-white/20 flex items-center justify-center text-primary bg-primary/10">
            <span className="material-symbols-outlined text-xl">compare_arrows</span>
          </div>
          <div>
            <h3 className="text-xl font-black text-text-light-main dark:text-text-dark-main">
              Month-over-Month Comparison
            </h3>
            <p className="text-xs text-text-light-muted dark:text-text-dark-muted font-medium">
              Comparing {currMonthName} vs {prevMonthName} performance
            </p>
          </div>
        </div>
      </div>

      {/* Metric comparison cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Expenses comparison */}
        <div className="p-5 rounded-2xl bg-background-light dark:bg-surface-darker border border-border-light dark:border-border-dark flex flex-col gap-3">
          <span className="text-xs font-black uppercase tracking-widest text-text-light-muted">Total Expenses</span>
          <div className="flex items-baseline justify-between">
            <div>
              <span className="text-2xl font-black text-danger">{currencySymbol}{currExpense.toLocaleString()}</span>
              <span className="text-xs text-text-light-muted ml-2">in {currMonthName}</span>
            </div>
            <span className={`px-2.5 py-1 rounded-full text-xs font-black ${
              expChangePct <= 0 ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'
            }`}>
              {expChangePct >= 0 ? '+' : ''}{expChangePct.toFixed(1)}%
            </span>
          </div>
          <p className="text-xs text-text-light-muted">
            vs {currencySymbol}{prevExpense.toLocaleString()} in {prevMonthName}
          </p>
        </div>

        {/* Income comparison */}
        <div className="p-5 rounded-2xl bg-background-light dark:bg-surface-darker border border-border-light dark:border-border-dark flex flex-col gap-3">
          <span className="text-xs font-black uppercase tracking-widest text-text-light-muted">Total Income</span>
          <div className="flex items-baseline justify-between">
            <div>
              <span className="text-2xl font-black text-primary">{currencySymbol}{currIncome.toLocaleString()}</span>
              <span className="text-xs text-text-light-muted ml-2">in {currMonthName}</span>
            </div>
            <span className={`px-2.5 py-1 rounded-full text-xs font-black ${
              incChangePct >= 0 ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'
            }`}>
              {incChangePct >= 0 ? '+' : ''}{incChangePct.toFixed(1)}%
            </span>
          </div>
          <p className="text-xs text-text-light-muted">
            vs {currencySymbol}{prevIncome.toLocaleString()} in {prevMonthName}
          </p>
        </div>
      </div>

      {/* Top Category Shifts */}
      {categoryDeltas.length > 0 && (
        <div className="flex flex-col gap-3">
          <h4 className="text-xs font-black uppercase tracking-widest text-text-light-muted">
            Top Category Spending Shifts ({currMonthName} vs {prevMonthName})
          </h4>
          <div className="flex flex-col gap-2">
            {categoryDeltas.map((cat) => (
              <div
                key={cat.category}
                className="flex items-center justify-between p-3 rounded-xl bg-background-light dark:bg-surface-darker border border-border-light dark:border-border-dark"
              >
                <span className="text-sm font-bold text-text-light-main dark:text-text-dark-main">
                  {cat.category}
                </span>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-text-light-muted font-bold">
                    {currencySymbol}{cat.curr.toLocaleString()} <span className="opacity-50">(was {currencySymbol}{cat.prev.toLocaleString()})</span>
                  </span>
                  <span className={`text-xs font-black ${cat.diff > 0 ? 'text-danger' : 'text-primary'}`}>
                    {cat.diff > 0 ? `+${currencySymbol}${cat.diff.toLocaleString()}` : `-${currencySymbol}${Math.abs(cat.diff).toLocaleString()}`}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default MonthlyComparisonWidget;
