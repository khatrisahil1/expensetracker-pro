import React, { useState, useRef, useCallback } from 'react';
import { useStore } from '../context/Store';

// ─── Types ────────────────────────────────────────────────────────────────────

type RowStatus = 'valid' | 'warning' | 'error';

interface ParsedRow {
  index: number;        // original CSV row number (1-based, excluding header)
  raw: string;          // original raw CSV line
  status: RowStatus;
  errors: string[];     // blocking errors
  warnings: string[];   // non-blocking warnings

  // Parsed fields
  date: string;
  title: string;
  amount: number;
  type: 'income' | 'expense';
  category: string;
  paymentMethod: string;
  note: string;
}

interface ImportResult {
  imported: number;
  skipped: number;
}

// ─── CSV Parsing Helpers ──────────────────────────────────────────────────────

/** Parse a single RFC-4180 CSV line respecting quoted fields. */
function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let cur = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++; // skip escaped quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      result.push(cur.trim());
      cur = '';
    } else {
      cur += ch;
    }
  }
  result.push(cur.trim());
  return result;
}

/** Attempt to normalise many date formats to YYYY-MM-DD. Returns null if unparseable. */
function normaliseDate(raw: string): string | null {
  const s = raw.trim();
  if (!s) return null;

  // Already ISO
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const d = new Date(s);
    return isNaN(d.getTime()) ? null : s;
  }
  // DD/MM/YYYY or DD-MM-YYYY
  const dmy = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (dmy) {
    const [, d, m, y] = dmy;
    const dt = new Date(`${y}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`);
    return isNaN(dt.getTime()) ? null : dt.toISOString().split('T')[0];
  }
  // MM/DD/YYYY
  const mdy = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (mdy) {
    const [, m, d, y] = mdy;
    const dt = new Date(`${y}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`);
    return isNaN(dt.getTime()) ? null : dt.toISOString().split('T')[0];
  }
  // Try native Date parsing as last resort (e.g. "19 Jul 2025", epoch ms)
  const dt = new Date(s);
  if (!isNaN(dt.getTime())) return dt.toISOString().split('T')[0];

  return null;
}

/** Strip currency symbols and thousand separators, return a positive float or NaN. */
function parseAmount(raw: string): number {
  const cleaned = raw.replace(/[₹$€£¥,\s]/g, '').trim();
  const n = parseFloat(cleaned);
  return n;
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface CSVImportModalProps {
  onClose: () => void;
}

const VALID_TYPES = ['income', 'expense'];

const CSVImportModal: React.FC<CSVImportModalProps> = ({ onClose }) => {
  const { addTransaction, transactions, userSettings, isDemo } = useStore();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);

  // Parsed rows state
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [isParsed, setIsParsed] = useState(false);

  // Import state
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [result, setResult] = useState<ImportResult | null>(null);

  // Filter state for preview
  const [showFilter, setShowFilter] = useState<'all' | 'valid' | 'warning' | 'error'>('all');

  const validRows = rows.filter(r => r.status !== 'error');
  const errorRows = rows.filter(r => r.status === 'error');
  const warningRows = rows.filter(r => r.status === 'warning');

  // ── Parse CSV text ──────────────────────────────────────────────────────────
  const parseCSV = useCallback((text: string) => {
    // Strip UTF-8 BOM
    const content = text.replace(/^\uFEFF/, '');
    const allLines = content.split(/\r?\n/).filter(l => l.trim() !== '');
    if (allLines.length < 2) {
      setRows([]);
      setIsParsed(true);
      return;
    }

    // Auto-detect header row by checking if first row contains known column names
    const firstLineLower = allLines[0].toLowerCase();
    const hasHeader =
      firstLineLower.includes('date') ||
      firstLineLower.includes('title') ||
      firstLineLower.includes('amount');

    const dataLines = hasHeader ? allLines.slice(1) : allLines;

    // Build duplicate-detection set from existing transactions
    const existingSet = new Set(
      transactions.map(t => `${t.date}|${t.title.toLowerCase()}|${t.amount}`)
    );

    // Per-CSV duplicate detection (to catch duplicates within the file itself)
    const seenInFile = new Set<string>();

    const knownExpenseCats = new Set(userSettings?.expenseCategories || []);
    const knownIncomeCats  = new Set(userSettings?.incomeCategories  || []);
    const defaultPayment   = userSettings?.paymentMethods?.[0] || 'Cash';

    const parsed: ParsedRow[] = dataLines.map((line, i) => {
      const cols = parseCsvLine(line);
      const errors: string[]   = [];
      const warnings: string[] = [];

      // ── Date ──
      const rawDate = cols[0] || '';
      const date    = normaliseDate(rawDate);
      if (!date) errors.push(`Invalid date: "${rawDate}"`);

      // ── Title ──
      const title = (cols[1] || '').trim();
      if (!title) errors.push('Title is required');

      // ── Amount ──
      const rawAmount = cols[2] || '';
      const amount    = parseAmount(rawAmount);
      if (isNaN(amount)) errors.push(`Invalid amount: "${rawAmount}"`);
      else if (amount <= 0) errors.push('Amount must be greater than 0');

      // ── Type ──
      const rawType = (cols[3] || '').trim().toLowerCase();
      const type    = rawType as 'income' | 'expense';
      if (!VALID_TYPES.includes(rawType)) {
        errors.push(`Type must be "income" or "expense", got: "${cols[3] || ''}"`);
      }

      // ── Category ──
      let category = (cols[4] || '').trim();
      if (category) {
        const inExpense = knownExpenseCats.has(category);
        const inIncome  = knownIncomeCats.has(category);
        if (!inExpense && !inIncome) {
          warnings.push(`Unknown category "${category}" — mapped to "Other"`);
          category = 'Other';
        }
      } else {
        category = 'Other';
        warnings.push('Category is blank — defaulted to "Other"');
      }

      // ── Payment Method ──
      let paymentMethod = (cols[5] || '').trim();
      if (!paymentMethod) {
        paymentMethod = defaultPayment;
      }

      // ── Note ──
      const note = (cols[6] || '').trim();

      // ── Duplicate checks (only if row is otherwise valid) ──
      if (errors.length === 0) {
        const dedupKey = `${date}|${title.toLowerCase()}|${amount}`;

        if (existingSet.has(dedupKey)) {
          warnings.push('Possible duplicate: same date, title & amount already exists');
        }
        if (seenInFile.has(dedupKey)) {
          warnings.push('Duplicate within this file');
        } else {
          seenInFile.add(dedupKey);
        }
      }

      const status: RowStatus = errors.length > 0 ? 'error' : warnings.length > 0 ? 'warning' : 'valid';

      return {
        index: i + 1,
        raw: line,
        status,
        errors,
        warnings,
        date: date || '',
        title,
        amount: isNaN(amount) ? 0 : amount,
        type,
        category,
        paymentMethod,
        note,
      };
    });

    setRows(parsed);
    setIsParsed(true);
  }, [transactions, userSettings]);

  // ── File reading ──────────────────────────────────────────────────────────
  const handleFile = (file: File) => {
    if (!file.name.endsWith('.csv') && file.type !== 'text/csv') {
      alert('Please select a valid .csv file.');
      return;
    }
    setFileName(file.name);
    setIsParsed(false);
    setResult(null);
    setRows([]);
    const reader = new FileReader();
    reader.onload = e => parseCSV((e.target?.result as string) || '');
    reader.readAsText(file, 'UTF-8');
  };

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = ''; // allow re-selecting same file
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  // ── Import ────────────────────────────────────────────────────────────────
  const handleImport = async () => {
    if (isDemo) {
      alert('Import is not available in Demo mode.');
      return;
    }
    const toImport = rows.filter(r => r.status !== 'error');
    if (toImport.length === 0) return;

    setIsImporting(true);
    setImportProgress(0);

    let imported = 0;
    let skipped = 0;

    for (let i = 0; i < toImport.length; i++) {
      const row = toImport[i];
      try {
        await addTransaction({
          title: row.title,
          amount: row.amount,
          date: row.date,
          type: row.type,
          category: row.category,
          paymentMethod: row.paymentMethod,
          note: row.note,
        });
        imported++;
      } catch (err) {
        console.error(`Failed to import row ${row.index}:`, err);
        skipped++;
      }
      setImportProgress(Math.round(((i + 1) / toImport.length) * 100));
    }

    setIsImporting(false);
    setResult({ imported, skipped });
  };

  // ── Filtered preview rows ─────────────────────────────────────────────────
  const displayRows = rows.filter(r => {
    if (showFilter === 'all') return true;
    return r.status === showFilter;
  });

  const currencySymbol = userSettings?.currency === 'USD' ? '$' : userSettings?.currency === 'EUR' ? '€' : '₹';

  // ── Status dot helper ─────────────────────────────────────────────────────
  const StatusDot: React.FC<{ status: RowStatus }> = ({ status }) => {
    if (status === 'valid')   return <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-emerald-500 dark:text-emerald-400"><span className="size-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400 shrink-0" />ok</span>;
    if (status === 'warning') return <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-amber-500 dark:text-amber-400"><span className="size-1.5 rounded-full bg-amber-500 dark:bg-amber-400 shrink-0" />warn</span>;
    return <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-red-500 dark:text-red-400"><span className="size-1.5 rounded-full bg-red-500 dark:bg-red-400 shrink-0" />err</span>;
  };

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div
      className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark rounded-[2rem] w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl animate-slide-up overflow-hidden">

        {/* ── Header ── */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-border-light dark:border-border-dark shrink-0">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-full bg-primary/10 text-primary flex items-center justify-center shadow-glow">
              <span className="material-symbols-outlined text-xl">upload_file</span>
            </div>
            <div>
              <h2 className="text-lg font-black text-text-light-main dark:text-text-dark-main leading-none">Import CSV</h2>
              <p className="text-xs text-text-light-muted dark:text-text-dark-muted mt-0.5">Date · Title · Amount · Type · Category · Method · Note</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="size-9 rounded-full flex items-center justify-center text-text-light-muted dark:text-text-dark-muted hover:bg-gray-100 dark:hover:bg-surface-darker hover:text-text-light-main dark:hover:text-text-dark-main transition-colors"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {/* ── Body ── */}
        <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-5">

          {/* ── Result State ── */}
          {result ? (
            <div className="flex flex-col items-center justify-center text-center py-10 gap-4">
              <div className={`size-20 rounded-full flex items-center justify-center text-4xl shadow-glow ${result.imported > 0 ? 'bg-primary/10' : 'bg-gray-100 dark:bg-surface-darker'}`}>
                {result.imported > 0 ? '🎉' : '😐'}
              </div>
              <div>
                <h3 className="text-2xl font-black text-text-light-main dark:text-text-dark-main">
                  {result.imported > 0 ? 'Import Complete!' : 'Nothing Imported'}
                </h3>
                <p className="text-text-light-muted dark:text-text-dark-muted text-sm mt-1">
                  {result.imported > 0 && (
                    <span className="text-primary font-bold">{result.imported} transaction{result.imported > 1 ? 's' : ''} imported</span>
                  )}
                  {result.imported > 0 && result.skipped > 0 && ' · '}
                  {result.skipped > 0 && (
                    <span className="text-danger font-bold">{result.skipped} failed</span>
                  )}
                </p>
                <p className="text-xs text-text-light-muted dark:text-text-dark-muted mt-2">
                  All imported transactions are now live in Firebase — visible across Dashboard, Calendar, and all charts.
                </p>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => { setResult(null); setRows([]); setIsParsed(false); setFileName(null); }}
                  className="px-5 py-2.5 rounded-xl border border-border-light dark:border-border-dark text-sm font-bold text-text-light-main dark:text-text-dark-main hover:bg-gray-100 dark:hover:bg-surface-darker transition-colors"
                >
                  Import Another
                </button>
                <button
                  onClick={onClose}
                  className="px-5 py-2.5 rounded-xl bg-primary text-[#131811] text-sm font-bold shadow-glow hover:bg-primary-hover transition-colors"
                >
                  Done
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* ── Drop Zone ── */}
              {!isParsed && (
                <div
                  onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={onDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`flex flex-col items-center justify-center gap-3 py-9 rounded-2xl border-2 border-dashed cursor-pointer transition-all select-none
                    ${isDragging
                      ? 'border-primary bg-primary/10 scale-[1.01]'
                      : 'border-border-light dark:border-border-dark hover:border-primary/40 hover:bg-gray-50 dark:hover:bg-surface-darker'
                    }`}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv,text/csv"
                    className="hidden"
                    onChange={onFileChange}
                  />
                  <div className={`size-11 rounded-full flex items-center justify-center transition-colors ${isDragging ? 'bg-primary text-[#131811]' : 'bg-gray-100 dark:bg-surface-darker text-text-light-muted dark:text-text-dark-muted'}`}>
                    <span className="material-symbols-outlined text-xl">upload_file</span>
                  </div>
                  <div className="text-center">
                    <p className="font-semibold text-text-light-main dark:text-text-dark-main text-sm">
                      {isDragging ? 'Drop it!' : 'Drag & drop your CSV here'}
                    </p>
                    <p className="text-xs text-text-light-muted dark:text-text-dark-muted mt-0.5">or click to browse · .csv files only</p>
                  </div>
                </div>
              )}

              {/* ── Schema Hint ── */}
              {!isParsed && (
                <p className="text-xs text-text-light-muted dark:text-text-dark-muted leading-relaxed px-1">
                  Columns: <span className="font-semibold text-text-light-main dark:text-text-dark-main">Date, Title, Amount, Type, Category, Method, Note</span>
                  &nbsp;·&nbsp; Date formats: YYYY-MM-DD / DD/MM/YYYY / MM/DD/YYYY
                  &nbsp;·&nbsp; Method &amp; Note are optional
                </p>
              )}

              {/* ── Parsing Loader ── */}
              {!isParsed && fileName && rows.length === 0 && (
                <div className="flex items-center gap-3 text-text-light-muted dark:text-text-dark-muted">
                  <span className="material-symbols-outlined animate-spin text-primary">sync</span>
                  <span className="text-sm">Parsing {fileName}…</span>
                </div>
              )}

              {/* ── Preview ── */}
              {isParsed && rows.length > 0 && (
                <>
                  {/* Stats bar */}
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-1.5 text-sm font-medium text-text-light-main dark:text-text-dark-main">
                      <span className="material-symbols-outlined text-base text-primary">table_rows</span>
                      <span className="font-bold">{rows.length}</span> rows
                      {fileName && <span className="text-text-light-muted dark:text-text-dark-muted text-xs">· {fileName}</span>}
                    </div>
                    <div className="flex gap-1.5 ml-auto">
                      {(['all', 'valid', 'warning', 'error'] as const).map(f => {
                        const count = f === 'all' ? rows.length : f === 'valid' ? rows.filter(r=>r.status==='valid').length : f === 'warning' ? warningRows.length : errorRows.length;
                        const active = showFilter === f;
                        const dotColor: Record<string, string> = {
                          all: '', valid: 'bg-emerald-500', warning: 'bg-amber-500', error: 'bg-red-500'
                        };
                        return (
                          <button
                            key={f}
                            onClick={() => setShowFilter(f)}
                            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold transition-all capitalize
                              ${active
                                ? 'bg-gray-100 dark:bg-surface-darker text-text-light-main dark:text-text-dark-main'
                                : 'text-text-light-muted dark:text-text-dark-muted hover:text-text-light-main dark:hover:text-text-dark-main'}`}
                          >
                            {f !== 'all' && <span className={`size-1.5 rounded-full shrink-0 ${dotColor[f]}`} />}
                            {f} <span className="opacity-60">({count})</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Change file button */}
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center gap-2 text-xs font-bold text-text-light-muted dark:text-text-dark-muted hover:text-primary transition-colors w-fit"
                  >
                    <span className="material-symbols-outlined text-sm">folder_open</span>
                    Choose a different file
                  </button>
                  <input ref={fileInputRef} type="file" accept=".csv,text/csv" className="hidden" onChange={onFileChange} />

                  {/* Table */}
                  <div className="rounded-2xl border border-border-light dark:border-border-dark overflow-hidden">
                    <div className="overflow-x-auto max-h-72 overflow-y-auto custom-scrollbar">
                      <table className="w-full text-xs">
                        <thead className="sticky top-0 bg-gray-50 dark:bg-surface-darker border-b border-border-light dark:border-border-dark z-10">
                          <tr>
                            <th className="px-3 py-2 text-left font-semibold uppercase tracking-wider text-text-light-muted dark:text-text-dark-muted opacity-60">#</th>
                            <th className="px-3 py-2 text-left font-semibold uppercase tracking-wider text-text-light-muted dark:text-text-dark-muted opacity-60"></th>
                            <th className="px-3 py-2 text-left font-semibold uppercase tracking-wider text-text-light-muted dark:text-text-dark-muted opacity-60">Date</th>
                            <th className="px-3 py-2 text-left font-semibold uppercase tracking-wider text-text-light-muted dark:text-text-dark-muted opacity-60">Title</th>
                            <th className="px-3 py-2 text-right font-semibold uppercase tracking-wider text-text-light-muted dark:text-text-dark-muted opacity-60">Amount</th>
                            <th className="px-3 py-2 text-left font-semibold uppercase tracking-wider text-text-light-muted dark:text-text-dark-muted opacity-60">Type</th>
                            <th className="px-3 py-2 text-left font-semibold uppercase tracking-wider text-text-light-muted dark:text-text-dark-muted opacity-60">Category</th>
                            <th className="px-3 py-2 text-left font-semibold uppercase tracking-wider text-text-light-muted dark:text-text-dark-muted opacity-60">Note</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border-light dark:divide-border-dark">
                          {displayRows.map(row => {
                            const rowBg =
                              row.status === 'error'   ? 'bg-red-50/40 dark:bg-red-900/5' :
                              row.status === 'warning' ? '' :
                              '';
                            return (
                              <tr key={row.index} className={`${rowBg} transition-colors`}>
                                <td className="px-3 py-1.5 text-text-light-muted dark:text-text-dark-muted opacity-40">{row.index}</td>
                                <td className="px-3 py-1.5"><StatusDot status={row.status} /></td>
                                <td className="px-3 py-1.5 text-text-light-main dark:text-text-dark-main whitespace-nowrap">{row.date || <span className="text-danger">—</span>}</td>
                                <td className="px-3 py-1.5 text-text-light-main dark:text-text-dark-main max-w-[120px] truncate">{row.title || <span className="text-danger">—</span>}</td>
                                <td className="px-3 py-1.5 text-right font-semibold whitespace-nowrap">
                                  {row.amount > 0
                                    ? <span className={row.type === 'income' ? 'text-primary' : 'text-danger dark:text-red-400'}>{currencySymbol}{row.amount.toLocaleString()}</span>
                                    : <span className="text-danger">—</span>
                                  }
                                </td>
                                <td className="px-3 py-1.5">
                                  <span className={`text-[11px] font-medium ${row.type === 'income' ? 'text-primary' : 'text-danger dark:text-red-400'}`}>
                                    {row.type}
                                  </span>
                                </td>
                                <td className="px-3 py-1.5 text-text-light-main dark:text-text-dark-main">{row.category}</td>
                                <td className="px-3 py-1.5 text-text-light-muted dark:text-text-dark-muted max-w-[120px] truncate">
                                  {row.errors.length > 0
                                    ? <span className="text-red-500 dark:text-red-400">{row.errors[0]}</span>
                                    : row.warnings.length > 0
                                    ? <span className="text-amber-500 dark:text-amber-400 opacity-70">{row.warnings[0]}</span>
                                    : <span className="opacity-30">—</span>}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Empty filter state */}
                  {displayRows.length === 0 && (
                    <p className="text-center text-sm text-text-light-muted dark:text-text-dark-muted py-4">No rows match this filter.</p>
                  )}
                </>
              )}

              {/* ── Empty CSV ── */}
              {isParsed && rows.length === 0 && (
                <div className="flex flex-col items-center justify-center py-10 gap-3 text-text-light-muted dark:text-text-dark-muted">
                  <span className="material-symbols-outlined text-4xl opacity-40">description</span>
                  <p className="text-sm font-bold">No data rows found in this file.</p>
                  <button onClick={() => { setIsParsed(false); setFileName(null); }} className="text-primary text-xs font-bold hover:underline">Try another file</button>
                </div>
              )}

              {/* ── Import progress ── */}
              {isImporting && (
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between text-xs font-bold text-text-light-muted dark:text-text-dark-muted">
                    <span>Importing…</span>
                    <span>{importProgress}%</span>
                  </div>
                  <div className="h-2 w-full bg-gray-100 dark:bg-surface-darker rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full transition-all duration-300 ease-out shadow-glow"
                      style={{ width: `${importProgress}%` }}
                    />
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* ── Footer CTA ── */}
        {!result && isParsed && rows.length > 0 && !isImporting && (
          <div className="px-6 py-4 border-t border-border-light dark:border-border-dark shrink-0 flex items-center gap-3">
            <div className="flex-1 text-xs text-text-light-muted dark:text-text-dark-muted leading-snug">
              {validRows.length > 0
                ? <><span className="text-primary font-bold">{validRows.length}</span> row{validRows.length !== 1 ? 's' : ''} ready to import{errorRows.length > 0 ? `, ` : ''}{errorRows.length > 0 && <span className="text-danger font-bold">{errorRows.length} will be skipped</span>}</>
                : <span className="text-danger font-bold">All rows have errors — fix your CSV and re-upload.</span>
              }
            </div>
            <button
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-border-light dark:border-border-dark text-sm font-bold text-text-light-muted dark:text-text-dark-muted hover:bg-gray-100 dark:hover:bg-surface-darker transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleImport}
              disabled={validRows.length === 0}
              className="px-5 py-2.5 rounded-xl bg-primary text-[#131811] text-sm font-bold shadow-glow hover:bg-primary-hover transition-all active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <span className="material-symbols-outlined text-lg">upload</span>
              Import {validRows.length} Row{validRows.length !== 1 ? 's' : ''}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default CSVImportModal;
