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
import { LoadingScreen } from './LoadingScreen';

/**
 * Shell for every signed-in page: sidebar, bottom nav, global overlays and the
 * scrolling content area. The current page renders into <Outlet />.
 */
const AppLayout: React.FC = () => {
  const { user, userSettings } = useStore();
  const { pathname } = useLocation();
  const isOnline = useOnlineStatus();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

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
      {!isOnline && (
        <div className="fixed top-4 left-1/2 z-[210] -translate-x-1/2 w-[min(98vw,1024px)] px-4">
          <div className="flex items-center justify-between gap-4 rounded-full bg-amber-600/90 px-4 py-2 text-sm font-semibold text-white shadow-lg backdrop-blur">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-base">cloud_off</span>
              Offline mode — changes will sync once you’re back online.
            </div>
            <button onClick={() => window.location.reload()} className="rounded-full bg-white/15 px-3 py-1 text-xs font-bold uppercase tracking-wide hover:bg-white/25">
              Retry
            </button>
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
        <div ref={scrollRef} className="flex-1 overflow-y-auto overflow-x-hidden relative scroll-smooth">
          {/* key restarts the page-enter animation on every route change */}
          <div key={pathname} className="animate-page-transition">
            <Suspense fallback={<LoadingScreen />}>
              <Outlet />
            </Suspense>
          </div>
        </div>
      </main>
    </div>
  );
};

export default AppLayout;
