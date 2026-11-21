// Transaction History page (/transactions/history): week / month / year calendar
// views, a spending heatmap, filters, and CSV import/export.
import React, { useState, useMemo } from 'react';
import { useStore } from '../context/Store';
import { useNavigate } from 'react-router';
import { ROUTES } from '../routes';
import { CATEGORY_STYLES } from '../constants/categories';
import { downloadTransactionsCsv } from '../utils/csv';
import { getPeriodRange, shiftPeriod } from '../utils/period';
import { formatDisplayDate, parseLocalDate, toLocalISODate } from '../utils/date';
import { formatMoney } from '../utils/format';
import CSVImportModal from './CSVImportModal';
import TidyUpModal from './TidyUpModal';
import SearchFilterBar, { FilterState, initialFilterState } from './SearchFilterBar';
import { matchesSearch, searchTokens } from '../utils/search';
import SpendingHeatmap from './SpendingHeatmap';
import { getCurrencySymbol } from '../utils/currency';

interface TransactionsCalendarScreenProps {
  isEmbedded?: boolean;
}


const TransactionsCalendarScreen: React.FC<TransactionsCalendarScreenProps> = ({ isEmbedded = false }) => {
  const navigate = useNavigate();
  const { transactions, userSettings, setViewingTransaction } = useStore();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [viewMode, setViewMode] = useState<'week' | 'month' | 'year' | 'heatmap'>('month');
  const [showImportModal, setShowImportModal] = useState(false);
  const [showTidyUp, setShowTidyUp] = useState(false);
  
  // Advanced Filters
  const [filters, setFilters] = useState<FilterState>(initialFilterState);

  // Calendar Constants
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

  // Helper: Get Start/End of current period
  // The calendar grid starts weeks on Sunday, so the week range does too.
  const { start: periodStart, end: periodEnd } = useMemo(() => getPeriodRange(currentDate, viewMode === 'heatmap' ? 'year' : viewMode, 0), [currentDate, viewMode]);

  // Searching (or picking a date range) looks across every date. It used to
  // stay inside the period on screen, so most matches were never shown.
  const searchWords = useMemo(() => searchTokens(filters.searchQuery), [filters.searchQuery]);
  const searchAllDates = searchWords.length > 0 || !!filters.startDate || !!filters.endDate;

  // Derived Data: Filtered List
  const filteredTransactions = useMemo(() => {
    return transactions.filter(tx => {
      const txDate = parseLocalDate(tx.date);
      let matchesPeriod = false;

      if (searchAllDates) {
          matchesPeriod = true;
      } else if (selectedDay !== null && (viewMode === 'week' || viewMode === 'month')) {
          // A day picked in the calendar grid
          matchesPeriod = txDate.getFullYear() === year && txDate.getMonth() === month && txDate.getDate() === selectedDay;
      } else {
          matchesPeriod = txDate >= periodStart && txDate <= periodEnd;
      }

      const matchesType = filters.type === 'all' || tx.type === filters.type;
      const matchesCategory = filters.category === 'all' || tx.category === filters.category;
      const matchesMethod = filters.paymentMethod === 'all' || tx.paymentMethod === filters.paymentMethod;

      const matchesText = matchesSearch(tx, searchWords);

      const matchesStart = !filters.startDate || tx.date >= filters.startDate;
      const matchesEnd = !filters.endDate || tx.date <= filters.endDate;
      const matchesMin = !filters.minAmount || tx.amount >= parseFloat(filters.minAmount);
      const matchesMax = !filters.maxAmount || tx.amount <= parseFloat(filters.maxAmount);

      return matchesPeriod && matchesType && matchesCategory && matchesMethod && matchesText && matchesStart && matchesEnd && matchesMin && matchesMax;
    }).sort((a, b) => b.date.localeCompare(a.date));
  }, [transactions, periodStart, periodEnd, selectedDay, viewMode, filters, year, month, searchWords, searchAllDates]);

  // Derived Data: Stats for the VISUALIZATION (Grid/Bars)
  const visualizationData = useMemo(() => {
      // Year View: 12 months
      if (viewMode === 'year') {
          const stats = Array(12).fill(0).map(() => ({ income: 0, expense: 0 }));
          transactions.forEach(tx => {
              const d = parseLocalDate(tx.date);
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
          const d = parseLocalDate(tx.date);
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
         const d = parseLocalDate(tx.date);
         if (d >= periodStart && d <= periodEnd) {
             if (tx.type === 'income') income += tx.amount;
             else expense += tx.amount;
         }
     });
     return { income, expense };
  }, [transactions, periodStart, periodEnd]);

  // Actions
  const handleNavigate = (direction: 'prev' | 'next') => {
      setCurrentDate(shiftPeriod(currentDate, viewMode === 'heatmap' ? 'year' : viewMode, direction === 'next' ? 1 : -1));
      setSelectedDay(null); // a selected day belongs to the old period
  };


  const handleModeChange = (mode: 'week' | 'month' | 'year') => {
      setViewMode(mode);
      setSelectedDay(null);
  };

  const currencySymbol = getCurrencySymbol(userSettings?.currency);

  const handleExportCSV = () => downloadTransactionsCsv(filteredTransactions, `transactions_${toLocalISODate()}`);


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
                    onClick={() => navigate(ROUTES.TRANSACTIONS)} 
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
                        {(['Week', 'Month', 'Year', 'Heatmap'] as const).map(m => (
                            <button
                                key={m}
                                onClick={() => handleModeChange(m.toLowerCase() as any)}
                                className={`px-5 py-2 rounded-full text-xs md:text-sm font-bold transition-all ${viewMode === m.toLowerCase() ? 'bg-primary text-[#142210] shadow-md' : 'text-text-light-muted dark:text-text-dark-muted hover:text-text-light-main dark:hover:text-text-dark-main'}`}
                            >
                                {m}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Main Calendar Card or Heatmap */}
                {viewMode === 'heatmap' ? (
                  <SpendingHeatmap onSelectDate={(d) => { setFilters(prev => ({ ...prev, startDate: d, endDate: d })); }} />
                ) : (
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
                )}
            </div>

            {/* RIGHT COLUMN: Transactions List */}
            <div className="lg:col-span-5 flex flex-col gap-6">
                
                {/* Header Actions */}
                <div className="flex justify-between items-center">
                    <h2 className="text-lg font-bold text-text-light-main dark:text-text-dark-main flex items-center gap-2">
                        <span className="material-symbols-outlined text-primary">history</span> Recent Activity
                    </h2>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => setShowImportModal(true)}
                            className="flex items-center gap-1.5 text-xs font-bold text-text-light-muted dark:text-text-dark-muted hover:text-primary transition-colors uppercase tracking-wider"
                        >
                            <span className="material-symbols-outlined text-sm">upload_file</span>
                            Import
                        </button>
                        <button
                            onClick={() => setShowTidyUp(true)}
                            className="flex items-center gap-1.5 text-xs font-bold text-text-light-muted dark:text-text-dark-muted hover:text-primary transition-colors uppercase tracking-wider"
                        >
                            <span className="material-symbols-outlined text-sm" aria-hidden="true">auto_fix_high</span>
                            Tidy up
                        </button>
                        <button onClick={handleExportCSV} className="text-primary text-xs font-bold hover:underline uppercase tracking-wider">Export</button>
                    </div>
                </div>

                {/* Smart Search & Filters */}
                <SearchFilterBar
                    filters={filters}
                    onFilterChange={setFilters}
                    onReset={() => setFilters(initialFilterState)}
                />

                {searchAllDates && (
                    <p role="status" className="text-xs font-semibold text-text-light-muted dark:text-text-dark-muted">
                        {filteredTransactions.length} {filteredTransactions.length === 1 ? 'result' : 'results'} across all dates
                    </p>
                )}

                {/* List Items */}
                <div className="flex flex-col gap-3 stagger">
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
                                            <span>{formatDisplayDate(tx.date)}</span>
                                            {tx.note && <span className="opacity-70 truncate max-w-[100px] hidden sm:inline">• {tx.note}</span>}
                                        </div>
                                    </div>
                                </div>
                                <div className="flex flex-col items-end">
                                    <p className={`text-base font-bold ${tx.type === 'income' ? 'text-primary' : 'text-danger dark:text-red-400'}`}>
                                        {formatMoney(tx.type === 'income' ? tx.amount : -tx.amount, currencySymbol, { signed: true })}
                                    </p>
                                </div>
                            </div>
                        );
                    }) : (
                        <div className="flex flex-col items-center justify-center py-12 text-text-light-muted dark:text-text-dark-muted border border-dashed border-border-light dark:border-border-dark rounded-2xl">
                            <span className="material-symbols-outlined text-3xl mb-2 opacity-30">search_off</span>
                            <p className="text-sm">{searchWords.length ? `Nothing matches "${filters.searchQuery.trim()}".` : 'No transactions in this period.'}</p>
                            {searchWords.length > 0 && <p className="text-xs mt-1 opacity-70">Try fewer words, part of a name, an amount, or a month like "oct".</p>}
                        </div>
                    )}
                </div>

            </div>

        </div>

      {showImportModal && <CSVImportModal onClose={() => setShowImportModal(false)} />}
      {showTidyUp && <TidyUpModal onClose={() => setShowTidyUp(false)} />}
    </div>
  );
};

export default TransactionsCalendarScreen;