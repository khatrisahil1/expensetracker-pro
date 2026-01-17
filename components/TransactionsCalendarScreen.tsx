import React, { useState, useMemo } from 'react';
import { useStore, Transaction } from '../context/Store';
import { View } from '../types';

interface TransactionsCalendarScreenProps {
  onNavigate: (view: View) => void;
  isEmbedded?: boolean;
}

const CATEGORY_STYLES: Record<string, { icon: string, colorClass: string }> = {
    "Food": { icon: "restaurant", colorClass: "text-orange-500 bg-orange-500/10 border-orange-500/20" },
    "Housing": { icon: "home", colorClass: "text-blue-500 bg-blue-500/10 border-blue-500/20" },
    "Transportation": { icon: "directions_car", colorClass: "text-purple-500 bg-purple-500/10 border-purple-500/20" },
    "Shopping": { icon: "shopping_bag", colorClass: "text-yellow-500 bg-yellow-500/10 border-yellow-500/20" },
    "Entertainment": { icon: "movie", colorClass: "text-pink-500 bg-pink-500/10 border-pink-500/20" },
    "Health": { icon: "medical_services", colorClass: "text-red-400 bg-red-400/10 border-red-400/20" },
    "Utilities": { icon: "bolt", colorClass: "text-cyan-400 bg-cyan-400/10 border-cyan-400/20" },
    "Salary": { icon: "payments", colorClass: "text-primary bg-primary/10 border-primary/20" },
    "Freelance": { icon: "work", colorClass: "text-emerald-400 bg-emerald-400/10 border-emerald-400/20" },
    "Other": { icon: "receipt", colorClass: "text-gray-400 bg-gray-400/10 border-gray-400/20" }
};

const EXPENSE_CATEGORIES = ["Food", "Housing", "Rent", "Transportation", "Entertainment", "Shopping", "Health", "Utilities", "Other"];
const INCOME_CATEGORIES = ["Salary", "Freelance", "Investments", "Gifts", "Refunds", "Rental", "Other"];
const ALL_CATEGORIES = Array.from(new Set([...EXPENSE_CATEGORIES, ...INCOME_CATEGORIES]));

const TransactionsCalendarScreen: React.FC<TransactionsCalendarScreenProps> = ({ onNavigate, isEmbedded = false }) => {
  const { transactions, userSettings, setViewingTransaction } = useStore();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [viewMode, setViewMode] = useState<'week' | 'month' | 'year'>('month');
  
  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'income' | 'expense'>('all');
  const [filterCategory, setFilterCategory] = useState<string>('All');

  // Calendar Constants
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

  // Helper: Get Start/End of current period
  const { periodStart, periodEnd } = useMemo(() => {
      const start = new Date(currentDate);
      const end = new Date(currentDate);

      if (viewMode === 'week') {
          const day = start.getDay();
          const diff = start.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
          start.setDate(start.getDate() - start.getDay()); // Start on Sunday
          start.setHours(0,0,0,0);
          end.setDate(start.getDate() + 6);
          end.setHours(23,59,59,999);
      } else if (viewMode === 'month') {
          start.setDate(1);
          start.setHours(0,0,0,0);
          end.setMonth(start.getMonth() + 1);
          end.setDate(0);
          end.setHours(23,59,59,999);
      } else { // Year
          start.setMonth(0, 1);
          start.setHours(0,0,0,0);
          end.setMonth(11, 31);
          end.setHours(23,59,59,999);
      }
      return { periodStart: start, periodEnd: end };
  }, [currentDate, viewMode]);

  // Derived Data: Filtered List
  const filteredTransactions = useMemo(() => {
    return transactions.filter(tx => {
      const txDate = new Date(tx.date);
      let matchesPeriod = false;

      // Special Case: specific day selection within the grid
      if (selectedDay !== null && viewMode !== 'year') {
          matchesPeriod = txDate.getFullYear() === year && txDate.getMonth() === month && txDate.getDate() === selectedDay;
      } else {
          matchesPeriod = txDate >= periodStart && txDate <= periodEnd;
      }

      const matchesType = filterType === 'all' || tx.type === filterType;
      const matchesCategory = filterCategory === 'All' || tx.category === filterCategory;
      
      const searchLower = searchQuery.toLowerCase();
      const matchesSearch = tx.title.toLowerCase().includes(searchLower) || 
                            (tx.note && tx.note.toLowerCase().includes(searchLower));

      return matchesPeriod && matchesType && matchesCategory && matchesSearch;
    }).sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [transactions, periodStart, periodEnd, selectedDay, viewMode, filterType, filterCategory, year, month, searchQuery]);

  // Derived Data: Stats for the VISUALIZATION (Grid/Bars)
  const visualizationData = useMemo(() => {
      // Year View: 12 months
      if (viewMode === 'year') {
          const stats = Array(12).fill(0).map(() => ({ income: 0, expense: 0 }));
          transactions.forEach(tx => {
              const d = new Date(tx.date);
              if (d.getFullYear() === year) {
                  if (tx.type === 'income') stats[d.getMonth()].income += tx.amount;
                  else stats[d.getMonth()].expense += tx.amount;
              }
          });
          return stats;
      } 
      
      // Month & Week View: Daily stats
      const daysMap: Record<number, {income: number, expense: number}> = {};
      transactions.forEach(tx => {
          const d = new Date(tx.date);
          // Only include if within the broader period view
          if (d >= periodStart && d <= periodEnd) {
              const dateKey = d.getDate();
              if (!daysMap[dateKey]) daysMap[dateKey] = {income: 0, expense: 0};
              if (tx.type === 'income') daysMap[dateKey].income += tx.amount;
              else daysMap[dateKey].expense += tx.amount;
          }
      });
      return daysMap;
  }, [transactions, viewMode, periodStart, periodEnd, year]);

  // Derived Data: Total Stats for the Period Header
  const periodTotalStats = useMemo(() => {
     let income = 0;
     let expense = 0;
     // We re-calculate based on the period, ignoring 'selectedDay' for the top totals to show context
     transactions.forEach(tx => {
         const d = new Date(tx.date);
         if (d >= periodStart && d <= periodEnd) {
             if (tx.type === 'income') income += tx.amount;
             else expense += tx.amount;
         }
     });
     return { income, expense };
  }, [transactions, periodStart, periodEnd]);

  // Actions
  const handleNavigate = (direction: 'prev' | 'next') => {
      const val = direction === 'next' ? 1 : -1;
      const newDate = new Date(currentDate);
      
      if (viewMode === 'year') {
          newDate.setFullYear(newDate.getFullYear() + val);
      } else if (viewMode === 'month') {
          newDate.setMonth(newDate.getMonth() + val);
      } else {
          newDate.setDate(newDate.getDate() + (val * 7));
      }
      
      setCurrentDate(newDate);
      setSelectedDay(null); // Clear specific selection when moving periods
  };

  const handleModeChange = (mode: 'week' | 'month' | 'year') => {
      setViewMode(mode);
      setSelectedDay(null);
  };

  const currencySymbol = userSettings?.currency === 'USD' ? '$' : userSettings?.currency === 'EUR' ? '€' : '₹';

  const handleExportCSV = () => {
    const headers = ['Date', 'Title', 'Amount', 'Type', 'Category', 'Note'];
    const csvContent = [
        headers.join(','),
        ...filteredTransactions.map(tx => {
            const escape = (str: string | undefined) => `"${(str || '').replace(/"/g, '""')}"`;
            return [
            tx.date, 
            escape(tx.title), 
            tx.amount, 
            tx.type, 
            tx.category, 
            escape(tx.note)
            ].join(',');
        })
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `transactions_export.csv`;
    a.click();
  };

  // Rendering Helper: Header Text
  const getPeriodLabel = () => {
      if (viewMode === 'year') return `${year}`;
      if (viewMode === 'month') return `${monthNames[month]} ${year}`;
      const startStr = periodStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const endStr = periodEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      return `${startStr} - ${endStr}`;
  };

  return (
    <div className={`max-w-[1400px] mx-auto p-4 md:p-8 flex flex-col gap-8 ${isEmbedded ? '' : 'pb-24'}`}>
        
        {/* Page Header with Back Button */}
        {!isEmbedded && (
             <div className="flex flex-col gap-3 shrink-0">
                <button 
                    onClick={() => onNavigate(View.SCANNER)} 
                    className="flex items-center gap-2 text-sm font-bold text-primary hover:bg-primary/10 px-4 py-2 rounded-full border border-primary/20 w-fit transition-all active:scale-95"
                >
                    <span className="material-symbols-outlined text-lg">arrow_back</span>
                    Back to Transactions
                </button>
                <div className="mt-2">
                    <h1 className="text-3xl md:text-5xl font-black text-text-light-main dark:text-text-dark-main tracking-tight leading-none mb-2">Activity History</h1>
                    <p className="text-text-light-muted dark:text-text-dark-muted text-base md:text-lg">Detailed log of all your financial movements</p>
                </div>
             </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            
            {/* LEFT COLUMN: Calendar & Period Controls */}
            <div className="lg:col-span-7 flex flex-col gap-6">
                
                {/* View Mode Tabs */}
                <div className="flex justify-center">
                    <div className="flex bg-gray-100 dark:bg-surface-darker p-1 rounded-full border border-gray-200 dark:border-border-dark shadow-sm">
                        {(['Week', 'Month', 'Year'] as const).map(m => (
                            <button
                                key={m}
                                onClick={() => handleModeChange(m.toLowerCase() as any)}
                                className={`px-6 py-2 rounded-full text-sm font-bold transition-all ${viewMode === m.toLowerCase() ? 'bg-primary text-[#142210] shadow-md' : 'text-text-light-muted dark:text-text-dark-muted hover:text-text-light-main dark:hover:text-text-dark-main'}`}
                            >
                                {m}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Main Calendar Card */}
                <div className="bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark rounded-[2.5rem] p-6 md:p-10 shadow-card-light dark:shadow-card">
                    
                    {/* Income / Expense Header */}
                    <div className="flex justify-between items-start mb-8">
                        <div>
                            <p className="text-xs font-bold text-text-light-muted dark:text-text-dark-muted uppercase tracking-wider mb-1">Income</p>
                            <p className="text-2xl md:text-3xl font-bold text-primary">{currencySymbol}{periodTotalStats.income.toLocaleString()}</p>
                        </div>
                        <div className="h-10 w-px bg-border-light dark:bg-border-dark mx-4"></div>
                        <div className="text-right">
                            <p className="text-xs font-bold text-text-light-muted dark:text-text-dark-muted uppercase tracking-wider mb-1">Expense</p>
                            <p className="text-2xl md:text-3xl font-bold text-danger dark:text-red-400">{currencySymbol}{periodTotalStats.expense.toLocaleString()}</p>
                        </div>
                    </div>

                    {/* Date Navigation */}
                    <div className="flex items-center justify-between mb-8">
                         <button onClick={() => handleNavigate('prev')} className="size-10 rounded-full flex items-center justify-center hover:bg-gray-100 dark:hover:bg-surface-darker text-text-light-muted dark:text-text-dark-muted transition-colors">
                            <span className="material-symbols-outlined">chevron_left</span>
                        </button>
                        <h3 className="text-2xl font-bold text-text-light-main dark:text-text-dark-main select-none">{getPeriodLabel()}</h3>
                        <button onClick={() => handleNavigate('next')} className="size-10 rounded-full flex items-center justify-center hover:bg-gray-100 dark:hover:bg-surface-darker text-text-light-muted dark:text-text-dark-muted transition-colors">
                            <span className="material-symbols-outlined">chevron_right</span>
                        </button>
                    </div>

                    {/* Visualizations (Grid) */}
                    <div>
                         {/* YEAR VIEW: 12 Month Grid */}
                         {viewMode === 'year' && (
                            <div className="grid grid-cols-3 sm:grid-cols-4 gap-4">
                                {(visualizationData as Array<any>).map((stat, i) => (
                                    <div key={i} className="flex flex-col items-center p-3 rounded-2xl bg-gray-50 dark:bg-surface-darker border border-border-light dark:border-border-dark hover:border-primary/50 transition-colors">
                                        <span className="text-sm font-bold text-text-light-main dark:text-text-dark-main mb-2">{monthNames[i].slice(0,3)}</span>
                                        <div className="w-full flex items-end gap-1 h-12 justify-center">
                                            {/* Simple bars */}
                                            <div className="w-2 bg-primary rounded-t-sm transition-all" style={{height: `${Math.min((stat.income / 5000) * 100, 100)}%`}}></div>
                                            <div className="w-2 bg-danger dark:bg-red-500 rounded-t-sm transition-all" style={{height: `${Math.min((stat.expense / 5000) * 100, 100)}%`}}></div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* MONTH VIEW: Standard Calendar */}
                        {viewMode === 'month' && (
                            <>
                                <div className="grid grid-cols-7 mb-6">
                                    {['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'].map(d => (
                                        <div key={d} className="text-center text-[10px] md:text-xs font-bold text-text-light-muted dark:text-text-dark-muted tracking-widest">{d}</div>
                                    ))}
                                </div>
                                <div className="grid grid-cols-7 gap-y-6 md:gap-y-8">
                                    {Array.from({ length: new Date(year, month, 1).getDay() }).map((_, i) => <div key={`empty-${i}`}></div>)}
                                    {Array.from({ length: new Date(year, month + 1, 0).getDate() }).map((_, i) => {
                                        const day = i + 1;
                                        const stats = (visualizationData as any)[day];
                                        const isSelected = selectedDay === day;
                                        return (
                                            <div key={day} className="flex flex-col items-center justify-start cursor-pointer group relative" onClick={() => setSelectedDay(isSelected ? null : day)}>
                                                <div className={`
                                                    size-10 md:size-12 rounded-2xl flex flex-col items-center justify-center transition-all relative
                                                    ${isSelected 
                                                        ? 'bg-primary text-[#142210] shadow-glow scale-110 z-10 font-bold' 
                                                        : 'text-text-light-main dark:text-text-dark-main hover:bg-gray-100 dark:hover:bg-surface-darker'}
                                                `}>
                                                    <span className="text-sm md:text-base">{day}</span>
                                                    {!isSelected && stats && (
                                                        <div className="flex gap-1 absolute bottom-1.5">
                                                            {stats.income > 0 && <div className="size-1 rounded-full bg-primary"></div>}
                                                            {stats.expense > 0 && <div className="size-1 rounded-full bg-danger dark:bg-red-500"></div>}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            </>
                        )}

                        {/* WEEK VIEW: 7 Columns */}
                        {viewMode === 'week' && (
                            <div className="grid grid-cols-7 gap-2">
                                {Array.from({ length: 7 }).map((_, i) => {
                                    const d = new Date(periodStart);
                                    d.setDate(periodStart.getDate() + i);
                                    const dayNum = d.getDate();
                                    const stats = (visualizationData as any)[dayNum];
                                    const isSelected = selectedDay === dayNum;
                                    const isToday = d.toDateString() === new Date().toDateString();

                                    return (
                                        <div key={i} className={`flex flex-col items-center p-2 rounded-2xl border transition-all cursor-pointer ${isSelected ? 'bg-primary/20 border-primary' : 'bg-transparent border-transparent hover:bg-surface-darker'}`} onClick={() => setSelectedDay(isSelected ? null : dayNum)}>
                                            <span className="text-[10px] uppercase font-bold text-text-light-muted dark:text-text-dark-muted mb-3">{d.toLocaleDateString('en-US', {weekday: 'short'})}</span>
                                            <div className={`size-10 rounded-full flex items-center justify-center mb-3 ${isToday ? 'bg-primary text-black font-bold' : 'text-text-light-main dark:text-text-dark-main bg-gray-100 dark:bg-surface-darker'}`}>
                                                {dayNum}
                                            </div>
                                            {stats && (
                                                <div className="flex flex-col gap-1 w-full px-2 h-20 justify-end">
                                                    {stats.income > 0 && <div className="bg-primary rounded-full w-full min-h-[4px]" style={{height: `${Math.min(stats.income/500 * 100, 100)}%`}}></div>}
                                                    {stats.expense > 0 && <div className="bg-danger dark:bg-red-500 rounded-full w-full min-h-[4px]" style={{height: `${Math.min(stats.expense/500 * 100, 100)}%`}}></div>}
                                                </div>
                                            )}
                                        </div>
                                    )
                                })}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* RIGHT COLUMN: Transactions List */}
            <div className="lg:col-span-5 flex flex-col gap-6">
                
                {/* Header Actions */}
                <div className="flex justify-between items-center">
                    <h2 className="text-lg font-bold text-text-light-main dark:text-text-dark-main flex items-center gap-2">
                        <span className="material-symbols-outlined text-primary">history</span> Recent Activity
                    </h2>
                    <div className="flex gap-2">
                        <button onClick={handleExportCSV} className="text-primary text-xs font-bold hover:underline uppercase tracking-wider">Export</button>
                        <select 
                            value={filterCategory}
                            onChange={(e) => setFilterCategory(e.target.value)}
                            className="bg-transparent text-xs font-bold text-text-light-muted dark:text-text-dark-muted border-none outline-none focus:ring-0 cursor-pointer hover:text-primary transition-colors pr-8 text-right"
                        >
                            <option value="All">All Categories</option>
                            {ALL_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                    </div>
                </div>

                {/* Search & Type Filter Row */}
                <div className="flex gap-3">
                    <div className="relative flex-1">
                        <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-lg">search</span>
                        <input 
                            type="text" 
                            placeholder="Search..." 
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark rounded-xl py-2.5 pl-10 pr-3 text-sm text-text-light-main dark:text-text-dark-main focus:border-primary outline-none focus:ring-1 focus:ring-primary"
                        />
                    </div>
                    <select 
                        value={filterType}
                        onChange={(e) => setFilterType(e.target.value as any)}
                        className="bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark rounded-xl px-3 py-2.5 text-sm font-bold text-text-light-main dark:text-text-dark-main focus:border-primary outline-none focus:ring-1 focus:ring-primary cursor-pointer"
                    >
                        <option value="all">All</option>
                        <option value="income">Income</option>
                        <option value="expense">Expense</option>
                    </select>
                </div>

                {/* List Items */}
                <div className="flex flex-col gap-3">
                    {filteredTransactions.length > 0 ? filteredTransactions.map(tx => {
                        const style = CATEGORY_STYLES[tx.category] || CATEGORY_STYLES['Other'];
                        return (
                            <div 
                                key={tx.id} 
                                onClick={() => setViewingTransaction(tx)}
                                className="bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark rounded-2xl p-4 flex items-center justify-between hover:border-gray-300 dark:hover:border-border-dark/70 transition-all shadow-sm cursor-pointer hover:bg-gray-50 dark:hover:bg-surface-darker"
                            >
                                <div className="flex items-center gap-4">
                                    <div className={`size-12 rounded-full flex items-center justify-center border ${style.colorClass}`}>
                                        <span className="material-symbols-outlined text-xl">{style.icon}</span>
                                    </div>
                                    <div className="flex flex-col">
                                        <p className="font-bold text-text-light-main dark:text-text-dark-main text-base">{tx.title}</p>
                                        <div className="flex gap-2 text-xs text-text-light-muted dark:text-text-dark-muted">
                                            <span>{tx.date}</span>
                                            {tx.note && <span className="opacity-70 truncate max-w-[100px] hidden sm:inline">• {tx.note}</span>}
                                        </div>
                                    </div>
                                </div>
                                <div className="flex flex-col items-end">
                                    <p className={`text-base font-bold ${tx.type === 'income' ? 'text-primary' : 'text-danger dark:text-red-400'}`}>
                                        {tx.type === 'income' ? '+' : '-'}{currencySymbol}{tx.amount.toFixed(2)}
                                    </p>
                                </div>
                            </div>
                        );
                    }) : (
                        <div className="flex flex-col items-center justify-center py-12 text-text-light-muted dark:text-text-dark-muted border border-dashed border-border-light dark:border-border-dark rounded-2xl">
                            <span className="material-symbols-outlined text-3xl mb-2 opacity-30">search_off</span>
                            <p className="text-sm">No transactions found.</p>
                        </div>
                    )}
                </div>

            </div>

        </div>

    </div>
  );
};

export default TransactionsCalendarScreen;