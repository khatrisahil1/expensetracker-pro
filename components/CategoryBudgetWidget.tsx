import React, { useState, useMemo } from 'react';
import { useStore } from '../context/Store';

const CategoryBudgetWidget: React.FC = () => {
  const { transactions, userSettings, updateUserSettings } = useStore();
  const currencySymbol = userSettings?.currency === 'USD' ? '$' : userSettings?.currency === 'EUR' ? '€' : '₹';

  const [editingCategory, setEditingCategory] = useState<string | null>(null);
  const [limitInput, setLimitInput] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const categoryBudgets = userSettings?.categoryBudgets || {};
  const expenseCategories = userSettings?.expenseCategories || [
    'Food', 'Rent', 'Transportation', 'Shopping', 'Entertainment', 'Health', 'Utilities', 'Home', 'Other'
  ];

  // Calculate current month spending per category
  const categoryStats = useMemo(() => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    const spendMap: Record<string, number> = {};

    transactions.forEach((tx) => {
      const d = new Date(tx.date);
      if (tx.type === 'expense' && d.getMonth() === currentMonth && d.getFullYear() === currentYear) {
        spendMap[tx.category] = (spendMap[tx.category] || 0) + tx.amount;
      }
    });

    return expenseCategories.map((cat) => {
      const limit = categoryBudgets[cat] || 0;
      const spent = spendMap[cat] || 0;
      const pct = limit > 0 ? (spent / limit) * 100 : 0;
      return { category: cat, spent, limit, pct };
    }).filter(item => item.limit > 0 || item.spent > 0)
      .sort((a, b) => b.spent - a.spent)
      .slice(0, 5);
  }, [transactions, categoryBudgets, expenseCategories]);

  const handleOpenEdit = (category: string, currentLimit: number) => {
    setEditingCategory(category);
    setLimitInput(currentLimit ? currentLimit.toString() : '');
  };

  const handleSaveBudget = async () => {
    if (!editingCategory) return;
    const val = parseFloat(limitInput);
    setIsSaving(true);
    const newBudgets = { ...categoryBudgets };
    if (isNaN(val) || val <= 0) {
      delete newBudgets[editingCategory];
    } else {
      newBudgets[editingCategory] = val;
    }
    await updateUserSettings({ categoryBudgets: newBudgets });
    setEditingCategory(null);
    setIsSaving(false);
  };

  return (
    <div className="col-span-2 md:col-span-2 lg:col-span-12 bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark rounded-[2.5rem] p-6 lg:p-8 flex flex-col gap-6 shadow-card-light dark:shadow-card">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="size-10 rounded-full border border-border-light dark:border-white/20 flex items-center justify-center text-primary bg-primary/10">
            <span className="material-symbols-outlined text-xl">pie_chart</span>
          </div>
          <div>
            <h3 className="text-xl font-black text-text-light-main dark:text-text-dark-main">
              Category Budgets
            </h3>
            <p className="text-xs text-text-light-muted dark:text-text-dark-muted font-medium">
              Monthly spending limits & progress
            </p>
          </div>
        </div>

        <button
          onClick={() => handleOpenEdit(expenseCategories[0], categoryBudgets[expenseCategories[0]] || 0)}
          className="px-3.5 py-1.5 rounded-full bg-primary/10 text-primary border border-primary/20 text-xs font-bold hover:bg-primary hover:text-[#131811] transition-all"
        >
          Manage Limits
        </button>
      </div>

      {categoryStats.length === 0 ? (
        <div
          onClick={() => handleOpenEdit(expenseCategories[0], 0)}
          className="p-6 rounded-2xl border border-dashed border-border-light dark:border-border-dark text-center cursor-pointer hover:border-primary/50 transition-all"
        >
          <span className="material-symbols-outlined text-3xl text-text-light-muted mb-2">add_task</span>
          <p className="text-sm font-bold text-text-light-main dark:text-text-dark-main">No Category Budgets Set</p>
          <p className="text-xs text-text-light-muted">Click to set your first category limit</p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {categoryStats.map((item) => {
            const isOver = item.limit > 0 && item.spent >= item.limit;
            const isWarn = item.limit > 0 && item.pct >= 75 && !isOver;

            return (
              <div
                key={item.category}
                onClick={() => handleOpenEdit(item.category, item.limit)}
                className="flex flex-col gap-2 p-3.5 rounded-2xl bg-background-light dark:bg-surface-darker border border-border-light dark:border-border-dark hover:border-primary/40 cursor-pointer transition-all"
              >
                <div className="flex items-center justify-between text-xs font-bold">
                  <span className="text-text-light-main dark:text-text-dark-main text-sm">{item.category}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-text-light-muted">
                      {currencySymbol}{item.spent.toLocaleString()} / {item.limit > 0 ? `${currencySymbol}${item.limit.toLocaleString()}` : 'No limit'}
                    </span>
                    {item.limit > 0 && (
                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase ${
                        isOver
                          ? 'bg-rose-500/10 text-rose-500'
                          : isWarn
                          ? 'bg-amber-500/10 text-amber-500'
                          : 'bg-emerald-500/10 text-emerald-500'
                      }`}>
                        {Math.round(item.pct)}%
                      </span>
                    )}
                  </div>
                </div>

                {/* Progress Bar */}
                {item.limit > 0 && (
                  <div className="h-2 w-full bg-gray-200 dark:bg-black/30 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-700 ${
                        isOver ? 'bg-rose-500' : isWarn ? 'bg-amber-500' : 'bg-primary'
                      }`}
                      style={{ width: `${Math.min(item.pct, 100)}%` }}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Edit Budget Modal */}
      {editingCategory && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark rounded-3xl p-6 w-full max-w-sm shadow-2xl animate-slide-up flex flex-col gap-5">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-black text-text-light-main dark:text-text-dark-main">Set Category Limit</h3>
              <button onClick={() => setEditingCategory(null)} className="size-8 rounded-full hover:bg-gray-100 dark:hover:bg-surface-darker flex items-center justify-center">
                <span className="material-symbols-outlined text-text-light-muted">close</span>
              </button>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-xs font-bold text-text-light-muted">Category</label>
              <select
                value={editingCategory}
                onChange={(e) => {
                  setEditingCategory(e.target.value);
                  setLimitInput(categoryBudgets[e.target.value] ? categoryBudgets[e.target.value].toString() : '');
                }}
                className="bg-gray-50 dark:bg-surface-darker border border-border-light dark:border-border-dark rounded-xl p-3 text-sm font-bold text-text-light-main dark:text-text-dark-main outline-none appearance-none"
              >
                {expenseCategories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-xs font-bold text-text-light-muted">Monthly Limit ({currencySymbol})</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-text-light-muted">{currencySymbol}</span>
                <input
                  type="number"
                  value={limitInput}
                  onChange={(e) => setLimitInput(e.target.value)}
                  placeholder="e.g. 5000 (leave 0 to remove)"
                  className="w-full pl-8 bg-gray-50 dark:bg-surface-darker border border-border-light dark:border-border-dark rounded-xl p-3 text-sm font-bold text-text-light-main dark:text-text-dark-main outline-none focus:border-primary"
                />
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setEditingCategory(null)}
                className="flex-1 py-3 rounded-xl border border-border-light dark:border-border-dark font-bold text-text-light-muted hover:bg-gray-50 dark:hover:bg-surface-darker transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveBudget}
                disabled={isSaving}
                className="flex-1 py-3 rounded-xl bg-primary text-[#131811] font-black shadow-glow hover:bg-primary/90 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isSaving && <span className="material-symbols-outlined animate-spin text-sm">sync</span>}
                Save Limit
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CategoryBudgetWidget;
