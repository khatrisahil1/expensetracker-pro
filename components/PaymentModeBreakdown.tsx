// "Balance by payment method", shown under the Dashboard's total balance.
// Replaces a grid of equal tiles that gave every method (including ~15 notes
// imported into the Method column) the same weight, cut names off, and
// printed amounts as "₹-46,188.07". Now: a ranked list where a bar shows each
// method's size, the user's own methods first, imported ones tucked away.
import React, { useMemo, useState } from 'react';
import type { Transaction } from '../context/Store';
import { balancesByPaymentMethod, type MethodBalance } from '../utils/transactionStats';
import { formatMoney } from '../utils/format';

const methodIcon = (method: string) => {
  const m = method.toLowerCase();
  if (m.includes('cash')) return 'payments';
  if (m.includes('upi')) return 'qr_code_2';
  if (m.includes('card') || m.includes('credit') || m.includes('debit')) return 'credit_card';
  if (m.includes('sav') || m.includes('bank') || m.includes('acc')) return 'account_balance';
  return 'wallet';
};

interface Props {
  transactions: Transaction[];
  paymentMethods: string[];
  currencySymbol: string;
}

const MethodRow: React.FC<{ row: MethodBalance; max: number; symbol: string }> = ({ row, max, symbol }) => {
  const positive = row.net >= 0;
  const width = max > 0 ? Math.max(2, (Math.abs(row.net) / max) * 100) : 0;
  return (
    <li className="group flex items-center gap-3 py-2.5">
      <span className={`size-9 shrink-0 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110 ${positive ? 'bg-primary/15 text-primary' : 'bg-danger/10 text-danger'}`}>
        <span className="material-symbols-outlined text-[19px]" aria-hidden="true">{methodIcon(row.method)}</span>
      </span>
      <div className="flex-1 min-w-0 flex flex-col gap-1.5">
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-sm font-bold text-text-light-main dark:text-text-dark-main truncate" title={row.method}>{row.method}</span>
          <span className={`text-sm font-black tabular-nums shrink-0 ${positive ? 'text-primary' : 'text-danger'}`}>
            {formatMoney(Math.round(row.net), symbol, { signed: true })}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex-1 h-1.5 rounded-full bg-gray-200/70 dark:bg-white/5 overflow-hidden">
            <div className={`bar-fill h-full rounded-full ${positive ? 'bg-primary' : 'bg-danger/80'}`} style={{ width: `${width}%` }} />
          </div>
          <span className="text-[11px] text-text-light-muted dark:text-text-dark-muted tabular-nums shrink-0 hidden sm:inline">
            in {formatMoney(Math.round(row.income), symbol, { compact: true })} · out {formatMoney(Math.round(row.expense), symbol, { compact: true })}
          </span>
        </div>
      </div>
    </li>
  );
};

const PaymentModeBreakdown: React.FC<Props> = ({ transactions, paymentMethods, currencySymbol }) => {
  const [showImported, setShowImported] = useState(false);
  const { rows, total } = useMemo(() => balancesByPaymentMethod(transactions, paymentMethods), [transactions, paymentMethods]);
  const own = rows.filter(r => r.configured && (r.income || r.expense));
  const imported = rows.filter(r => !r.configured);
  const importedNet = imported.reduce((s, r) => s + r.net, 0);
  // Bars share one scale so sizes compare across both lists.
  const max = Math.max(0, ...rows.map(r => Math.abs(r.net)));

  return (
    <div className="rounded-3xl bg-gray-50/90 dark:bg-surface-darker/90 backdrop-blur-md border border-border-light dark:border-border-dark p-4 lg:p-5 flex flex-col gap-2 animate-sheet-in">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.2em] text-text-light-muted dark:text-text-dark-muted">By payment method</p>
          <p className="text-xs text-text-light-muted dark:text-text-dark-muted mt-0.5">Money in minus money out, all time</p>
        </div>
        <span className="text-sm font-black text-text-light-main dark:text-text-dark-main tabular-nums">{formatMoney(Math.round(total), currencySymbol)}</span>
      </div>

      <ul className="grid grid-cols-1 md:grid-cols-2 gap-x-8 divide-y md:divide-y-0 divide-black/[0.05] dark:divide-white/[0.05] stagger">
        {own.map(r => <MethodRow key={r.method} row={r} max={max} symbol={currencySymbol} />)}
      </ul>

      {imported.length > 0 && (
        <div className="border-t border-black/[0.06] dark:border-white/[0.06] pt-2">
          <button type="button" onClick={() => setShowImported(v => !v)} aria-expanded={showImported}
            className="w-full flex items-center gap-3 py-2 text-left group">
            <span className="size-9 shrink-0 rounded-xl flex items-center justify-center bg-gray-500/10 text-text-light-muted">
              <span className="material-symbols-outlined text-[19px]" aria-hidden="true">inventory_2</span>
            </span>
            <span className="flex-1 min-w-0">
              <span className="block text-sm font-bold text-text-light-main dark:text-text-dark-main">{imported.length} more from imported statements</span>
              <span className="block text-[11px] text-text-light-muted dark:text-text-dark-muted">Not in your payment methods. Often notes that landed in the Method column.</span>
            </span>
            <span className={`text-sm font-black tabular-nums ${importedNet >= 0 ? 'text-primary' : 'text-danger'}`}>{formatMoney(Math.round(importedNet), currencySymbol, { signed: true })}</span>
            <span className={`material-symbols-outlined text-text-light-muted transition-transform duration-300 ${showImported ? 'rotate-180' : ''}`} aria-hidden="true">expand_more</span>
          </button>
          {showImported && (
            <ul className="grid grid-cols-1 md:grid-cols-2 gap-x-8 stagger">
              {imported.map(r => <MethodRow key={r.method} row={r} max={max} symbol={currencySymbol} />)}
            </ul>
          )}
        </div>
      )}
    </div>
  );
};

export default PaymentModeBreakdown;
