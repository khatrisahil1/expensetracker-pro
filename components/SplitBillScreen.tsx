// Split Bill page (/split-bill): share expenses with friends.
// Friends are just names (they don't need the app). A split records who paid
// and everyone's share (equal, exact amounts, or percentages). The page shows
// who owes whom, lets you settle up per friend or per bill, and send a
// reminder through the phone's share sheet. Optionally your own share is
// recorded as a normal expense.
// Data lives on the user's settings document (splitBills, splitFriends), so it
// syncs, works offline and in Guest mode. Maths: utils/split.ts.
import React, { useMemo, useState } from 'react';
import { useStore } from '../context/Store';
import { useDialog } from './ui/DialogProvider';
import { getCurrencySymbol } from '../utils/currency';
import { formatMoney } from '../utils/format';
import { formatDisplayDate, toLocalISODate } from '../utils/date';
import { celebrate } from '../utils/celebrate';
import { YOU, balanceTotals, computeShares, friendBalances, isFullySettled, settleWithFriend, type SplitBill, type SplitMethod } from '../utils/split';

const METHODS: { id: SplitMethod; label: string; icon: string }[] = [
  { id: 'equal', label: 'Equally', icon: 'drag_handle' },
  { id: 'exact', label: 'Amounts', icon: 'payments' },
  { id: 'percent', label: 'Percent', icon: 'percent' },
];

const initials = (name: string) => (name === YOU ? 'You' : name.split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase());
const HUES = ['bg-sky-500', 'bg-fuchsia-500', 'bg-amber-500', 'bg-emerald-500', 'bg-rose-500', 'bg-indigo-500', 'bg-teal-500'];
const hueFor = (name: string) => (name === YOU ? 'bg-primary' : HUES[[...name].reduce((a, c) => a + c.charCodeAt(0), 0) % HUES.length]);

const Avatar: React.FC<{ name: string; size?: string }> = ({ name, size = 'size-10' }) => (
  <span className={`${size} shrink-0 rounded-full ${hueFor(name)} text-white text-xs font-black flex items-center justify-center ring-2 ring-white dark:ring-surface-dark`} aria-hidden="true">
    {initials(name)}
  </span>
);

const SplitBillScreen: React.FC = () => {
  const { userSettings, updateUserSettings, addTransaction } = useStore();
  const dialog = useDialog();
  const symbol = getCurrencySymbol(userSettings?.currency);
  const splits = userSettings?.splitBills ?? [];
  const friends = userSettings?.splitFriends ?? [];

  const balances = useMemo(() => friendBalances(splits), [splits]);
  const totals = balanceTotals(balances);
  const [showNew, setShowNew] = useState(false);
  const [openBill, setOpenBill] = useState<string | null>(null);

  const save = (nextSplits: SplitBill[], nextFriends = friends) =>
    updateUserSettings({ splitBills: nextSplits, splitFriends: nextFriends });

  const settleFriend = async (friend: string) => {
    const amount = Math.abs(balances[friend]);
    const youOwe = balances[friend] < 0;
    const ok = await dialog.confirm({
      title: `Settle up with ${friend}?`,
      message: youOwe ? `Mark the ${formatMoney(amount, symbol)} you owe ${friend} as paid.` : `Mark the ${formatMoney(amount, symbol)} ${friend} owes you as paid.`,
      confirmLabel: 'Settle up',
    });
    if (!ok) return;
    await save(settleWithFriend(splits, friend));
    celebrate(null, 'coins', 18);
    dialog.toast(`All square with ${friend} 🤝`);
  };

  const remind = async (friend: string) => {
    const amount = balances[friend];
    const items = splits.filter(s => s.paidBy === YOU && s.people.includes(friend) && !s.settled[friend]).map(s => s.title);
    const text = `Hey ${friend}! Friendly reminder: you owe me ${formatMoney(amount, symbol)}${items.length ? ` for ${items.slice(0, 3).join(', ')}` : ''}. Thanks! 🙂`;
    try {
      if (navigator.share) await navigator.share({ text });
      else { await navigator.clipboard.writeText(text); dialog.toast('Reminder copied. Paste it in a chat.', 'info'); }
    } catch { /* cancelled */ }
  };

  const toggleSettled = (bill: SplitBill, person: string) =>
    save(splits.map(s => (s.id === bill.id ? { ...s, settled: { ...s.settled, [person]: !s.settled[person] } } : s)));

  const deleteBill = async (bill: SplitBill) => {
    if (!(await dialog.confirm({ title: `Delete “${bill.title}”?`, message: 'Balances will update. Any expense already recorded stays.', confirmLabel: 'Delete', destructive: true }))) return;
    await save(splits.filter(s => s.id !== bill.id));
  };

  const friendRows = Object.entries(balances).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]));

  return (
    <div className="w-full max-w-5xl mx-auto px-4 py-6 md:px-10 md:py-10 pb-32 flex flex-col gap-8">
      <div className="flex items-end justify-between gap-4 animate-slide-up">
        <div>
          <h1 className="text-4xl md:text-5xl font-black tracking-tight text-text-light-main dark:text-text-dark-main">Split bills</h1>
          <p className="text-sm md:text-base text-text-light-muted dark:text-text-dark-muted mt-1">Share costs with friends and keep track of who owes whom.</p>
        </div>
        <button onClick={() => setShowNew(true)} className="hidden sm:flex h-12 px-5 rounded-full bg-primary text-[#0b2615] font-black items-center gap-2 shadow-glow">
          <span aria-hidden="true" className="material-symbols-outlined">add</span>New split
        </button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 gap-3 stagger">
        <div className="rounded-[2rem] p-5 bg-primary/10 border border-primary/20">
          <p className="text-[11px] font-black uppercase tracking-widest text-text-light-muted dark:text-text-dark-muted">Friends owe you</p>
          <p className="text-2xl md:text-3xl font-black text-primary mt-1 tabular-nums">{formatMoney(totals.owedToYou, symbol)}</p>
        </div>
        <div className="rounded-[2rem] p-5 bg-rose-500/10 border border-rose-500/20">
          <p className="text-[11px] font-black uppercase tracking-widest text-text-light-muted dark:text-text-dark-muted">You owe</p>
          <p className="text-2xl md:text-3xl font-black text-rose-500 mt-1 tabular-nums">{formatMoney(totals.youOwe, symbol)}</p>
        </div>
      </div>

      {/* Balances per friend */}
      <section className="flex flex-col gap-3">
        <h2 className="px-1 text-[11px] font-black uppercase tracking-[0.2em] text-primary">Balances</h2>
        {friendRows.length === 0 ? (
          <div className="rounded-[2rem] border border-dashed border-border-light dark:border-border-dark p-8 text-center text-text-light-muted dark:text-text-dark-muted">
            <span aria-hidden="true" className="material-symbols-outlined text-4xl animate-float">handshake</span>
            <p className="font-bold mt-2 text-text-light-main dark:text-text-dark-main">{splits.length ? 'All settled up 🎉' : 'No splits yet'}</p>
            <p className="text-sm mt-1">{splits.length ? 'Nobody owes anybody.' : 'Split a dinner, a trip or the rent, and we’ll keep score.'}</p>
          </div>
        ) : (
          <ul className="rounded-[2rem] bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark divide-y divide-black/[0.06] dark:divide-white/[0.06] overflow-hidden stagger">
            {friendRows.map(([friend, amount]) => (
              <li key={friend} className="flex items-center gap-3 px-4 py-3">
                <Avatar name={friend} />
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-text-light-main dark:text-text-dark-main truncate">{friend}</p>
                  <p className={`text-sm font-semibold ${amount > 0 ? 'text-primary' : 'text-rose-500'}`}>
                    {amount > 0 ? `owes you ${formatMoney(amount, symbol)}` : `you owe ${formatMoney(-amount, symbol)}`}
                  </p>
                </div>
                {amount > 0 && (
                  <button onClick={() => remind(friend)} aria-label={`Remind ${friend}`} className="size-10 rounded-full bg-gray-100 dark:bg-white/5 flex items-center justify-center hover:text-primary">
                    <span aria-hidden="true" className="material-symbols-outlined text-[20px]">notifications_active</span>
                  </button>
                )}
                <button onClick={() => settleFriend(friend)} className="h-10 px-4 rounded-full bg-primary/15 text-primary text-sm font-black hover:bg-primary/25">Settle</button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Bills */}
      {splits.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="px-1 text-[11px] font-black uppercase tracking-[0.2em] text-primary">Bills</h2>
          <ul className="flex flex-col gap-3 stagger">
            {[...splits].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt).map(bill => {
              const done = isFullySettled(bill);
              const open = openBill === bill.id;
              return (
                <li key={bill.id} className="rounded-[2rem] bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark overflow-hidden">
                  <button onClick={() => setOpenBill(open ? null : bill.id)} aria-expanded={open} className="w-full flex items-center gap-3 p-4 text-left">
                    <span className="size-11 rounded-2xl bg-orange-500/15 text-orange-500 flex items-center justify-center shrink-0">
                      <span aria-hidden="true" className="material-symbols-outlined">receipt_long</span>
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="block font-bold text-text-light-main dark:text-text-dark-main truncate">{bill.title}</span>
                      <span className="block text-xs text-text-light-muted dark:text-text-dark-muted">{formatDisplayDate(bill.date)} · paid by {bill.paidBy === YOU ? 'you' : bill.paidBy}</span>
                    </span>
                    <span className="text-right">
                      <span className="block font-black tabular-nums text-text-light-main dark:text-text-dark-main">{formatMoney(bill.total, symbol)}</span>
                      <span className={`block text-[11px] font-bold ${done ? 'text-primary' : 'text-amber-500'}`}>{done ? 'Settled' : 'Open'}</span>
                    </span>
                    <span aria-hidden="true" className={`material-symbols-outlined text-text-light-muted transition-transform ${open ? 'rotate-180' : ''}`}>expand_more</span>
                  </button>
                  {open && (
                    <div className="px-4 pb-4 flex flex-col gap-2 animate-fade-in">
                      <div className="flex -space-x-2 mb-1">{bill.people.map(p => <Avatar key={p} name={p} size="size-8" />)}</div>
                      {bill.people.map(p => (
                        <div key={p} className="flex items-center justify-between gap-3 py-1.5">
                          <span className="text-sm font-semibold text-text-light-main dark:text-text-dark-main">{p}{p === bill.paidBy && <span className="ml-1 text-xs text-text-light-muted">(paid)</span>}</span>
                          <span className="flex items-center gap-3">
                            <span className="text-sm font-bold tabular-nums">{formatMoney(bill.shares[p] ?? 0, symbol)}</span>
                            {p !== bill.paidBy && (
                              <button onClick={() => toggleSettled(bill, p)} role="switch" aria-checked={!!bill.settled[p]} aria-label={`${p} paid back`}
                                className={`h-7 px-3 rounded-full text-xs font-black transition-colors ${bill.settled[p] ? 'bg-primary text-[#0b2615]' : 'bg-gray-100 dark:bg-white/5 text-text-light-muted'}`}>
                                {bill.settled[p] ? 'Paid ✓' : 'Mark paid'}
                              </button>
                            )}
                          </span>
                        </div>
                      ))}
                      <button onClick={() => deleteBill(bill)} className="self-start mt-1 text-xs font-bold text-danger hover:underline">Delete bill</button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <button onClick={() => setShowNew(true)} aria-label="New split" className="sm:hidden fixed bottom-24 right-5 z-30 size-16 rounded-3xl bg-primary text-[#0b2615] shadow-glow flex items-center justify-center">
        <span aria-hidden="true" className="material-symbols-outlined text-3xl">add</span>
      </button>

      {showNew && (
        <NewSplitSheet
          friends={friends}
          symbol={symbol}
          expenseCategories={userSettings?.expenseCategories ?? []}
          onClose={() => setShowNew(false)}
          onSave={async (bill, newFriends, recordMyShare, category) => {
            await save([bill, ...splits], newFriends);
            if (recordMyShare && bill.people.includes(YOU) && (bill.shares[YOU] ?? 0) > 0) {
              await addTransaction({ title: bill.title, amount: bill.shares[YOU], date: bill.date, type: 'expense', category, note: `My share of a split bill (${formatMoney(bill.total, symbol)} total)` });
            }
            celebrate(null, 'confetti', 22);
            dialog.toast('Split saved');
            setShowNew(false);
          }}
        />
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------

interface SheetProps {
  friends: string[];
  symbol: string;
  expenseCategories: string[];
  onClose: () => void;
  onSave: (bill: SplitBill, friends: string[], recordMyShare: boolean, category: string) => Promise<void>;
}

const NewSplitSheet: React.FC<SheetProps> = ({ friends, symbol, expenseCategories, onClose, onSave }) => {
  const [title, setTitle] = useState('');
  const [total, setTotal] = useState('');
  const [date, setDate] = useState(toLocalISODate());
  const [people, setPeople] = useState<string[]>([YOU]);
  const [newName, setNewName] = useState('');
  const [paidBy, setPaidBy] = useState(YOU);
  const [method, setMethod] = useState<SplitMethod>('equal');
  const [inputs, setInputs] = useState<Record<string, number>>({});
  const [recordMyShare, setRecordMyShare] = useState(true);
  const [category, setCategory] = useState(expenseCategories.includes('Food') ? 'Food' : expenseCategories[0] ?? 'Other');
  const [saving, setSaving] = useState(false);

  const amount = parseFloat(total) || 0;
  const { shares, error } = computeShares(amount, people, method, inputs);
  const canSave = title.trim() && amount > 0 && people.length >= 2 && !error;
  const suggestions = friends.filter(f => !people.includes(f));

  const addPerson = (name: string) => {
    const n = name.trim();
    if (!n || n.toLowerCase() === YOU.toLowerCase() || people.some(p => p.toLowerCase() === n.toLowerCase())) return;
    setPeople(p => [...p, n]);
    setNewName('');
  };
  const removePerson = (name: string) => {
    setPeople(p => p.filter(x => x !== name));
    if (paidBy === name) setPaidBy(YOU);
  };

  const submit = async () => {
    if (!canSave) return;
    setSaving(true);
    const newFriends = [...new Set([...people.filter(p => p !== YOU), ...friends])].slice(0, 30);
    try {
      await onSave({
        id: crypto.randomUUID(), title: title.trim(), total: amount, date, paidBy, people, shares,
        settled: {}, method, createdAt: Date.now(),
      }, newFriends, recordMyShare && paidBy === YOU, category);
    } finally {
      setSaving(false);
    }
  };

  const field = 'w-full h-12 rounded-2xl px-4 text-[15px] font-semibold bg-gray-100 dark:bg-white/[0.05] border border-transparent dark:border-white/10 outline-none focus:border-primary/60 focus:ring-4 focus:ring-primary/10 text-text-light-main dark:text-text-dark-main';

  return (
    <div className="fixed inset-0 z-[150] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm animate-fade-in" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-labelledby="new-split-title" onClick={e => e.stopPropagation()}
        className="w-full sm:max-w-lg max-h-[92vh] overflow-y-auto rounded-t-[2rem] sm:rounded-[2rem] bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark shadow-2xl animate-sheet-in">
        <div className="sticky top-0 z-10 bg-surface-light/95 dark:bg-surface-dark/95 backdrop-blur px-5 pt-5 pb-3 flex items-center justify-between">
          <button onClick={onClose} className="text-sm font-bold text-text-light-muted">Cancel</button>
          <h2 id="new-split-title" className="text-base font-black text-text-light-main dark:text-text-dark-main">New split</h2>
          <button onClick={submit} disabled={!canSave || saving} className="text-sm font-black text-primary disabled:opacity-40">{saving ? 'Saving…' : 'Save'}</button>
        </div>

        <div className="px-5 pb-6 flex flex-col gap-5">
          <input aria-label="What was it for?" placeholder="What was it for? e.g. Dinner at Toit" value={title} onChange={e => setTitle(e.target.value)} className={field} autoFocus />
          <div className="grid grid-cols-2 gap-3">
            <label className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 font-black text-text-light-muted">{symbol}</span>
              <input aria-label="Total amount" type="number" inputMode="decimal" min="0" placeholder="0" value={total} onChange={e => setTotal(e.target.value)} className={`${field} pl-9 text-lg font-black`} />
            </label>
            <input aria-label="Date" type="date" value={date} onChange={e => setDate(e.target.value)} className={`${field} [color-scheme:light] dark:[color-scheme:dark]`} />
          </div>

          {/* People */}
          <div className="flex flex-col gap-2">
            <span className="text-[11px] font-black uppercase tracking-widest text-text-light-muted">Who’s splitting?</span>
            <div className="flex flex-wrap gap-2">
              {people.map(p => (
                <span key={p} className="flex items-center gap-1.5 pl-1 pr-2 py-1 rounded-full bg-gray-100 dark:bg-white/5 text-sm font-bold animate-pop">
                  <Avatar name={p} size="size-7" />{p}
                  {p !== YOU && <button onClick={() => removePerson(p)} aria-label={`Remove ${p}`} className="text-text-light-muted hover:text-danger"><span aria-hidden="true" className="material-symbols-outlined text-[16px]">close</span></button>}
                </span>
              ))}
            </div>
            <form className="flex gap-2" onSubmit={e => { e.preventDefault(); addPerson(newName); }}>
              <input aria-label="Friend's name" placeholder="Add a friend's name" value={newName} onChange={e => setNewName(e.target.value)} className={field} />
              <button type="submit" disabled={!newName.trim()} className="h-12 px-4 rounded-2xl bg-primary/15 text-primary font-black disabled:opacity-40">Add</button>
            </form>
            {suggestions.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {suggestions.slice(0, 8).map(f => (
                  <button key={f} onClick={() => addPerson(f)} className="px-3 py-1 rounded-full border border-border-light dark:border-border-dark text-xs font-bold text-text-light-muted hover:border-primary/50 hover:text-primary">+ {f}</button>
                ))}
              </div>
            )}
          </div>

          {/* Paid by */}
          {people.length >= 2 && (
            <div className="flex flex-col gap-2">
              <span className="text-[11px] font-black uppercase tracking-widest text-text-light-muted">Who paid?</span>
              <div className="flex flex-wrap gap-2">
                {people.map(p => (
                  <button key={p} onClick={() => setPaidBy(p)} aria-pressed={paidBy === p}
                    className={`px-4 py-2 rounded-full text-sm font-bold border transition-all ${paidBy === p ? 'bg-primary text-[#0b2615] border-primary' : 'border-border-light dark:border-border-dark text-text-light-muted'}`}>
                    {p}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Method + shares */}
          {people.length >= 2 && (
            <div className="flex flex-col gap-3">
              <div role="tablist" aria-label="How to split" className="relative grid grid-cols-3 p-1 rounded-full bg-gray-100 dark:bg-black/30">
                <span className="absolute top-1 bottom-1 left-1 w-[calc((100%-8px)/3)] rounded-full bg-white dark:bg-surface-darker shadow-sm transition-transform duration-300 [transition-timing-function:cubic-bezier(0.34,1.56,0.64,1)]"
                  style={{ transform: `translateX(${METHODS.findIndex(m => m.id === method) * 100}%)` }} aria-hidden="true" />
                {METHODS.map(m => (
                  <button key={m.id} role="tab" aria-selected={method === m.id} onClick={() => setMethod(m.id)}
                    className={`relative z-10 py-2 text-xs font-bold flex items-center justify-center gap-1 ${method === m.id ? 'text-text-light-main dark:text-text-dark-main' : 'text-text-light-muted'}`}>
                    <span aria-hidden="true" className="material-symbols-outlined text-[16px]">{m.icon}</span>{m.label}
                  </button>
                ))}
              </div>
              <ul className="flex flex-col gap-2">
                {people.map(p => (
                  <li key={p} className="flex items-center gap-3">
                    <Avatar name={p} size="size-8" />
                    <span className="flex-1 text-sm font-bold text-text-light-main dark:text-text-dark-main truncate">{p}</span>
                    {method === 'equal' ? (
                      <span className="text-sm font-black tabular-nums">{formatMoney(shares[p] ?? 0, symbol)}</span>
                    ) : (
                      <span className="flex items-center gap-2">
                        <input aria-label={`${p}'s ${method === 'exact' ? 'amount' : 'percentage'}`} type="number" inputMode="decimal" min="0"
                          value={inputs[p] ?? ''} onChange={e => setInputs(v => ({ ...v, [p]: parseFloat(e.target.value) || 0 }))}
                          className="w-24 h-10 rounded-xl px-3 text-right font-bold bg-gray-100 dark:bg-white/[0.05] border border-transparent dark:border-white/10 outline-none focus:border-primary/60" />
                        <span className="text-xs font-bold text-text-light-muted w-14 text-right">{method === 'percent' ? formatMoney(shares[p] ?? 0, symbol) : symbol}</span>
                      </span>
                    )}
                  </li>
                ))}
              </ul>
              {error && amount > 0 && <p role="alert" className="text-sm font-semibold text-amber-600 dark:text-amber-400">{error}</p>}
            </div>
          )}

          {/* Record my share */}
          {paidBy === YOU && people.includes(YOU) && amount > 0 && (
            <label className="flex items-center justify-between gap-3 p-3 rounded-2xl bg-gray-100 dark:bg-white/[0.04]">
              <span className="text-sm">
                <span className="block font-bold text-text-light-main dark:text-text-dark-main">Add my share as an expense</span>
                <span className="block text-xs text-text-light-muted">{formatMoney(shares[YOU] ?? 0, symbol)} in</span>
              </span>
              <span className="flex items-center gap-2">
                <select aria-label="Category" value={category} onChange={e => setCategory(e.target.value)} disabled={!recordMyShare}
                  className="h-9 rounded-full bg-white dark:bg-surface-darker border border-border-light dark:border-border-dark text-xs font-bold py-0 pl-3 pr-8 disabled:opacity-50">
                  {expenseCategories.map(c => <option key={c}>{c}</option>)}
                </select>
                <input type="checkbox" checked={recordMyShare} onChange={e => setRecordMyShare(e.target.checked)} className="size-5 accent-primary" aria-label="Add my share as an expense" />
              </span>
            </label>
          )}

          {people.length < 2 && <p className="text-sm text-text-light-muted text-center">Add at least one friend to split with.</p>}
        </div>
      </div>
    </div>
  );
};

export default SplitBillScreen;
