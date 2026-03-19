
import React, { useState, useMemo } from 'react';
import { useStore, SavingsGoal } from '../context/Store';

const CATEGORY_STYLES: Record<string, { hex: string, icon: string, color: string, bg: string }> = {
    "Food": { hex: "#f97316", icon: "restaurant", color: "text-orange-500", bg: "bg-orange-500/10" },
    "Housing": { hex: "#3b82f6", icon: "home", color: "text-blue-500", bg: "bg-blue-500/10" },
    "Rent": { hex: "#818cf8", icon: "real_estate_agent", color: "text-indigo-400", bg: "bg-indigo-400/10" },
    "Transportation": { hex: "#a855f7", icon: "directions_car", color: "text-purple-500", bg: "bg-purple-500/10" },
    "Entertainment": { hex: "#ec4899", icon: "movie", color: "text-pink-500", bg: "bg-pink-500/10" },
    "Shopping": { hex: "#eab308", icon: "shopping_bag", color: "text-yellow-500", bg: "bg-yellow-500/10" },
    "Subscription": { hex: "#ad1c43", icon: "subscriptions", color: "text-red-500", bg: "bg-red-500/10" },
    "Health": { hex: "#f87171", icon: "medical_services", color: "text-red-400", bg: "bg-red-400/10" },
    "Utilities": { hex: "#22d3ee", icon: "bolt", color: "text-cyan-400", bg: "bg-cyan-400/10" },
    "Other": { hex: "#9ca3af", icon: "receipt", color: "text-gray-400", bg: "bg-gray-400/10" }
};

const PAYMENT_METHOD_COLORS: Record<string, string> = {
    "Cash": "#10b981",
    "UPI": "#3b82f6",
    "Savings Account": "#f59e0b",
    "Credit Card": "#ef4444",
    "Debit Card": "#06b6d4",
    "Unspecified": "#9ca3af"
};

const DEFAULT_COLORS = ["#10b981", "#3b82f6", "#8b5cf6", "#f59e0b", "#ef4444", "#06b6d4","#FF0000"];

const ProgressRing: React.FC<{ percentage: number, color: string, size?: number }> = ({ percentage, color, size = 60 }) => {
    const radius = 25;
    const circumference = 2 * Math.PI * radius;
    const safePercentage = Math.max(0, Math.min(100, percentage));
    const offset = circumference - (safePercentage / 100) * circumference;
    return (
        <svg width={size} height={size} viewBox="0 0 60 60" className="rotate-[-90deg]">
            <circle cx="30" cy="30" r={radius} stroke="currentColor" strokeWidth="4" fill="transparent" className="text-gray-100 dark:text-gray-800" />
            <circle cx="30" cy="30" r={radius} stroke={color} strokeWidth="4" fill="transparent" strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round" className="transition-all duration-1000 ease-out" />
        </svg>
    );
};

const DonutChart: React.FC<{ data: Record<string, number>, total: number, currency: string, label: string, type: 'category' | 'payment' }> = ({ data, total, currency, label, type }) => {
    const [hovered, setHovered] = useState<string | null>(null);
    let accumulatedAngle = 0;
    const radius = 40;
    const center = 50;
    const strokeWidth = 10;
    const sorted = (Object.entries(data) as [string, number][]).sort(([, a], [, b]) => b - a);

    const paths = sorted.map(([key, val], i) => {
        const percentage = total > 0 ? val / total : 0;
        const angle = percentage * 360;
        if (angle === 0) return null;

        const largeArc = angle > 180 ? 1 : 0;
        const x1 = center + radius * Math.cos(Math.PI * (accumulatedAngle - 90) / 180);
        const y1 = center + radius * Math.sin(Math.PI * (accumulatedAngle - 90) / 180);
        const x2 = center + radius * Math.cos(Math.PI * (accumulatedAngle + angle - 90) / 180);
        const y2 = center + radius * Math.sin(Math.PI * (accumulatedAngle + angle - 90) / 180);

        const d = total > 0 && sorted.length === 1
            ? `M ${center} ${center - radius} A ${radius} ${radius} 0 1 1 ${center - 0.01} ${center - radius}`
            : `M ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2}`;

        accumulatedAngle += angle;
        const color = type === 'category'
            ? (CATEGORY_STYLES[key]?.hex || '#9ca3af')
            : (PAYMENT_METHOD_COLORS[key] || DEFAULT_COLORS[i % DEFAULT_COLORS.length]);

        const isHovered = hovered === key;

        return (
            <path
                key={i}
                d={d}
                fill="none"
                stroke={color}
                strokeWidth={isHovered ? strokeWidth + 4 : strokeWidth}
                strokeLinecap="round"
                className="transition-all duration-300 cursor-pointer pointer-events-auto"
                onMouseEnter={() => setHovered(key)}
                onMouseLeave={() => setHovered(null)}
            />
        );
    });

    return (
        <div className="relative size-72 md:size-96 flex items-center justify-center mx-auto group/donut">
            <svg viewBox="0 0 100 100" className="w-full h-full drop-shadow-xl overflow-visible">
                {/* Background Ring */}
                <circle cx="50" cy="50" r={radius} fill="none" stroke="currentColor" className="text-gray-100 dark:text-gray-800" strokeWidth={strokeWidth} />

                {/* Data Segments */}
                {total > 0 && paths}
            </svg>

            {/* Central Label Container */}
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none p-6 z-10">
                <div className="animate-fade-in flex flex-col items-center">
                    <span className="text-[10px] md:text-xs font-black uppercase tracking-[0.2em] text-text-light-muted dark:text-text-dark-muted mb-1 transition-all duration-300">
                        {hovered ? hovered : label}
                    </span>
                    <span className="text-3xl md:text-5xl font-black text-text-light-main dark:text-text-dark-main tabular-nums tracking-tighter transition-all duration-300">
                        {hovered && total > 0 && data[hovered] != null
                            ? `${((data[hovered] / total) * 100).toFixed(1)}%`
                            : `${currency}${total.toLocaleString()}`}
                    </span>
                    {hovered && data[hovered] != null && (
                        <span className="text-[10px] md:text-xs font-bold text-primary mt-1 opacity-80 uppercase tracking-widest animate-fade-in">
                            {currency}{data[hovered].toLocaleString()}
                        </span>
                    )}
                </div>
            </div>
        </div>
    );
};

const BudgetGoalsScreen: React.FC = () => {
    const { userSettings, updateUserSettings, transactions, generateFinancialAudit } = useStore();
    const [activeTab, setActiveTab] = useState<'budget' | 'goals' | 'ai'>('budget');
    const [allocationType, setAllocationType] = useState<'category' | 'payment'>('category');
    const [editingBudget, setEditingBudget] = useState<string | null>(null);
    const [tempValue, setTempValue] = useState('');

    const [aiAuditRaw, setAiAuditRaw] = useState<string | null>(null);
    const [aiAuditJson, setAiAuditJson] = useState<any | null>(null);
    const [aiAuditParseError, setAiAuditParseError] = useState<string | null>(null);
    const [isAuditing, setIsAuditing] = useState(false);

    const [showGoalModal, setShowGoalModal] = useState(false);
    const [showFundModal, setShowFundModal] = useState<{ id: string, name: string } | null>(null);
    const [fundAmount, setFundAmount] = useState('');
    const [goalForm, setGoalForm] = useState({ name: '', target: '', date: '', icon: 'savings' });

    const currencySymbol = userSettings?.currency === 'USD' ? '$' : userSettings?.currency === 'EUR' ? '€' : '₹';

    // Metrics
    const { currentMonthSpent, previousMonthBalance, categoryActuals, paymentMethodActuals } = useMemo(() => {
        const now = new Date();
        const curMonth = now.getMonth();
        const curYear = now.getFullYear();
        const prevMonthDate = new Date(curYear, curMonth - 1, 1);
        const prevMonth = prevMonthDate.getMonth();
        const prevYear = prevMonthDate.getFullYear();

        let curSpent = 0;
        let prevIncome = 0;
        let prevExpense = 0;
        const actuals: Record<string, number> = {};
        const pMethods: Record<string, number> = {};

        transactions.forEach(t => {
            const d = new Date(t.date);
            if (d.getMonth() === curMonth && d.getFullYear() === curYear) {
                if (t.type === 'expense') {
                    curSpent += t.amount;
                    actuals[t.category] = (actuals[t.category] || 0) + t.amount;
                    // Fix: Ensure undefined/empty payment methods are tracked under "Unspecified"
                    const method = t.paymentMethod || "Unspecified";
                    pMethods[method] = (pMethods[method] || 0) + t.amount;
                }
            }
            if (d.getMonth() === prevMonth && d.getFullYear() === prevYear) {
                if (t.type === 'income') prevIncome += t.amount; else prevExpense += t.amount;
            }
        });

        return {
            currentMonthSpent: curSpent,
            previousMonthBalance: prevIncome - prevExpense,
            categoryActuals: actuals,
            paymentMethodActuals: pMethods
        };
    }, [transactions]);

    const tryParseJson = (raw: string) => {
        if (!raw) return null;
        const trimmed = raw.trim();
        try {
            return JSON.parse(trimmed);
        } catch {
            // Attempt to extract a JSON object from the text
            const first = trimmed.indexOf('{');
            const last = trimmed.lastIndexOf('}');
            if (first >= 0 && last > first) {
                const candidate = trimmed.slice(first, last + 1);
                try {
                    return JSON.parse(candidate);
                } catch {
                    return null;
                }
            }
            return null;
        }
    };

    const copyInsightJson = async () => {
        if (!aiAuditJson) return;
        try {
            await navigator.clipboard.writeText(JSON.stringify(aiAuditJson, null, 2));
            setAiAuditParseError('Copied insight JSON to clipboard.');
            setTimeout(() => setAiAuditParseError(null), 3000);
        } catch (e) {
            setAiAuditParseError('Clipboard copy failed.');
            setTimeout(() => setAiAuditParseError(null), 3000);
        }
    };

    const exportInsightJson = () => {
        if (!aiAuditJson) return;
        const blob = new Blob([JSON.stringify(aiAuditJson, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'insight.json';
        a.click();
        URL.revokeObjectURL(url);
    };

    const handleAudit = async () => {
        setIsAuditing(true);
        setAiAuditParseError(null);
        const res = await generateFinancialAudit();
        setAiAuditRaw(res);
        const parsed = res ? tryParseJson(res) : null;
        if (parsed) {
            setAiAuditJson(parsed);
        } else {
            setAiAuditJson(null);
            if (res) setAiAuditParseError('Could not parse JSON output; showing raw response.');
        }
        setIsAuditing(false);
    };

    const handleAddGoal = async () => {
        if (!goalForm.name.trim() || Number(goalForm.target) <= 0) return;
        const newGoal: SavingsGoal = {
            id: crypto.randomUUID(),
            name: goalForm.name.trim(),
            targetAmount: Number(goalForm.target) || 0,
            currentAmount: 0,
            targetDate: goalForm.date,
            icon: goalForm.icon
        };
        const goals = [...(userSettings?.savingsGoals || []), newGoal];
        await updateUserSettings({ savingsGoals: goals });
        setShowGoalModal(false);
        setGoalForm({ name: '', target: '', date: '', icon: 'savings' });
    };

    const handleAddFunds = async () => {
        if (!showFundModal || !fundAmount) return;
        const amount = Number(fundAmount);
        if (isNaN(amount) || amount <= 0) return;

        const goals = (userSettings?.savingsGoals || []).map(g => {
            if (g.id === showFundModal.id) {
                return { ...g, currentAmount: g.currentAmount + amount };
            }
            return g;
        });
        await updateUserSettings({ savingsGoals: goals });
        setShowFundModal(null);
        setFundAmount('');
    };

    const handleDeleteGoal = async (id: string) => {
        if (!confirm("Are you sure you want to delete this milestone?")) return;
        const goals = (userSettings?.savingsGoals || []).filter(g => g.id !== id);
        await updateUserSettings({ savingsGoals: goals });
    };

    const donutData: Record<string, number> = allocationType === 'category'
        ? (userSettings?.categoryBudgets ?? {})
        : (paymentMethodActuals ?? {});

    const donutTotal = Object.values(donutData).reduce((a: number, b: number) => a + b, 0);

    return (
        <div className="max-w-[1400px] mx-auto p-4 md:p-10 pb-32 flex flex-col gap-10 animate-fade-in overflow-y-auto h-full scroll-smooth">

            {/* Page Header - Centered */}
            
            <div className="flex flex-col gap-1">
                    <h1 className="text-4xl md:text-5xl font-black text-text-light-main dark:text-text-dark-main tracking-tight">Budget & Goals</h1>
                    <p className="text-text-light-muted dark:text-text-dark-muted text-lg">Set your budgets & goals.</p>
                </div>
            <div className="flex flex-col items-center justify-center gap-6 text-center">
                
                <div className="flex bg-gray-100 dark:bg-surface-darker p-1.5 rounded-2xl border border-border-light dark:border-border-dark shadow-sm">
                    <button onClick={() => setActiveTab('budget')} className={`px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'budget' ? 'bg-primary text-[#131811] shadow-glow' : 'text-text-light-muted hover:text-text-light-main'}`}>Budget</button>
                    <button onClick={() => setActiveTab('goals')} className={`px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'goals' ? 'bg-primary text-[#131811] shadow-glow' : 'text-text-light-muted hover:text-text-light-main'}`}>Goals</button>
                    <button onClick={() => setActiveTab('ai')} className={`px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'ai' ? 'bg-indigo-500 text-white shadow-glow' : 'text-text-light-muted hover:text-text-light-main'}`}>Advisor</button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">

                {/* LEFT COLUMN: Main Feature Area */}
                <div className="lg:col-span-7 flex flex-col gap-8">

                    {activeTab === 'budget' && (
                        <div className="bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark rounded-[2.5rem] p-8 md:p-12 shadow-sm animate-fade-in min-h-[500px] flex flex-col">
                            
                            <div className="flex-1 flex items-center justify-center">
                                <DonutChart
                                    data={donutData}
                                    total={donutTotal}
                                    currency={currencySymbol}
                                    label={allocationType === 'category' ? "Total Budgeted" : "Total Spent"}
                                    type={allocationType}
                                />
                            </div>
                            
                            {/* Allocation Toggle - Centered */}
                            <div className="flex justify-center items-center mb-10 gap-4 mt-8">
                                <div className="flex bg-gray-50 dark:bg-surface-darker p-1 rounded-full border border-border-light dark:border-border-dark">
                                    <button
                                        onClick={() => setAllocationType('category')}
                                        className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${allocationType === 'category' ? 'bg-white dark:bg-surface-dark shadow-sm text-primary' : 'text-text-light-muted'}`}
                                    >
                                        By Category
                                    </button>
                                    <button
                                        onClick={() => setAllocationType('payment')}
                                        className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${allocationType === 'payment' ? 'bg-white dark:bg-surface-dark shadow-sm text-primary' : 'text-text-light-muted'}`}
                                    >
                                        By Payment
                                    </button>
                                </div>
                            </div>

                            <div className="flex justify-center">
                                <p className="text-xs font-medium text-text-light-muted opacity-60 flex items-center gap-2">
                                    <span className="material-symbols-outlined text-sm">touch_app</span>
                                    Hover or tap segments for specific metrics.
                                </p>
                            </div>
                        </div>
                    )}

                    {activeTab === 'goals' && (
                        <div className="flex flex-col gap-6 animate-fade-in">
                            <div className="flex justify-between items-center px-4">
                                <h2 className="text-xl font-black uppercase tracking-widest">Active Milestones</h2>
                                <button onClick={() => setShowGoalModal(true)} className="bg-primary text-[#131811] px-2 py-1 rounded-full font-black text-[12px] uppercase tracking-widest shadow-glow active:scale-95 transition-transform">✚ Add</button>
                            </div>
                            <div className="grid grid-cols-1 sd:grid-cols-1/2 md:grid-cols-2 gap-6">
                                {(userSettings?.savingsGoals || []).map(goal => {
                                    const progress = goal.targetAmount > 0 ? Math.min(100, (goal.currentAmount / goal.targetAmount) * 100) : 0;
                                    return (
                                        <div key={goal.id} className="bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark rounded-[2.5rem] p-6 shadow-sm group hover:border-primary/50 transition-all flex flex-col gap-6 relative overflow-hidden">
                                            <div className="flex justify-between items-start">
                                                <div className="size-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center transition-transform group-hover:scale-110"><span className="material-symbols-outlined">{goal.icon}</span></div>
                                                <div className="flex items-center gap-3">
                                                    <button onClick={() => setShowFundModal({ id: goal.id, name: goal.name })} className="opacity-0 group-hover:opacity-100 bg-gray-100 dark:bg-surface-darker px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-primary hover:text-black transition-all">Add Funds</button>
                                                    <button onClick={() => handleDeleteGoal(goal.id)} className="opacity-0 group-hover:opacity-100 text-danger hover:scale-110 transition-all"><span className="material-symbols-outlined text-lg">delete</span></button>
                                                </div>
                                            </div>
                                            <div className="flex items-center justify-between gap-4">
                                                <div>
                                                    <h3 className="text-xl font-bold mb-1 truncate max-w-[150px]">{goal.name}</h3>
                                                    <p className="text-xs font-bold text-text-light-muted uppercase tracking-widest opacity-60">Due: {goal.targetDate || 'TBD'}</p>
                                                </div>
                                                <ProgressRing percentage={progress} color={progress >= 100 ? '#22c55e' : '#3b82f6'} />
                                            </div>
                                            <div>
                                                <div className="flex justify-between text-xs font-black uppercase tracking-widest mb-3">
                                                    <div className="flex flex-col">
                                                        <span className="text-[10px] opacity-40">Saved</span>
                                                        <span className="text-primary">{currencySymbol}{goal.currentAmount.toLocaleString()}</span>
                                                    </div>
                                                    <div className="flex flex-col items-end">
                                                        <span className="text-[10px] opacity-40">Target</span>
                                                        <span className="text-text-light-main dark:text-white">{currencySymbol}{goal.targetAmount.toLocaleString()}</span>
                                                    </div>
                                                </div>
                                                <div className="h-3 w-full bg-gray-100 dark:bg-surface-darker rounded-full overflow-hidden p-0.5 border border-border-light dark:border-border-dark">
                                                    <div className="h-full bg-primary rounded-full transition-all duration-1000 ease-out" style={{ width: `${progress}%` }}></div>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                                {(userSettings?.savingsGoals || []).length === 0 && (
                                    <div className="col-span-full py-24 bg-surface-light dark:bg-surface-dark rounded-[2.5rem] border border-dashed border-border-light dark:border-border-dark flex flex-col items-center justify-center text-text-light-muted">
                                        <div className="size-20 rounded-full bg-primary/5 flex items-center justify-center mb-6"><span className="material-symbols-outlined text-4xl opacity-20">flag</span></div>
                                        <p className="font-bold text-text-light-main dark:text-white">No active milestones.</p>
                                        <p className="text-xs max-w-[200px] text-center mt-2 opacity-60">Visualize your goals and start securing the funds today.</p>
                                        <button onClick={() => setShowGoalModal(true)} className="mt-6 text-primary text-xs font-black uppercase tracking-[0.2em] hover:underline">Launch Milestone</button>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
{/* Financial Analyzer */}
                    {activeTab === 'ai' && (
                      <div className="bg-gradient-to-br from-[#0f172a] via-[#020617] to-[#020617] border border-white/10 rounded-[2.5rem] p-8 md:p-12 shadow-[0_20px_80px_rgba(0,0,0,0.6)] relative overflow-hidden animate-fade-in flex flex-col gap-8 min-h-[500px]">
                        <div className="absolute top-[-100px] right-[-100px] size-[300px] bg-indigo-500/10 rounded-full blur-[100px] pointer-events-none"></div>

                        {/* HEADER */}
                        <div className="flex items-start justify-between relative z-10">
                          <div>
                            <h2 className="text-2xl md:text-3xl font-bold text-white flex items-center gap-2">
                              <span className="material-symbols-outlined text-indigo-400">auto_awesome</span>
                              Gemini Insight
                            </h2>
                            <p className="text-xs text-white/60 mt-1">AI-generated financial insights</p>
                          </div>
                        </div>

                        {/* CONTENT */}
                        <div className="rounded-3xl bg-black/40 border border-white/10 p-5 flex flex-col gap-5 min-h-[260px]">
                          {isAuditing ? (
                            <div className="flex flex-col items-center justify-center h-full gap-4 text-indigo-400">
                              <div className="size-14 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin" />
                              <p className="text-xs uppercase tracking-widest animate-pulse">Analyzing your finances...</p>
                            </div>
                          ) : aiAuditJson ? (
                            <>
                              {/* STATUS */}
                              {aiAuditJson.status && (
                                <div className="flex items-center justify-between bg-white/5 border border-white/10 rounded-2xl px-4 py-3">
                                  <div className="flex items-center gap-3">
                                    <span className="text-5xl">{aiAuditJson.status.emoji}</span>
                                    <div>
                                      <p className="text-sm font-bold text-white">{aiAuditJson.status.label}</p>
                                      <p className="text-xs text-white/60">{aiAuditJson.status.message}</p>
                                    </div>
                                  </div>
                                </div>
                              )}

                              {/* SUMMARY */}
                              <div className="text-lg font-bold text-white leading-snug">
                                {aiAuditJson.summary}
                              </div>

                              {/* METRICS */}
                              {aiAuditJson.metrics && (
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                  {Object.entries(aiAuditJson.metrics).map(([k, v]) => (
                                    <div key={k} className="bg-white/5 border border-white/10 rounded-xl p-3">
                                      <p className="text-[10px] uppercase text-white/50">{k}</p>
                                      <p className="text-sm font-bold text-white mt-1">{String(v)}</p>
                                    </div>
                                  ))}
                                </div>
                              )}

                              {/* INSIGHTS */}
                              {aiAuditJson.insights && (
                                <div className="flex flex-col gap-3">
                                  {aiAuditJson.insights.map((ins: any, idx: number) => (
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
                              {aiAuditJson.actions && (
                                <div className="flex flex-wrap gap-2">
                                  {aiAuditJson.actions.map((act: any, idx: number) => (
                                    <div key={idx} className="px-3 py-2 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-xs text-indigo-300 flex items-center gap-2">
                                      <span>{act.emoji}</span>
                                      {act.text}
                                    </div>
                                  ))}
                                </div>
                              )}

                              {/* TONE */}
                              {aiAuditJson.tone && (
                                <div className="text-xs text-white/50 italic border-t border-white/10 pt-3">
                                  {aiAuditJson.tone.one_liner || aiAuditJson.tone.vibe}
                                </div>
                              )}

                              {aiAuditParseError && (
                                <div className="text-xs text-red-300">{aiAuditParseError}</div>
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
                          ) : aiAuditRaw ? (
                            <div className="text-sm text-white/70 whitespace-pre-line">
                              {aiAuditRaw}
                            </div>
                          ) : (
                            <div className="flex flex-col items-center justify-center text-center text-white/40 h-full">
                              <span className="material-symbols-outlined text-4xl mb-2">analytics</span>
                              <p className="text-sm font-bold">AI Audit</p>
                            </div>
                          )}
                        </div>

                        <div className="flex gap-3">
                          <button
                            onClick={handleAudit}
                            disabled={isAuditing}
                            className="flex-1 py-3 rounded-xl bg-indigo-500 text-white font-bold text-xs uppercase tracking-widest hover:bg-indigo-400 transition-all"
                          >
                            {isAuditing ? 'Auditing Nodes...' : 're-Genrate'}
                          </button>

                          <button
                            onClick={() => { setAiAuditRaw(null); setAiAuditJson(null); }}
                            className="flex-1 py-3 rounded-xl border border-white/10 text-white/60 text-xs font-bold uppercase hover:bg-white/5"
                          >
                            Back
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Shared Wealth Bento Box - Side by Side on Mobile */}
                    <div className="grid grid-cols-2 gap-4 md:gap-6">
                        <div className="bg-gradient-to-br from-primary to-emerald-600 rounded-[2.5rem] p-4 md:p-8 text-[#131811] shadow-glow flex flex-col justify-between min-h-[180px] md:min-h-[220px] transition-transform hover:scale-[1.01]">
                            <div>
                                <div className="flex items-center gap-2 mb-2">
                                    <span className="material-symbols-outlined text-xl md:text-2xl">savings</span>
                                    <span className="text-[10px] md:text-xs font-black uppercase tracking-widest opacity-80 hidden md:inline">Realized Savings</span>
                                    <span className="text-[10px] font-black uppercase tracking-widest opacity-80 md:hidden">Saved</span>
                                </div>
                                <h3 className="text-2xl md:text-4xl font-black tracking-tight">{currencySymbol}{(userSettings?.realizedSavings || 0).toLocaleString()}</h3>
                            </div>
                            <p className="text-[10px] md:text-sm font-bold opacity-70 leading-tight">Total money saved through impulse suppression.</p>
                        </div>
                        <div className="bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark rounded-[2.5rem] p-4 md:p-8 flex flex-col justify-between min-h-[180px] md:min-h-[220px] shadow-sm transition-transform hover:scale-[1.01]">
                            <div>
                                <div className="flex items-center gap-2 mb-2 text-text-light-muted">
                                    <span className="material-symbols-outlined text-xl md:text-2xl">event_repeat</span>
                                    <span className="text-[10px] md:text-xs font-black uppercase tracking-widest hidden md:inline">Previous Carryover</span>
                                    <span className="text-[10px] font-black uppercase tracking-widest md:hidden">Rollover</span>
                                </div>
                                <h3 className={`text-2xl md:text-4xl font-black tracking-tight ${previousMonthBalance >= 0 ? 'text-primary' : 'text-danger'}`}>{previousMonthBalance >= 0 ? '+' : '-'}{currencySymbol}{Math.abs(previousMonthBalance).toLocaleString()}</h3>
                            </div>
                            <div className="bg-gray-100 dark:bg-surface-darker p-2 md:p-3 rounded-2xl flex items-center gap-2 md:gap-3">
                                <span className="material-symbols-outlined text-primary text-sm md:text-base">auto_awesome</span>
                                <p className="text-[10px] md:text-xs font-bold text-text-light-muted dark:text-gray-400 leading-tight">Automatic rollover from last month.</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* RIGHT COLUMN: Granular Budget Controls */}
                <div className="lg:col-span-5 flex flex-col gap-6">
                    <div className="bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark rounded-[3rem] p-8 md:p-10 shadow-sm flex flex-col h-full sticky top-4">
                        <div className="flex items-center justify-between mb-8">
                            <div>
                                <h2 className="text-xl font-black text-text-light-main dark:text-text-dark-main uppercase tracking-tight">Set Budget</h2>

                            </div>
                            <span className="text-[10px] font-black text-primary px-4 py-1.5 bg-primary/10 rounded-full uppercase tracking-widest border border-primary/20">Active Cycle</span>
                        </div>

                        <div className="flex flex-col gap-4 overflow-y-auto custom-scrollbar flex-1 max-h-[650px] pr-2">
                            {[...(userSettings?.expenseCategories || [])]
                                .sort((a, b) => {
                                    const aVal = categoryActuals[a] || 0;
                                    const bVal = categoryActuals[b] || 0;
                                    // Push zero-spend categories to bottom
                                    if (aVal === 0 && bVal === 0) return 0;
                                    if (aVal === 0) return 1;
                                    if (bVal === 0) return -1;
                                    // Otherwise sort by highest spending first
                                    return bVal - aVal;
                                })
                                .map(cat => {
                                    const limit = userSettings.categoryBudgets[cat] || 0;
                                    const actual = categoryActuals[cat] || 0;
                                    const progress = limit > 0 ? Math.min(100, (actual / limit) * 100) : 0;
                                    const remaining = limit - actual;
                                    const isOver = remaining < 0;
                                    const style = CATEGORY_STYLES[cat] || CATEGORY_STYLES['Other'];

                                    return (
                                        <div key={cat} className="group bg-gray-50 dark:bg-surface-darker border border-border-light dark:border-border-dark/50 rounded-[2rem] p-5 flex flex-col gap-4 transition-all hover:bg-white dark:hover:bg-surface-dark hover:shadow-lg">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-4">
                                                    <div className={`size-12 rounded-2xl flex items-center justify-center border border-border-light dark:border-border-dark bg-white dark:bg-surface-dark ${style.color} transition-transform group-hover:scale-110 shadow-sm`}>
                                                        <span className="material-symbols-outlined">{style.icon}</span>
                                                    </div>
                                                    <div className="flex flex-col">
                                                        <span className="font-black text-sm text-text-light-main dark:text-white uppercase tracking-tight">{cat}</span>
                                                        <span className={`text-[10px] font-bold uppercase tracking-widest ${isOver ? 'text-danger' : 'text-primary'}`}>
                                                            {isOver ? `Over: ${currencySymbol}${Math.abs(remaining).toLocaleString()}` : `Left: ${currencySymbol}${remaining.toLocaleString()}`}
                                                        </span>
                                                    </div>
                                                </div>
                                                <div className="flex items-end flex-col">
                                                    {editingBudget === cat ? (
                                                        <div className="flex items-center gap-2 animate-fade-in">
                                                            <input type="number" className="w-24 bg-background-light dark:bg-surface-dark border border-primary rounded-xl py-2 px-3 text-sm font-bold outline-none shadow-glow" value={tempValue} onChange={e => setTempValue(e.target.value)} autoFocus />
                                                            <button onClick={async () => { const val = Number(tempValue); if (!isNaN(val)) { const buds = { ...userSettings.categoryBudgets, [cat]: val }; await updateUserSettings({ categoryBudgets: buds }); setEditingBudget(null); setTempValue(''); } }} className="size-9 rounded-xl bg-primary text-[#131811] flex items-center justify-center shadow-glow active:scale-95"><span className="material-symbols-outlined text-lg">check</span></button>
                                                        </div>
                                                    ) : (
                                                        <div className="flex flex-col items-end cursor-pointer group/edit" onClick={() => { setEditingBudget(cat); setTempValue(limit.toString()); }}>
                                                            <span className="text-xl font-black tracking-tighter tabular-nums text-text-light-main dark:text-white group-hover/edit:text-primary transition-colors">{currencySymbol}{limit.toLocaleString()}</span>
                                                            <span className="text-[10px] font-bold text-text-light-muted flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity uppercase tracking-widest">Adjust Cap <span className="material-symbols-outlined text-[10px]">edit</span></span>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="flex flex-col gap-2">
                                                <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest opacity-40">
                                                    <span>Consumed: {currencySymbol}{actual.toLocaleString()}</span>
                                                    <span className={isOver ? 'text-danger font-black' : ''}>{progress.toFixed(0)}%</span>
                                                </div>
                                                <div className="h-2 w-full bg-gray-200 dark:bg-black/30 rounded-full overflow-hidden p-0.5 border border-border-light dark:border-border-dark">
                                                    <div className={`h-full rounded-full transition-all duration-1000 ease-out ${isOver ? 'bg-danger' : progress > 85 ? 'bg-orange-500' : 'bg-primary'}`} style={{ width: `${Math.min(100, progress)}%` }}></div>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                        </div>

                        <div className="mt-8 pt-8 border-t border-border-light dark:border-border-dark">
                            <div className="flex justify-between items-center mb-4">
                                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-text-light-muted opacity-60">Monthly Limit</p>
                                <span className="text-xs font-black text-primary bg-primary/10 px-3 py-1 rounded-full">{((currentMonthSpent / Math.max(1, userSettings?.monthlyExpenseLimit ?? 1)) * 100).toFixed(0)}% </span>
                            </div>
                            <div className="h-6 w-full bg-gray-200 dark:bg-surface-darker rounded-full overflow-hidden p-1.5 border border-border-light dark:border-border-dark">
                                    <div className="h-full bg-gradient-to-r from-primary via-primary to-emerald-400 rounded-full transition-all duration-1000 ease-out" style={{ width: `${Math.min(100, (currentMonthSpent / Math.max(1, userSettings?.monthlyExpenseLimit ?? 1)) * 100)}%` }}></div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Goal Creation Modal */}
            {showGoalModal && (
                <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in">
                    <div className="bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark rounded-[3rem] p-8 md:p-10 w-full max-w-md shadow-2xl animate-slide-up">
                        <div className="flex justify-between items-center mb-8">
                            <div className="flex items-center gap-3">
                                <div className="size-10 rounded-2xl bg-primary/10 text-primary flex items-center justify-center"><span className="material-symbols-outlined">flag</span></div>
                                <h2 className="text-2xl font-black uppercase tracking-tight">New Milestone</h2>
                            </div>
                            <button onClick={() => setShowGoalModal(false)} className="size-10 rounded-full hover:bg-gray-100 dark:hover:bg-surface-darker transition-colors"><span className="material-symbols-outlined">close</span></button>
                        </div>
                        <div className="flex flex-col gap-6">
                            <div className="flex flex-col gap-2">
                                <label className="text-[10px] font-black uppercase tracking-widest text-text-light-muted opacity-60 ml-2">Name</label>
                                <input type="text" className="w-full bg-gray-50 dark:bg-surface-darker border border-border-light dark:border-border-dark rounded-2xl p-4 font-bold outline-none focus:border-primary transition-all" placeholder="e.g. Dream Wedding Fund" value={goalForm.name} onChange={e => setGoalForm({ ...goalForm, name: e.target.value })} />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="flex flex-col gap-2">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-text-light-muted opacity-60 ml-2">Target {currencySymbol}</label>
                                    <input type="number" className="w-full bg-gray-50 dark:bg-surface-darker border border-border-light dark:border-border-dark rounded-2xl p-4 font-bold outline-none focus:border-primary transition-all" placeholder="0.00" value={goalForm.target} onChange={e => setGoalForm({ ...goalForm, target: e.target.value })} />
                                </div>
                                <div className="flex flex-col gap-2">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-text-light-muted opacity-60 ml-2">Icon</label>
                                    <select className="w-full bg-gray-50 dark:bg-surface-darker border border-border-light dark:border-border-dark rounded-2xl p-4 font-bold outline-none appearance-none cursor-pointer" value={goalForm.icon} onChange={e => setGoalForm({ ...goalForm, icon: e.target.value })}>
                                        <option value="savings">Savings</option>
                                        <option value="flight">Travel</option>
                                        <option value="home">Housing</option>
                                        <option value="directions_car">Automotive</option>
                                        <option value="devices_other">Gadget</option>
                                    </select>
                                </div>
                            </div>
                            <div className="flex flex-col gap-2">
                                <label className="text-[10px] font-black uppercase tracking-widest text-text-light-muted opacity-60 ml-2">Target Date</label>
                                <input type="date" className="w-full bg-gray-50 dark:bg-surface-darker border border-border-light dark:border-border-dark rounded-2xl p-4 font-bold outline-none focus:border-primary transition-all" value={goalForm.date} onChange={e => setGoalForm({ ...goalForm, date: e.target.value })} style={{ colorScheme: 'dark' }} />
                            </div>
                            <button onClick={handleAddGoal} className="w-full bg-primary text-[#131811] font-black py-5 rounded-[2rem] uppercase tracking-[0.2em] text-xs shadow-glow mt-4 transition-all hover:translate-y-[-2px]">Deploy Milestone</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Add Funds Modal */}
            {showFundModal && (
                <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in">
                    <div className="bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark rounded-[2.5rem] sm:rounded-[3rem] p-4 sm:p-8 md:p-8 w-full sm:max-w-sm md:max-w-md lg:max-w-lg xl:max-w-xl max-h-[90vh] overflow-y-auto shadow-2xl animate-slide-up text-center">
                        <div className="size-16 rounded-3xl bg-primary/10 text-primary flex items-center justify-center mx-auto mb-6"><span className="material-symbols-outlined text-3xl">add_card</span></div>
                        <h3 className="text-2xl font-black text-text-light-main dark:text-text-dark-main mb-2">Inject Funds</h3>
                        <p className="text-sm text-text-light-muted mb-8">Securing capital for <span className="text-primary font-bold">{showFundModal.name}</span></p>

                        <div className="relative mb-8">
                            <span className="absolute left-4 sm:left-6 top-1/2 -translate-y-1/2 text-xl sm:text-2xl md:text-3xl font-black text-text-light-subtle opacity-40">{currencySymbol}</span>
                            <input
                                type="number"
                                className="w-full bg-gray-50 dark:bg-surface-darker border border-border-light dark:border-border-dark rounded-2xl p-4 sm:p-6 pl-12 sm:pl-14 text-2xl sm:text-3xl md:text-4xl font-black focus:border-primary outline-none text-center shadow-inner"
                                value={fundAmount}
                                onChange={e => setFundAmount(e.target.value)}
                                autoFocus
                                placeholder="0.00"
                            />
                        </div>

                        <div className="flex  sm:flex-row gap-3 sm:gap-4">
                            <button
                                onClick={() => setShowFundModal(null)}
                                className="flex-1 py-3 sm:py-4 rounded-xl font-black text-xs uppercase tracking-widest text-text-light-muted hover:bg-gray-100 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleAddFunds}
                                className="flex-1 py-3 sm:py-4 rounded-xl font-black text-xs uppercase tracking-widest bg-primary text-[#131811] shadow-glow transition-all active:scale-[0.98]"
                            >
                                Confirm
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default BudgetGoalsScreen;
