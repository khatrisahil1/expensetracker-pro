
import React, { useState, useMemo, useEffect } from 'react';
import { DotLottieReact } from "@lottiefiles/dotlottie-react";

import { useStore, Transaction } from '../context/Store';
import { View } from '../types';

interface DashboardScreenProps {
    onNavigate?: (view: View) => void;
}

// Widget Configuration Maps
const WIDGET_LABELS: Record<string, string> = {
    streak: "Streak",
    balance: "Balance",
    income: "Income",
    expense: "Expenses",
    breakdown: "Breakdown",
    recent: "Recent Transactions",
    quickAdd: "Quick Add"
};

// Styling map for categories
const CATEGORY_STYLES: Record<string, { icon: string, colorClass: string, hex: string }> = {
    "Food": { icon: "restaurant", colorClass: "text-orange-500 bg-orange-500/10 border-orange-500/20", hex: "#f97316" },
    "Housing": { icon: "home", colorClass: "text-blue-500 bg-blue-500/10 border-blue-500/20", hex: "#3b82f6" },
    "Rent": { icon: "real_estate_agent", colorClass: "text-indigo-400 bg-indigo-400/10 border-indigo-400/20", hex: "#818cf8" },
    "Transportation": { icon: "directions_car", colorClass: "text-purple-500 bg-purple-500/10 border-purple-500/20", hex: "#a855f7" },
    "Entertainment": { icon: "movie", colorClass: "text-pink-500 bg-pink-500/10 border-pink-500/20", hex: "#ec4899" },
    "Shopping": { icon: "shopping_bag", colorClass: "text-yellow-500 bg-yellow-500/10 border-yellow-500/20", hex: "#eab308" },
    "Health": { icon: "medical_services", colorClass: "text-red-400 bg-red-400/10 border-red-400/20", hex: "#f87171" },
    "Utilities": { icon: "bolt", colorClass: "text-cyan-400 bg-cyan-400/10 border-cyan-400/20", hex: "#22d3ee" },
    "Salary": { icon: "payments", colorClass: "text-emerald-500 bg-emerald-500/10 border-emerald-500/20", hex: "#10b981" },
    "Freelance": { icon: "work", colorClass: "text-cyan-500 bg-cyan-500/10 border-cyan-500/20", hex: "#06b6d4" },
    "Investments": { icon: "trending_up", colorClass: "text-violet-500 bg-violet-500/10 border-violet-500/20", hex: "#8b5cf6" },
    "Gifts": { icon: "card_giftcard", colorClass: "text-pink-400 bg-pink-400/10 border-pink-400/20", hex: "#f472b6" },
    "Refunds": { icon: "currency_exchange", colorClass: "text-amber-500 bg-amber-500/10 border-amber-500/20", hex: "#f59e0b" },
    "Rental": { icon: "house", colorClass: "text-blue-400 bg-blue-400/10 border-blue-400/20", hex: "#60a5fa" },
    "Other": { icon: "receipt", colorClass: "text-gray-400 bg-gray-400/10 border-gray-400/20", hex: "#9ca3af" }
};

const EXPENSE_CATEGORIES = ["Food", "Housing", "Rent", "Transportation", "Entertainment", "Shopping", "Health", "Utilities", "Other"];
const INCOME_CATEGORIES = ["Salary", "Freelance", "Investments", "Gifts", "Refunds", "Rental", "Other"];

// Helper: Short Date Format
const formatDisplayDateShort = (dateStr: string) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
};

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

// Component: Visual Badge for Streak (Lottie-based, React-native)
export const StreakVisual: React.FC<{ count: number }> = ({ count }) => {
  const tier = getStreakTier(count);

  const lottieMap: Record<StreakTier, string> = {
    single: "https://lottie.host/bd4943b7-a504-4f64-a6ae-72ce6a96dfa2/7v4kl3Ndl7.lottie",
    stack:  "https://lottie.host/a9c83fe1-5340-40ae-8b8c-f1ad8312aa63/8fEsa8IE7w.lottie",
    bag:    "https://lottie.host/78d6f6bf-836d-4e79-98b1-15297e5431b4/pWjfsPi4dq.lottie",
    reward: "https://lottie.host/08d2cad2-35de-4cf4-94b3-7e20923a3ca6/5hOQzGfL1Z.lottie",
    vault:  "https://lottie.host/dacd1761-1fdb-4c67-a1d7-dce9f7098a68/fauCFJWZYw.lottie",
    legend: "hhttps://lottie.host/5f2a8771-51dc-426b-a826-e4fc0a30f75f/kvcqD0l4xL.lottie",
  };

  return (
    <div className="w-full h-full flex items-center justify-center">
      <DotLottieReact
        src={lottieMap[tier]}
        autoplay
        loop={tier !== "legend"} 
        className="w-40 h-40 md:w-52 md:h-52 drop-shadow-2xl"
      />
    </div>
  );
};

// Component: SVG Donut Chart
// Renders SVG arcs based on data percentage
const DonutChart: React.FC<{ data: Record<string, number>, total: number, currencySymbol: string, change?: number, label: string, className?: string, isExpense?: boolean }> = ({ data, total, currencySymbol, change = 0, label, className = "size-80", isExpense = true }) => {
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
                {!hovered && change !== undefined && total > 0 && (<span className={`text-xs font-bold mt-1 flex items-center gap-1 ${isBad ? 'text-danger' : 'text-primary'}`}><span className="material-symbols-outlined text-xs font-bold">{(change ?? 0) >= 0 ? 'arrow_upward' : 'arrow_downward'}</span>{Math.abs(change).toFixed(0)}%</span>)}
            </div>
        </div>
    );
};

// Component: Simple Wave Graph for Balance Widget
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
        <svg viewBox="0 0 100 100" className="w-full h-full opacity-30" preserveAspectRatio="none">
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
const DashboardScreen: React.FC<DashboardScreenProps> = ({ onNavigate }) => {
  const { user, userSettings, transactions, addTransaction, deleteTransaction, restoreTransaction, loading, toggleTheme, widgets, toggleWidget, widgetOrder, updateWidgetOrder, setViewingTransaction, updateUserSettings, lockApp, showUndo } = useStore();

  // Local State
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [dashboardViewMode, setDashboardViewMode] = useState<'week' | 'month' | 'year'>('month');
  const [dashboardDate, setDashboardDate] = useState(new Date());
  
  // UI Toggles
  const [showExportModal, setShowExportModal] = useState(false);
  const [showWidgetEditor, setShowWidgetEditor] = useState(false);
  const [editorOrder, setEditorOrder] = useState<string[]>([]);
  const [showMobileHeaderMenu, setShowMobileHeaderMenu] = useState(false);
  const [editingTarget, setEditingTarget] = useState<'income' | 'expense' | null>(null);
  const [targetInput, setTargetInput] = useState('');
  const [showNotifDropdown, setShowNotifDropdown] = useState(false);
  
  // Quick Add Form State
  const [breakdownType, setBreakdownType] = useState<'income' | 'expense'>('expense');
  const [formData, setFormData] = useState({
    title: '', amount: '', date: new Date().toISOString().split('T')[0],
    category: 'Food', type: 'expense' as 'income' | 'expense', paymentMethod: 'UPI', note: '', tags: ''
  });
  const [isAdding, setIsAdding] = useState(false);
  const [notifications, setNotifications] = useState([
      { id: 1, title: 'Daily Reminder', msg: "Don't forget to add your today's expenses!", time: '10:30 AM', icon: 'edit_note', read: false },
      { id: 2, title: 'Monthly Report', msg: "Your January report is ready to view.", time: 'Yesterday', icon: 'pie_chart', read: false },
      { id: 3, title: 'Impulse Vault', msg: "2 items are ready to review.", time: '2d ago', icon: 'lock_open', read: true }
  ]);
  const [activeToast, setActiveToast] = useState<string | null>(null);

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

  const unreadCount = notifications.filter(n => !n.read).length;
  const currencySymbol = userSettings?.currency === 'USD' ? '$' : userSettings?.currency === 'EUR' ? '€' : '₹';

  // --- DATA AGGREGATION & MEMOIZATION ---
  // Calculates start/end dates for current view mode (Week/Month/Year)
  const { periodStart, periodEnd } = useMemo(() => {
      const d = new Date(dashboardDate); const start = new Date(d); const end = new Date(d);
      if (dashboardViewMode === 'week') {
          const day = d.getDay(); const diff = d.getDate() - day + (day === 0 ? -6 : 1); 
          start.setDate(diff); start.setHours(0,0,0,0); end.setDate(start.getDate() + 6); end.setHours(23,59,59,999);
      } else if (dashboardViewMode === 'month') {
          start.setDate(1); start.setHours(0,0,0,0); end.setMonth(start.getMonth() + 1); end.setDate(0); end.setHours(23,59,59,999);
      } else {
          start.setMonth(0, 1); start.setHours(0,0,0,0); end.setFullYear(start.getFullYear() + 1); end.setMonth(0, 0); end.setHours(23,59,59,999);
      }
      return { periodStart: start, periodEnd: end };
  }, [dashboardDate, dashboardViewMode]);

  // Filter transactions based on calculated period
  const filteredTransactions = useMemo(() => {
      return transactions.filter(t => {
          const d = new Date(t.date); return d >= periodStart && d <= periodEnd;
      }).sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [transactions, periodStart, periodEnd]);

  // Compute Income/Expense Totals
  const periodStats = useMemo(() => {
      let income = 0; let expense = 0;
      filteredTransactions.forEach(t => {
          if (t.type === 'income') income += t.amount; else expense += t.amount;
      });
      return { income, expense, balance: income - expense };
  }, [filteredTransactions]);

  // Compute Previous Period for comparison percentages
  const previousPeriodStats = useMemo(() => {
      const d = new Date(dashboardDate); let start = new Date(d); let end = new Date(d);
      if (dashboardViewMode === 'week') {
          const day = d.getDay(); const diff = d.getDate() - day + (day === 0 ? -6 : 1); 
          start.setDate(diff - 7); start.setHours(0,0,0,0); end.setDate(start.getDate() + 6); end.setHours(23,59,59,999);
      } else if (dashboardViewMode === 'month') {
          start.setDate(1); start.setMonth(start.getMonth() - 1); start.setHours(0,0,0,0);
          end = new Date(start); end.setMonth(start.getMonth() + 1); end.setDate(0); end.setHours(23,59,59,999);
      } else {
          start.setFullYear(start.getFullYear() - 1); start.setMonth(0, 1); start.setHours(0,0,0,0);
          end.setFullYear(start.getFullYear()); end.setMonth(11, 31); end.setHours(23,59,59,999);
      }
      const prevTx = transactions.filter(t => {
          const tDate = new Date(t.date); return tDate >= start && tDate <= end;
      });
      let income = 0; let expense = 0;
      prevTx.forEach(t => {
          if (t.type === 'income') income += t.amount; else expense += t.amount;
      });
      return { income, expense, balance: income - expense };
  }, [transactions, dashboardViewMode, dashboardDate]);

  // Compute Points for Wave Graph
  const graphData = useMemo(() => {
      const points: number[] = [];
      if (dashboardViewMode === 'year') {
          const yearStart = periodStart.getFullYear();
          for (let i = 0; i < 12; i++) {
              const monthlyNet = transactions.filter(t => { const d = new Date(t.date); return d.getFullYear() === yearStart && d.getMonth() === i; }).reduce((acc, t) => acc + (t.type === 'income' ? t.amount : -t.amount), 0);
              const prev = points.length > 0 ? points[points.length - 1] : 0; points.push(prev + monthlyNet);
          }
      } else {
          const map = new Map<string, number>(); filteredTransactions.forEach(t => { const d = t.date; const val = t.type === 'income' ? t.amount : -t.amount; map.set(d, (map.get(d) || 0) + val); });
          let runningBalance = 0; 
          if (dashboardViewMode === 'week') {
              for (let i=0; i<7; i++) {
                  const d = new Date(periodStart); d.setDate(periodStart.getDate() + i); const dateStr = d.toISOString().split('T')[0]; const net = map.get(dateStr) || 0; runningBalance += net; points.push(runningBalance);
              }
          } else {
              const daysInMonth = new Date(periodStart.getFullYear(), periodStart.getMonth() + 1, 0).getDate();
              for (let d = 1; d <= daysInMonth; d++) {
                   const dateObj = new Date(periodStart.getFullYear(), periodStart.getMonth(), d); if (dateObj > new Date()) break;
                   const dateStr = dateObj.toISOString().split('T')[0]; const net = map.get(dateStr) || 0; runningBalance += net; points.push(runningBalance);
              }
          }
      }
      if (points.length === 1) points.push(points[0]); if (points.length === 0) return [0, 0, 0]; return points;
  }, [filteredTransactions, dashboardViewMode, transactions, periodStart]);

  // Targets for progress bars
  const targets = useMemo(() => {
      const baseIncome = userSettings?.monthlyIncomeGoal || 1; const baseExpense = userSettings?.monthlyExpenseLimit || 1;
      let multiplier = 1; if (dashboardViewMode === 'week') multiplier = 0.25; if (dashboardViewMode === 'year') multiplier = 12;
      return { income: baseIncome * multiplier, expense: baseExpense * multiplier };
  }, [userSettings, dashboardViewMode]);

  // Breakdown Chart Data
  const breakdownStats = useMemo(() => {
      const stats: Record<string, number> = {}; let total = 0;
      filteredTransactions.forEach(t => { if (t.type === breakdownType) { stats[t.category] = (stats[t.category] || 0) + t.amount; total += t.amount; } });
      const sorted = Object.entries(stats).sort(([,a], [,b]) => b - a);
      const top5 = sorted.slice(0, 5); const otherVal = sorted.slice(5).reduce((sum, [,v]) => sum + v, 0);
      const displayData: Record<string, number> = {}; top5.forEach(([k,v]) => displayData[k] = v); if (otherVal > 0) displayData['Other'] = otherVal;
      const legends = Object.entries(displayData).map(([cat, val]) => ({ name: cat, value: val, percent: total > 0 ? (val / total * 100).toFixed(1) : '0', color: CATEGORY_STYLES[cat]?.hex || '#9ca3af' })).sort((a,b) => b.value - a.value);
      return { data: displayData, total, legends };
  }, [filteredTransactions, breakdownType]);

  // Streak Calculation (Consecutive days with activity)
  const streakCount = useMemo(() => {
      if (transactions.length === 0) return 0;
      const uniqueDates = Array.from(new Set(transactions.map(t => t.date))).sort((a: any, b: any) => new Date(b).getTime() - new Date(a).getTime());
      const today = new Date().toISOString().split('T')[0]; const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
      if (!uniqueDates.includes(today) && !uniqueDates.includes(yesterday)) return 0;
      let count = 0; let checkDate = new Date(); if (!uniqueDates.includes(today)) checkDate.setDate(checkDate.getDate() - 1);
      while (true) { const dateStr = checkDate.toISOString().split('T')[0]; if (uniqueDates.includes(dateStr)) { count++; checkDate.setDate(checkDate.getDate() - 1); } else break; }
      return count;
  }, [transactions]);

  // Navigation Logic
  const handleDateNavigate = (direction: 'prev' | 'next') => {
      const newDate = new Date(dashboardDate);
      if (dashboardViewMode === 'week') newDate.setDate(newDate.getDate() + (direction === 'next' ? 7 : -7));
      if (dashboardViewMode === 'month') newDate.setMonth(newDate.getMonth() + (direction === 'next' ? 1 : -1));
      if (dashboardViewMode === 'year') newDate.setFullYear(newDate.getFullYear() + (direction === 'next' ? 1 : -1));
      setDashboardDate(newDate);
  };

  // Bento Box Layout Logic
  const handleEditorReorder = (key: string, direction: 'up' | 'down') => {
      const idx = editorOrder.indexOf(key); if (idx === -1) return;
      const newOrder = [...editorOrder]; if (direction === 'up' && idx > 0) [newOrder[idx], newOrder[idx - 1]] = [newOrder[idx - 1], newOrder[idx]];
      else if (direction === 'down' && idx < newOrder.length - 1) [newOrder[idx], newOrder[idx + 1]] = [newOrder[idx + 1], newOrder[idx]];
      setEditorOrder(newOrder);
  };

  const handleSaveLayout = () => { updateWidgetOrder(editorOrder); setShowWidgetEditor(false); };
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => { const { name, value } = e.target; setFormData(prev => ({ ...prev, [name]: value })); };
  const handleTypeChange = (type: 'income' | 'expense') => { setFormData(prev => ({ ...prev, type, category: type === 'income' ? INCOME_CATEGORIES[0] : EXPENSE_CATEGORIES[0] })); };

  const handleAddTransaction = async () => {
    if (!formData.title.trim() || !formData.amount) { alert("Please fill description and amount."); return; }
    const amount = parseFloat(formData.amount);
    if (isNaN(amount) || amount <= 0) { alert("Please enter valid amount."); return; }
    setIsAdding(true);
    try {
        let tags: string[] = formData.tags ? formData.tags.split(',').map(t => t.trim()).filter(t => t.length > 0) : [];
        await addTransaction({ title: formData.title, amount: amount, date: formData.date, category: formData.category, type: formData.type, note: formData.note, tags: tags, paymentMethod: formData.paymentMethod });
        setFormData({ title: '', amount: '', date: new Date().toISOString().split('T')[0], category: formData.type === 'income' ? INCOME_CATEGORIES[0] : EXPENSE_CATEGORIES[0], type: formData.type, paymentMethod: userSettings?.paymentMethods[0] || 'UPI', note: '', tags: '' });
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

  // Export Logic: Generates CSV blob from current data
  const handleExport = (allTime: boolean = false) => {
      const dataToExport = allTime ? transactions : filteredTransactions;
      const headers = ['Date', 'Title', 'Amount', 'Type', 'Category', 'Method', 'Note'];
      const csvContent = [
          headers.join(','),
          ...dataToExport.map(tx => {
              const escape = (str: string | undefined) => `"${(str || '').replace(/"/g, '""')}"`;
              return [
                  tx.date, 
                  escape(tx.title), 
                  tx.amount, 
                  tx.type, 
                  tx.category, 
                  escape(tx.paymentMethod),
                  escape(tx.note)
              ].join(',');
          })
      ].join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `transactions_${allTime ? 'full' : 'view'}_export.csv`;
      a.click();
      setShowExportModal(false);
  };

  const formatCompact = (val: number) => { if(val >= 1000000) return `${(val/1000000).toFixed(1)}M`; if(val >= 1000) return `${(val/1000).toFixed(1)}k`; return val.toLocaleString('en-IN', { maximumFractionDigits: 0 }); };
  const filteredList = transactions.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 5);

  // Widget Renderer: Dynamically renders components based on key
  const renderWidget = (key: string) => {
      if (!widgets[key]) return null;
      switch(key) {
          case 'streak': return (
            <div className="col-span-2 md:col-span-1 lg:col-span-3 bg-gradient-to-br from-[#FFFBEB] to-[#FEF3C7] dark:from-[#2a1c05] dark:to-[#1a1306] border border-yellow-200 dark:border-yellow-900/30 rounded-[2.5rem] p-6 relative overflow-hidden shadow-card-light dark:shadow-glow flex flex-col items-center justify-center group min-h-[300px]">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-32 bg-yellow-400/20 rounded-full blur-3xl group-hover:bg-yellow-400/30 transition-all duration-700"></div>
                <div className="flex flex-col items-center z-10 mb-4">
                    <span className="text-yellow-700 dark:text-yellow-400 font-bold uppercase tracking-widest text-xs mb-1">Current Streak</span>
                    <h3 className="text-5xl font-black text-yellow-900 dark:text-yellow-100 tabular-nums leading-none drop-shadow-sm">{streakCount}<span className="text-2xl text-yellow-600 dark:text-yellow-500/80 ml-1">days</span></h3>
                </div>
                <div className="w-40 h-40 relative z-10 transform transition-transform duration-500 group-hover:scale-110"><StreakVisual count={streakCount} /></div>
                <div className="z-10 mt-4 text-center"><p className="text-yellow-800 dark:text-yellow-200/70 text-sm font-medium">{streakCount === 0 ? "Start a streak today!" : "Keep the momentum going!"}</p></div>
            </div>
          );
          case 'balance': 
            const balanceChange = previousPeriodStats.balance !== 0 ? ((periodStats.balance - previousPeriodStats.balance) / Math.abs(previousPeriodStats.balance)) * 100 : 0;
            return ( <div className="col-span-4 md:col-span-2 lg:col-span-12 bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark rounded-[2.5rem] p-8 relative overflow-hidden flex flex-col justify-between min-h-[300px] shadow-card-light dark:shadow-glow transition-all hover:scale-[1.005]"> {loading ? <Skeleton className="h-full w-full"/> : ( <> <div className="flex flex-row justify-between items-start gap-4 relative z-10"> <div className="flex flex-col gap-4"> <div className="flex items-center gap-2"> <span className="material-symbols-outlined text-[#3b82f6] text-xl">account_balance</span> <span className="text-[#3b82f6] font-bold text-base tracking-wide">Total Balance</span> </div> <h2 className="text-5xl lg:text-7xl font-black text-text-light-main dark:text-text-dark-main tracking-tight leading-none"> {currencySymbol}{periodStats.balance.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} </h2> <div className="flex items-center gap-2 mt-1"> <span className={`px-2 py-1 rounded-md text-xs font-bold ${balanceChange >= 0 ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'}`}> {balanceChange >= 0 ? '↗' : '↘'} {Math.abs(balanceChange).toFixed(1)}% </span> <span className="text-text-light-muted dark:text-text-dark-muted text-sm font-medium">vs last {dashboardViewMode}</span> </div> </div> <div className="hidden sm:flex p-1 bg-gray-100 dark:bg-surface-darker rounded-full border border-border-light dark:border-border-dark self-start"> {['week', 'month', 'year'].map(m => ( <button key={m} onClick={() => setDashboardViewMode(m as any)} className={`px-4 py-1.5 rounded-full text-xs font-bold capitalize transition-all ${dashboardViewMode === m ? 'bg-white dark:bg-surface-dark text-text-light-main dark:text-text-dark-main shadow-sm' : 'text-text-light-muted dark:text-text-dark-muted hover:text-primary'}`} > {m} </button> ))} </div> <button onClick={() => setDashboardViewMode(dashboardViewMode === 'week' ? 'month' : dashboardViewMode === 'month' ? 'year' : 'week')} className="sm:hidden px-4 py-2 bg-gray-100 dark:bg-surface-darker border border-border-light dark:border-border-dark rounded-full text-xs font-bold capitalize text-text-light-main dark:text-text-dark-main shadow-sm self-start" > {dashboardViewMode} </button> </div> <div className="absolute bottom-0 left-0 w-full h-32 pointer-events-none"> <RealWaveGraph data={graphData} color="#2ECC71" /> </div> </> )} </div> );
          case 'income': return ( <div onClick={() => handleEditTarget('income')} className="col-span-1 lg:col-span-3 bg-surface-light dark:bg-surface-dark rounded-[2rem] lg:rounded-[2.5rem] p-5 lg:p-8 border border-border-light dark:border-border-dark flex flex-col justify-between shadow-card-light dark:shadow-card relative group min-h-[180px] lg:min-h-[240px] cursor-pointer" > {loading ? <Skeleton className="h-full w-full"/> : ( <> <div className="flex justify-between items-start"> <div className="size-10 lg:size-12 rounded-full border border-gray-200 dark:border-border-dark hidden md:flex items-center justify-center text-text-light-main dark:text-text-dark-main mb-2 lg:mb-4 group-hover:scale-110 transition-transform"> <span className="material-symbols-outlined text-lg lg:text-2xl text-primary">south_west</span> </div> <span className="hidden lg:block text-xs font-bold text-text-light-muted dark:text-text-dark-muted uppercase bg-gray-100 dark:bg-surface-darker px-2 py-1 rounded-md">{dashboardViewMode}ly</span> </div> <div> <span className="text-text-light-muted dark:text-text-dark-muted text-[10px] lg:text-xs font-bold uppercase tracking-wider">Total Income</span> <span className="block text-xl lg:text-4xl font-black text-primary tracking-tight mt-1 lg:mt-1">+{formatCompact(periodStats.income)}</span> </div> <div className="mt-4 lg:mt-6"> <div className="flex justify-between text-[10px] font-bold text-text-light-muted dark:text-text-dark-muted mb-1 uppercase tracking-wider"> <span className="flex items-center gap-1 truncate max-w-[80px] lg:max-w-none">Target: {formatCompact(targets.income)}</span> <span>{Math.min((periodStats.income / targets.income) * 100, 100).toFixed(0)}%</span> </div> <div className="h-1.5 lg:h-2 w-full bg-gray-100 dark:bg-black/20 rounded-full overflow-hidden"> <div className="h-full bg-primary rounded-full transition-all duration-1000 ease-out" style={{width: `${Math.min((periodStats.income / targets.income) * 100, 100)}%`}}></div> </div> </div> </> )} </div> );
          case 'expense': return ( <div onClick={() => handleEditTarget('expense')} className="col-span-1 lg:col-span-3 bg-surface-light dark:bg-surface-dark rounded-[2rem] lg:rounded-[2.5rem] p-5 lg:p-8 border border-border-light dark:border-border-dark flex flex-col justify-between shadow-card-light dark:shadow-card relative group min-h-[180px] lg:min-h-[240px] cursor-pointer" > {loading ? <Skeleton className="h-full w-full"/> : ( <> <div className="flex justify-between items-start"> <div className="size-10 lg:size-12 rounded-full border border-gray-200 dark:border-border-dark hidden md:flex items-center justify-center text-text-light-main dark:text-text-dark-main mb-2 lg:mb-4 group-hover:scale-110 transition-transform"> <span className="material-symbols-outlined text-lg lg:text-2xl text-danger">north_east</span> </div> <span className="hidden lg:block text-xs font-bold text-text-light-muted dark:text-text-dark-muted uppercase bg-gray-100 dark:bg-surface-darker px-2 py-1 rounded-md">{dashboardViewMode}ly</span> </div> <div> <span className="text-text-light-muted dark:text-text-dark-muted text-[10px] lg:text-xs font-bold uppercase tracking-wider">Total Expenses</span> <span className="block text-xl lg:text-4xl font-black text-danger tracking-tight mt-1 lg:mt-1">-{formatCompact(periodStats.expense)}</span> </div> <div className="mt-4 lg:mt-6"> <div className="flex justify-between text-[10px] font-bold text-text-light-muted dark:text-text-dark-muted mb-1 uppercase tracking-wider"> <span className="flex items-center gap-1 truncate max-w-[80px] lg:max-w-none">Limit: {formatCompact(targets.expense)}</span> <span>{Math.min((periodStats.expense / targets.expense) * 100, 100).toFixed(0)}%</span> </div> <div className="h-1.5 lg:h-2 w-full bg-gray-100 dark:bg-black/20 rounded-full overflow-hidden"> <div className="h-full bg-danger rounded-full transition-all duration-1000 ease-out" style={{width: `${Math.min((periodStats.expense / targets.expense) * 100, 100)}%`}}></div> </div> </div> </> )} </div> );
          case 'quickAdd': return ( <div className="col-span-2 md:col-span-2 lg:col-span-4 bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark rounded-[2rem] p-6 shadow-card-light dark:shadow-card hover:shadow-lg transition-shadow"> <div className="flex items-center gap-2 mb-6"> <div className="size-8 rounded-full bg-primary flex items-center justify-center text-[#142210] shadow-glow"><span className="material-symbols-outlined text-lg">add</span></div> <h3 className="text-xl font-bold text-text-light-main dark:text-text-dark-main">New Transaction</h3> </div> <div className="flex flex-col gap-5"> <div className="flex bg-gray-100 dark:bg-surface-darker p-1.5 rounded-xl border border-gray-200 dark:border-border-dark"> <button onClick={() => handleTypeChange('expense')} className={`flex-1 py-2.5 text-sm font-bold rounded-lg transition-all ${formData.type === 'expense' ? 'bg-white dark:bg-surface-dark text-danger dark:text-red-400 shadow-sm border border-danger/30' : 'text-text-light-muted dark:text-text-dark-muted hover:text-text-light-main dark:hover:text-text-dark-main'}`}>Expense</button> <button onClick={() => handleTypeChange('income')} className={`flex-1 py-2.5 text-sm font-bold rounded-lg transition-all ${formData.type === 'income' ? 'bg-white dark:bg-surface-dark text-primary shadow-sm border border-primary/30' : 'text-text-light-muted dark:text-text-dark-muted hover:text-text-light-main dark:hover:text-text-dark-main'}`}>Income</button> </div> <div className="space-y-4"> <div className="flex flex-col gap-1.5"> <label className="text-xs font-bold text-text-light-muted dark:text-text-dark-muted ml-1 uppercase">Description</label> <div className="relative"> <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 text-lg">edit_note</span> <input name="title" value={formData.title} onChange={handleInputChange} type="text" placeholder="e.g. Groceries" className="w-full bg-background-light dark:bg-surface-darker text-text-light-main dark:text-text-dark-main rounded-xl py-3 pl-10 pr-4 border border-border-light dark:border-border-dark focus:border-primary focus:ring-1 focus:ring-primary outline-none text-sm transition-all" /> </div> </div> <div className="grid grid-cols-2 gap-3"> <div className="flex flex-col gap-1.5"> <label className="text-xs font-bold text-text-light-muted dark:text-text-dark-muted ml-1 uppercase">Amount</label> <div className="relative"> <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 font-bold text-lg">{currencySymbol}</span> <input name="amount" value={formData.amount} onChange={handleInputChange} type="number" placeholder="0.00" className="w-full bg-background-light dark:bg-surface-darker text-text-light-main dark:text-text-dark-main rounded-xl py-3 pl-9 pr-4 border border-border-light dark:border-border-dark focus:border-primary outline-none text-sm font-bold tracking-wide" /> </div> </div> <div className="flex flex-col gap-1.5"> <label className="text-xs font-bold text-text-light-muted dark:text-text-dark-muted ml-1 uppercase">Method</label> <select name="paymentMethod" value={formData.paymentMethod} onChange={handleInputChange} className="w-full bg-background-light dark:bg-surface-darker text-text-light-main dark:text-text-dark-main rounded-xl py-3 px-3 border border-border-light dark:border-border-dark focus:border-primary outline-none text-sm appearance-none cursor-pointer"> {userSettings?.paymentMethods.map(m => <option key={m} value={m}>{m}</option>)} </select> </div> </div> <div className="grid grid-cols-2 gap-3"> <div className="flex flex-col gap-1.5"> <label className="text-xs font-bold text-text-light-muted dark:text-text-dark-muted ml-1 uppercase">Category</label> <select name="category" value={formData.category} onChange={handleInputChange} className="w-full bg-background-light dark:bg-surface-darker text-text-light-main dark:text-text-dark-main rounded-xl py-3 px-3 border border-border-light dark:border-border-dark focus:border-primary outline-none text-sm appearance-none cursor-pointer"> {(formData.type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES).map(cat => <option key={cat} value={cat}>{cat}</option>)} </select> </div> <div className="flex flex-col gap-1.5"> <label className="text-xs font-bold text-text-light-muted dark:text-text-dark-muted ml-1 uppercase">Date</label> <input name="date" type="date" value={formData.date} onChange={handleInputChange} className="w-full bg-background-light dark:bg-surface-darker text-text-light-main dark:text-text-dark-main rounded-xl py-3 px-3 border border-border-light dark:border-border-dark focus:border-primary outline-none text-sm" style={{colorScheme: userSettings?.theme === 'light' ? 'light' : 'dark'}} /> </div> </div> </div> <button onClick={handleAddTransaction} disabled={isAdding} className="mt-2 w-full bg-primary hover:bg-primary-hover text-[#131811] font-bold py-3.5 rounded-xl shadow-glow transition-all flex items-center justify-center gap-2 disabled:opacity-50 transform active:scale-[0.98]"> {isAdding ? <span className="material-symbols-outlined animate-spin">sync</span> : <span className="material-symbols-outlined">add</span>} {isAdding ? 'Saving...' : 'Add Transaction'} </button> </div> </div> );
          case 'breakdown': 
            const prevTotalBreakdown = breakdownType === 'income' ? previousPeriodStats.income : previousPeriodStats.expense;
            const breakdownChangeValue = prevTotalBreakdown !== 0 ? ((breakdownStats.total - prevTotalBreakdown) / Math.abs(prevTotalBreakdown)) * 100 : 0;
            return ( <div className="col-span-4 md:col-span-1 lg:col-span-8 bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark rounded-[2.5rem] p-8 flex flex-col gap-8 shadow-card-light dark:shadow-card relative overflow-visible group min-h-[400px]"> <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 z-20"> <div className="flex items-center gap-3"> <div className="size-10 rounded-full border border-border-light dark:border-white/20 flex items-center justify-center text-text-light-main dark:text-primary bg-surface-light dark:bg-surface-dark shadow-sm"><span className="material-symbols-outlined text-sm">donut_large</span></div> <div> <h3 className="text-lg font-bold text-text-light-main dark:text-white tracking-wide leading-tight">Financial Breakdown</h3> <p className="text-xs text-text-light-muted dark:text-text-dark-muted font-medium">{dashboardViewMode === 'year' ? dashboardDate.getFullYear() : dashboardDate.toLocaleDateString('default', {month:'short', year:'numeric'})}</p> </div> </div> <div className="hidden sm:flex items-center gap-2 bg-gray-100 dark:bg-surface-darker rounded-full p-1 border border-border-light dark:border-border-dark self-start sm:self-auto"> <button onClick={() => handleDateNavigate('prev')} className="size-8 rounded-full flex items-center justify-center hover:bg-white dark:hover:bg-surface-dark text-text-light-muted dark:text-text-dark-muted transition-colors"><span className="material-symbols-outlined text-sm">chevron_left</span></button> <span className="text-xs font-bold text-text-light-main dark:text-text-dark-main px-2 min-w-[80px] text-center select-none">{dashboardViewMode === 'year' ? dashboardDate.getFullYear() : dashboardDate.toLocaleDateString('default', {month:'short', year:'2-digit'})}</span> <button onClick={() => handleDateNavigate('next')} className="size-8 rounded-full flex items-center justify-center hover:bg-white dark:hover:bg-surface-dark text-text-light-muted dark:text-text-dark-muted transition-colors"><span className="material-symbols-outlined text-sm">chevron_right</span></button> </div> </div> <div className="w-full flex flex-col md:flex-row items-center gap-6 justify-center"> <div className="shrink-0 relative flex flex-col items-center gap-6 w-full md:w-auto"> <div className="flex sm:hidden items-center gap-2 bg-gray-100 dark:bg-surface-darker rounded-full p-1 border border-border-light dark:border-border-dark mb-[-10px] z-10"> <button onClick={() => handleDateNavigate('prev')} className="size-8 rounded-full flex items-center justify-center hover:bg-white dark:hover:bg-surface-dark text-text-light-muted dark:text-text-dark-muted transition-colors"><span className="material-symbols-outlined text-sm">chevron_left</span></button> <span className="text-xs font-bold text-text-light-main dark:text-text-dark-main px-4 min-w-[80px] text-center select-none">{dashboardViewMode === 'year' ? dashboardDate.getFullYear() : dashboardDate.toLocaleDateString('default', {month:'short', year:'2-digit'})}</span> <button onClick={() => handleDateNavigate('next')} className="size-8 rounded-full flex items-center justify-center hover:bg-white dark:hover:bg-surface-dark text-text-light-muted dark:text-text-dark-muted transition-colors"><span className="material-symbols-outlined text-sm">chevron_right</span></button> </div> <DonutChart data={breakdownStats.data} total={breakdownStats.total} currencySymbol={currencySymbol} change={breakdownChangeValue} label={breakdownType === 'expense' ? 'Expenses' : 'Income'} className="size-56 md:size-64" isExpense={breakdownType === 'expense'} /> <div className="flex bg-gray-100 dark:bg-black/30 rounded-full p-1.5 border border-border-light dark:border-border-dark w-fit shadow-sm"> <button onClick={() => setBreakdownType('income')} className={`px-6 py-2 rounded-full text-xs font-bold uppercase transition-all ${breakdownType === 'income' ? 'bg-white dark:bg-surface-dark shadow-md text-primary' : 'text-text-light-muted dark:text-gray-400 hover:text-text-light-main'}`}>Income</button> <button onClick={() => setBreakdownType('expense')} className={`px-6 py-2 rounded-full text-xs font-bold uppercase transition-all ${breakdownType === 'expense' ? 'bg-white dark:bg-surface-dark shadow-md text-danger' : 'text-text-light-muted dark:text-gray-400 hover:text-text-light-main'}`}>Expense</button> </div> </div> <div className="w-full md:w-56 flex-1 flex flex-col gap-1.5 max-h-72 overflow-y-auto custom-scrollbar pr-2"> {breakdownStats.legends.length > 0 ? ( breakdownStats.legends.map((item, idx) => ( <div key={idx} className="flex items-center justify-between px-3 py-2 rounded-xl hover:bg-gray-50 dark:hover:bg-surface-darker transition-colors group border border-transparent hover:border-border-light dark:hover:border-border-dark/50"> <div className="flex items-center gap-3"> <div className="size-3 rounded-full shadow-sm" style={{backgroundColor: item.color}}></div> <span className="text-sm font-bold text-text-light-main dark:text-text-dark-main group-hover:text-primary transition-colors">{item.name}</span> </div> <div className="flex flex-col items-end"> <span className="text-sm font-bold text-text-light-main dark:text-text-dark-main tracking-tight">{currencySymbol}{formatCompact(item.value)}</span> <span className="text-[10px] font-bold text-text-light-muted dark:text-text-dark-muted bg-gray-100 dark:bg-black/20 px-1.5 py-0.5 rounded-md">{item.percent}%</span> </div> </div> )) ) : ( <div className="text-center py-8 text-text-light-muted dark:text-text-dark-muted opacity-60"> <span className="material-symbols-outlined text-3xl mb-2">data_usage</span> <p className="text-xs">No data for this period</p> </div> )} </div> </div> </div> );
          case 'recent': return ( 
            <div className="col-span-2 md:col-span-2 lg:col-span-8 flex flex-col gap-4">
                <div className="flex items-center justify-between px-2">
                    <h3 className="text-xl font-black text-text-light-main dark:text-text-dark-main flex items-center flex-wrap gap-x-3 gap-y-1">
                        <div className="flex items-center gap-2">
                            <span className="material-symbols-outlined text-text-light-main dark:text-text-dark-main text-xl">history</span> Recent Transactions
                        </div>
                        <span className="text-text-light-muted dark:text-text-dark-muted text-sm font-normal">•</span>
                        <button onClick={() => onNavigate && onNavigate(View.TRANSACTIONS_CALENDAR)} className="text-primary text-sm font-bold hover:underline cursor-pointer">Full History</button>
                    </h3>
                </div>
                <div className="flex flex-col gap-3">
                    {loading ? ([1,2,3,4].map(i => <Skeleton key={i} className="h-20 w-full rounded-2xl"/>)) : filteredList.length > 0 ? (
                        filteredList.map(tx => {
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
                                        <p className={`text-lg font-black tracking-tight ${tx.type === 'income' ? 'text-primary' : 'text-danger dark:text-red-400'}`}>{tx.type === 'income' ? '+' : '-'}{currencySymbol}{tx.amount.toFixed(2)}</p>
                                        <button onClick={(e) => { e.stopPropagation(); setDeleteId(tx.id); }} className="size-8 rounded-full bg-danger/10 text-danger flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-danger hover:text-white" title="Delete Transaction"><span className="material-symbols-outlined text-[18px]">delete</span></button>
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
      {/* Toast Notification */}
      {activeToast && ( <div className="fixed top-20 right-4 z-[60] bg-surface-dark text-white p-4 rounded-xl shadow-2xl animate-slide-in-right flex gap-3 items-start max-w-sm border border-primary/20 backdrop-blur-md"> <span className="material-symbols-outlined text-primary">notifications_active</span> <div><p className="font-bold text-sm">Notification</p><p className="text-xs opacity-90">{activeToast}</p></div> <button onClick={() => setActiveToast(null)} className="ml-auto hover:text-primary"><span className="material-symbols-outlined text-sm">close</span></button> </div> )}
      {/* Budget Goal Modal */}
      {editingTarget && ( <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in"> <div className="bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark rounded-3xl p-8 lg : w-9/10 max-sm shadow-2xl animate-slide-up"> <h3 className="text-xl font-bold text-text-light-main dark:text-text-dark-main mb-1">Set Monthly {editingTarget === 'income' ? 'Goal' : 'Limit'}</h3> <p className="text-sm text-text-light-muted dark:text-text-dark-muted mb-6">Update your base monthly target. This will scale automatically for weekly/yearly views.</p> <div className="relative mb-6"> <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-lg text-text-light-muted dark:text-text-dark-muted">{currencySymbol}</span> <input type="number" value={targetInput} onChange={(e) => setTargetInput(e.target.value)} className="w-full bg-background-light dark:bg-surface-darker border border-border-light dark:border-border-dark rounded-xl p-4 pl-10 text-xl font-bold focus:border-primary outline-none" autoFocus /> </div> <div className="flex gap-3"> <button onClick={() => setEditingTarget(null)} className="flex-1 py-3 rounded-xl font-bold text-text-light-muted dark:text-text-dark-muted hover:bg-gray-100 dark:hover:bg-surface-darker transition-colors">Cancel</button> <button onClick={saveTarget} className="flex-1 py-3 rounded-xl font-bold bg-primary text-[#131811] hover:bg-primary-hover shadow-glow transition-colors">Save</button> </div> </div> </div> )}
      {/* Delete Confirmation */}
      {deleteId && ( <div className="fixed inset-0 bg-black/60 z-[110] flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in"> <div className="bg-surface-light dark:bg-surface-dark border border-danger/30 rounded-3xl p-8 w-full max-sm shadow-2xl animate-slide-up text-center"> <div className="size-16 rounded-full bg-danger/10 flex items-center justify-center mx-auto mb-4"><span className="material-symbols-outlined text-3xl text-danger">delete_forever</span></div> <h2 className="text-xl font-bold text-text-light-main dark:text-text-dark-main mb-2">Delete Transaction?</h2> <div className="flex gap-3"> <button onClick={() => setDeleteId(null)} className="flex-1 py-3 rounded-xl border border-border-light dark:border-border-dark text-text-light-main dark:text-text-dark-main hover:bg-gray-100 dark:hover:bg-surface-darker font-bold transition-colors">Cancel</button> <button onClick={handleDelete} className="flex-1 py-3 rounded-xl bg-danger text-white hover:bg-red-600 font-bold transition-colors">Delete</button> </div> </div> </div> )}
      {/* Widget Customization Modal */}
      {showWidgetEditor && ( <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm"> <div className="bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark rounded-3xl p-6 w-[calc(100vw-32px)] md:w-[80vw] lg:max-w-[400px] shadow-2xl animate-slide-up"><div className="flex justify-between items-center mb-4"> <h2 className="text-xl font-bold text-text-light-main dark:text-text-dark-main">Customize Bento</h2> <button onClick={() => setShowWidgetEditor(false)} className="text-text-light-muted dark:text-text-dark-muted hover:text-text-light-main dark:hover:text-text-dark-main"><span className="material-symbols-outlined">close</span></button> </div> <div className="flex flex-col gap-2 max-h-[50vh] overflow-y-auto custom-scrollbar mb-4"> {editorOrder.map((id, idx) => ( <div key={id} className={`flex items-center justify-between p-3 bg-background-light dark:bg-surface-darker rounded-xl border border-border-light dark:border-border-dark transition-opacity ${!widgets[id] ? 'opacity-60' : 'opacity-100'}`}> <div className="flex items-center gap-3"> <div className="flex flex-col gap-1"> <button onClick={() => handleEditorReorder(id, 'up')} disabled={idx === 0} className="size-7 flex items-center justify-center rounded-lg bg-gray-200 dark:bg-border-dark hover:bg-gray-300 dark:hover:bg-border-dark/80 disabled:opacity-20 transition-colors"><span className="material-symbols-outlined text-sm font-bold">keyboard_arrow_up</span></button> <button onClick={() => handleEditorReorder(id, 'down')} disabled={idx === editorOrder.length - 1} className="size-7 flex items-center justify-center rounded-lg bg-gray-200 dark:bg-border-dark hover:bg-gray-300 dark:hover:bg-border-dark/80 disabled:opacity-20 transition-colors"><span className="material-symbols-outlined text-sm font-bold">keyboard_arrow_down</span></button> </div> <span className="text-text-light-main dark:text-text-dark-main font-medium text-sm">{WIDGET_LABELS[id] || id}</span> </div> <div onClick={() => toggleWidget(id)} className={`w-12 h-6 rounded-full cursor-pointer relative transition-colors ${widgets[id] ? 'bg-primary' : 'bg-gray-300 dark:bg-border-dark'}`}><div className={`absolute top-1 size-4 bg-white rounded-full shadow-md transition-all ${widgets[id] ? 'left-7' : 'left-1'}`}></div></div> </div> ))} </div> <button onClick={handleSaveLayout} className="w-full py-3 bg-primary text-[#131811] font-bold rounded-xl shadow-glow hover:bg-primary-hover transition-colors">Save Layout</button> </div> </div> )}
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
      
      {/* Header Toolbar */}
      <div className="flex flex-row justify-between items-center gap-4 animate-slide-up relative z-20 mb-2"> <div className="flex flex-col gap-1"> <h1 className="text-text-light-main dark:text-text-dark-main text-3xl lg:text-5xl font-black tracking-tight leading-tight">Dashboard</h1> <p className="text-text-light-muted dark:text-text-dark-muted text-sm md:text-base lg:text-lg block">Your financial overview. </p> </div> <div className="flex justify-end items-center gap-2"> <button onClick={lockApp} className="flex items-center justify-center size-10 rounded-full bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark text-text-light-muted dark:text-text-dark-muted hover:text-primary hover:border-primary transition-all shadow-sm active:scale-95 group" title="Lock App" > <span className="material-symbols-outlined text-[20px] group-hover:scale-110 transition-transform">lock</span> </button> <div className="relative"> <button onClick={() => setShowNotifDropdown(!showNotifDropdown)} className="flex items-center justify-center size-10 rounded-full bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark text-text-light-muted dark:text-text-dark-muted hover:text-primary hover:border-primary transition-all shadow-sm relative group" title="Notifications"> <span className="material-symbols-outlined text-[22px] group-hover:animate-swing">notifications</span> {unreadCount > 0 && <span className="absolute top-2 right-2 size-2 bg-red-500 rounded-full border border-surface-light dark:border-surface-dark animate-pulse"></span>} </button> {showNotifDropdown && ( <div className="absolute top-12 right-0 w-80 bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark rounded-2xl shadow-2xl p-4 z-50 animate-fade-in"> <div className="flex justify-between items-center mb-3"><h3 className="font-bold text-text-light-main dark:text-text-dark-main">Notifications</h3><button onClick={() => setNotifications([])} className="text-xs text-primary font-bold hover:underline">Clear All</button> </div> <div className="flex flex-col gap-3 max-h-[300px] overflow-y-auto custom-scrollbar"> {notifications.length > 0 ? notifications.map(n => ( <div key={n.id} className={`flex gap-3 p-3 rounded-xl transition-colors ${n.read ? 'bg-transparent hover:bg-gray-50 dark:hover:bg-surface-darker' : 'bg-primary/5'}`}> <div className="size-8 rounded-full bg-surface-light dark:bg-surface-darker flex items-center justify-center text-text-light-main dark:text-text-dark-main border border-border-light dark:border-border-dark"><span className="material-symbols-outlined text-sm">{n.icon}</span></div> <div className="flex flex-col"> <p className="text-sm font-bold text-text-light-main dark:text-text-dark-main leading-tight">{n.title}</p> <p className="text-xs text-text-light-muted dark:text-text-dark-muted leading-tight mt-0.5">{n.msg}</p> <p className="text-[10px] text-text-light-muted dark:text-text-dark-muted mt-1 opacity-60">{n.time}</p> </div> </div> )) : ( <div className="py-8 text-center text-text-light-muted dark:text-text-dark-muted text-xs">No new notifications</div> )} </div> </div> )} </div> <div className="hidden md:flex items-center gap-2 bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark rounded-full p-1.5 shadow-sm"> <button onClick={() => toggleTheme()} className="flex items-center gap-2 px-3 py-2 rounded-full hover:bg-gray-100 dark:hover:bg-surface-darker transition-colors text-text-light-muted dark:text-text-dark-muted hover:text-primary"><span className="material-symbols-outlined text-[20px]">{userSettings?.theme === 'light' ? 'dark_mode' : 'light_mode'}</span><span className="hidden lg:inline text-sm font-bold">Theme</span></button> <div className="w-px h-5 bg-border-light dark:bg-border-dark"></div> <button onClick={() => setShowExportModal(true)} className="flex items-center gap-2 px-3 py-2 rounded-full hover:bg-gray-100 dark:hover:bg-surface-darker transition-colors text-text-light-muted dark:text-text-dark-muted hover:text-primary"><span className="material-symbols-outlined text-[20px]">download</span><span className="hidden lg:inline text-sm font-bold">Export</span></button> <div className="w-px h-5 bg-border-light dark:bg-border-dark"></div> <button onClick={() => setShowWidgetEditor(true)} className="flex items-center gap-2 px-3 py-2 rounded-full hover:bg-gray-100 dark:hover:bg-surface-darker transition-colors text-text-light-muted dark:text-text-dark-muted hover:text-primary"><span className="material-symbols-outlined text-[20px]">edit</span><span className="hidden lg:inline text-sm font-bold">Customize</span></button> </div> <div className="md:hidden relative"> <button onClick={() => setShowMobileHeaderMenu(!showMobileHeaderMenu)} className="flex items-center justify-center size-8 rounded-full bg-surface-light dark:bg-surface-dark text-text-light-muted dark:text-text-dark-muted border border-border-light dark:border-border-dark hover:text-primary transition-all shadow-sm active:scale-95"><span className="material-symbols-outlined text-[18px]">more_vert</span></button> {showMobileHeaderMenu && ( <div className="absolute right-0 top-10 bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark rounded-2xl shadow-xl p-2 flex flex-col gap-1 min-w-[160px] z-50 animate-fade-in"> <button onClick={() => { toggleTheme(); setShowMobileHeaderMenu(false); }} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-100 dark:hover:bg-surface-darker rounded-xl text-sm font-bold text-text-light-main dark:text-text-dark-main"><span className="material-symbols-outlined text-[20px]">{userSettings?.theme === 'light' ? 'dark_mode' : 'light_mode'}</span> Theme</button> <button onClick={() => { setShowExportModal(true); setShowMobileHeaderMenu(false); }} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-100 dark:hover:bg-surface-darker rounded-xl text-sm font-bold text-text-light-main dark:text-text-dark-main"><span className="material-symbols-outlined text-[20px]">download</span> Export Data</button> <button onClick={() => { setShowWidgetEditor(true); setShowMobileHeaderMenu(false); }} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-100 dark:hover:bg-surface-darker rounded-xl text-sm font-bold text-text-light-main dark:text-text-dark-main"><span className="material-symbols-outlined text-[20px]">edit</span> Customize</button> </div> )} </div> </div> </div>
      
      {/* Welcome Message */}
      <div className="mb-12 animate-slide-up mt-4"> <div className="flex items-center flex-wrap gap-x-4 gap-y-2 mb-3"> <h1 className="text-5xl md:text-6xl font-black text-text-light-main dark:text-text-dark-main tracking-tight leading-none"> Hello, <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-emerald-600">{userSettings?.displayName?.split(' ')[0] || "SAHIL"}</span> </h1> </div> <p className="text-xl font-medium text-text-light-muted dark:text-text-dark-muted">Your finances are looking good.</p> </div>
      
      {/* Widget Grid */}
      <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-12 gap-6 animate-slide-up delay-100"> 
        {widgetOrder.map(key => (
            <React.Fragment key={key}>
                {renderWidget(key)}
            </React.Fragment>
        ))}
      </div>
    </div>
  );
};

export default DashboardScreen;
