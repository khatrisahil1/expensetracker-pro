import React, { useMemo } from 'react';
import { useStore, Transaction } from '../context/Store';

interface SpendingHeatmapProps {
  onSelectDate?: (dateStr: string) => void;
}

const SpendingHeatmap: React.FC<SpendingHeatmapProps> = ({ onSelectDate }) => {
  const { transactions, userSettings } = useStore();
  const currencySymbol = userSettings?.currency === 'USD' ? '$' : userSettings?.currency === 'EUR' ? '€' : '₹';

  // Generate 52 weeks (364 days) up to today
  const { weeks, dayStatsMap, maxExpense, statsSummary } = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Map date string "YYYY-MM-DD" to { expense, income, count, items }
    const map: Record<string, { expense: number; income: number; count: number; items: Transaction[] }> = {};

    transactions.forEach((tx) => {
      if (!map[tx.date]) {
        map[tx.date] = { expense: 0, income: 0, count: 0, items: [] };
      }
      if (tx.type === 'expense') map[tx.date].expense += tx.amount;
      else map[tx.date].income += tx.amount;
      map[tx.date].count += 1;
      map[tx.date].items.push(tx);
    });

    let maxExp = 0;
    Object.values(map).forEach((d) => {
      if (d.expense > maxExp) maxExp = d.expense;
    });

    // Generate 52 weeks (ending on current day of week)
    const weeksArr: Date[][] = [];
    const endDate = new Date(today);
    // Align endDate to Saturday end of week
    const endDayOfWeek = endDate.getDay();
    const totalDays = 52 * 7 + endDayOfWeek + 1;

    const startDate = new Date(today);
    startDate.setDate(startDate.getDate() - totalDays + 1);

    let currentWeek: Date[] = [];
    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      currentWeek.push(new Date(d));
      if (currentWeek.length === 7) {
        weeksArr.push(currentWeek);
        currentWeek = [];
      }
    }
    if (currentWeek.length > 0) weeksArr.push(currentWeek);

    // Stats summary
    let highestDayDate = '';
    let highestDayAmount = 0;
    let activeDaysCount = 0;
    let totalExpenseAll = 0;

    Object.entries(map).forEach(([dateStr, stat]) => {
      if (stat.expense > 0) {
        activeDaysCount++;
        totalExpenseAll += stat.expense;
        if (stat.expense > highestDayAmount) {
          highestDayAmount = stat.expense;
          highestDayDate = dateStr;
        }
      }
    });

    const avgDaily = activeDaysCount > 0 ? totalExpenseAll / activeDaysCount : 0;

    return {
      weeks: weeksArr,
      dayStatsMap: map,
      maxExpense: maxExp || 1,
      statsSummary: { highestDayDate, highestDayAmount, avgDaily, activeDaysCount },
    };
  }, [transactions]);

  const getColorClass = (dateStr: string) => {
    const stat = dayStatsMap[dateStr];
    if (!stat || stat.expense === 0) return 'bg-[#1e293b]/40 border-white/5';
    const ratio = stat.expense / maxExpense;
    if (ratio < 0.15) return 'bg-emerald-900/60 border-emerald-700/40 text-emerald-300';
    if (ratio < 0.35) return 'bg-emerald-600/80 border-emerald-500/50 text-white';
    if (ratio < 0.65) return 'bg-amber-500/80 border-amber-400/50 text-white';
    return 'bg-rose-600/90 border-rose-500/60 text-white shadow-[0_0_10px_rgba(244,63,94,0.4)]';
  };

  return (
    <div className="flex flex-col gap-6 p-6 rounded-[2.5rem] bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark shadow-card-light dark:shadow-card">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-xl font-black text-text-light-main dark:text-text-dark-main flex items-center gap-2">
            <span className="material-symbols-outlined text-primary">calendar_view_month</span>
            Spending Heatmap
          </h3>
          <p className="text-xs text-text-light-muted dark:text-text-dark-muted font-medium mt-1">
            Visual intensity of daily spending over the last 365 days
          </p>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-2 text-xs font-bold text-text-light-muted dark:text-text-dark-muted">
          <span>Less</span>
          <div className="size-3.5 rounded-sm bg-[#1e293b]/40 border border-white/5" />
          <div className="size-3.5 rounded-sm bg-emerald-900/60 border border-emerald-700/40" />
          <div className="size-3.5 rounded-sm bg-emerald-600/80 border border-emerald-500/50" />
          <div className="size-3.5 rounded-sm bg-amber-500/80 border border-amber-400/50" />
          <div className="size-3.5 rounded-sm bg-rose-600/90 border border-rose-500/60" />
          <span>More</span>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <div className="p-4 rounded-2xl bg-background-light dark:bg-surface-darker border border-border-light dark:border-border-dark flex flex-col gap-1">
          <span className="text-[10px] font-black uppercase tracking-widest text-text-light-muted">Highest Spend Day</span>
          <span className="text-lg font-black text-danger">
            {statsSummary.highestDayAmount > 0
              ? `${currencySymbol}${statsSummary.highestDayAmount.toLocaleString()}`
              : 'N/A'}
          </span>
          <span className="text-xs text-text-light-muted">{statsSummary.highestDayDate || 'No data'}</span>
        </div>

        <div className="p-4 rounded-2xl bg-background-light dark:bg-surface-darker border border-border-light dark:border-border-dark flex flex-col gap-1">
          <span className="text-[10px] font-black uppercase tracking-widest text-text-light-muted">Avg Active Day Spend</span>
          <span className="text-lg font-black text-primary">
            {currencySymbol}{Math.round(statsSummary.avgDaily).toLocaleString()}
          </span>
          <span className="text-xs text-text-light-muted">across {statsSummary.activeDaysCount} active days</span>
        </div>

        <div className="col-span-2 md:col-span-1 p-4 rounded-2xl bg-background-light dark:bg-surface-darker border border-border-light dark:border-border-dark flex flex-col gap-1">
          <span className="text-[10px] font-black uppercase tracking-widest text-text-light-muted">Active Days Ratio</span>
          <span className="text-lg font-black text-text-light-main dark:text-text-dark-main">
            {Math.round((statsSummary.activeDaysCount / 365) * 100)}%
          </span>
          <span className="text-xs text-text-light-muted">{statsSummary.activeDaysCount} of 365 days spent money</span>
        </div>
      </div>

      {/* Heatmap Grid */}
      <div className="overflow-x-auto pb-2 scrollbar-none">
        <div className="flex gap-1.5 min-w-[700px] justify-between">
          {weeks.map((week, wIdx) => (
            <div key={wIdx} className="flex flex-col gap-1.5 flex-1">
              {week.map((dateObj) => {
                const dateStr = dateObj.toISOString().split('T')[0];
                const stat = dayStatsMap[dateStr];
                const exp = stat?.expense || 0;
                return (
                  <div
                    key={dateStr}
                    onClick={() => onSelectDate && onSelectDate(dateStr)}
                    title={`${dateStr}: ${exp > 0 ? `${currencySymbol}${exp.toLocaleString()} spent` : 'No expenses'}`}
                    className={`h-4 rounded-md border transition-all cursor-pointer hover:scale-125 hover:z-10 ${getColorClass(
                      dateStr
                    )}`}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default SpendingHeatmap;
