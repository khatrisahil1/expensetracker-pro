// App-wide card that asks before booking missed subscription renewals.
// Replaces the Subscriptions page's silent auto-booking, which wrote charges to
// the user's history just from opening that page.
import React, { useMemo, useState } from 'react';
import { useStore } from '../context/Store';
import { findMissedRenewals, renewalTransaction, type MissedRenewal } from '../utils/renewals';
import { formatDisplayDate } from '../utils/date';
import { getCurrencySymbol } from '../utils/currency';
import { formatMoney } from '../utils/format';

/** Subscriptions dismissed with "Later" stay hidden until the page is reloaded. */
const dismissedThisSession = new Set<string>();

const RenewalPrompt: React.FC = () => {
  const { transactions, userSettings, addTransaction, updateTransaction } = useStore();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [dismissTick, setDismissTick] = useState(0);
  const symbol = getCurrencySymbol(userSettings?.currency);

  const pending = useMemo(
    () => findMissedRenewals(transactions).filter(r => !dismissedThisSession.has(r.subscription.id)),
    // dismissTick re-runs the filter after "Later" adds to the module-level set.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [transactions, dismissTick],
  );
  if (pending.length === 0) return null;
  const current = pending[0];
  const { subscription: sub, dueDates } = current;

  /** Book every listed renewal (or none, when `book` is false), then move the next date past today. */
  const resolve = async (renewal: MissedRenewal, book: boolean) => {
    setBusyId(renewal.subscription.id);
    setError('');
    try {
      if (book) {
        for (const date of renewal.dueDates) await addTransaction(renewalTransaction(renewal.subscription, date));
      }
      await updateTransaction(renewal.subscription.id, { nextRenewalDate: renewal.nextRenewalDate });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update the subscription.');
    } finally {
      setBusyId(null);
    }
  };

  const later = () => { dismissedThisSession.add(sub.id); setDismissTick(n => n + 1); };
  const count = dueDates.length;
  const busy = busyId === sub.id;
  const datesText = count <= 3
    ? dueDates.map(formatDisplayDate).join(', ')
    : `${formatDisplayDate(dueDates[0])} – ${formatDisplayDate(dueDates[count - 1])}`;

  return (
    <div role="dialog" aria-labelledby="renewal-prompt-title" className="fixed z-[190] left-1/2 -translate-x-1/2 bottom-24 lg:bottom-auto lg:top-6 w-[min(92vw,480px)]">
      <div className="rounded-3xl border border-border-light dark:border-border-dark bg-surface-light dark:bg-surface-darker shadow-2xl p-5 flex flex-col gap-3 animate-slide-up">
        <div className="flex items-start gap-3">
          <span className="material-symbols-outlined text-primary" aria-hidden="true">event_repeat</span>
          <div className="flex-1 min-w-0">
            <p id="renewal-prompt-title" className="font-bold text-text-light-main dark:text-text-dark-main">
              {count === 1 ? 'A renewal is due' : `${count} renewals are due`}: {sub.title}
            </p>
            <p className="text-sm text-text-light-muted dark:text-text-dark-muted">
              {formatMoney(sub.amount, symbol)}{count > 1 ? ` × ${count}` : ''} · {datesText}
            </p>
            <p className="text-xs text-text-light-muted dark:text-text-dark-muted mt-1">
              Add {count === 1 ? 'it' : 'them'} to your history if you were charged, or skip if you weren't.
            </p>
          </div>
        </div>
        {error && <p role="alert" className="text-sm text-danger">{error}</p>}
        <div className="flex flex-wrap justify-end gap-2">
          <button onClick={later} disabled={busy} className="px-4 py-2 rounded-full text-sm font-bold text-text-light-muted hover:bg-gray-100 dark:hover:bg-white/5">Later</button>
          <button onClick={() => resolve(current, false)} disabled={busy} className="px-4 py-2 rounded-full text-sm font-bold border border-border-light dark:border-border-dark hover:bg-gray-100 dark:hover:bg-white/5">Skip</button>
          <button onClick={() => resolve(current, true)} disabled={busy} className="px-4 py-2 rounded-full text-sm font-bold bg-primary text-[#131811] hover:bg-primary-hover disabled:opacity-60">
            {busy ? 'Saving…' : count === 1 ? 'Add renewal' : `Add ${count} renewals`}
          </button>
        </div>
      </div>
    </div>
  );
};

export default RenewalPrompt;
