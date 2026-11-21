// CSV import/export for transactions. Export used to be copied into three
// screens with different columns (the History screen left out "Method", so its
// files didn't re-import correctly), and Settings had a second importer that
// split on every comma. Everything now goes through these functions.
import type { Transaction } from '../context/Store';
import { parseLocalDate, toLocalISODate } from './date';

/** Column order for exported files. CSVImportModal reads files in this order. */
export const CSV_HEADERS = ['Date', 'Title', 'Amount', 'Type', 'Category', 'Method', 'Note'] as const;

/**
 * Quote a value for CSV. Values starting with = + - @ are prefixed with ' so
 * spreadsheet apps show them as text instead of running them as formulas.
 */
export const escapeCsvField = (value: string | number | undefined | null): string => {
  if (typeof value === 'number') return String(value);
  let s = value ?? '';
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
};

/** Build CSV text (header row + one row per transaction). */
export const transactionsToCsv = (transactions: Transaction[]): string =>
  [
    CSV_HEADERS.join(','),
    ...transactions.map(tx =>
      [tx.date, tx.title, tx.amount, tx.type, tx.category, tx.paymentMethod, tx.note].map(escapeCsvField).join(',')
    ),
  ].join('\n');

/** Trigger a browser download of `content` as `fileName`. */
export const downloadFile = (content: string, fileName: string, mimeType: string) => {
  const url = URL.createObjectURL(new Blob([content], { type: mimeType }));
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  // Revoke after the click has started the download.
  setTimeout(() => URL.revokeObjectURL(url), 0);
};

/** Export transactions as a CSV download. `.csv` is added to the name. */
export const downloadTransactionsCsv = (transactions: Transaction[], baseName: string) =>
  downloadFile(transactionsToCsv(transactions), `${baseName}.csv`, 'text/csv');

/** Split one CSV line into fields, honouring quotes and "" escapes (RFC 4180). */
export function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let cur = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++; // skip the escaped quote
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

/** 'YYYY-MM-DD' for a real calendar date, or null (rejects e.g. 31 Feb). */
const isoIfValid = (y: number, m: number, d: number): string | null => {
  const iso = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  return toLocalISODate(parseLocalDate(iso)) === iso ? iso : null;
};

/**
 * Normalise a date from an imported file to 'YYYY-MM-DD'. Accepts ISO,
 * DD/MM/YYYY (also with '-'), and MM/DD/YYYY when the day is clearly > 12.
 * Returns null when the date can't be read.
 */
export function normaliseDate(raw: string): string | null {
  const s = raw.trim();
  if (!s) return null;

  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (iso) return isoIfValid(+iso[1], +iso[2], +iso[3]);

  const slashed = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/.exec(s);
  if (slashed) {
    const [a, b, y] = [+slashed[1], +slashed[2], +slashed[3]];
    // Day-first by default (the app's main audience). Only a second number above
    // 12 makes it unambiguously month-first.
    return b > 12 ? isoIfValid(y, a, b) : isoIfValid(y, b, a);
  }

  // Last resort, e.g. "19 Jul 2025". Read in local time so the day doesn't shift.
  const dt = new Date(s);
  return isNaN(dt.getTime()) ? null : toLocalISODate(dt);
}

/** Parse an amount, ignoring currency symbols, spaces and thousands separators. NaN if unreadable. */
export function parseAmount(raw: string): number {
  return parseFloat(raw.replace(/[₹$€£¥,\s]/g, '').trim());
}
