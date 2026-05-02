
import React, { useState, useMemo, useEffect } from 'react';
import { useStore, Transaction } from '../context/Store';
import { requestNotificationPermission, scheduleSubscriptionReminders } from '../utils/notifications';

const CATEGORY_ICONS: Record<string, string> = {
    "Food": "restaurant",
    "Housing": "home",
    "Transportation": "directions_car",
    "Entertainment": "movie",
    "Shopping": "shopping_bag",
    "Health": "medical_services",
    "Utilities": "bolt",
    "Subscription": "subscriptions",
    "Other": "receipt"
};

const SubscriptionsScreen: React.FC = () => {
    const { transactions, userSettings, addTransaction, updateTransaction, deleteTransaction } = useStore();
    const [showAddModal, setShowAddModal] = useState(false);
    const [isDetecting, setIsDetecting] = useState(false);
    const [isFlipped, setIsFlipped] = useState(false);
    const [isEditMode, setIsEditMode] = useState(false);
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [editingSub, setEditingSub] = useState<Transaction | null>(null);
    const [burnPeriod, setBurnPeriod] = useState<'monthly' | 'yearly'>('monthly');
    const [newSub, setNewSub] = useState({
        title: '',
        amount: '',
        frequency: 'monthly' as 'monthly' | 'yearly' | 'weekly',
        category: 'Subscription',
        renewalDate: new Date().toISOString().split('T')[0]
    });

    const subscriptions = useMemo(() => {
        return transactions.filter(t => t.isSubscription === true);
    }, [transactions]);

    const activeSubscriptions = useMemo(() => {
        return subscriptions.filter(s => s.subscriptionStatus !== 'paused');
    }, [subscriptions]);

    // Handle Automatic Renewals and Notifications
    useEffect(() => {
        const processRenewals = async () => {
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            for (const sub of subscriptions) {
                if (!sub.nextRenewalDate || sub.subscriptionStatus === 'paused') continue;

                const renewalDate = new Date(sub.nextRenewalDate);
                renewalDate.setHours(0, 0, 0, 0);

                if (renewalDate <= today) {
                    // 1. Record the transaction
                    await addTransaction({
                        title: `${sub.title} (Renewal)`,
                        amount: sub.amount,
                        date: today.toISOString().split('T')[0],
                        category: sub.category || 'Subscription',
                        type: 'expense',
                        paymentMethod: sub.paymentMethod || 'Other',
                        note: `Automated renewal for ${sub.title}`
                    });

                    // 2. Update next renewal date
                    const nextDate = new Date(renewalDate);
                    if (sub.subscriptionFrequency === 'yearly') nextDate.setFullYear(nextDate.getFullYear() + 1);
                    else if (sub.subscriptionFrequency === 'weekly') nextDate.setDate(nextDate.getDate() + 7);
                    else nextDate.setMonth(nextDate.getMonth() + 1);

                    await updateTransaction(sub.id, { 
                        nextRenewalDate: nextDate.toISOString().split('T')[0] 
                    });
                }
            }
        };

        processRenewals();
        requestNotificationPermission().then(granted => {
            if (granted) scheduleSubscriptionReminders(subscriptions);
        });
    }, [subscriptions.length]); // Run when subscriptions change

    const stats = useMemo(() => {
        const monthly = activeSubscriptions.reduce((acc, sub) => {
            const amt = sub.amount;
            if (sub.subscriptionFrequency === 'yearly') return acc + (amt / 12);
            if (sub.subscriptionFrequency === 'weekly') return acc + (amt * 4);
            return acc + amt;
        }, 0);

        // Category Breakdown for the graph
        const breakdown: Record<string, number> = {};
        activeSubscriptions.forEach(sub => {
            const cat = sub.category || 'Other';
            let amt = sub.amount;
            if (sub.subscriptionFrequency === 'yearly') amt = amt / 12;
            if (sub.subscriptionFrequency === 'weekly') amt = amt * 4;
            breakdown[cat] = (breakdown[cat] || 0) + amt;
        });

        return {
            monthly,
            yearly: monthly * 12,
            breakdown
        };
    }, [activeSubscriptions]);

    const formatDate = (dateStr: string) => {
        if (!dateStr) return '';
        const d = new Date(dateStr);
        return d.toLocaleDateString('en-GB', { 
            day: '2-digit', 
            month: 'long', 
            year: 'numeric' 
        });
    };

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: userSettings?.currency || 'INR',
            maximumFractionDigits: 0
        }).format(amount);
    };

    const handleToggleStatus = async (sub: Transaction) => {
        const newStatus = sub.subscriptionStatus === 'paused' ? 'active' : 'paused';
        await updateTransaction(sub.id, { subscriptionStatus: newStatus });
    };

    const handleDelete = async (id: string) => {
        if (window.confirm("Are you sure you want to delete this subscription?")) {
            await deleteTransaction(id);
        }
    };

    const handleMassDelete = async () => {
        if (window.confirm(`Delete ${selectedIds.length} subscriptions?`)) {
            for (const id of selectedIds) {
                await deleteTransaction(id);
            }
            setSelectedIds([]);
            setIsEditMode(false);
        }
    };

    const toggleSelection = (id: string) => {
        setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
    };

    const openEditModal = (sub: Transaction) => {
        setEditingSub(sub);
        setNewSub({
            title: sub.title,
            amount: sub.amount.toString(),
            frequency: sub.subscriptionFrequency || 'monthly',
            category: sub.category || 'Subscription',
            renewalDate: sub.nextRenewalDate || new Date().toISOString().split('T')[0]
        });
        setShowAddModal(true);
    };

    const detectSubscriptions = async () => {
        setIsDetecting(true);
        await new Promise(r => setTimeout(r, 2000));
        const patterns = [
            { kw: 'netflix', cat: 'Entertainment' },
            { kw: 'spotify', cat: 'Entertainment' },
            { kw: 'amazon', cat: 'Shopping' },
            { kw: 'youtube', cat: 'Entertainment' },
            { kw: 'gym', cat: 'Health' },
            { kw: 'rent', cat: 'Housing' },
            { kw: 'icloud', cat: 'Utilities' },
            { kw: 'google', cat: 'Utilities' },
            { kw: 'adobe', cat: 'Other' },
            { kw: 'zomato', cat: 'Food' },
            { kw: 'swiggy', cat: 'Food' }
        ];
        
        let count = 0;
        for (const tx of transactions) {
            const match = patterns.find(p => tx.title.toLowerCase().includes(p.kw));
            if (!tx.isSubscription && match) {
                await updateTransaction(tx.id, { 
                    isSubscription: true, 
                    category: match.cat,
                    subscriptionFrequency: 'monthly',
                    subscriptionStatus: 'active',
                    nextRenewalDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
                });
                count++;
            }
        }
        setIsDetecting(false);
        alert(count > 0 ? `Detected ${count} new subscriptions!` : "No new patterns found.");
    };

    return (
        <div className="max-w-6xl mx-auto p-4 md:p-10 pb-32 min-h-screen relative overflow-x-hidden">
            <style>{`
                .perspective-1000 { perspective: 1000px; }
                .preserve-3d { transform-style: preserve-3d; }
                .backface-hidden { backface-visibility: hidden; }
                .rotate-y-180 { transform: rotateY(180deg); }
                .flip-card-inner { transition: transform 0.8s cubic-bezier(0.4, 0, 0.2, 1); }
                .is-flipped { transform: rotateY(180deg); }
            `}</style>

            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
                <div className="flex flex-col gap-1">
                    <h3 className="text-3xl md:text-5xl font-black tracking-tight text-text-light-main dark:text-text-dark-main">Subscriptions</h3>
                    <p className="text-text-light-muted dark:text-text-dark-muted text-sm md:text-lg">Track, Pause, and Optimize your recurring spend.</p>
                </div>
                <button onClick={detectSubscriptions} disabled={isDetecting} className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-primary/10 border border-primary/20 text-primary text-xs font-black uppercase tracking-widest hover:bg-primary/20 transition-all active:scale-95">
                    <span className={`material-symbols-outlined text-lg ${isDetecting ? 'animate-spin' : ''}`}>{isDetecting ? 'sync' : 'auto_awesome'}</span>
                    {isDetecting ? 'Analyzing...' : 'Magic Detect'}
                </button>
            </div>

            {/* --- THE FLIPPABLE BURN CARD --- */}
            <div className="perspective-1000 w-full mb-12 h-64 md:h-72">
                <div className={`relative w-full h-full flip-card-inner preserve-3d ${isFlipped ? 'is-flipped' : ''}`}>
                    
                    {/* FRONT: Total Burn */}
                    <div className="absolute inset-0 backface-hidden bg-gradient-to-br from-rose-500 to-rose-700 rounded-[3rem] p-8 md:p-12 text-white shadow-2xl flex flex-col justify-between overflow-hidden group">
                        <div className="absolute -right-10 -top-10 size-64 bg-white/10 blur-[80px] rounded-full" />
                        <div className="relative z-10 flex items-start justify-between">
                            <div>
                                <p className="text-[10px] font-black uppercase tracking-[0.3em] opacity-60 mb-1">Total Subscription Burn</p>
                                <h2 className="text-5xl md:text-6xl font-black tracking-tighter">
                                    {formatCurrency(burnPeriod === 'monthly' ? stats.monthly : stats.yearly)}
                                </h2>
                            </div>
                            <div className="flex bg-black/20 p-1 rounded-2xl backdrop-blur-md">
                                <button onClick={(e) => { e.stopPropagation(); setBurnPeriod('monthly'); }} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${burnPeriod === 'monthly' ? 'bg-white text-rose-600' : 'text-white/60'}`}>Month</button>
                                <button onClick={(e) => { e.stopPropagation(); setBurnPeriod('yearly'); }} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${burnPeriod === 'yearly' ? 'bg-white text-rose-600' : 'text-white/60'}`}>Year</button>
                            </div>
                        </div>
                        <div className="relative z-10 flex items-center justify-between mt-8">
                            <div className="flex items-center gap-4">
                                <div className="size-10 rounded-xl bg-white/20 backdrop-blur-md flex items-center justify-center border border-white/10">
                                    <span className="material-symbols-outlined">trending_down</span>
                                </div>
                                <span className="text-xs font-bold opacity-80">{subscriptions.length} detected • {activeSubscriptions.length} active</span>
                            </div>
                            <button onClick={() => setIsFlipped(true)} className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest bg-white/10 hover:bg-white/20 px-4 py-2 rounded-xl transition-all">
                                Category Breakdown <span className="material-symbols-outlined text-sm">bar_chart</span>
                            </button>
                        </div>
                    </div>

                    {/* BACK: Category Breakdown */}
                    <div className="absolute inset-0 backface-hidden rotate-y-180 bg-surface-dark border border-white/10 rounded-[3rem] p-8 md:p-12 text-white shadow-2xl overflow-hidden">
                        <div className="flex items-center justify-between mb-8">
                            <div>
                                <h4 className="text-xl font-black">Monthly Allocation</h4>
                                <p className="text-[10px] font-black uppercase tracking-widest opacity-50">Where your money goes</p>
                            </div>
                            <button onClick={() => setIsFlipped(false)} className="size-10 rounded-full bg-white/5 flex items-center justify-center hover:bg-white/10"><span className="material-symbols-outlined">close</span></button>
                        </div>
                        <div className="flex flex-col gap-3 max-h-32 overflow-y-auto pr-2">
                            {(Object.entries(stats.breakdown) as [string, number][]).sort((a,b) => b[1] - a[1]).map(([cat, amt]) => {
                                const percentage = (amt / stats.monthly) * 100;
                                return (
                                    <div key={cat} className="flex flex-col gap-1">
                                        <div className="flex justify-between text-[10px] font-black uppercase tracking-widest">
                                            <span>{cat}</span>
                                            <span className="text-rose-500">{formatCurrency(amt)}</span>
                                        </div>
                                        <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                                            <div className="h-full bg-rose-500 rounded-full transition-all duration-1000" style={{ width: `${percentage}%` }} />
                                        </div>
                                    </div>
                                );
                            })}
                            {Object.keys(stats.breakdown).length === 0 && <p className="text-xs text-center opacity-40 py-4">No active subscriptions to analyze.</p>}
                        </div>
                    </div>
                </div>
            </div>

            {/* --- NAVIGATION & TIMELINE --- */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
                
                {/* Active Subs List */}
                <div className="lg:col-span-8 flex flex-col gap-6">
                    <div className="flex items-center justify-between px-2">
                        <h4 className="text-xl font-black flex items-center gap-2"><span className="material-symbols-outlined text-primary">list</span> Manage Subscriptions</h4>
                        <div className="flex items-center gap-2">
                            {isEditMode && selectedIds.length > 0 && (
                                <button onClick={handleMassDelete} className="flex items-center gap-2 px-4 py-2 bg-rose-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest animate-scale-up">
                                    <span className="material-symbols-outlined text-sm">delete_sweep</span>
                                    Delete ({selectedIds.length})
                                </button>
                            )}
                            <button 
                                onClick={() => { setIsEditMode(!isEditMode); setSelectedIds([]); }} 
                                className={`size-10 rounded-xl flex items-center justify-center transition-all ${isEditMode ? 'bg-primary text-black' : 'bg-gray-100 dark:bg-surface-darker hover:bg-primary/20 hover:text-primary'}`}
                            >
                                <span className="material-symbols-outlined">{isEditMode ? 'close' : 'edit'}</span>
                            </button>
                        </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {subscriptions.length === 0 ? (
                            <div className="col-span-full py-20 text-center opacity-30 bg-surface-light dark:bg-surface-dark border border-dashed border-border-light dark:border-border-dark rounded-[2.5rem]">
                                <span className="material-symbols-outlined text-6xl mb-4">sentiment_neutral</span>
                                <p className="font-bold">No subscriptions yet.</p>
                            </div>
                        ) : (
                            subscriptions.map(sub => (
                                <div 
                                    key={sub.id} 
                                    onClick={() => isEditMode && toggleSelection(sub.id)}
                                    className={`group relative bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark rounded-[2rem] p-6 transition-all shadow-sm cursor-pointer ${isEditMode ? 'hover:border-primary' : 'hover:border-primary/40'} ${selectedIds.includes(sub.id) ? 'border-primary ring-2 ring-primary/20' : ''} ${sub.subscriptionStatus === 'paused' ? 'opacity-60 grayscale-[0.5]' : ''}`}
                                >
                                    {isEditMode && (
                                        <div className="absolute top-4 left-4 z-20">
                                            <div className={`size-6 rounded-full border-2 flex items-center justify-center transition-all ${selectedIds.includes(sub.id) ? 'bg-primary border-primary' : 'border-border-light dark:border-border-dark'}`}>
                                                {selectedIds.includes(sub.id) && <span className="material-symbols-outlined text-black text-sm">check</span>}
                                            </div>
                                        </div>
                                    )}
                                    <div className={`flex items-start justify-between mb-6 ${isEditMode ? 'pl-8' : ''}`}>
                                        <div className="size-12 rounded-2xl bg-gray-100 dark:bg-surface-darker flex items-center justify-center text-primary group-hover:scale-110 transition-transform border border-border-light dark:border-border-dark">
                                            <span className="material-symbols-outlined">{CATEGORY_ICONS[sub.category || 'Subscription'] || 'subscriptions'}</span>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-xl font-black">{formatCurrency(sub.amount)}</p>
                                            <p className="text-[10px] font-black uppercase tracking-widest opacity-50">{sub.subscriptionFrequency}</p>
                                        </div>
                                    </div>
                                    <div className="mb-6">
                                        <div className="flex items-center justify-between gap-2">
                                            <h5 className="text-lg font-black tracking-tight truncate">{sub.title}</h5>
                                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all">
                                                <button onClick={(e) => { e.stopPropagation(); openEditModal(sub); }} className="size-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center hover:bg-primary hover:text-black transition-all">
                                                    <span className="material-symbols-outlined text-lg">edit</span>
                                                </button>
                                                <button onClick={(e) => { e.stopPropagation(); handleDelete(sub.id); }} className="size-8 rounded-lg bg-rose-500/10 text-rose-500 flex items-center justify-center hover:bg-rose-500 hover:text-white transition-all">
                                                    <span className="material-symbols-outlined text-lg">delete</span>
                                                </button>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2 mt-1">
                                            <span className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">{sub.category}</span>
                                            {sub.nextRenewalDate && (
                                                <span className="text-[9px] font-bold text-text-light-muted flex items-center gap-1">
                                                    <span className="material-symbols-outlined text-[12px]">schedule</span>
                                                    Due: {formatDate(sub.nextRenewalDate)}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex items-center justify-between pt-4 border-t border-border-light dark:border-border-dark">
                                        <div className="flex items-center gap-2">
                                            <span className={`size-2 rounded-full ${sub.subscriptionStatus === 'paused' ? 'bg-rose-500' : 'bg-primary animate-pulse'}`} />
                                            <span className="text-[10px] font-black uppercase tracking-widest opacity-60">{sub.subscriptionStatus || 'active'}</span>
                                        </div>
                                        <div className="flex gap-2">
                                            <button onClick={() => handleToggleStatus(sub)} className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${sub.subscriptionStatus === 'paused' ? 'bg-primary text-black' : 'bg-gray-100 dark:bg-surface-darker hover:bg-white/10'}`}>
                                                {sub.subscriptionStatus === 'paused' ? 'Resume' : 'Pause'}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* Renewal Timeline Sidebar */}
                <div className="lg:col-span-4 flex flex-col gap-6">
                    <h4 className="text-xl font-black flex items-center gap-2 px-2"><span className="material-symbols-outlined text-rose-500">alarm</span> Upcoming Bills</h4>
                    <div className="bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark rounded-[2.5rem] p-8 flex flex-col gap-8 shadow-sm">
                        {activeSubscriptions.length === 0 ? (
                            <p className="text-xs text-text-light-muted opacity-50 italic">No upcoming renewals found.</p>
                        ) : (
                            activeSubscriptions.slice(0, 5).sort((a,b) => new Date(a.nextRenewalDate || '').getTime() - new Date(b.nextRenewalDate || '').getTime()).map((sub, i) => {
                                const daysLeft = Math.ceil((new Date(sub.nextRenewalDate || '').getTime() - Date.now()) / (1000*60*60*24));
                                return (
                                    <div key={sub.id} className="flex gap-4 relative group">
                                        {i !== activeSubscriptions.length - 1 && (
                                            <div className="absolute left-[11px] top-6 bottom-[-32px] w-[2px] bg-border-light dark:bg-border-dark group-hover:bg-primary/20 transition-colors" />
                                        )}
                                        <div className="size-6 rounded-full bg-primary/20 border-4 border-surface-dark flex items-center justify-center z-10">
                                            <div className={`size-1.5 rounded-full ${daysLeft < 3 ? 'bg-rose-500 animate-ping' : 'bg-primary'}`} />
                                        </div>
                                        <div className="flex-1">
                                            <div className="flex justify-between items-start mb-1">
                                                <p className="text-xs font-black truncate max-w-[120px]">{sub.title}</p>
                                                <span className="text-[10px] font-black text-rose-500">{formatCurrency(sub.amount)}</span>
                                            </div>
                                            <p className={`text-[9px] font-bold ${daysLeft < 3 ? 'text-rose-500' : 'text-text-light-muted opacity-60'}`}>
                                                {daysLeft < 0 ? 'Overdue' : daysLeft === 0 ? 'Today' : `In ${daysLeft} days`}
                                            </p>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>

                    <div className="bg-primary/5 border border-primary/20 rounded-3xl p-6 flex items-center gap-4">
                        <div className="size-12 rounded-2xl bg-primary flex items-center justify-center text-black">
                            <span className="material-symbols-outlined text-2xl">auto_fix_high</span>
                        </div>
                        <div>
                            <p className="text-[10px] font-black uppercase tracking-widest text-primary mb-1">Optimizer Tip</p>
                            <p className="text-xs font-medium text-text-light-muted">You could save {formatCurrency(stats.monthly * 0.15)} by switching to annual plans.</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Quick Add FAB */}
            <button onClick={() => setShowAddModal(true)} className="fixed bottom-24 right-6 md:right-12 size-16 bg-primary text-black rounded-3xl shadow-glow flex items-center justify-center group hover:scale-110 active:scale-95 transition-all z-40">
                <span className="material-symbols-outlined text-3xl group-hover:rotate-90 transition-transform">add</span>
            </button>

            {/* Add Modal */}
            {showAddModal && (
                <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-fade-in">
                    <div className="bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark rounded-[2.5rem] w-full max-w-md p-8 shadow-2xl animate-scale-up">
                        <h4 className="text-2xl font-black mb-8">Track New Service</h4>
                        <div className="flex flex-col gap-6">
                            <div className="flex flex-col gap-2">
                                <label className="text-[10px] font-black uppercase tracking-widest opacity-50">Service Name</label>
                                <input type="text" value={newSub.title} onChange={e => setNewSub({...newSub, title: e.target.value})} className="w-full bg-gray-50 dark:bg-surface-darker border border-border-light dark:border-border-dark rounded-2xl p-4 font-bold outline-none focus:border-primary" placeholder="e.g. Netflix, Adobe" />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="flex flex-col gap-2">
                                    <label className="text-[10px] font-black uppercase tracking-widest opacity-50">Amount</label>
                                    <input type="number" value={newSub.amount} onChange={e => setNewSub({...newSub, amount: e.target.value})} className="w-full bg-gray-50 dark:bg-surface-darker border border-border-light dark:border-border-dark rounded-2xl p-4 font-bold outline-none focus:border-primary" placeholder="0.00" />
                                </div>
                                <div className="flex flex-col gap-2">
                                    <label className="text-[10px] font-black uppercase tracking-widest opacity-50">Category</label>
                                    <select value={newSub.category} onChange={e => setNewSub({...newSub, category: e.target.value})} className="w-full bg-gray-50 dark:bg-surface-darker border border-border-light dark:border-border-dark rounded-2xl p-4 font-bold outline-none focus:border-primary appearance-none">
                                        {Object.keys(CATEGORY_ICONS).map(cat => <option key={cat} value={cat}>{cat}</option>)}
                                    </select>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="flex flex-col gap-2">
                                    <label className="text-[10px] font-black uppercase tracking-widest opacity-50">Frequency</label>
                                    <select value={newSub.frequency} onChange={e => setNewSub({...newSub, frequency: e.target.value as any})} className="w-full bg-gray-50 dark:bg-surface-darker border border-border-light dark:border-border-dark rounded-2xl p-4 font-bold outline-none focus:border-primary appearance-none">
                                        <option value="weekly">Weekly</option>
                                        <option value="monthly">Monthly</option>
                                        <option value="yearly">Yearly</option>
                                    </select>
                                </div>
                                <div className="flex flex-col gap-2">
                                    <label className="text-[10px] font-black uppercase tracking-widest opacity-50">Next Bill</label>
                                    <input type="date" value={newSub.renewalDate} onChange={e => setNewSub({...newSub, renewalDate: e.target.value})} className="w-full bg-gray-50 dark:bg-surface-darker border border-border-light dark:border-border-dark rounded-2xl p-4 font-bold outline-none focus:border-primary" style={{colorScheme: 'dark'}} />
                                </div>
                            </div>
                            <div className="flex gap-4 mt-4">
                                <button onClick={() => { setShowAddModal(false); setEditingSub(null); }} className="flex-1 py-4 rounded-2xl font-black uppercase tracking-widest text-xs border border-border-light dark:border-border-dark hover:bg-gray-50 dark:hover:bg-white/5 transition-all">Cancel</button>
                                <button onClick={async () => {
                                    if(!newSub.title || !newSub.amount) return;
                                    const data = {
                                        title: newSub.title,
                                        amount: parseFloat(newSub.amount),
                                        category: newSub.category,
                                        isSubscription: true,
                                        subscriptionFrequency: newSub.frequency,
                                        nextRenewalDate: newSub.renewalDate
                                    };

                                    if (editingSub) {
                                        await updateTransaction(editingSub.id, data);
                                    } else {
                                        await addTransaction({
                                            ...data,
                                            date: new Date().toISOString().split('T')[0],
                                            type: 'expense',
                                            subscriptionStatus: 'active'
                                        });
                                    }
                                    setShowAddModal(false);
                                    setEditingSub(null);
                                    setNewSub({ title: '', amount: '', frequency: 'monthly', category: 'Subscription', renewalDate: new Date().toISOString().split('T')[0] });
                                }} className="flex-1 py-4 rounded-2xl bg-primary text-black font-black uppercase tracking-widest text-xs shadow-glow transition-all active:scale-95">
                                    {editingSub ? 'Save Changes' : 'Start Tracking'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SubscriptionsScreen;
