// "Tidy up" dialog on the History page: previews readable names and categories
// for already-imported bank narrations, and saves only the rows the user keeps
// ticked. Nothing is written until "Update" is pressed.
import React, { useMemo, useState } from 'react';
import { useStore } from '../context/Store';
import { suggestTidyUps } from '../utils/merchant';

interface Props { onClose: () => void }

const TidyUpModal: React.FC<Props> = ({ onClose }) => {
  const { transactions, userSettings, updateTransaction } = useStore();
  const suggestions = useMemo(
    () => suggestTidyUps(transactions, userSettings?.expenseCategories || [], userSettings?.incomeCategories || []),
    // Computed once when the dialog opens, so the list doesn't shift while saving.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
  const [selected, setSelected] = useState<Set<string>>(() => new Set(suggestions.map(s => s.id)));
  const [progress, setProgress] = useState<number | null>(null);
  const [result, setResult] = useState('');

  const toggle = (id: string) =>
    setSelected(prev => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; });

  const apply = async () => {
    const chosen = suggestions.filter(s => selected.has(s.id));
    let failed = 0;
    setProgress(0);
    for (let i = 0; i < chosen.length; i++) {
      const s = chosen[i];
      try {
        await updateTransaction(s.id, { title: s.title, category: s.category, note: s.note });
      } catch {
        failed++;
      }
      setProgress(Math.round(((i + 1) / chosen.length) * 100));
    }
    setResult(failed
      ? `Updated ${chosen.length - failed} of ${chosen.length}. ${failed} could not be saved.`
      : `Updated ${chosen.length} transaction${chosen.length === 1 ? '' : 's'}.`);
  };

  const categoryChanges = suggestions.filter(s => s.category !== s.oldCategory).length;

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="tidy-title" className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-2xl max-h-[85vh] flex flex-col rounded-3xl bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark shadow-2xl">
        <div className="p-6 border-b border-border-light dark:border-border-dark flex items-start justify-between gap-4">
          <div>
            <h2 id="tidy-title" className="text-xl font-bold text-text-light-main dark:text-text-dark-main">Tidy up imported transactions</h2>
            <p className="text-sm text-text-light-muted dark:text-text-dark-muted mt-1">
              {suggestions.length === 0
                ? 'Everything already looks tidy.'
                : `${suggestions.length} suggestions: readable names for bank references, and ${categoryChanges} categories guessed from the merchant. The original text is kept in each note.`}
            </p>
          </div>
          <button onClick={onClose} aria-label="Close" className="text-text-light-muted hover:text-text-light-main"><span className="material-symbols-outlined" aria-hidden="true">close</span></button>
        </div>

        {suggestions.length > 0 && (
          <ul className="flex-1 overflow-y-auto divide-y divide-border-light dark:divide-border-dark">
            {suggestions.map(s => (
              <li key={s.id}>
                <label className="flex items-start gap-3 px-6 py-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-surface-darker">
                  <input type="checkbox" checked={selected.has(s.id)} onChange={() => toggle(s.id)} disabled={progress !== null} className="mt-1 accent-primary" />
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold text-text-light-main dark:text-text-dark-main">
                      {s.title}
                      {s.category !== s.oldCategory && (
                        <span className="ml-2 text-xs font-bold text-primary">{s.oldCategory} → {s.category}</span>
                      )}
                    </span>
                    {s.title !== s.oldTitle && (
                      <span className="block text-xs text-text-light-muted dark:text-text-dark-muted truncate">was: {s.oldTitle}</span>
                    )}
                  </span>
                </label>
              </li>
            ))}
          </ul>
        )}

        <div className="p-6 border-t border-border-light dark:border-border-dark flex items-center justify-between gap-3">
          <p role="status" className="text-sm text-text-light-muted dark:text-text-dark-muted">
            {result || (progress !== null ? `Saving… ${progress}%` : `${selected.size} selected`)}
          </p>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-2 rounded-full text-sm font-bold text-text-light-muted hover:bg-gray-100 dark:hover:bg-white/5">
              {result ? 'Done' : 'Cancel'}
            </button>
            {!result && suggestions.length > 0 && (
              <button onClick={apply} disabled={selected.size === 0 || progress !== null} className="px-5 py-2 rounded-full text-sm font-bold bg-primary text-[#131811] hover:bg-primary-hover disabled:opacity-50">
                Update {selected.size}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TidyUpModal;
