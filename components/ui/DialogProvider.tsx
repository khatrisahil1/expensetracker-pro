// In-app confirm dialogs and toasts, used instead of window.confirm/alert.
// The native dialogs can be blocked or silently return false in embedded
// browsers (the desktop app's browser pane, some PWAs), which is why turning
// App Lock off appeared to do nothing. They also froze the page and looked
// nothing like the app.
//
//   const dialog = useDialog();
//   if (await dialog.confirm({ title: 'Turn off App Lock?', confirmLabel: 'Turn Off', destructive: true })) …
//   dialog.toast('Saved');               // success
//   dialog.toast('Could not save', 'error');
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

export interface ConfirmOptions {
  title: string;
  message?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Red confirm button, for actions that delete or turn something off. */
  destructive?: boolean;
}
type ToastKind = 'success' | 'error' | 'info';

interface DialogApi {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
  toast: (message: string, kind?: ToastKind) => void;
}

const DialogContext = createContext<DialogApi | null>(null);

/** Fallback outside the provider (tests, isolated renders): use the browser's own dialogs. */
const nativeApi: DialogApi = {
  confirm: async ({ title, message }) => window.confirm(typeof message === 'string' ? `${title}\n\n${message}` : title),
  toast: message => console.info(message),
};

export const useDialog = () => useContext(DialogContext) ?? nativeApi;

interface PendingConfirm extends ConfirmOptions { resolve: (ok: boolean) => void }
interface Toast { id: number; message: string; kind: ToastKind }

const TOAST_ICON: Record<ToastKind, string> = { success: 'check_circle', error: 'error', info: 'info' };
const TOAST_MS = 2800;

export const DialogProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [pending, setPending] = useState<PendingConfirm | null>(null);
  const [closing, setClosing] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);
  const confirmButton = useRef<HTMLButtonElement>(null);

  const confirm = useCallback((options: ConfirmOptions) =>
    new Promise<boolean>(resolve => { setClosing(false); setPending({ ...options, resolve }); }), []);

  const toast = useCallback((message: string, kind: ToastKind = 'success') => {
    const id = nextId.current++;
    setToasts(list => [...list.slice(-2), { id, message, kind }]);
    setTimeout(() => setToasts(list => list.filter(t => t.id !== id)), TOAST_MS);
  }, []);

  /** Play the exit animation, then resolve. */
  const close = useCallback((ok: boolean) => {
    if (!pending) return;
    setClosing(true);
    setTimeout(() => { pending.resolve(ok); setPending(null); setClosing(false); }, 160);
  }, [pending]);

  // Escape cancels; focus starts on the confirm button for keyboard users.
  useEffect(() => {
    if (!pending) return;
    confirmButton.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [pending, close]);

  return (
    <DialogContext.Provider value={{ confirm, toast }}>
      {children}
      {createPortal(
        <>
          {pending && (
            <div className={`fixed inset-0 z-[300] flex items-end sm:items-center justify-center p-4 bg-black/50 backdrop-blur-sm ${closing ? 'animate-fade-out' : 'animate-fade-in'}`}
              onClick={() => close(false)}>
              <div role="alertdialog" aria-modal="true" aria-labelledby="app-confirm-title"
                onClick={e => e.stopPropagation()}
                className={`w-full max-w-sm rounded-[2rem] bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark shadow-2xl p-6 flex flex-col gap-5 ${closing ? 'animate-sheet-out' : 'animate-sheet-in'}`}>
                <div className="flex flex-col gap-2 text-center">
                  <span className={`mx-auto size-12 rounded-full flex items-center justify-center ${pending.destructive ? 'bg-danger/10 text-danger' : 'bg-primary/10 text-primary'} animate-pop`}>
                    <span className="material-symbols-outlined" aria-hidden="true">{pending.destructive ? 'warning' : 'help'}</span>
                  </span>
                  <h2 id="app-confirm-title" className="text-lg font-black text-text-light-main dark:text-text-dark-main">{pending.title}</h2>
                  {pending.message && <div className="text-sm text-text-light-muted dark:text-text-dark-muted">{pending.message}</div>}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <button onClick={() => close(false)} className="py-3 rounded-full font-bold text-sm bg-gray-100 dark:bg-white/5 text-text-light-main dark:text-text-dark-main hover:bg-gray-200 dark:hover:bg-white/10 transition-colors">
                    {pending.cancelLabel ?? 'Cancel'}
                  </button>
                  <button ref={confirmButton} onClick={() => close(true)}
                    className={`py-3 rounded-full font-bold text-sm transition-colors ${pending.destructive ? 'bg-danger text-white hover:bg-danger/90' : 'bg-primary text-[#131811] hover:bg-primary-hover'}`}>
                    {pending.confirmLabel ?? 'OK'}
                  </button>
                </div>
              </div>
            </div>
          )}
          <div aria-live="polite" className="fixed z-[310] top-4 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 pointer-events-none w-[min(92vw,420px)]">
            {toasts.map(t => (
              <div key={t.id} role="status"
                className="pointer-events-auto flex items-center gap-2 px-4 py-2.5 rounded-full bg-gray-900/95 dark:bg-surface-darker/95 border border-white/10 text-white text-sm font-semibold shadow-xl backdrop-blur animate-toast-in">
                <span className={`material-symbols-outlined text-[18px] ${t.kind === 'error' ? 'text-red-400' : t.kind === 'info' ? 'text-sky-300' : 'text-primary'}`} aria-hidden="true">{TOAST_ICON[t.kind]}</span>
                {t.message}
              </div>
            ))}
          </div>
        </>,
        document.body,
      )}
    </DialogContext.Provider>
  );
};
