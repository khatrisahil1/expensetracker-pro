import React, { Suspense, useEffect, useRef, useState } from 'react';
import { Outlet, useLocation } from 'react-router';
import { useStore } from '../context/Store';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { PAGE_TITLES } from '../routes';
import { User } from '../types';
import Sidebar from './Sidebar';
import TransactionDetailsPanel from './TransactionDetailsPanel';
import UndoSnackbar from './UndoSnackbar';
import RenewalPrompt from './RenewalPrompt';
import { PageLoader } from './LoadingScreen';
import { useDialog } from './ui/DialogProvider';
import PullToRefresh from './PullToRefresh';
import { usePullToRefresh } from '../hooks/usePullToRefresh';

/**
 * Shell for every signed-in page: sidebar, bottom nav, global overlays and the
 * scrolling content area. The current page renders into <Outlet />.
 */
const AppLayout: React.FC = () => {
  const { user, userSettings, refreshUser, isDemo } = useStore();
  const { pathname } = useLocation();
  const isOnline = useOnlineStatus();
  const dialog = useDialog();
  // Say so when the connection comes back (not on the first render).
  const wasOnline = useRef(isOnline);
  useEffect(() => {
    if (isOnline && !wasOnline.current) dialog.toast('Back online. Syncing your changes…', 'success');
    wasOnline.current = isOnline;
  }, [isOnline, dialog]);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Pull down from the top to refresh (touch screens). Data is already live
  // (Firestore listeners), so this is a soft refresh: re-draw the page, re-check
  // the account (e.g. email verified) and look for a new app version. A full
  // reload would show the splash again and re-lock the app if a PIN is set.
  const [refreshKey, setRefreshKey] = useState(0);
  const handleRefresh = async () => {
    setRefreshKey(k => k + 1);
    const checks: Promise<unknown>[] = [];
    if (user && !isDemo) checks.push(refreshUser().catch(() => {}));
    if ('serviceWorker' in navigator) {
      checks.push(navigator.serviceWorker.getRegistration().then(r => r?.update()).catch(() => {}));
    }
    await Promise.all(checks);
    if (!navigator.onLine) dialog.toast('You’re offline. Showing what’s saved on this device.', 'info');
  };
  const { pull, phase: pullPhase, dragging } = usePullToRefresh(scrollRef, handleRefresh);

  // On every page change: start at the top, close the drawer, update the tab title.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
    setMobileMenuOpen(false);
    const page = PAGE_TITLES[pathname];
    document.title = page ? `${page} · ExpenseTracker Pro` : 'ExpenseTracker Pro';
  }, [pathname]);

  const displayUser: User = {
    name: userSettings?.displayName || user?.email?.split('@')[0] || 'Guest',
    email: user?.email || 'guest@example.com',
    avatar: userSettings?.avatar || '/avatar-placeholder.png',
    plan: 'Pro Plan',
  };

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background-light dark:bg-background-dark text-text-light-main dark:text-text-dark-main transition-colors duration-300 font-display">
      {/* Connection status. Data keeps working offline: reads come from the
          device cache and saves queue until the connection returns. */}
      {!isOnline && (
        <div role="status" className="fixed top-3 left-1/2 -translate-x-1/2 z-[210] w-[min(94vw,520px)] animate-toast-in">
          <div className="flex items-center gap-3 rounded-2xl bg-amber-500/95 px-4 py-2.5 text-sm font-semibold text-[#1a1300] shadow-lg backdrop-blur">
            <span className="relative flex size-8 shrink-0 items-center justify-center rounded-full bg-black/10">
              <span className="material-symbols-outlined text-[18px] animate-[pulse_2s_ease-in-out_infinite]" aria-hidden="true">cloud_off</span>
            </span>
            <span className="flex-1 leading-snug">
              You’re offline. Keep going — changes are saved on this device and sync when you’re back.
            </span>
          </div>
        </div>
      )}

      {/* Desktop sidebar (also renders the mobile bottom bar) */}
      <Sidebar user={displayUser} />
      {/* Mobile slide-in drawer */}
      <Sidebar user={displayUser} isOpen={mobileMenuOpen} onClose={() => setMobileMenuOpen(false)} />

      {/* Global overlays */}
      <TransactionDetailsPanel />
      <UndoSnackbar />
      <RenewalPrompt />

      <main className="flex-1 flex flex-col h-full overflow-hidden relative">
        <PullToRefresh pull={pull} phase={pullPhase} dragging={dragging} />
        {/* overscroll-y-contain stops the browser's own pull-to-refresh / bounce */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto overflow-x-hidden relative scroll-smooth overscroll-y-contain">
          {/* key restarts the page-enter animation on every route change (and on refresh).
              The content follows the pull; the transform is removed entirely when idle,
              because any transform here would trap position:fixed dialogs. */}
          <div key={`${pathname}#${refreshKey}`} className="animate-page-transition"
            style={pullPhase === 'idle' ? undefined : {
              transform: `translateY(${pull}px)`,
              transition: dragging ? 'none' : 'transform 0.32s cubic-bezier(0.34, 1.56, 0.64, 1)',
            }}>
            <Suspense fallback={<PageLoader />}>
              <Outlet />
            </Suspense>
          </div>
        </div>
      </main>
    </div>
  );
};

export default AppLayout;
