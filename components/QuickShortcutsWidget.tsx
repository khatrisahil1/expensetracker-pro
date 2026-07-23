import React, { useState } from 'react';
import { useStore, QuickShortcut } from '../context/Store';

const EXPENSE_CATS = ["Food", "Rent", "Transportation", "Shopping", "Entertainment", "Health", "Utilities", "Home", "Other"];
const INCOME_CATS = ["Salary", "Freelance", "Investments", "Gifts", "Refunds", "Rental", "Other"];

const QuickShortcutsWidget: React.FC = () => {
  const { userSettings, updateUserSettings, addTransaction, isDemo } = useStore();
  const shortcuts = userSettings?.quickShortcuts || [];
  const currencySymbol = userSettings?.currency === 'USD' ? '$' : userSettings?.currency === 'EUR' ? '€' : '₹';

  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [form, setForm] = useState({
    emoji: '💸', label: '', amount: '', type: 'expense' as 'income' | 'expense',
    category: 'Food', paymentMethod: userSettings?.paymentMethods[0] || 'UPI'
  });

  const handleTap = async (s: QuickShortcut) => {
    if (isDemo) return;
    const today = new Date().toISOString().split('T')[0];
    await addTransaction({
      title: s.label, amount: s.amount, date: today,
      type: s.type, category: s.category, paymentMethod: s.paymentMethod,
    });
    setRemoving(s.id);
    setTimeout(() => setRemoving(null), 400);
  };

  const handleSave = async () => {
    const amt = parseFloat(form.amount);
    if (!form.label.trim() || isNaN(amt) || amt <= 0) return;
    setIsSaving(true);
    const newShortcut: QuickShortcut = {
      id: crypto.randomUUID(),
      emoji: form.emoji || '💸',
      label: form.label.trim(),
      amount: amt,
      type: form.type,
      category: form.category,
      paymentMethod: form.paymentMethod,
    };
    await updateUserSettings({ quickShortcuts: [...shortcuts, newShortcut] });
    setShowModal(false);
    setForm({ emoji: '💸', label: '', amount: '', type: 'expense', category: 'Food', paymentMethod: userSettings?.paymentMethods[0] || 'UPI' });
    setIsSaving(false);
  };

  const handleDelete = async (id: string) => {
    await updateUserSettings({ quickShortcuts: shortcuts.filter(s => s.id !== id) });
    setEditingId(null);
  };

  const cats = form.type === 'expense' ? EXPENSE_CATS : INCOME_CATS;

  return (
    <div className="col-span-2 md:col-span-2 lg:col-span-12 bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark rounded-[2rem] p-5 shadow-card-light dark:shadow-card">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-primary text-xl">bolt</span>
          <h3 className="text-sm font-black uppercase tracking-widest text-text-light-main dark:text-text-dark-main">Quick Shortcuts</h3>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="size-8 rounded-full bg-primary/10 text-primary flex items-center justify-center hover:bg-primary hover:text-[#131811] transition-all"
        >
          <span className="material-symbols-outlined text-[18px]">add</span>
        </button>
      </div>

      {shortcuts.length === 0 ? (
        <div
          onClick={() => setShowModal(true)}
          className="flex items-center gap-3 p-4 rounded-2xl border border-dashed border-border-light dark:border-border-dark text-text-light-muted dark:text-text-dark-muted cursor-pointer hover:border-primary/40 hover:text-primary transition-all"
        >
          <span className="material-symbols-outlined text-xl">bolt</span>
          <span className="text-sm font-bold">Save your first shortcut for one-tap transactions</span>
        </div>
      ) : (
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
          {shortcuts.map(s => (
            <div key={s.id} className="relative flex-shrink-0">
              <button
                onClick={() => editingId === s.id ? setEditingId(null) : handleTap(s)}
                onContextMenu={(e) => { e.preventDefault(); setEditingId(editingId === s.id ? null : s.id); }}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-full border transition-all font-bold text-sm whitespace-nowrap ${
                  removing === s.id
                    ? 'bg-primary/20 border-primary scale-95'
                    : s.type === 'income'
                    ? 'bg-primary/10 border-primary/20 text-primary hover:bg-primary hover:text-[#131811]'
                    : 'bg-surface-darker border-border-light dark:border-border-dark text-text-light-main dark:text-text-dark-main hover:border-primary/40'
                }`}
              >
                <span>{s.emoji}</span>
                <span>{s.label}</span>
                <span className={`text-xs font-black ${s.type === 'income' ? 'text-primary' : 'text-danger'}`}>
                  {s.type === 'income' ? '+' : '-'}{currencySymbol}{s.amount}
                </span>
              </button>
              {editingId === s.id && (
                <button
                  onClick={() => handleDelete(s.id)}
                  className="absolute -top-1.5 -right-1.5 size-5 rounded-full bg-danger text-white flex items-center justify-center text-[10px] font-black shadow-md hover:scale-110 transition-transform"
                >
                  ×
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Add Shortcut Modal */}
      {showModal && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark rounded-3xl p-6 w-full max-w-sm shadow-2xl animate-slide-up flex flex-col gap-5">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-black text-text-light-main dark:text-text-dark-main">New Shortcut</h3>
              <button onClick={() => setShowModal(false)} className="size-8 rounded-full hover:bg-gray-100 dark:hover:bg-surface-darker flex items-center justify-center">
                <span className="material-symbols-outlined text-text-light-muted">close</span>
              </button>
            </div>

            {/* Type toggle */}
            <div className="flex bg-gray-100 dark:bg-surface-darker p-1 rounded-xl">
              {(['expense', 'income'] as const).map(t => (
                <button
                  key={t}
                  onClick={() => setForm(p => ({ ...p, type: t, category: t === 'income' ? 'Salary' : 'Food' }))}
                  className={`flex-1 py-2 rounded-lg text-sm font-bold capitalize transition-all ${
                    form.type === t
                      ? t === 'expense' ? 'bg-white dark:bg-surface-dark text-danger shadow-sm' : 'bg-white dark:bg-surface-dark text-primary shadow-sm'
                      : 'text-text-light-muted dark:text-text-dark-muted'
                  }`}
                >{t}</button>
              ))}
            </div>

            {/* Emoji + Label row */}
            <div className="flex gap-3">
              <input
                type="text" maxLength={2} value={form.emoji}
                onChange={e => setForm(p => ({ ...p, emoji: e.target.value }))}
                className="w-16 text-center text-2xl bg-gray-50 dark:bg-surface-darker border border-border-light dark:border-border-dark rounded-xl p-2 outline-none focus:border-primary"
                placeholder="💸"
              />
              <input
                type="text" value={form.label}
                onChange={e => setForm(p => ({ ...p, label: e.target.value }))}
                placeholder="Label (e.g. Morning Coffee)"
                className="flex-1 bg-gray-50 dark:bg-surface-darker border border-border-light dark:border-border-dark rounded-xl p-3 text-sm font-bold text-text-light-main dark:text-text-dark-main outline-none focus:border-primary"
              />
            </div>

            {/* Amount */}
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-text-light-muted">{currencySymbol}</span>
              <input
                type="number" value={form.amount}
                onChange={e => setForm(p => ({ ...p, amount: e.target.value }))}
                placeholder="Amount"
                className="w-full pl-8 bg-gray-50 dark:bg-surface-darker border border-border-light dark:border-border-dark rounded-xl p-3 text-sm font-bold text-text-light-main dark:text-text-dark-main outline-none focus:border-primary"
              />
            </div>

            {/* Category + Method */}
            <div className="grid grid-cols-2 gap-3">
              <select
                value={form.category}
                onChange={e => setForm(p => ({ ...p, category: e.target.value }))}
                className="bg-gray-50 dark:bg-surface-darker border border-border-light dark:border-border-dark rounded-xl p-3 text-sm font-bold text-text-light-main dark:text-text-dark-main outline-none appearance-none"
              >
                {cats.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <select
                value={form.paymentMethod}
                onChange={e => setForm(p => ({ ...p, paymentMethod: e.target.value }))}
                className="bg-gray-50 dark:bg-surface-darker border border-border-light dark:border-border-dark rounded-xl p-3 text-sm font-bold text-text-light-main dark:text-text-dark-main outline-none appearance-none"
              >
                {(userSettings?.paymentMethods || ['UPI', 'Cash']).map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>

            <button
              onClick={handleSave}
              disabled={isSaving || !form.label.trim() || !form.amount}
              className="w-full py-3.5 rounded-xl bg-primary text-[#131811] font-black shadow-glow hover:bg-primary/90 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isSaving ? <span className="material-symbols-outlined animate-spin text-sm">sync</span> : <span className="material-symbols-outlined text-sm">bolt</span>}
              Save Shortcut
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default QuickShortcutsWidget;
