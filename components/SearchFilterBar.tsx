import React, { useState } from 'react';
import { useStore } from '../context/Store';

export interface FilterState {
  searchQuery: string;
  type: 'all' | 'income' | 'expense';
  category: string;
  paymentMethod: string;
  startDate: string;
  endDate: string;
  minAmount: string;
  maxAmount: string;
}

export const initialFilterState: FilterState = {
  searchQuery: '',
  type: 'all',
  category: 'all',
  paymentMethod: 'all',
  startDate: '',
  endDate: '',
  minAmount: '',
  maxAmount: '',
};

interface SearchFilterBarProps {
  filters: FilterState;
  onFilterChange: (filters: FilterState) => void;
  onReset: () => void;
  className?: string;
}

const SearchFilterBar: React.FC<SearchFilterBarProps> = ({
  filters,
  onFilterChange,
  onReset,
  className = '',
}) => {
  const { userSettings } = useStore();
  const [showAdvanced, setShowAdvanced] = useState(false);

  const categories =
    filters.type === 'income'
      ? userSettings?.incomeCategories || []
      : filters.type === 'expense'
      ? userSettings?.expenseCategories || []
      : Array.from(
          new Set([
            ...(userSettings?.expenseCategories || []),
            ...(userSettings?.incomeCategories || []),
          ])
        );

  const paymentMethods = userSettings?.paymentMethods || ['Cash', 'UPI', 'Savings Account'];

  const handleChange = (key: keyof FilterState, value: string) => {
    onFilterChange({ ...filters, [key]: value });
  };

  const activeCount = Object.entries(filters).filter(([key, val]) => {
    if (key === 'type') return val !== 'all';
    if (key === 'category' || key === 'paymentMethod') return val !== 'all';
    return Boolean(val);
  }).length;

  return (
    <div className={`flex flex-col gap-3 ${className}`}>
      {/* Top bar: Search input + Quick pills + Advanced toggle */}
      <div className="flex flex-col md:flex-row items-center gap-3">
        {/* Search input */}
        <div className="relative flex-1 w-full">
          <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-text-light-muted dark:text-text-dark-muted text-lg">
            search
          </span>
          <input
            type="text"
            value={filters.searchQuery}
            onChange={(e) => handleChange('searchQuery', e.target.value)}
            placeholder="Search by title, category, or note..."
            className="w-full bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark text-text-light-main dark:text-text-dark-main rounded-2xl py-3 pl-10 pr-10 outline-none text-sm font-bold focus:border-primary transition-all shadow-sm"
          />
          {filters.searchQuery && (
            <button
              onClick={() => handleChange('searchQuery', '')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-text-light-muted hover:text-text-light-main dark:hover:text-text-dark-main"
            >
              <span className="material-symbols-outlined text-base">close</span>
            </button>
          )}
        </div>

        {/* Type pills */}
        <div className="flex bg-gray-100 dark:bg-surface-darker p-1 rounded-2xl border border-border-light dark:border-border-dark w-full md:w-auto">
          {(['all', 'expense', 'income'] as const).map((t) => (
            <button
              key={t}
              onClick={() => handleChange('type', t)}
              className={`flex-1 md:flex-initial px-4 py-2 rounded-xl text-xs font-bold capitalize transition-all ${
                filters.type === t
                  ? t === 'expense'
                    ? 'bg-white dark:bg-surface-dark text-danger shadow-sm'
                    : t === 'income'
                    ? 'bg-white dark:bg-surface-dark text-primary shadow-sm'
                    : 'bg-white dark:bg-surface-dark text-text-light-main dark:text-text-dark-main shadow-sm'
                  : 'text-text-light-muted dark:text-text-dark-muted'
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Advanced Filters Button */}
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className={`flex items-center gap-2 px-4 py-3 rounded-2xl border text-xs font-bold transition-all whitespace-nowrap ${
            showAdvanced || activeCount > 0
              ? 'bg-primary/10 border-primary/40 text-primary'
              : 'bg-surface-light dark:bg-surface-dark border-border-light dark:border-border-dark text-text-light-muted dark:text-text-dark-muted hover:border-primary/30'
          }`}
        >
          <span className="material-symbols-outlined text-base">tune</span>
          Filters
          {activeCount > 0 && (
            <span className="size-5 rounded-full bg-primary text-[#131811] text-[10px] font-black flex items-center justify-center">
              {activeCount}
            </span>
          )}
        </button>

        {activeCount > 0 && (
          <button
            onClick={onReset}
            className="text-xs font-bold text-text-light-muted hover:text-danger transition-colors uppercase tracking-wider px-2"
          >
            Reset
          </button>
        )}
      </div>

      {/* Advanced Filter Drawer */}
      {showAdvanced && (
        <div className="p-5 rounded-2xl bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark animate-slide-up grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 shadow-card-light dark:shadow-card">
          {/* Category */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-black uppercase tracking-widest text-text-light-muted">
              Category
            </label>
            <select
              value={filters.category}
              onChange={(e) => handleChange('category', e.target.value)}
              className="bg-background-light dark:bg-surface-darker text-text-light-main dark:text-text-dark-main rounded-xl p-2.5 text-xs font-bold border border-border-light dark:border-border-dark outline-none cursor-pointer"
            >
              <option value="all">All Categories</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          {/* Payment Method */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-black uppercase tracking-widest text-text-light-muted">
              Payment Method
            </label>
            <select
              value={filters.paymentMethod}
              onChange={(e) => handleChange('paymentMethod', e.target.value)}
              className="bg-background-light dark:bg-surface-darker text-text-light-main dark:text-text-dark-main rounded-xl p-2.5 text-xs font-bold border border-border-light dark:border-border-dark outline-none cursor-pointer"
            >
              <option value="all">All Methods</option>
              {paymentMethods.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>

          {/* Date Range */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-black uppercase tracking-widest text-text-light-muted">
              From Date
            </label>
            <input
              type="date"
              value={filters.startDate}
              onChange={(e) => handleChange('startDate', e.target.value)}
              className="bg-background-light dark:bg-surface-darker text-text-light-main dark:text-text-dark-main rounded-xl p-2.5 text-xs font-bold border border-border-light dark:border-border-dark outline-none"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-black uppercase tracking-widest text-text-light-muted">
              To Date
            </label>
            <input
              type="date"
              value={filters.endDate}
              onChange={(e) => handleChange('endDate', e.target.value)}
              className="bg-background-light dark:bg-surface-darker text-text-light-main dark:text-text-dark-main rounded-xl p-2.5 text-xs font-bold border border-border-light dark:border-border-dark outline-none"
            />
          </div>

          {/* Amount Range */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-black uppercase tracking-widest text-text-light-muted">
              Min Amount
            </label>
            <input
              type="number"
              placeholder="0"
              value={filters.minAmount}
              onChange={(e) => handleChange('minAmount', e.target.value)}
              className="bg-background-light dark:bg-surface-darker text-text-light-main dark:text-text-dark-main rounded-xl p-2.5 text-xs font-bold border border-border-light dark:border-border-dark outline-none"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-black uppercase tracking-widest text-text-light-muted">
              Max Amount
            </label>
            <input
              type="number"
              placeholder="100000"
              value={filters.maxAmount}
              onChange={(e) => handleChange('maxAmount', e.target.value)}
              className="bg-background-light dark:bg-surface-darker text-text-light-main dark:text-text-dark-main rounded-xl p-2.5 text-xs font-bold border border-border-light dark:border-border-dark outline-none"
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default SearchFilterBar;
