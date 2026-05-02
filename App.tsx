import React, { useState, useEffect } from 'react';
import { View, User } from './types';

// Hooks
const useOnlineStatus = () => {
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);

  useEffect(() => {
    const update = () => setIsOnline(navigator.onLine);
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);

  return isOnline;
};
// Component Imports
import LoginScreen from './components/LoginScreen';
import DashboardScreen from './components/DashboardScreen';
import SimulatorScreen from './components/SimulatorScreen';
import ImpulseVaultScreen from './components/ImpulseVaultScreen';
import SplitBillScreen from './components/SplitBillScreen';
import { ScannerScreen } from './components/ScannerScreen';
import SettingsScreen from './components/SettingsScreen';
import OnboardingScreen from './components/OnboardingScreen';
import TransactionsCalendarScreen from './components/TransactionsCalendarScreen';
import SubscriptionsScreen from './components/SubscriptionsScreen';
import TransactionDetailsPanel from './components/TransactionDetailsPanel';
import BudgetGoalsScreen from './components/BudgetGoalsScreen';
import Sidebar from './components/Sidebar';
import { PinLockScreen } from './components/PinLockScreen';
import { LoadingScreen } from './components/LoadingScreen';
// Global Store
import { StoreProvider, useStore } from './context/Store';

// Global Component: Undo Snackbar
// Displays when an item is deleted, allowing immediate restoration
const UndoSnackbar: React.FC = () => {
    const { undoState, clearUndo, restoreTransaction } = useStore();
    const [progress, setProgress] = useState(100);

    useEffect(() => {
        if (!undoState.show) return;

        setProgress(100);
        const duration = 5000;
        const start = performance.now();

        const id = window.setInterval(() => {
            const elapsed = performance.now() - start;
            const percent = Math.max(0, 100 - (elapsed / duration) * 100);
            setProgress(percent);
            if (percent <= 0) window.clearInterval(id);
        }, 50);

        return () => window.clearInterval(id);
    }, [undoState.show]);

    if (!undoState.show || !undoState.item) return null;

    const handleUndo = async () => {
        if (undoState.item) {
            await restoreTransaction(undoState.item);
            clearUndo();
        }
    };

    const circleRadius = 14;
    const circleCircumference = 2 * Math.PI * circleRadius;
    const strokeDashOffset = circleCircumference * (1 - progress / 100);
    const isUrgent = progress <= 25;

    return (
        <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[200] w-42/50 max-w-[90vw]">
            <div className={`relative flex items-center justify-between gap-4 bg-surface-darker/90 backdrop-blur-xl border border-white/10 text-white px-5 py-4 rounded-full shadow-[0_20px_50px_rgba(0,0,0,0.35)] animate-slide-up ${isUrgent ? 'ring-2 ring-amber-300/60' : ''}`}>
                <div className="flex items-center gap-4">
                    <div className="relative">
                        {isUrgent && <div className="absolute inset-0 rounded-full bg-amber-400/10 animate-pulse" />}
                        <svg width="40" height="40" className="rotate-[-90deg]">
                            <circle
                                cx="20"
                                cy="20"
                                r={circleRadius}
                                stroke="rgba(255,255,255,0.15)"
                                strokeWidth="4"
                                fill="transparent"
                            />
                            <circle
                                cx="20"
                                cy="20"
                                r={circleRadius}
                                stroke={isUrgent ? '#f87171' : '#38bdf8'}
                                strokeWidth="4"
                                fill="transparent"
                                strokeDasharray={circleCircumference}
                                strokeDashoffset={strokeDashOffset}
                                strokeLinecap="round"
                            />
                        </svg>
                        <span className="absolute inset-0 flex items-center justify-center text-[18px] text-white"><svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="#e3e3e3"><path d="M280-200v-80h284q63 0 109.5-40T720-420q0-60-46.5-100T564-560H312l104 104-56 56-200-200 200-200 56 56-104 104h252q97 0 166.5 63T800-420q0 94-69.5 157T564-200H280Z"/></svg></span>
                    </div>
                    <div className="flex flex-col">
                        <p className="font-black text-sm leading-tight">Deleted</p>
                        <p className="text-[11px] text-gray-300 truncate max-w-[160px] md:max-w-[260px]">{undoState.item.title}</p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <span className={`text-[11px] font-bold tracking-wide ${isUrgent ? 'text-amber-100' : 'text-gray-300'}`}>{Math.ceil((progress / 100) * 5)}s</span>
                    <button onClick={handleUndo} className={`text-sm font-black px-4 py-2 rounded-full border transition-all active:scale-95 ${isUrgent ? 'bg-amber-500/20 border-amber-300 text-amber-100 hover:bg-amber-500/30' : 'bg-primary/15 border-primary/25 text-primary hover:bg-primary/25'}`}>UNDO</button>
                    <button onClick={clearUndo} className="size-8 rounded-full flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 transition-colors"><span className="material-symbols-outlined text-lg">close</span></button>
                </div>
            </div>
        </div>
    );
};

// Main App Content wrapped to use Store Hook
const AppContent: React.FC = () => {
  const { user, userSettings, loading, isAppLocked } = useStore();
  const [currentView, setCurrentView] = useState<View>(View.LOGIN);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const isOnline = useOnlineStatus();

  // Effect: Handle Initial Routing based on Auth/Onboarding status
  useEffect(() => {
    if (!loading) {
      if (user) {
        // If user is logged in but hasn't finished onboarding, force Onboarding view
        if (userSettings && userSettings.hasCompletedOnboarding === false) {
            setCurrentView(View.ONBOARDING);
        } else if (currentView === View.LOGIN || currentView === View.ONBOARDING) {
            // Default to Dashboard if coming from login/onboarding
            setCurrentView(View.DASHBOARD);
        }
      } else {
        // No user, force Login view
        setCurrentView(View.LOGIN);
      }
    }
  }, [user, userSettings, loading]);

  const handleNavigate = (view: View) => {
    setCurrentView(view);
    setMobileMenuOpen(false); // Close mobile drawer on navigation
    // Reset scroll position of the main content area
    setTimeout(() => {
        const mainContent = document.querySelector('main > div.overflow-y-auto');
        if (mainContent) mainContent.scrollTo({ top: 0, behavior: 'instant' });
    }, 0);
  };

  // Construct display user object safely
  const displayUser: User = {
    name: userSettings?.displayName || user?.email?.split('@')[0] || "Guest",
    email: user?.email || "guest@example.com",
    avatar: userSettings?.avatar || "/public/avatar-placeholder.png",
    plan: "Pro Plan"
  };

  // --- RENDERING CONDITIONS ---
  if (loading) return <LoadingScreen />;
  if (!user) return <LoginScreen />;
  if (isAppLocked) return <PinLockScreen />;
  if (currentView === View.ONBOARDING) return <OnboardingScreen />;

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

      {/* Desktop Sidebar */}
      <Sidebar currentView={currentView} onNavigate={handleNavigate} user={displayUser} />
      
      {/* Mobile Drawer */}
      <Sidebar currentView={currentView} onNavigate={handleNavigate} user={displayUser} isOpen={mobileMenuOpen} onClose={() => setMobileMenuOpen(false)} />

      {/* Global Overlays */}
      <TransactionDetailsPanel />
      <UndoSnackbar />

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col h-full overflow-hidden relative">
         
         {/* Mobile Header */}
         

        {/* Dynamic View Rendering */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden relative scroll-smooth">
          <div
            key={currentView}
            className="animate-page-transition"
          >
            {currentView === View.DASHBOARD && <DashboardScreen onNavigate={handleNavigate} />}
            {currentView === View.TRANSACTIONS_CALENDAR && <TransactionsCalendarScreen onNavigate={handleNavigate} />}
            {currentView === View.SIMULATOR && <SimulatorScreen />}
            {currentView === View.VAULT && <ImpulseVaultScreen />}
            {currentView === View.SPLIT_BILL && <SplitBillScreen />}
            {currentView === View.SCANNER && <ScannerScreen onNavigate={handleNavigate} />}
            {currentView === View.SETTINGS && <SettingsScreen />}
            {currentView === View.GOALS && <BudgetGoalsScreen />}
            {currentView === View.SUBSCRIPTIONS && <SubscriptionsScreen />}
          </div>
        </div>
      </main>
    </div>
  );
};

// Root Component
const App: React.FC = () => (
  <StoreProvider>
    <AppContent />
  </StoreProvider>
);

export default App;
