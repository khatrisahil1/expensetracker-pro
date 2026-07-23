import React, { useState, useRef } from 'react';
import { useStore } from '../context/Store';

interface BackupRestoreModalProps {
  onClose: () => void;
}

const BackupRestoreModal: React.FC<BackupRestoreModalProps> = ({ onClose }) => {
  const { exportAllData, importAllData, transactions, isDemo } = useStore();
  const [tab, setTab] = useState<'export' | 'import'>('export');
  const [isImporting, setIsImporting] = useState(false);
  const [importStatus, setImportStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [confirmImport, setConfirmImport] = useState<any>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleExport = () => {
    const data = exportAllData();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `expensetracker_backup_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target?.result as string);
        if (!data.version || !data.transactions) throw new Error('Invalid backup file format');
        setConfirmImport(data);
      } catch (err: any) {
        setImportStatus({ type: 'error', message: err.message || 'Could not parse backup file' });
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleConfirmImport = async () => {
    if (!confirmImport) return;
    setIsImporting(true);
    setImportStatus(null);
    try {
      await importAllData(confirmImport);
      setImportStatus({ type: 'success', message: `Restored ${confirmImport.transactions?.length || 0} transactions successfully!` });
      setConfirmImport(null);
    } catch (err: any) {
      setImportStatus({ type: 'error', message: err.message || 'Import failed. Please try again.' });
    } finally {
      setIsImporting(false);
    }
  };

  const today = new Date().toISOString().split('T')[0];

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark rounded-3xl w-full max-w-md shadow-2xl animate-slide-up flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border-light dark:border-border-dark">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
              <span className="material-symbols-outlined">cloud_sync</span>
            </div>
            <div>
              <h2 className="text-lg font-black text-text-light-main dark:text-text-dark-main">Backup & Restore</h2>
              <p className="text-xs text-text-light-muted dark:text-text-dark-muted">{transactions.length} transactions on record</p>
            </div>
          </div>
          <button onClick={onClose} className="size-9 rounded-full hover:bg-gray-100 dark:hover:bg-surface-darker flex items-center justify-center transition-colors">
            <span className="material-symbols-outlined text-text-light-muted">close</span>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex bg-gray-50 dark:bg-surface-darker m-4 p-1 rounded-2xl gap-1">
          {(['export', 'import'] as const).map(t => (
            <button
              key={t}
              onClick={() => { setTab(t); setImportStatus(null); setConfirmImport(null); }}
              className={`flex-1 py-2.5 rounded-xl text-sm font-bold capitalize transition-all ${
                tab === t
                  ? 'bg-white dark:bg-surface-dark text-text-light-main dark:text-text-dark-main shadow-sm'
                  : 'text-text-light-muted dark:text-text-dark-muted hover:text-text-light-main dark:hover:text-text-dark-main'
              }`}
            >{t}</button>
          ))}
        </div>

        <div className="px-6 pb-6 flex flex-col gap-4">
          {tab === 'export' ? (
            <>
              <div className="p-4 rounded-2xl bg-primary/5 border border-primary/20 flex flex-col gap-2">
                <div className="flex items-center gap-2 text-primary font-bold text-sm">
                  <span className="material-symbols-outlined text-[18px]">info</span>
                  What's included
                </div>
                <ul className="text-xs text-text-light-muted dark:text-text-dark-muted space-y-1 ml-6">
                  <li>• All {transactions.length} transactions with full details</li>
                  <li>• Your settings and preferences</li>
                  <li>• Impulse Vault items</li>
                  <li>• Category budgets and savings goals</li>
                </ul>
              </div>
              <div className="text-xs text-text-light-muted dark:text-text-dark-muted">
                File: <code className="bg-gray-100 dark:bg-surface-darker px-1.5 py-0.5 rounded font-mono">expensetracker_backup_{today}.json</code>
              </div>
              {isDemo && (
                <div className="p-3 rounded-xl bg-warning/10 border border-warning/20 text-warning text-xs font-bold">
                  Export is not available in Demo mode.
                </div>
              )}
              <button
                onClick={handleExport}
                disabled={isDemo}
                className="w-full py-4 bg-primary text-[#131811] font-black rounded-2xl shadow-glow hover:bg-primary/90 active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <span className="material-symbols-outlined">download</span>
                Download Backup
              </button>
            </>
          ) : (
            <>
              {confirmImport ? (
                <div className="flex flex-col gap-4 animate-fade-in">
                  <div className="p-4 rounded-2xl bg-warning/10 border border-warning/20">
                    <div className="flex items-center gap-2 text-warning font-bold text-sm mb-2">
                      <span className="material-symbols-outlined text-[18px]">warning</span>
                      Confirm Restore
                    </div>
                    <p className="text-xs text-text-light-muted dark:text-text-dark-muted">
                      This will <strong>add</strong> {confirmImport.transactions?.length || 0} transactions from the backup.
                      Exported on: {confirmImport.exportedAt?.split('T')[0] || 'Unknown'}
                    </p>
                  </div>
                  <div className="flex gap-3">
                    <button
                      onClick={() => setConfirmImport(null)}
                      className="flex-1 py-3 rounded-xl border border-border-light dark:border-border-dark font-bold text-text-light-muted hover:bg-gray-50 dark:hover:bg-surface-darker transition-colors"
                    >Cancel</button>
                    <button
                      onClick={handleConfirmImport}
                      disabled={isImporting}
                      className="flex-1 py-3 rounded-xl bg-primary text-[#131811] font-black shadow-glow disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {isImporting && <span className="material-symbols-outlined animate-spin text-sm">sync</span>}
                      {isImporting ? 'Restoring...' : 'Restore Now'}
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  {importStatus && (
                    <div className={`p-4 rounded-2xl border text-sm font-bold flex items-center gap-2 ${
                      importStatus.type === 'success'
                        ? 'bg-primary/10 border-primary/20 text-primary'
                        : 'bg-danger/10 border-danger/20 text-danger'
                    }`}>
                      <span className="material-symbols-outlined text-[18px]">
                        {importStatus.type === 'success' ? 'check_circle' : 'error'}
                      </span>
                      {importStatus.message}
                    </div>
                  )}
                  <div className="p-4 rounded-2xl bg-gray-50 dark:bg-surface-darker border border-dashed border-border-light dark:border-border-dark flex flex-col items-center gap-3">
                    <span className="material-symbols-outlined text-4xl text-text-light-muted opacity-40">upload_file</span>
                    <p className="text-sm text-text-light-muted dark:text-text-dark-muted text-center">Select a <code>.json</code> backup file to restore from</p>
                    <button
                      onClick={() => fileRef.current?.click()}
                      className="px-6 py-2.5 rounded-xl bg-primary text-[#131811] font-bold shadow-glow hover:bg-primary/90 transition-all text-sm"
                    >
                      Choose File
                    </button>
                  </div>
                  <input ref={fileRef} type="file" accept=".json" className="hidden" onChange={handleFileSelect} />
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default BackupRestoreModal;
