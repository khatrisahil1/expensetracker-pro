// "Tidy up" dialog on the History page. Two kinds of fixes for imported rows:
//   1. Names & categories: readable names for bank narrations, and categories
//      learned from how the user already files the same merchant (then keywords).
//   2. Payment methods: notes that landed in the Method column ("Salary
//      credit.") become one of the user's real methods; the text moves to the note.
// Everything is previewed; nothing is written until "Update" is pressed.
import React, { useMemo, useState } from 'react';
import { useStore, type Transaction } from '../context/Store';
import { noteWithOldMethod, suggestMethodFixes, suggestTidyUps } from '../utils/merchant';
import { celebrate } from '../utils/celebrate';

interface Props { onClose: () => void }

type Tab = 'names' | 'methods';

const TidyUpModal: React.FC<Props> = ({ onClose }) => {
  const { transactions, userSettings, updateTransaction } = useStore();
  const methods = userSettings?.paymentMethods || [];

  // Computed once when the dialog opens, so the lists don't shift while saving.
  /* eslint-disable react-hooks/exhaustive-deps */
  const suggestions = useMemo(() => suggestTidyUps(transactions, userSettings?.expenseCategories || [], userSettings?.incomeCategories || []), []);
  const methodFixes = useMemo(() => suggestMethodFixes(transactions, methods), []);
  const byId = useMemo(() => new Map(transactions.map(t => [t.id, t])), []);
  /* eslint-enable react-hooks/exhaustive-deps */

  const [tab, setTab] = useState<Tab>(suggestions.length > 0 || methodFixes.length === 0 ? 'names' : 'methods');
  const [selected, setSelected] = useState<Set<string>>(() => new Set(suggestions.map(s => s.id)));
  const [selectedGroups, setSelectedGroups] = useState<Set<string>>(() => new Set(methodFixes.map(f => f.value)));
  const [methodChoice, setMethodChoice] = useState<Record<string, string>>(() => Object.fromEntries(methodFixes.map(f => [f.value, f.suggested])));
  const [progress, setProgress] = useState<number | null>(null);
  const [result, setResult] = useState('');

  const toggleIn = (setter: React.Dispatch<React.SetStateAction<Set<string>>>, key: string) =>
    setter(prev => { const next = new Set(prev); next.has(key) ? next.delete(key) : next.add(key); return next; });

  const methodRowCount = methodFixes.filter(f => selectedGroups.has(f.value)).reduce((n, f) => n + f.ids.length, 0);

  /** One update per transaction, combining both kinds of fix. */
  const buildUpdates = () => {
    const updates = new Map<string, Partial<Transaction>>();
    for (const s of suggestions) {
      if (selected.has(s.id)) updates.set(s.id, { title: s.title, category: s.category, note: s.note });
    }
    for (const f of methodFixes) {
      if (!selectedGroups.has(f.value)) continue;
      for (const id of f.ids) {
        const current = updates.get(id) ?? {};
        const note = current.note ?? byId.get(id)?.note;
        updates.set(id, { ...current, paymentMethod: methodChoice[f.value], note: noteWithOldMethod(note, f.value) });
      }
    }
    return updates;
  };
  const pending = buildUpdates().size;

  const apply = async () => {
    const updates = [...buildUpdates()];
    let failed = 0;
    setProgress(0);
    for (let i = 0; i < updates.length; i++) {
      const [id, patch] = updates[i];
      try { await updateTransaction(id, patch); } catch { failed++; }
      setProgress(Math.round(((i + 1) / updates.length) * 100));
    }
    if (!failed) celebrate(null, 'confetti', 30);
    setResult(failed
      ? `Updated ${updates.length - failed} of ${updates.length}. ${failed} could not be saved.`
      : `Updated ${updates.length} transaction${updates.length === 1 ? '' : 's'}.`);
  };

  const categoryChanges = suggestions.filter(s => s.category !== s.oldCategory).length;
  const nothing = suggestions.length === 0 && methodFixes.length === 0;
  const busy = progress !== null;

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="tidy-title" className="fixed inset-0 z-[150] flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in" onClick={onClose}>
      <div onClick={e => e.stopPropagation()} className="w-full max-w-2xl max-h-[85vh] flex flex-col rounded-[2rem] bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark shadow-2xl animate-sheet-in">
        <div className="p-6 pb-4 flex flex-col gap-4 border-b border-border-light dark:border-border-dark">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 id="tidy-title" className="text-xl font-black text-text-light-main dark:text-text-dark-main">Tidy up imported transactions</h2>
              <p className="text-sm text-text-light-muted dark:text-text-dark-muted mt-1">
                {nothing ? 'Everything already looks tidy.' : 'Review the suggestions. Original text is kept in each note.'}
              </p>
            </div>
            <button onClick={onClose} aria-label="Close" className="size-9 rounded-full flex items-center justify-center text-text-light-muted hover:bg-gray-100 dark:hover:bg-white/5">
              <span className="material-symbols-outlined" aria-hidden="true">close</span>
            </button>
          </div>
          {!nothing && (
            <div role="tablist" className="relative grid grid-cols-2 p-1 rounded-full bg-gray-100 dark:bg-black/30">
              <span className={`absolute top-1 bottom-1 left-1 w-[calc(50%-4px)] rounded-full bg-white dark:bg-surface-dark shadow-sm transition-transform duration-300 ${tab === 'methods' ? 'translate-x-full' : ''}`} aria-hidden="true" />
              {([['names', `Names & categories (${suggestions.length})`], ['methods', `Payment methods (${methodFixes.length})`]] as const).map(([id, label]) => (
                <button key={id} role="tab" aria-selected={tab === id} onClick={() => setTab(id)}
                  className={`relative z-10 py-2 text-xs font-bold transition-colors ${tab === id ? 'text-text-light-main dark:text-text-dark-main' : 'text-text-light-muted'}`}>{label}</button>
              ))}
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto">
          {tab === 'names' && suggestions.length > 0 && (
            <>
              <p className="px-6 pt-4 text-xs text-text-light-muted dark:text-text-dark-muted">
                {categoryChanges} categories come from how you filed the same merchant before, or from its name.
              </p>
              <ul className="divide-y divide-border-light dark:divide-border-dark">
                {suggestions.map(s => (
                  <li key={s.id}>
                    <label className="flex items-start gap-3 px-6 py-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-surface-darker">
                      <input type="checkbox" checked={selected.has(s.id)} onChange={() => toggleIn(setSelected, s.id)} disabled={busy} className="mt-1 accent-primary" />
                      <span className="min-w-0 flex-1">
                        <span className="block font-semibold text-text-light-main dark:text-text-dark-main">
                          {s.title}
                          {s.category !== s.oldCategory && <span className="ml-2 text-xs font-bold text-primary">{s.oldCategory} → {s.category}</span>}
                        </span>
                        {s.title !== s.oldTitle && <span className="block text-xs text-text-light-muted dark:text-text-dark-muted truncate">was: {s.oldTitle}</span>}
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            </>
          )}
          {tab === 'names' && suggestions.length === 0 && !nothing && (
            <p className="p-6 text-sm text-text-light-muted">Names and categories already look good.</p>
          )}

          {tab === 'methods' && methodFixes.length > 0 && (
            <>
              <p className="px-6 pt-4 text-xs text-text-light-muted dark:text-text-dark-muted">
                These values aren’t your payment methods; they’re usually notes from a bank statement. Pick the real method for each. The text moves to the note.
              </p>
              <ul className="divide-y divide-border-light dark:divide-border-dark">
                {methodFixes.map(f => (
                  <li key={f.value} className="flex items-center gap-3 px-6 py-3">
                    <input type="checkbox" aria-label={`Fix "${f.value}"`} checked={selectedGroups.has(f.value)} onChange={() => toggleIn(setSelectedGroups, f.value)} disabled={busy} className="accent-primary" />
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold text-text-light-main dark:text-text-dark-main truncate">{f.value}</span>
                      <span className="block text-xs text-text-light-muted dark:text-text-dark-muted">{f.ids.length} transaction{f.ids.length === 1 ? '' : 's'}</span>
                    </span>
                    <span className="material-symbols-outlined text-text-light-muted text-[18px]" aria-hidden="true">arrow_forward</span>
                    <select aria-label={`Payment method for "${f.value}"`} value={methodChoice[f.value]} disabled={busy || !selectedGroups.has(f.value)}
                      onChange={e => setMethodChoice(c => ({ ...c, [f.value]: e.target.value }))}
                      className="rounded-full border border-border-light dark:border-border-dark bg-gray-50 dark:bg-surface-darker text-sm font-bold py-1.5 pl-3 pr-8 disabled:opacity-50">
                      {methods.map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                  </li>
                ))}
              </ul>
            </>
          )}
          {tab === 'methods' && methodFixes.length === 0 && !nothing && (
            <p className="p-6 text-sm text-text-light-muted">All payment methods are already ones you use.</p>
          )}
        </div>

        <div className="p-5 border-t border-border-light dark:border-border-dark flex items-center justify-between gap-3">
          <p role="status" className="text-sm text-text-light-muted dark:text-text-dark-muted">
            {result || (busy ? `Saving… ${progress}%` : `${pending} transaction${pending === 1 ? '' : 's'} will change${methodRowCount ? ` (${methodRowCount} methods)` : ''}`)}
          </p>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-2 rounded-full text-sm font-bold text-text-light-muted hover:bg-gray-100 dark:hover:bg-white/5">
              {result ? 'Done' : 'Cancel'}
            </button>
            {!result && !nothing && (
              <button onClick={apply} disabled={pending === 0 || busy} className="px-5 py-2 rounded-full text-sm font-bold bg-primary text-[#131811] hover:bg-primary-hover disabled:opacity-50">
                Update {pending}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TidyUpModal;
