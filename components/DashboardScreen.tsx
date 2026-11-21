// Dashboard page (/): balance, income/expense, streak, breakdown and other
// widgets in a user-arranged grid, plus Quick Add and the AI insight panel.
// Calculations live in utils/period.ts and utils/transactionStats.ts.
import React, { useState, useMemo, useEffect } from 'react';
import { usePWAInstall } from "../usePWAInstall";
import { DotLottieReact } from "@lottiefiles/dotlottie-react";
import { useStore } from '../context/Store';
import { useDialog } from './ui/DialogProvider';
import { useNavigate } from 'react-router';
import { ROUTES } from '../routes';
import { CATEGORY_STYLES, getCategoryStyle, DEFAULT_EXPENSE_CATEGORIES, DEFAULT_INCOME_CATEGORIES } from '../constants/categories';
import { downloadTransactionsCsv } from '../utils/csv';
import { addInterval, formatDisplayDate, parseLocalDate, toLocalISODate } from '../utils/date';
import { getPeriodRange, shiftPeriod, isInRange, PeriodMode } from '../utils/period';
import { formatMoney } from '../utils/format';
import { useCountUp } from '../hooks/useCountUp';
import PaymentModeBreakdown from './PaymentModeBreakdown';
import NotificationsPanel from './NotificationsPanel';
import { sumTotals, signedAmount, calculateStreak, topCategories, percentChange } from '../utils/transactionStats';
import { useFinancialInsight } from '../hooks/useFinancialInsight';
import { STORAGE_KEYS } from '../constants/app';
import CSVImportModal from './CSVImportModal';
import QuickShortcutsWidget from './QuickShortcutsWidget';
import MonthlyComparisonWidget from './MonthlyComparisonWidget';
import CategoryBudgetWidget from './CategoryBudgetWidget';
import { getCurrencySymbol } from '../utils/currency';



// Widget Configuration Maps
const WIDGET_LABELS: Record<string, string> = {
    streak: "Streak",
    balance: "Balance",
    income: "Income",
    expense: "Expenses",
    shortcuts: "Quick Shortcuts",
    comparison: "Monthly Comparison",
    categoryBudgets: "Category Budgets",
    breakdown: "Breakdown",
    recent: "Recent Transactions",
    quickAdd: "Quick Add"
};

/**
 * Scales monthly income/expense goals to the selected period. A week is
 * 7 / 30.44 of an average month (was a flat 0.25).
 */
const PERIOD_GOAL_MULTIPLIER: Record<PeriodMode, number> = { week: 7 / 30.44, month: 1, year: 12 };



// Helper: Short Date Format

const formatDisplayDateShort = (dateStr: string) => (dateStr ? formatDisplayDate(dateStr) : '');




// UI Component: Loading Skeleton

const Skeleton: React.FC<{className: string}> = ({ className }) => (

    <div className={`animate-pulse bg-gray-200 dark:bg-border-dark rounded-xl ${className}`}></div>

);




// Helper: Streak Logic

type StreakTier = "single" | "stack" | "bag" | "reward" | "vault" | "legend";

const getStreakTier = (count: number): StreakTier => {

  if (count <= 1) return "single";

  if (count <= 3) return "stack";

  if (count <= 7) return "bag";

  if (count <= 14) return "reward";

  if (count <= 29) return "vault";

  return "legend";

};




const STREAK_LOTTIE_MAP: Record<StreakTier, string> = {

  single: "https://lottie.host/bd4943b7-a504-4f64-a6ae-72ce6a96dfa2/7v4kl3Ndl7.lottie",

  stack: "https://lottie.host/dacd1761-1fdb-4c67-a1d7-dce9f7098a68/fauCFJWZYw.lottie",

  bag: "https://lottie.host/2e644b69-9681-4cb2-99f1-152dae265f70/ZuOQRrUnBh.lottie",

  reward: "https://lottie.host/dacd1761-1fdb-4c67-a1d7-dce9f7098a68/fauCFJWZYw.lottie",

  vault: "https://lottie.host/67583866-07de-4549-8398-7344814496a4/VCEkeOmolA.lottie",

  legend: "https://lottie.host/bd4943b7-a504-4f64-a6ae-72ce6a96dfa2/7v4kl3Ndl7.lottie",

};








export const StreakVisual: React.FC<{ count: number }> = ({ count }) => {

  const tier = getStreakTier(count);

  const [showCelebration, setShowCelebration] = useState(false);




  useEffect(() => {

    if (count !== 7 && count !== 30) return;




    const last = Number(localStorage.getItem(STORAGE_KEYS.STREAK_CELEBRATED));

    if (last === count) return;




    setShowCelebration(true);

    localStorage.setItem(STORAGE_KEYS.STREAK_CELEBRATED, String(count));




    const t = setTimeout(() => setShowCelebration(false), 3000);

    return () => clearTimeout(t);

  }, [count]);




  return (

    <div className="relative w-full h-full flex items-center justify-center">

      {/* Base streak lottie */}

      <DotLottieReact

        src={STREAK_LOTTIE_MAP[tier]}

        autoplay

        loop={tier !== "legend"}

        className="w-[120px] h-[120px] md:w-[160px] md:h-[160px]"

      />




      {/* Celebration overlay (day 7 / 30 only) */}

      {showCelebration && (

        <div className="absolute inset-0 pointer-events-none">

          <DotLottieReact

            src={STREAK_LOTTIE_MAP[tier]}

            autoplay

            loop={false}

            className="w-full h-full scale-"

          />

        </div>

      )}

    </div>

  );

};



// Component: SVG Donut Chart
// Renders SVG arcs based on data percentage
const DonutChart: React.FC<{ data: Record<string, number>, total: number, currencySymbol: string, change?: number, changeLabel?: string, label: string, className?: string, isExpense?: boolean }> = ({ data, total, currencySymbol, change, changeLabel, label, className = "size-80", isExpense = true }) => {
    const [hovered, setHovered] = useState<{category: string, value: number, color: string} | null>(null);
    let accumulatedAngle = 0; 
    const radius = 40; 
    const center = 50; 
    const strokeWidth = 8;
    const sorted = (Object.entries(data) as [string, number][]).sort(([,a], [,b]) => b-a);
    
    // Generate SVG Paths for segments
    const paths = sorted.map(([cat, val], i) => {
        const percentage = total > 0 ? val / total : 0;
        const angle = percentage * 360;
        const largeArc = angle > 180 ? 1 : 0;
        const x1 = center + radius * Math.cos(Math.PI * (accumulatedAngle - 90) / 180);
        const y1 = center + radius * Math.sin(Math.PI * (accumulatedAngle - 90) / 180);
        const x2 = center + radius * Math.cos(Math.PI * (accumulatedAngle + angle - 90) / 180);
        const y2 = center + radius * Math.sin(Math.PI * (accumulatedAngle + angle - 90) / 180);
        const color = CATEGORY_STYLES[cat]?.hex || '#9ca3af';
        const isHovered = hovered?.category === cat;
        
        // Handle single 100% segment case
        const d = total > 0 && sorted.length === 1 
            ? `M ${center} ${center - radius} A ${radius} ${radius} 0 1 1 ${center - 0.01} ${center - radius}`
            : `M ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2}`;
            
        accumulatedAngle += angle;
        
        return (
            <path key={i} d={d} fill="none" stroke={color} strokeWidth={isHovered ? strokeWidth + 2 : strokeWidth} strokeLinecap="round" className="transition-all duration-300 cursor-pointer" onMouseEnter={() => setHovered({ category: cat, value: val, color })} onMouseLeave={() => setHovered(null)} />
        );
    });
    
    const isBad = isExpense ? (change ?? 0) > 0 : (change ?? 0) < 0;
    return (
        <div className={`relative flex items-center justify-center ${className}`}>
            <svg viewBox="0 0 100 100" className="w-full h-full rotate-0">
                <circle cx="50" cy="50" r={radius} fill="none" stroke="currentColor" className="text-gray-100 dark:text-gray-800" strokeWidth={strokeWidth} />
                {total === 0 ? null : paths}
            </svg>
            <div className="absolute inset-0 flex items-center justify-center flex-col pointer-events-none text-center p-6">
                <span className="text-[10px] text-text-light-muted dark:text-text-dark-muted font-bold uppercase tracking-widest mb-1 truncate max-w-full">{hovered ? hovered.category : `Total ${label}`}</span>
                <span className="text-2xl md:text-3xl font-black text-text-light-main dark:text-text-dark-main tracking-tight">{hovered ? `${((hovered.value / total) * 100).toFixed(1)}%` : `${currencySymbol}${total.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`}</span>
                {!hovered && change !== undefined && total > 0 && (<span className={`text-xs font-bold mt-1 flex items-center gap-1 ${isBad ? 'text-danger' : 'text-primary'}`}><span className="material-symbols-outlined text-xs font-bold">{(change ?? 0) >= 0 ? 'arrow_upward' : 'arrow_downward'}</span>{Math.abs(change).toFixed(0)}%{changeLabel && <span className="font-medium text-text-light-muted dark:text-text-dark-muted">{changeLabel}</span>}</span>)}
            </div>
        </div>
    );
};

// Component: Simple Wave Graph for Balance Widget
const PERIODS = ['week', 'month', 'year'] as const;
const NEXT_PERIOD: Record<(typeof PERIODS)[number], (typeof PERIODS)[number]> = { week: 'month', month: 'year', year: 'week' };

const RealWaveGraph: React.FC<{ data: number[], color: string }> = ({ data, color }) => {
    if (!data || data.length === 0) return null;
    const max = Math.max(...data, 1);
    const min = Math.min(...data, 0);
    const range = max - min || 1;
    const points = data.map((val, i) => {
        const x = (i / (data.length - 1)) * 100;
        const y = 100 - ((val - min) / range) * 80; // Keep some padding
        return `${x},${y}`;
    }).join(' ');

    return (
        <svg viewBox="0 0 100 100" className="w-full h-full opacity-70" preserveAspectRatio="none">
            <polyline points={points} fill="none" stroke={color} strokeWidth="2" vectorEffect="non-scaling-stroke" />
            <linearGradient id="grad" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor={color} stopOpacity="0.5" />
                <stop offset="100%" stopColor={color} stopOpacity="0" />
            </linearGradient>
            <polygon points={`0,100 ${points} 100,100`} fill="url(#grad)" />
        </svg>
    );
};

// --- MAIN DASHBOARD COMPONENT ---
const DashboardScreen: React.FC = () => {
  const navigate = useNavigate();
  const { userSettings, transactions, addTransaction, deleteTransaction, loading, toggleTheme, widgets, toggleWidget, widgetOrder, updateWidgetOrder, setViewingTransaction, updateUserSettings, lockApp, showUndo, notifications } = useStore();
  const unreadNotifications = notifications.filter(n => !n.read).length;
  const dialog = useDialog();
  const { isInstallable, install } = usePWAInstall();
  // Local State
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [dashboardViewMode, setDashboardViewMode] = useState<'week' | 'month' | 'year'>('month');
  /** The balance card's period chip cycles through these on each tap. */
  const cyclePeriod = () => setDashboardViewMode(m => NEXT_PERIOD[m]);
  const [dashboardDate, setDashboardDate] = useState(new Date());
  const [showNotifications, setShowNotifications] = useState(false);
  
  // UI Toggles
  const [showExportModal, setShowExportModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showWidgetEditor, setShowWidgetEditor] = useState(false);
  const [editorOrder, setEditorOrder] = useState<string[]>([]);
  const [showMobileHeaderMenu, setShowMobileHeaderMenu] = useState(false);
  const [editingTarget, setEditingTarget] = useState<'income' | 'expense' | null>(null);
  const [targetInput, setTargetInput] = useState('');


  const [insightOpen, setInsightOpen] = useState(false);
  const {
    raw: insightText, json: insightJson, loading: insightLoading, notice: insightParseError,
    run: handleInsight, reset: resetInsight, copyJson: copyInsightJson, exportJson: exportInsightJson,
  } = useFinancialInsight();
  
  // Quick Add Form State
  const [breakdownType, setBreakdownType] = useState<'income' | 'expense'>('expense');
  const [formData, setFormData] = useState({
    title: '', amount: '', date: toLocalISODate(),
    category: 'Food', type: 'expense' as 'income' | 'expense', paymentMethod: 'UPI', note: '', tags: ''
  });
  const [isAdding, setIsAdding] = useState(false);
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurrenceFreq, setRecurrenceFreq] = useState<'daily' | 'weekly' | 'monthly' | 'yearly'>('monthly');
  const [showBalanceBreakdown, setShowBalanceBreakdown] = useState(false);
  const [enableCarryForward, setEnableCarryForward] = useState(true);

  // Sync widget editor order with store when opened
  useEffect(() => {
      if (showWidgetEditor) setEditorOrder([...widgetOrder]);
  }, [showWidgetEditor, widgetOrder]);

  // Sync default payment method
  useEffect(() => {
    if (userSettings && userSettings.paymentMethods.length > 0) {
      setFormData(prev => ({ ...prev, paymentMethod: userSettings.paymentMethods[0] }));
    }
  }, [userSettings]);


  const currencySymbol = getCurrencySymbol(userSettings?.currency);

  // --- DATA AGGREGATION ---
  // The Dashboard shows one week/month/year at a time (weeks start on Monday).
  const period = useMemo(() => getPeriodRange(dashboardDate, dashboardViewMode, 1), [dashboardDate, dashboardViewMode]);
  const periodStart = period.start;

  /** Transactions in the selected period, newest first. */
  const filteredTransactions = useMemo(
    () => transactions.filter(t => isInRange(t.date, period)).sort((a, b) => b.date.localeCompare(a.date)),
    [transactions, period]
  );

  const periodStats = useMemo(() => sumTotals(filteredTransactions), [filteredTransactions]);

  /** Balance from everything before the period, added on when "carry forward" is on. */
  const carriedForwardStats = useMemo(() => {
    const periodStartIso = toLocalISODate(periodStart);
    const { income, expense, balance } = sumTotals(transactions.filter(t => t.date < periodStartIso));
    return { priorIncome: income, priorExpense: expense, balance };
  }, [transactions, periodStart]);

  const effectiveBalance = enableCarryForward ? (carriedForwardStats.balance + periodStats.balance) : periodStats.balance;
  /** The headline balance rolls to its new value when the period or data changes. */
  const animatedBalance = useCountUp(effectiveBalance);

  /** Totals for the period before this one, for the "% vs last period" badges. */
  const previousPeriodStats = useMemo(() => {
    const previous = getPeriodRange(shiftPeriod(dashboardDate, dashboardViewMode, -1), dashboardViewMode, 1);
    return sumTotals(transactions.filter(t => isInRange(t.date, previous)));
  }, [transactions, dashboardViewMode, dashboardDate]);

  /** Running balance for the wave graph: one point per day (week/month) or per month (year). */
  const graphData = useMemo(() => {
      const points: number[] = [];
      let running = 0;
      if (dashboardViewMode === 'year') {
          const year = periodStart.getFullYear();
          const netByMonth = Array(12).fill(0);
          transactions.forEach(t => {
              const d = parseLocalDate(t.date);
              if (d.getFullYear() === year) netByMonth[d.getMonth()] += signedAmount(t);
          });
          netByMonth.forEach(net => { running += net; points.push(running); });
      } else {
          const netByDay = new Map<string, number>();
          filteredTransactions.forEach(t => netByDay.set(t.date, (netByDay.get(t.date) || 0) + signedAmount(t)));
          const dayCount = dashboardViewMode === 'week'
              ? 7
              : new Date(periodStart.getFullYear(), periodStart.getMonth() + 1, 0).getDate();
          const now = new Date();
          for (let i = 0; i < dayCount; i++) {
              const day = new Date(periodStart.getFullYear(), periodStart.getMonth(), periodStart.getDate() + i);
              if (dashboardViewMode === 'month' && day > now) break; // don't draw the future
              // Local date key: toISOString() shifted every point by a day in UTC+ zones.
              running += netByDay.get(toLocalISODate(day)) || 0;
              points.push(running);
          }
      }
      if (points.length === 0) return [0, 0, 0];
      if (points.length === 1) points.push(points[0]); // a line needs two points
      return points;
  }, [filteredTransactions, dashboardViewMode, transactions, periodStart]);

  /**
   * One-line summary under the greeting, always about the current calendar
   * month. It used to say "Your finances are looking good" whatever the numbers.
   */
  const monthSummary = useMemo(() => {
    const month = getPeriodRange(new Date(), 'month', 1);
    const { income, expense } = sumTotals(transactions.filter(t => isInRange(t.date, month)));
    const limit = userSettings?.monthlyExpenseLimit || 0;
    if (limit > 0 && expense > limit) return `You're over this month's spending limit by ${formatMoney(expense - limit, currencySymbol)}.`;
    if (limit > 0 && expense >= limit * 0.85) return `You've used ${Math.round((expense / limit) * 100)}% of this month's spending limit.`;
    if (expense > income && income > 0) return `You've spent ${formatMoney(expense - income, currencySymbol)} more than you earned this month.`;
    if (expense === 0 && income === 0) return 'Nothing recorded this month yet.';
    return "You're on track this month.";
  }, [transactions, userSettings?.monthlyExpenseLimit, currencySymbol]);

  /** Monthly goals scaled to the selected period; 0 means no goal has been set. */
  const targets = useMemo(() => {
      const multiplier = PERIOD_GOAL_MULTIPLIER[dashboardViewMode];
      return {
          income: (userSettings?.monthlyIncomeGoal || 0) * multiplier,
          expense: (userSettings?.monthlyExpenseLimit || 0) * multiplier,
      };
  }, [userSettings, dashboardViewMode]);

  /** Progress towards a goal, 0–100. With no goal it was shown as "1" and 100%. */
  const goalPercent = (value: number, goal: number) => (goal > 0 ? Math.min((value / goal) * 100, 100) : 0);

  /** Donut chart data: top five categories plus "Other". */
  const breakdownStats = useMemo(() => {
      const { data, total } = topCategories(filteredTransactions, breakdownType);
      const legends = Object.entries(data)
          .map(([cat, val]) => ({ name: cat, value: val, percent: total > 0 ? (val / total * 100).toFixed(1) : '0', color: getCategoryStyle(cat).hex }))
          .sort((a, b) => b.value - a.value);
      return { data, total, legends };
  }, [filteredTransactions, breakdownType]);

  const streakCount = useMemo(() => calculateStreak(transactions.map(t => t.date)), [transactions]);

  const handleDateNavigate = (direction: 'prev' | 'next') =>
      setDashboardDate(shiftPeriod(dashboardDate, dashboardViewMode, direction === 'next' ? 1 : -1));

  // Bento Box Layout Logic
  const handleEditorReorder = (key: string, direction: 'up' | 'down') => {
      const idx = editorOrder.indexOf(key); if (idx === -1) return;
      const newOrder = [...editorOrder]; if (direction === 'up' && idx > 0) [newOrder[idx], newOrder[idx - 1]] = [newOrder[idx - 1], newOrder[idx]];
      else if (direction === 'down' && idx < newOrder.length - 1) [newOrder[idx], newOrder[idx + 1]] = [newOrder[idx + 1], newOrder[idx]];
      setEditorOrder(newOrder);
  };

  const handleSaveLayout = () => { updateWidgetOrder(editorOrder); setShowWidgetEditor(false); };
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => { const { name, value } = e.target; setFormData(prev => ({ ...prev, [name]: value })); };
  const handleTypeChange = (type: 'income' | 'expense') => { 
    const cats = type === 'income' ? (userSettings?.incomeCategories || DEFAULT_INCOME_CATEGORIES) : (userSettings?.expenseCategories || DEFAULT_EXPENSE_CATEGORIES);
    setFormData(prev => ({ ...prev, type, category: cats[0] || 'Other' })); 
  };



  const handleAddTransaction = async () => {
    if (!formData.title.trim() || !formData.amount) { dialog.toast('Add a description and an amount', 'error'); return; }
    const amount = parseFloat(formData.amount);
    if (isNaN(amount) || amount <= 0) { dialog.toast('Enter an amount greater than 0', 'error'); return; }
    setIsAdding(true);
    try {
        let tags: string[] = formData.tags ? formData.tags.split(',').map(t => t.trim()).filter(t => t.length > 0) : [];
        await addTransaction({
          title: formData.title, amount: amount, date: formData.date, category: formData.category, type: formData.type, note: formData.note, tags: tags, paymentMethod: formData.paymentMethod,
          ...(isRecurring ? {
            isRecurring: true,
            recurrenceRule: { frequency: recurrenceFreq, interval: 1 },
            nextOccurrence: addInterval(formData.date, recurrenceFreq)
          } : {})
        });
        const defaultCats = formData.type === 'income' ? (userSettings?.incomeCategories || DEFAULT_INCOME_CATEGORIES) : (userSettings?.expenseCategories || DEFAULT_EXPENSE_CATEGORIES);
        setFormData({ title: '', amount: '', date: toLocalISODate(), category: defaultCats[0] || 'Other', type: formData.type, paymentMethod: userSettings?.paymentMethods[0] || 'UPI', note: '', tags: '' });
        setIsRecurring(false);
    } catch (e: any) { console.error(e); } finally { setIsAdding(false); }
  };

  const handleDelete = async () => {
      if (deleteId) {
          const itemToDelete = transactions.find(t => t.id === deleteId);
          await deleteTransaction(deleteId);
          if (itemToDelete) showUndo(itemToDelete);
          setDeleteId(null);
      }
  };

  const handleEditTarget = (type: 'income' | 'expense') => { setEditingTarget(type); setTargetInput(type === 'income' ? (userSettings?.monthlyIncomeGoal?.toString() || '') : (userSettings?.monthlyExpenseLimit?.toString() || '')); };
  const saveTarget = async () => {
      if (!targetInput) return; const val = parseFloat(targetInput); if (isNaN(val)) return;
      if (editingTarget === 'income') await updateUserSettings({ monthlyIncomeGoal: val });
      else await updateUserSettings({ monthlyExpenseLimit: val });
      setEditingTarget(null);
  };

  /** Download the current period's transactions, or all of them, as CSV. */
  const handleExport = (allTime: boolean = false) => {
      downloadTransactionsCsv(allTime ? transactions : filteredTransactions, `transactions_${allTime ? 'full' : 'view'}_${toLocalISODate()}`);
      setShowExportModal(false);
  };


  const formatCompact = (val: number) => { if(val >= 1000000) return `${(val/1000000).toFixed(1)}M`; if(val >= 1000) return `${(val/1000).toFixed(1)}k`; return val.toLocaleString('en-IN', { maximumFractionDigits: 0 }); };



  // Five most recent. Sorts a copy: sorting `transactions` in place reordered the shared store array during render.
  const recentTransactions = [...transactions].sort((a,b) => b.date.localeCompare(a.date)).slice(0, 5);

  // Widget Renderer: Dynamically renders components based on key
  const renderWidget = (key: string) => {
      if (!widgets[key]) return null;
      switch(key) {
        case 'streak':
  return (
    <div className="
      col-span-2 md:col-span-2 lg:col-span-3
      bg-gradient-to-br from-[#FFFBEB] to-[#FEF3C7]
      dark:from-[#2a1c05] dark:to-[#1a1306]
      border border-yellow-200 dark:border-yellow-900/30
      rounded-[2.5rem]
      p-6
      relative overflow-hidden
      shadow-card-light dark:shadow-glow
      min-h-[220px] md:min-h-[300px]
      flex flex-col
    ">
      {/* glow */}
      <div className="absolute inset-0 bg-yellow-400/10 blur-3xl" />

      {/* title */}
      <span className="z-10 text-yellow-700 dark:text-yellow-400 font-bold uppercase tracking-widest text-xs text-center md:text-center">
        Current Streak
      </span>

      {/* MAIN CONTENT */}
      <div
        className="
            z-10 flex flex-row md:flex-col
            items-center
            justify-center
            gap-3 md:gap-6
            flex-1
            mt-6
                    "
                >
        <div className="flex items-center justify-center gap-4 md:gap-6 w-full">
          {/* left: number */}
          <div className="flex flex-col items-start md:items-center min-w-[64px]">
            <span className="text-5xl md:text-6xl font-black text-yellow-900 dark:text-yellow-100 tabular-nums leading-none">
              {streakCount}
            </span>
            <span className="mt-1 text-xs md:text-sm font-bold uppercase tracking-widest text-yellow-600 dark:text-yellow-500">
              days
            </span>
          </div>
          {/* right: lottie */}
          <div className="w-18 h-18 md:w-28 md:h-28 flex items-center justify-center shrink-0">
            <StreakVisual count={streakCount} />
          </div>
        </div>
      </div>

      {/* footer */}
      <p className="z-10 text-center text-yellow-800 dark:text-yellow-200/70 text-sm font-medium mt-2">
        {streakCount === 0
          ? "Start a streak today!"
          : "Keep the momentum going!"}
      </p>
    </div>
  );


          case 'balance': {
            // null when the previous period's balance was 0: nothing to compare against.
            const balanceChange = percentChange(periodStats.balance, previousPeriodStats.balance);
            const periodWord = dashboardViewMode; // week / month / year
            const periodStartLabel = periodStart.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
            // Layout, top to bottom: label + period switch, the balance, its change,
            // a small trend line, two figures that make up the balance, then the
            // two options. It used to squeeze four controls into one row.
            return (
              <div className="col-span-2 md:col-span-2 lg:col-span-12 bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark rounded-[2.5rem] p-5 sm:p-6 lg:p-8 relative overflow-hidden shadow-card-light dark:shadow-glow">
                <div className="pointer-events-none absolute -top-24 -right-16 size-72 rounded-full bg-primary/10 blur-[100px]" aria-hidden="true" />
                {loading ? <Skeleton className="h-64 w-full"/> : (
                  <div className="relative flex flex-col gap-5">
                    {/* Label + period chip. One tap moves Week → Month → Year → Week. */}
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5">
                        <span className="size-9 rounded-xl bg-sky-500/15 text-sky-400 flex items-center justify-center">
                          <span className="material-symbols-outlined text-[20px]" aria-hidden="true">account_balance</span>
                        </span>
                        <span className="text-[11px] font-black uppercase tracking-[0.2em] text-text-light-muted dark:text-text-dark-muted">Total balance</span>
                      </div>
                      <button type="button" onClick={cyclePeriod}
                        aria-label={`Period: ${periodWord}. Tap for ${NEXT_PERIOD[dashboardViewMode]}.`}
                        className="group flex items-center gap-2 pl-3.5 pr-2 py-1.5 rounded-full bg-gray-100 dark:bg-black/30 border border-border-light dark:border-border-dark hover:border-primary/40 transition-colors">
                        <span key={dashboardViewMode} className="text-xs font-black capitalize text-text-light-main dark:text-text-dark-main min-w-[2.75rem] text-left animate-sheet-in">{periodWord}</span>
                        {/* Three dots show where you are in the cycle */}
                        <span className="flex gap-1" aria-hidden="true">
                          {PERIODS.map(m => (
                            <span key={m} className={`h-1.5 rounded-full transition-all duration-300 ${dashboardViewMode === m ? 'w-4 bg-primary' : 'w-1.5 bg-gray-300 dark:bg-white/20'}`} />
                          ))}
                        </span>
                      </button>
                    </div>

                    {/* The balance and how it changed */}
                    <div className="flex flex-col gap-2">
                      <h2 className="text-[2.6rem] leading-none sm:text-6xl lg:text-7xl font-black tracking-tight tabular-nums text-text-light-main dark:text-text-dark-main">
                        {currencySymbol}{animatedBalance.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </h2>
                      <div className="flex flex-wrap items-center gap-2 text-xs font-bold">
                        {balanceChange === null ? (
                          <span className="px-2.5 py-1 rounded-full bg-gray-100 dark:bg-white/5 text-text-light-muted dark:text-text-dark-muted">No data for last {periodWord}</span>
                        ) : (
                          <span className={`px-2.5 py-1 rounded-full flex items-center gap-1 ${balanceChange >= 0 ? 'bg-primary/15 text-primary' : 'bg-danger/15 text-danger'}`}>
                            <span className="material-symbols-outlined text-[14px]" aria-hidden="true">{balanceChange >= 0 ? 'trending_up' : 'trending_down'}</span>
                            {Math.abs(balanceChange).toFixed(1)}% vs last {periodWord}
                          </span>
                        )}
                        {/* Scope: everything to date, or just this period */}
                        <div role="radiogroup" aria-label="Balance covers" className="relative grid grid-cols-2 p-0.5 rounded-full bg-gray-100 dark:bg-black/30 border border-border-light dark:border-border-dark">
                          <span className={`absolute top-0.5 bottom-0.5 left-0.5 w-[calc(50%-2px)] rounded-full bg-white dark:bg-surface-dark shadow-sm transition-transform duration-300 [transition-timing-function:cubic-bezier(0.34,1.56,0.64,1)] ${enableCarryForward ? '' : 'translate-x-full'}`} aria-hidden="true" />
                          {[{ on: true, label: 'All time' }, { on: false, label: `This ${periodWord}` }].map(o => (
                            <button key={o.label} type="button" role="radio" aria-checked={enableCarryForward === o.on} onClick={() => setEnableCarryForward(o.on)}
                              className={`relative z-10 px-3 py-1 text-[11px] font-bold whitespace-nowrap transition-colors ${enableCarryForward === o.on ? 'text-text-light-main dark:text-text-dark-main' : 'text-text-light-muted dark:text-text-dark-muted'}`}>
                              {o.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Trend line, in its own row so it never sits behind text */}
                    <div className="h-14 -mx-2" aria-hidden="true">
                      <RealWaveGraph data={graphData} color="#2ECC71" />
                    </div>

                    {/* What the balance is made of. "All time": earlier + this period.
                        "This period": money in and out, so it doesn't just repeat the headline. */}
                    <div className="grid grid-cols-2 rounded-2xl bg-gray-50 dark:bg-black/20 border border-border-light dark:border-border-dark divide-x divide-border-light dark:divide-border-dark overflow-hidden">
                      {(enableCarryForward
                        ? [
                            { label: `Before ${periodStartLabel}`, value: carriedForwardStats.balance, tone: carriedForwardStats.balance >= 0 ? 'text-text-light-main dark:text-text-dark-main' : 'text-danger' },
                            { label: `Net this ${periodWord}`, value: periodStats.balance, tone: periodStats.balance >= 0 ? 'text-primary' : 'text-danger' },
                          ]
                        : [
                            { label: `In this ${periodWord}`, value: periodStats.income, tone: 'text-primary' },
                            { label: `Out this ${periodWord}`, value: -periodStats.expense, tone: 'text-danger' },
                          ]
                      ).map(cell => (
                        <div key={cell.label} className="p-3.5 sm:p-4 flex flex-col gap-1 min-w-0 animate-fade-in">
                          <span className="text-[10px] font-black uppercase tracking-widest text-text-light-muted dark:text-text-dark-muted truncate">{cell.label}</span>
                          <span className={`text-base sm:text-xl font-black tabular-nums truncate ${cell.tone}`}>
                            {formatMoney(Math.round(cell.value), currencySymbol, { signed: true })}
                          </span>
                        </div>
                      ))}
                    </div>

                    <div className="flex">
                      <button type="button" onClick={() => setShowBalanceBreakdown(v => !v)} aria-expanded={showBalanceBreakdown}
                        className={`w-full sm:w-auto justify-center flex items-center gap-1.5 px-3.5 py-2.5 rounded-full text-xs font-bold border transition-colors ${showBalanceBreakdown ? 'bg-primary/15 text-primary border-primary/30' : 'bg-gray-100 dark:bg-white/5 text-text-light-main dark:text-text-dark-main border-border-light dark:border-border-dark hover:border-primary/40'}`}>
                        <span className="material-symbols-outlined text-[16px]" aria-hidden="true">account_balance_wallet</span>
                        By payment method
                        <span className={`material-symbols-outlined text-[18px] transition-transform duration-300 ${showBalanceBreakdown ? 'rotate-180' : ''}`} aria-hidden="true">expand_more</span>
                      </button>
                    </div>

                    {showBalanceBreakdown && (
                      <PaymentModeBreakdown transactions={transactions} paymentMethods={userSettings?.paymentMethods || []} currencySymbol={currencySymbol} />
                    )}
                  </div>
                )}
              </div>
            );
          }
          case 'income': return ( <div onClick={() => handleEditTarget('income')} className="lift col-span-1 lg:col-span-3 bg-surface-light dark:bg-surface-dark rounded-[2rem] lg:rounded-[2.5rem] p-5 lg:p-8 border border-border-light dark:border-border-dark flex flex-col justify-between shadow-card-light dark:shadow-card relative group min-h-[180px] lg:min-h-[240px] cursor-pointer" > {loading ? <Skeleton className="h-full w-full"/> : ( <> <div className="flex justify-between items-start"> <div className="size-10 lg:size-12 rounded-full border border-gray-200 dark:border-border-dark hidden md:flex items-center justify-center text-text-light-main dark:text-text-dark-main mb-2 lg:mb-4 group-hover:scale-110 transition-transform"> <span className="material-symbols-outlined text-lg lg:text-2xl text-primary">south_west</span> </div> <span className="hidden lg:block text-xs font-bold text-text-light-muted dark:text-text-dark-muted uppercase bg-gray-100 dark:bg-surface-darker px-2 py-1 rounded-md">{dashboardViewMode}ly</span> </div> <div> <span className="text-text-light-muted dark:text-text-dark-muted text-[10px] lg:text-xs font-bold uppercase tracking-wider">Total Income</span> <span className="block text-xl lg:text-4xl font-black text-primary tracking-tight mt-1 lg:mt-1">{formatMoney(periodStats.income, currencySymbol, { compact: true, signed: true })}</span> </div> <div className="mt-4 lg:mt-6"> <div className="flex justify-between text-[10px] font-bold text-text-light-muted dark:text-text-dark-muted mb-1 uppercase tracking-wider"> <span className="flex items-center gap-1 truncate max-w-[80px] lg:max-w-none">{targets.income > 0 ? `Target: ${formatMoney(targets.income, currencySymbol, { compact: true })}` : 'Set target'}</span> <span>{targets.income > 0 ? `${((periodStats.income / targets.income) * 100).toFixed(0)}%` : ''}</span> </div> <div className="h-1.5 lg:h-2 w-full bg-gray-100 dark:bg-black/20 rounded-full overflow-hidden"> <div className="h-full bg-primary rounded-full transition-all duration-1000 ease-out" style={{width: `${goalPercent(periodStats.income, targets.income)}%`}}></div> </div> </div> </> )} </div> );
          case 'expense': return ( <div onClick={() => handleEditTarget('expense')} className="lift col-span-1 lg:col-span-3 bg-surface-light dark:bg-surface-dark rounded-[2rem] lg:rounded-[2.5rem] p-5 lg:p-8 border border-border-light dark:border-border-dark flex flex-col justify-between shadow-card-light dark:shadow-card relative group min-h-[180px] lg:min-h-[240px] cursor-pointer" > {loading ? <Skeleton className="h-full w-full"/> : ( <> <div className="flex justify-between items-start"> <div className="size-10 lg:size-12 rounded-full border border-gray-200 dark:border-border-dark hidden md:flex items-center justify-center text-text-light-main dark:text-text-dark-main mb-2 lg:mb-4 group-hover:scale-110 transition-transform"> <span className="material-symbols-outlined text-lg lg:text-2xl text-danger">north_east</span> </div> <span className="hidden lg:block text-xs font-bold text-text-light-muted dark:text-text-dark-muted uppercase bg-gray-100 dark:bg-surface-darker px-2 py-1 rounded-md">{dashboardViewMode}ly</span> </div> <div> <span className="text-text-light-muted dark:text-text-dark-muted text-[10px] lg:text-xs font-bold uppercase tracking-wider">Total Expenses</span> <span className="block text-xl lg:text-4xl font-black text-danger tracking-tight mt-1 lg:mt-1">{formatMoney(-periodStats.expense, currencySymbol, { compact: true })}</span> </div> <div className="mt-4 lg:mt-6"> <div className="flex justify-between text-[10px] font-bold text-text-light-muted dark:text-text-dark-muted mb-1 uppercase tracking-wider"> <span className={`flex items-center gap-1 truncate max-w-[110px] lg:max-w-none ${targets.expense > 0 && periodStats.expense > targets.expense ? 'text-danger' : ''}`}>{targets.expense <= 0 ? 'Set limit' : periodStats.expense > targets.expense ? `Over by ${formatMoney(periodStats.expense - targets.expense, currencySymbol, { compact: true })}` : `Limit: ${formatMoney(targets.expense, currencySymbol, { compact: true })}`}</span> <span className={targets.expense > 0 && periodStats.expense > targets.expense ? 'text-danger' : ''}>{targets.expense > 0 ? `${((periodStats.expense / targets.expense) * 100).toFixed(0)}%` : ''}</span> </div> <div className="h-1.5 lg:h-2 w-full bg-gray-100 dark:bg-black/20 rounded-full overflow-hidden"> <div className="h-full bg-danger rounded-full transition-all duration-1000 ease-out" style={{width: `${goalPercent(periodStats.expense, targets.expense)}%`}}></div> </div> </div> </> )} </div> );
          case 'shortcuts': return <QuickShortcutsWidget />;
          case 'comparison': return <MonthlyComparisonWidget />;
          case 'categoryBudgets': return <CategoryBudgetWidget />;
          case 'quickAdd': return ( <div className="col-span-2 md:col-span-2 lg:col-span-4 bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark rounded-[2rem] p-6 shadow-card-light dark:shadow-card hover:shadow-lg transition-shadow"> <div className="flex items-center gap-2 mb-6"> <div className="size-8 rounded-full bg-primary flex items-center justify-center text-[#142210] shadow-glow"><span className="material-symbols-outlined text-lg">add</span></div> <h3 className="text-xl font-bold text-text-light-main dark:text-text-dark-main">New Transaction</h3> </div> <div className="flex flex-col gap-5"> <div className="flex bg-gray-100 dark:bg-surface-darker p-1.5 rounded-xl border border-gray-200 dark:border-border-dark"> <button onClick={() => handleTypeChange('expense')} className={`flex-1 py-2.5 text-sm font-bold rounded-lg transition-all ${formData.type === 'expense' ? 'bg-white dark:bg-surface-dark text-danger dark:text-red-400 shadow-sm border border-danger/30' : 'text-text-light-muted dark:text-text-dark-muted hover:text-text-light-main dark:hover:text-text-dark-main'}`}>Expense</button> <button onClick={() => handleTypeChange('income')} className={`flex-1 py-2.5 text-sm font-bold rounded-lg transition-all ${formData.type === 'income' ? 'bg-white dark:bg-surface-dark text-primary shadow-sm border border-primary/30' : 'text-text-light-muted dark:text-text-dark-muted hover:text-text-light-main dark:hover:text-text-dark-main'}`}>Income</button> </div> <div className="space-y-4"> <div className="flex flex-col gap-1.5"> <label className="text-xs font-bold text-text-light-muted dark:text-text-dark-muted ml-1 uppercase">Description</label> <div className="relative"> <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 text-lg">edit_note</span> <input name="title" value={formData.title} onChange={handleInputChange} type="text" placeholder="e.g. Groceries" className="w-full bg-background-light dark:bg-surface-darker text-text-light-main dark:text-text-dark-main rounded-xl py-3 pl-10 pr-4 border border-border-light dark:border-border-dark focus:border-primary focus:ring-1 focus:ring-primary outline-none text-sm transition-all" /> </div> </div> <div className="grid grid-cols-2 gap-3"> <div className="flex flex-col gap-1.5"> <label className="text-xs font-bold text-text-light-muted dark:text-text-dark-muted ml-1 uppercase">Amount</label> <div className="relative"> <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 font-bold text-lg">{currencySymbol}</span> <input name="amount" value={formData.amount} onChange={handleInputChange} type="number" placeholder="0.00" className="w-full bg-background-light dark:bg-surface-darker text-text-light-main dark:text-text-dark-main rounded-xl py-3 pl-9 pr-4 border border-border-light dark:border-border-dark focus:border-primary outline-none text-sm font-bold tracking-wide" /> </div> </div> <div className="flex flex-col gap-1.5"> <label className="text-xs font-bold text-text-light-muted dark:text-text-dark-muted ml-1 uppercase">Method</label> <select name="paymentMethod" value={formData.paymentMethod} onChange={handleInputChange} className="w-full bg-background-light dark:bg-surface-darker text-text-light-main dark:text-text-dark-main rounded-xl py-3 px-3 border border-border-light dark:border-border-dark focus:border-primary outline-none text-sm appearance-none cursor-pointer"> {userSettings?.paymentMethods.map(m => <option key={m} value={m}>{m}</option>)} </select> </div> </div> <div className="grid grid-cols-2 gap-3"> <div className="flex flex-col gap-1.5"> <label className="text-xs font-bold text-text-light-muted dark:text-text-dark-muted ml-1 uppercase">Category</label> <select name="category" value={formData.category} onChange={handleInputChange} className="w-full bg-background-light dark:bg-surface-darker text-text-light-main dark:text-text-dark-main rounded-xl py-3 px-3 border border-border-light dark:border-border-dark focus:border-primary outline-none text-sm appearance-none cursor-pointer"> {(formData.type === 'income' ? (userSettings?.incomeCategories || DEFAULT_INCOME_CATEGORIES) : (userSettings?.expenseCategories || DEFAULT_EXPENSE_CATEGORIES)).map(cat => <option key={cat} value={cat}>{cat}</option>)} </select> </div> <div className="flex flex-col gap-1.5"> <label className="text-xs font-bold text-text-light-muted dark:text-text-dark-muted ml-1 uppercase">Date</label> <input name="date" type="date" value={formData.date} onChange={handleInputChange} className="w-full bg-background-light dark:bg-surface-darker text-text-light-main dark:text-text-dark-main rounded-xl py-3 px-3 border border-border-light dark:border-border-dark focus:border-primary outline-none text-sm" style={{colorScheme: userSettings?.theme === 'light' ? 'light' : 'dark'}} /> </div> </div> <div className="flex flex-col gap-2 pt-1"> <div onClick={() => setIsRecurring(!isRecurring)} className="flex items-center justify-between p-2.5 rounded-xl bg-background-light dark:bg-surface-darker border border-border-light dark:border-border-dark cursor-pointer hover:border-primary/40 transition-all"> <div className="flex items-center gap-2"> <span className="material-symbols-outlined text-[18px] text-text-light-muted dark:text-text-dark-muted">repeat</span> <span className="text-xs font-bold text-text-light-main dark:text-text-dark-main">Repeat</span> </div> <div className={`w-8 h-4 rounded-full relative transition-colors ${isRecurring ? 'bg-primary' : 'bg-gray-300 dark:bg-border-dark'}`}> <div className={`absolute top-0.5 size-3 bg-white rounded-full shadow transition-all ${isRecurring ? 'left-4.5' : 'left-0.5'}`} /> </div> </div> {isRecurring && ( <div className="flex gap-1.5 flex-wrap animate-fade-in"> {(['daily', 'weekly', 'monthly', 'yearly'] as const).map(f => ( <button key={f} type="button" onClick={() => setRecurrenceFreq(f)} className={`px-2.5 py-1 rounded-full text-[11px] font-bold capitalize transition-all ${recurrenceFreq === f ? 'bg-primary text-[#131811] shadow-glow' : 'bg-background-light dark:bg-surface-darker text-text-light-muted dark:text-text-dark-muted hover:bg-primary/10'}`}>{f}</button> ))} </div> )} </div> </div> <button onClick={handleAddTransaction} disabled={isAdding} className="mt-2 w-full bg-primary hover:bg-primary-hover text-[#131811] font-bold py-3.5 rounded-xl shadow-glow transition-all flex items-center justify-center gap-2 disabled:opacity-50 transform active:scale-[0.98]"> {isAdding ? <span className="material-symbols-outlined animate-spin">sync</span> : <span className="material-symbols-outlined">add</span>} {isAdding ? 'Saving...' : 'Add Transaction'} </button> </div> </div> );
          case 'breakdown': 
            const prevTotalBreakdown = breakdownType === 'income' ? previousPeriodStats.income : previousPeriodStats.expense;
            const breakdownChangeValue = percentChange(breakdownStats.total, prevTotalBreakdown) ?? undefined;
            return ( <div className="col-span-2 md:col-span-1 lg:col-span-8 bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark rounded-[2.5rem] p-8 flex flex-col gap-8 shadow-card-light dark:shadow-card relative overflow-visible group min-h-[400px]"> <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 z-20"> <div className="flex items-center gap-3"> <div className="size-10 rounded-full border border-border-light dark:border-white/20 flex items-center justify-center text-text-light-main dark:text-primary bg-surface-light dark:bg-surface-dark shadow-sm"><span className="material-symbols-outlined text-sm">donut_large</span></div> <div> <h3 className="text-lg font-bold text-text-light-main dark:text-white tracking-wide leading-tight">Financial Breakdown</h3> <p className="text-xs text-text-light-muted dark:text-text-dark-muted font-medium">{dashboardViewMode === 'year' ? dashboardDate.getFullYear() : dashboardDate.toLocaleDateString('default', {month:'short', year:'numeric'})}</p> </div> </div> <div className="hidden sm:flex items-center gap-2 bg-gray-100 dark:bg-surface-darker rounded-full p-1 border border-border-light dark:border-border-dark self-start sm:self-auto"> <button onClick={() => handleDateNavigate('prev')} className="size-8 rounded-full flex items-center justify-center hover:bg-white dark:hover:bg-surface-dark text-text-light-muted dark:text-text-dark-muted transition-colors"><span className="material-symbols-outlined text-sm">chevron_left</span></button> <span className="text-xs font-bold text-text-light-main dark:text-text-dark-main px-2 min-w-[80px] text-center select-none">{dashboardViewMode === 'year' ? dashboardDate.getFullYear() : dashboardDate.toLocaleDateString('en-GB', {month:'short', year:'numeric'})}</span> <button onClick={() => handleDateNavigate('next')} className="size-8 rounded-full flex items-center justify-center hover:bg-white dark:hover:bg-surface-dark text-text-light-muted dark:text-text-dark-muted transition-colors"><span className="material-symbols-outlined text-sm">chevron_right</span></button> </div> </div> <div className="w-full flex flex-col md:flex-row items-center gap-6 justify-center"> <div className="shrink-0 relative flex flex-col items-center gap-6 w-full md:w-auto"> <div className="flex sm:hidden items-center gap-2 bg-gray-100 dark:bg-surface-darker rounded-full p-1 border border-border-light dark:border-border-dark mb-[-10px] z-10"> <button onClick={() => handleDateNavigate('prev')} className="size-8 rounded-full flex items-center justify-center hover:bg-white dark:hover:bg-surface-dark text-text-light-muted dark:text-text-dark-muted transition-colors"><span className="material-symbols-outlined text-sm">chevron_left</span></button> <span className="text-xs font-bold text-text-light-main dark:text-text-dark-main px-4 min-w-[80px] text-center select-none">{dashboardViewMode === 'year' ? dashboardDate.getFullYear() : dashboardDate.toLocaleDateString('en-GB', {month:'short', year:'numeric'})}</span> <button onClick={() => handleDateNavigate('next')} className="size-8 rounded-full flex items-center justify-center hover:bg-white dark:hover:bg-surface-dark text-text-light-muted dark:text-text-dark-muted transition-colors"><span className="material-symbols-outlined text-sm">chevron_right</span></button> </div> <DonutChart data={breakdownStats.data} total={breakdownStats.total} currencySymbol={currencySymbol} change={breakdownChangeValue} changeLabel={`vs last ${dashboardViewMode}`} label={breakdownType === 'expense' ? 'Expenses' : 'Income'} className="size-56 md:size-64" isExpense={breakdownType === 'expense'} /> <div className="flex bg-gray-100 dark:bg-black/30 rounded-full p-1.5 border border-border-light dark:border-border-dark w-fit shadow-sm"> <button onClick={() => setBreakdownType('income')} className={`px-6 py-2 rounded-full text-xs font-bold uppercase transition-all ${breakdownType === 'income' ? 'bg-white dark:bg-surface-dark shadow-md text-primary' : 'text-text-light-muted dark:text-gray-400 hover:text-text-light-main'}`}>Income</button> <button onClick={() => setBreakdownType('expense')} className={`px-6 py-2 rounded-full text-xs font-bold uppercase transition-all ${breakdownType === 'expense' ? 'bg-white dark:bg-surface-dark shadow-md text-danger' : 'text-text-light-muted dark:text-gray-400 hover:text-text-light-main'}`}>Expense</button> </div> </div> <div className="w-full md:w-56 flex-1 flex flex-col gap-1.5 max-h-72 overflow-y-auto custom-scrollbar pr-2"> {breakdownStats.legends.length > 0 ? ( breakdownStats.legends.map((item, idx) => ( <div key={idx} className="flex items-center justify-between px-3 py-2 rounded-xl hover:bg-gray-50 dark:hover:bg-surface-darker transition-colors group border border-transparent hover:border-border-light dark:hover:border-border-dark/50"> <div className="flex items-center gap-3"> <div className="size-3 rounded-full shadow-sm" style={{backgroundColor: item.color}}></div> <span className="text-sm font-bold text-text-light-main dark:text-text-dark-main group-hover:text-primary transition-colors">{item.name}</span> </div> <div className="flex flex-col items-end"> <span className="text-sm font-bold text-text-light-main dark:text-text-dark-main tracking-tight">{currencySymbol}{formatCompact(item.value)}</span> <span className="text-[10px] font-bold text-text-light-muted dark:text-text-dark-muted bg-gray-100 dark:bg-black/20 px-1.5 py-0.5 rounded-md">{item.percent}%</span> </div> </div> )) ) : ( <div className="text-center py-8 text-text-light-muted dark:text-text-dark-muted opacity-60"> <span className="material-symbols-outlined text-3xl mb-2">data_usage</span> <p className="text-xs">No data for this period</p> </div> )} </div> </div> </div> );
          case 'recent': return ( 
            <div className="col-span-2 md:col-span-2 lg:col-span-8 flex flex-col gap-4">
                <div className="flex items-center justify-between px-2">
                    <h3 className="text-xl font-black text-text-light-main dark:text-text-dark-main flex items-center flex-wrap gap-x-3 gap-y-1">
                        <div className="flex items-center gap-2">
                            <span className="material-symbols-outlined text-text-light-main dark:text-text-dark-main text-xl">history</span> Recent Transactions
                        </div>
                        <span className="text-text-light-muted dark:text-text-dark-muted text-sm font-normal">•</span>
                        <button onClick={() => navigate(ROUTES.TRANSACTION_HISTORY)} className="text-primary text-sm font-bold hover:underline cursor-pointer">Full History</button>
                    </h3>
                </div>
                <div className="flex flex-col gap-3 stagger">
                    {loading ? ([1,2,3,4].map(i => <Skeleton key={i} className="h-20 w-full rounded-2xl"/>)) : recentTransactions.length > 0 ? (
                        recentTransactions.map(tx => {
                            const style = CATEGORY_STYLES[tx.category] || CATEGORY_STYLES['Other'];
                            return (
                                <div key={tx.id} onClick={() => setViewingTransaction(tx)} className="group bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark hover:border-gray-300 dark:hover:border-border-dark/70 rounded-2xl p-4 flex items-center justify-between transition-all hover:bg-gray-50 dark:hover:bg-surface-darker relative shadow-card-light dark:shadow-none cursor-pointer">
                                    <div className="flex items-center gap-4">
                                        <div className={`size-12 rounded-full flex items-center justify-center border bg-opacity-10 dark:bg-opacity-10 ${style.colorClass}`}><span className="material-symbols-outlined text-xl">{style.icon}</span></div>
                                        <div className="flex flex-col">
                                            <p className="text-text-light-main dark:text-text-dark-main font-bold text-base group-hover:text-primary transition-colors">{tx.title}</p>
                                            <div className="flex gap-2 text-[10px] text-text-light-muted dark:text-text-dark-muted uppercase font-bold tracking-tight"><span>{formatDisplayDateShort(tx.date)}</span>{tx.note && <span className="opacity-50 truncate max-w-[150px] hidden sm:inline">• {tx.note}</span>}</div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <p className={`text-lg font-black tracking-tight ${tx.type === 'income' ? 'text-primary' : 'text-danger dark:text-red-400'}`}>{formatMoney(tx.type === 'income' ? tx.amount : -tx.amount, currencySymbol, { signed: true })}</p>
                                        <button onClick={(e) => { e.stopPropagation(); setDeleteId(tx.id); }} className="size-8 rounded-full bg-danger/10 text-danger flex items-center justify-center opacity-100 lg:opacity-0 lg:group-hover:opacity-100 lg:focus-within:opacity-100 lg:focus:opacity-100 transition-opacity hover:bg-danger hover:text-white" title="Delete Transaction"><span className="material-symbols-outlined text-[18px]">delete</span></button>
                                    </div>
                                </div>
                            );
                        })
                    ) : (
                        <div className="flex flex-col items-center justify-center py-12 text-text-light-muted dark:text-text-dark-muted bg-surface-light dark:bg-surface-dark rounded-[2rem] border border-border-light dark:border-border-dark">
                            <span className="material-symbols-outlined text-4xl mb-2 opacity-30">receipt_long</span>
                            <h3 className="text-lg font-bold text-text-light-main dark:text-text-dark-main mb-1">No transactions yet</h3>
                            <p className="text-sm opacity-70 mb-4">Start by adding your first income or expense.</p>
                        </div>
                    )}
                </div>
            </div>
          );
          default: return null;
      }
  };

  return (
    <div className="max-w-[1400px] mx-auto flex flex-col gap-8 p-4 md:p-6 lg:p-10 pb-20 overflow-visible relative">
   
     
      {isInstallable && (
        <button
          onClick={install}
          className="fixed bottom-10 right-6 z-[999]
                     bg-primary text-[#131811]
                     px-5 py-3 rounded-full
                     font-bold shadow-glow
                     hover:bg-primary-hover
                     active:scale-95 transition-all"
        >
          Install App
        </button>
    )}

      
      {/* Budget Goal Modal */}
      {editingTarget && ( <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in"> <div className="bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark rounded-3xl p-8 w-[90vw] max-w-[480px] shadow-2xl animate-slide-up"> <h3 className="text-xl font-bold text-text-light-main dark:text-text-dark-main mb-1">Set Monthly {editingTarget === 'income' ? 'Goal' : 'Limit'}</h3> <p className="text-sm text-text-light-muted dark:text-text-dark-muted mb-6">Update your base monthly target.</p> <div className="relative mb-6"> <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-lg text-text-light-muted dark:text-text-dark-muted">{currencySymbol}</span> <input type="number" value={targetInput} onChange={(e) => setTargetInput(e.target.value)} className="w-full bg-background-light dark:bg-surface-darker border border-border-light dark:border-border-dark rounded-xl p-4 pl-10 text-xl font-bold focus:border-primary outline-none" autoFocus /> </div> <div className="flex gap-3"> <button onClick={() => setEditingTarget(null)} className="flex-1 py-3 rounded-xl font-bold text-text-light-muted dark:text-text-dark-muted hover:bg-gray-100 dark:hover:bg-surface-darker transition-colors">Cancel</button> <button onClick={saveTarget} className="flex-1 py-3 rounded-xl font-bold bg-primary text-[#131811] hover:bg-primary-hover shadow-glow transition-colors">Save</button> </div> </div> </div> )}
      {/* Delete Confirmation */}
      {deleteId && (
        <div className="fixed inset-0 bg-black/60 z-[110] flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
          <div className="bg-surface-light dark:bg-surface-dark border border-danger/30 rounded-[2rem] sm:rounded-3xl p-6 sm:p-8 w-full max-w-[92%] sm:max-w-sm md:max-w-md lg:max-w-lg shadow-2xl animate-slide-up text-center">
            <div className="size-16 rounded-full bg-danger/10 flex items-center justify-center mx-auto mb-4">
              <span className="material-symbols-outlined text-3xl text-danger">delete_forever</span>
            </div>
            <h2 className="text-xl font-bold text-text-light-main dark:text-text-dark-main mb-2">Delete Transaction?</h2>
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={() => setDeleteId(null)}
                className="flex-1 py-3 sm:py-4 rounded-xl border border-border-light dark:border-border-dark text-text-light-main dark:text-text-dark-main hover:bg-gray-100 dark:hover:bg-surface-darker font-bold transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                className="flex-1 py-3 sm:py-4 rounded-xl bg-danger text-white hover:bg-red-600 font-bold transition-colors active:scale-[0.98]"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Widget Customization Modal */}
      {showWidgetEditor && ( <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm"> <div className="bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark rounded-3xl p-6 w-[calc(100vw-32px)] md:w-[80vw] lg:max-w-[400px] shadow-2xl animate-slide-up"><div className="flex justify-between items-center mb-4"> <h2 className="text-xl font-bold text-text-light-main dark:text-text-dark-main">Customize Bento</h2> <button onClick={() => setShowWidgetEditor(false)} className="text-text-light-muted dark:text-text-dark-muted hover:text-text-light-main dark:hover:text-text-dark-main"><span className="material-symbols-outlined">close</span></button> </div> <div className="flex flex-col gap-2 max-h-[50vh] overflow-y-auto custom-scrollbar mb-4"> {editorOrder.map((id, idx) => ( <div key={id} className={`flex items-center justify-between p-3 bg-background-light dark:bg-surface-darker rounded-xl border border-border-light dark:border-border-dark transition-opacity ${!widgets[id] ? 'opacity-60' : 'opacity-100'}`}> <div className="flex items-center gap-3"> <div className="flex flex-col gap-1"> <button onClick={() => handleEditorReorder(id, 'up')} disabled={idx === 0} className="size-7 flex items-center justify-center rounded-lg bg-gray-200 dark:bg-border-dark hover:bg-gray-300 dark:hover:bg-border-dark/80 disabled:opacity-20 transition-colors"><span className="material-symbols-outlined text-sm font-bold">keyboard_arrow_up</span></button> <button onClick={() => handleEditorReorder(id, 'down')} disabled={idx === editorOrder.length - 1} className="size-7 flex items-center justify-center rounded-lg bg-gray-200 dark:bg-border-dark hover:bg-gray-300 dark:hover:bg-border-dark/80 disabled:opacity-20 transition-colors"><span className="material-symbols-outlined text-sm font-bold">keyboard_arrow_down</span></button> </div> <span className="text-text-light-main dark:text-text-dark-main font-medium text-sm">{WIDGET_LABELS[id] || id}</span> </div> <button type="button" role="switch" aria-checked={!!widgets[id]} aria-label={`Show ${WIDGET_LABELS[id] || id}`} onClick={() => toggleWidget(id)} className={`w-12 h-6 rounded-full cursor-pointer relative transition-colors shrink-0 ${widgets[id] ? 'bg-primary' : 'bg-gray-300 dark:bg-border-dark'}`}><span className={`absolute top-1 size-4 bg-white rounded-full shadow-md transition-all ${widgets[id] ? 'left-7' : 'left-1'}`}></span></button> </div> ))} </div> <button onClick={handleSaveLayout} className="w-full py-3 bg-primary text-[#131811] font-bold rounded-xl shadow-glow hover:bg-primary-hover transition-colors">Save Layout</button> </div> </div> )}
      {/* CSV Import Modal */}
      {showImportModal && <CSVImportModal onClose={() => setShowImportModal(false)} />}

      {/* Export Modal */}
      {showExportModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
            <div className="bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark rounded-3xl p-8 w-full max-w-sm shadow-2xl animate-slide-up flex flex-col gap-6">
                <div className="flex flex-col items-center text-center gap-2">
                    <div className="size-16 rounded-full bg-primary/10 text-primary flex items-center justify-center mb-2 shadow-glow">
                        <span className="material-symbols-outlined text-3xl">download</span>
                    </div>
                    <h3 className="text-xl font-bold text-text-light-main dark:text-text-dark-main">Export Data</h3>
                    <p className="text-sm text-text-light-muted dark:text-text-dark-muted">Download your financial history as a CSV file for external analysis.</p>
                </div>
                
                <div className="flex flex-col gap-3">
                    <button onClick={() => handleExport(false)} className="w-full py-4 bg-gray-100 dark:bg-surface-darker hover:bg-gray-200 dark:hover:bg-border-dark text-text-light-main dark:text-text-dark-main font-bold rounded-xl transition-all flex items-center justify-center gap-3 border border-transparent hover:border-primary/30 group">
                        <span className="material-symbols-outlined text-primary group-hover:scale-110 transition-transform">calendar_view_month</span>
                        Export Current View
                    </button>
                    <button onClick={() => handleExport(true)} className="w-full py-4 bg-primary text-[#131811] font-bold rounded-xl shadow-glow hover:bg-primary-hover transition-all flex items-center justify-center gap-3 active:scale-[0.98]">
                        <span className="material-symbols-outlined">receipt_long</span>
                        Export All History
                    </button>
                </div>

                <button onClick={() => setShowExportModal(false)} className="text-xs font-bold text-text-light-muted dark:text-text-dark-muted uppercase tracking-widest hover:text-text-light-main dark:hover:text-text-dark-main transition-colors">Cancel</button>
            </div>
        </div>
      )}

      {/* AI Insight Modal */}
      {insightOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/70 backdrop-blur-xl p-4 pt-16 md:pt-20 overflow-y-auto">
          <div className="w-full max-w-2xl rounded-[2.5rem] bg-gradient-to-br from-[#0f172a] via-[#020617] to-[#020617] border border-white/10 shadow-[0_20px_80px_rgba(0,0,0,0.6)] p-6 md:p-8 flex flex-col gap-6 animate-slide-up mt-2">

            {/* HEADER */}
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                  <span className="material-symbols-outlined text-indigo-400">auto_awesome</span>
                  Gemini Insight
                </h3>
                <p className="text-xs text-white/60 mt-1">AI-generated financial insights</p>
              </div>
              <button onClick={() => setInsightOpen(false)} className="size-9 rounded-full hover:bg-white/10 flex items-center justify-center">
                <span className="material-symbols-outlined text-white/60">close</span>
              </button>
            </div>

            {/* CONTENT */}
            <div className="rounded-3xl bg-black/40 border border-white/10 p-5 flex flex-col gap-5 min-h-[260px]">

              {insightLoading ? (
                <div className="flex flex-col items-center justify-center h-full gap-4 text-indigo-400">
                  <div className="size-14 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin"></div>
                  <p className="text-xs uppercase tracking-widest animate-pulse">Analyzing your finances...</p>
                </div>
              ) : insightJson ? (

                <>
                  {/* STATUS */}
                  {insightJson.status && (
                    <div className="flex items-center justify-between bg-white/5 border border-white/10 rounded-2xl px-4 py-3">
                      <div className="flex items-center gap-3">
                        <span className="text-5xl">{insightJson.status.emoji}</span>
                        <div>
                          <p className="text-sm font-bold text-white">{insightJson.status.label}</p>
                          <p className="text-xs text-white/60">{insightJson.status.message}</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* SUMMARY */}
                  <div className="text-lg font-bold text-white leading-snug">
                    {insightJson.summary}
                  </div>

                  {/* METRICS */}
                  {insightJson.metrics && (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      {Object.entries(insightJson.metrics).map(([k, v]) => (
                        <div key={k} className="bg-white/5 border border-white/10 rounded-xl p-3">
                          <p className="text-[10px] uppercase text-white/50">{k}</p>
                          <p className="text-sm font-bold text-white mt-1">{String(v)}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* INSIGHTS */}
                  {insightJson.insights && (
                    <div className="flex flex-col gap-3">
                      {insightJson.insights.map((ins: any, idx: number) => (
                        <div key={idx} className="flex gap-3 p-4 bg-white/5 border border-white/10 rounded-xl">
                          <span className="text-xl">{ins.emoji}</span>
                          <div>
                            <p className="text-sm font-bold text-white">{ins.title}</p>
                            <p className="text-xs text-white/60">{ins.message}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* ACTIONS */}
                  {insightJson.actions && (
                    <div className="flex flex-wrap gap-2">
                      {insightJson.actions.map((act: any, idx: number) => (
                        <div key={idx} className="px-3 py-2 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-xs text-indigo-300 flex items-center gap-2">
                          <span>{act.emoji}</span>
                          {act.text}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* TONE */}
                  {insightJson.tone && (
                    <div className="text-xs text-white/50 italic border-t border-white/10 pt-3">
                      {insightJson.tone.one_liner || insightJson.tone.vibe}
                    </div>
                  )}

                  {insightParseError && (
                    <div className="text-xs text-red-300">{insightParseError}</div>
                  )}

                  {/* Secondary actions: copy/export JSON */}
                  <div className="flex flex-wrap gap-2 mt-4">
                    <button
                      onClick={copyInsightJson}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="#999999"><path d="M120-220v-80h80v80h-80Zm0-140v-80h80v80h-80Zm0-140v-80h80v80h-80ZM260-80v-80h80v80h-80Zm100-160q-33 0-56.5-23.5T280-320v-480q0-33 23.5-56.5T360-880h360q33 0 56.5 23.5T800-800v480q0 33-23.5 56.5T720-240H360Zm0-80h360v-480H360v480Zm40 240v-80h80v80h-80Zm-200 0q-33 0-56.5-23.5T120-160h80v80Zm340 0v-80h80q0 33-23.5 56.5T540-80ZM120-640q0-33 23.5-56.5T200-720v80h-80Zm420 80Z"/></svg>
                    </button>
                    <button
                      onClick={exportInsightJson}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="#999999"><path d="M440-320v-326L336-542l-56-58 200-200 200 200-56 58-104-104v326h-80ZM240-160q-33 0-56.5-23.5T160-240v-120h80v120h480v-120h80v120q0 33-23.5 56.5T720-160H240Z"/></svg>

                    </button>
                  </div>
                </>

              ) : insightText ? (
                <div className="text-sm text-white/70 whitespace-pre-line">
                  {insightText}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center text-center text-white/40 h-full">
                  <span className="material-symbols-outlined text-4xl mb-2">analytics</span>
                  <p className="text-sm font-bold">Generate AI Insight</p>
                </div>
              )}
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleInsight}
                disabled={insightLoading}
                className="flex-1 py-3 rounded-xl bg-indigo-500 text-white font-bold text-xs uppercase tracking-widest hover:bg-indigo-400 transition-all"
              >
                {insightLoading ? "Analyzing..." : "Generate"}
              </button>

              <button
                onClick={resetInsight}
                className="flex-1 py-3 rounded-xl border border-white/10 text-white/60 text-xs font-bold uppercase hover:bg-white/5"
              >
                Back
              </button>
            </div>

          </div>
        </div>
      )}
      
      {/* Header Toolbar */}
      <div className="flex flex-row justify-between items-center gap-4 animate-slide-up relative z-20 mb-2">
        <div className="flex flex-col gap-1">
          <h5 className="text-text-light-main dark:text-text-dark-main text-3xl lg:text-5xl font-black tracking-tight leading-tight">Dashboard</h5>

        </div>
        <div className="flex justify-end items-center gap-2">
          <button onClick={() => { setInsightOpen(true); resetInsight(); handleInsight(); }} className="flex items-center justify-center size-10 rounded-full bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark text-text-light-muted dark:text-text-dark-muted hover:text-primary hover:border-primary transition-all duration-200 ease-out shadow-sm relative overflow-hidden hover:scale-[1.05] active:scale-[0.95]" title="Gemini Neural Insight">
            <span className="material-symbols-outlined text-[22px]">magic_button</span>
          </button>
          <button onClick={() => setShowNotifications(true)} aria-label={`Notifications${unreadNotifications ? `, ${unreadNotifications} unread` : ''}`} className="relative flex items-center justify-center size-10 rounded-full bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark text-text-light-muted dark:text-text-dark-muted hover:text-primary hover:border-primary transition-all duration-200 ease-out shadow-sm relative overflow-hidden hover:scale-[1.05] active:scale-[0.95]" title="Notifications">
            <span className="material-symbols-outlined text-[22px]">notifications</span>
            {unreadNotifications > 0 && (
              <span key={unreadNotifications} className="absolute -top-1 -right-1 min-w-5 h-5 px-1 rounded-full bg-rose-500 text-white text-[10px] font-black flex items-center justify-center border-2 border-background-light dark:border-background-dark animate-pop">
                {unreadNotifications > 9 ? '9+' : unreadNotifications}
              </span>
            )}
          </button>


        
          <div className="hidden md:flex items-center gap-2 bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark rounded-full p-1.5 shadow-sm">
            <button onClick={() => toggleTheme()} className="flex items-center gap-2 px-3 py-2 rounded-full hover:bg-gray-100 dark:hover:bg-surface-darker transition-colors text-text-light-muted dark:text-text-dark-muted hover:text-primary"><span className="material-symbols-outlined text-[20px]">{userSettings?.theme === 'light' ? 'dark_mode' : 'light_mode'}</span><span className="hidden lg:inline text-sm font-bold">Theme</span></button>
            <div className="w-px h-5 bg-border-light dark:bg-border-dark"></div>
            <button onClick={() => setShowExportModal(true)} className="flex items-center gap-2 px-3 py-2 rounded-full hover:bg-gray-100 dark:hover:bg-surface-darker transition-colors text-text-light-muted dark:text-text-dark-muted hover:text-primary"><span className="material-symbols-outlined text-[20px]">download</span><span className="hidden lg:inline text-sm font-bold">Export</span></button>
            <div className="w-px h-5 bg-border-light dark:bg-border-dark"></div>
            <button onClick={() => setShowImportModal(true)} className="flex items-center gap-2 px-3 py-2 rounded-full hover:bg-gray-100 dark:hover:bg-surface-darker transition-colors text-text-light-muted dark:text-text-dark-muted hover:text-primary" title="Import CSV"><span className="material-symbols-outlined text-[20px]">upload_file</span><span className="hidden lg:inline text-sm font-bold">Import</span></button>
            <div className="w-px h-5 bg-border-light dark:bg-border-dark"></div>
            <button onClick={() => setShowWidgetEditor(true)} className="flex items-center gap-2 px-3 py-2 rounded-full hover:bg-gray-100 dark:hover:bg-surface-darker transition-colors text-text-light-muted dark:text-text-dark-muted hover:text-primary"><span className="material-symbols-outlined text-[20px]">edit</span><span className="hidden lg:inline text-sm font-bold">Customize</span></button>
          </div>
          <div className="md:hidden relative">
            <button onClick={() => setShowMobileHeaderMenu(!showMobileHeaderMenu)} className="flex items-center justify-center size-8 rounded-full bg-surface-light dark:bg-surface-dark text-text-light-muted dark:text-text-dark-muted border border-border-light dark:border-border-dark hover:text-primary transition-all shadow-sm active:scale-95"><span className="material-symbols-outlined text-[18px]">more_vert</span></button>
            {showMobileHeaderMenu && (
              <div className="absolute right-0 top-10 bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark rounded-2xl shadow-xl p-2 flex flex-col gap-1 min-w-[160px] z-50 animate-fade-in">
                <button onClick={() => { toggleTheme(); setShowMobileHeaderMenu(false); }} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-100 dark:hover:bg-surface-darker rounded-xl text-sm font-bold text-text-light-main dark:text-text-dark-main"><span className="material-symbols-outlined text-[20px]">{userSettings?.theme === 'light' ? 'dark_mode' : 'light_mode'}</span> Theme</button>
                <button onClick={() => { setShowExportModal(true); setShowMobileHeaderMenu(false); }} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-100 dark:hover:bg-surface-darker rounded-xl text-sm font-bold text-text-light-main dark:text-text-dark-main"><span className="material-symbols-outlined text-[20px]">download</span> Export</button>
                <button onClick={() => { setShowImportModal(true); setShowMobileHeaderMenu(false); }} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-100 dark:hover:bg-surface-darker rounded-xl text-sm font-bold text-text-light-main dark:text-text-dark-main"><span className="material-symbols-outlined text-[20px]">upload_file</span> Import CSV</button>
                <button onClick={lockApp} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-100 dark:hover:bg-surface-darker rounded-xl text-sm font-bold text-text-light-main dark:text-text-dark-main"><span className="material-symbols-outlined text-[20px]">lock</span> App lock</button>
                <button onClick={() => { setShowWidgetEditor(true); setShowMobileHeaderMenu(false); }} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-100 dark:hover:bg-surface-darker rounded-xl text-sm font-bold text-text-light-main dark:text-text-dark-main"><span className="material-symbols-outlined text-[20px]">edit</span> Customize</button>
              </div>
            )}
          </div>

            {/* Mobile Profile Avatar */}
          <button
            onClick={() => navigate(ROUTES.SETTINGS)}
            className="md:hidden relative ml-1 active:scale-95 transition-transform"
          >
            <img
              src={userSettings?.avatar && userSettings.avatar.trim() !== '' ? userSettings.avatar : '/public/avatar-placeholder.png'}
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).src = '/avatar-placeholder.png';
              }}
              alt="Profile"
              className="size-10 rounded-full object-cover
                         border-2 border-primary/90
                         shadow-md"
            />
            
          </button>
        </div>
      </div>
      

      {/* Welcome Message */}
      <div className="mb-2 animate-slide-up mt-4"> <div className="flex items-center flex-wrap gap-x-4 gap-y-2 mb-3"> <h1 className="text-5xl md:text-6xl font-black text-text-light-main dark:text-text-dark-main tracking-tight leading-none"> Hello, <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-emerald-600">{userSettings?.displayName?.split(' ')[0] || "Guest"}</span> </h1> </div> <p className="text-xxl font-small text-text-light-muted dark:text-text-dark-muted">{monthSummary}</p> </div>
      
      {/* Widget Grid */}
      <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-12 gap-6 animate-slide-up delay-100"> 
        {widgetOrder.map(key => (
            <React.Fragment key={key}>
                {renderWidget(key)}
            </React.Fragment>
        ))}
      </div>

      {showNotifications && <NotificationsPanel onClose={() => setShowNotifications(false)} />}
    </div>
  );
};

export default DashboardScreen;

