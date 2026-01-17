
import React, { useState, useEffect } from 'react';
import { View, User } from './types';
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
import TransactionDetailsPanel from './components/TransactionDetailsPanel';
import BudgetGoalsScreen from './components/BudgetGoalsScreen';
import Sidebar from './components/Sidebar';
import { PinLockScreen } from './components/PinLockScreen';
// Global Store
import { StoreProvider, useStore } from './context/Store';

// Global Component: Undo Snackbar
// Displays when an item is deleted, allowing immediate restoration
const UndoSnackbar: React.FC = () => {
    const { undoState, clearUndo, restoreTransaction } = useStore();
    if (!undoState.show || !undoState.item) return null;
    
    const handleUndo = async () => {
        if (undoState.item) {
            await restoreTransaction(undoState.item);
            clearUndo();
        }
    };
    
    return (
        <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[200] flex items-center gap-6 bg-surface-darker/95 backdrop-blur-xl border border-white/10 text-white px-5 py-3 rounded-full shadow-[0_20px_50px_rgba(0,0,0,0.5)] animate-slide-up w-max max-w-[90vw] transition-all">
            <div className="flex items-center gap-3">
                <div className="size-8 rounded-full bg-danger/20 flex items-center justify-center text-danger">
                    <span className="material-symbols-outlined text-[20px]">delete_sweep</span>
                </div>
                <div className="flex flex-col">
                    <p className="font-bold text-sm leading-tight">Deleted</p>
                    <p className="text-[10px] text-gray-400 truncate max-w-[120px] md:max-w-[200px]">{undoState.item.title}</p>
                </div>
            </div>
            <div className="flex items-center gap-2">
                <button onClick={handleUndo} className="text-primary hover:text-white font-bold text-xs bg-primary/10 px-4 py-2 rounded-full border border-primary/20 hover:bg-primary transition-all active:scale-90">UNDO</button>
                <button onClick={clearUndo} className="size-8 rounded-full flex items-center justify-center text-gray-500 hover:text-white hover:bg-white/10 transition-colors"><span className="material-symbols-outlined text-lg">close</span></button>
            </div>
        </div>
    );
};

// Main App Content wrapped to use Store Hook
const AppContent: React.FC = () => {
  const { user, userSettings, loading, isAppLocked } = useStore();
  const [currentView, setCurrentView] = useState<View>(View.LOGIN);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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
  };

  // Construct display user object safely
  const displayUser: User = {
    name: userSettings?.displayName || user?.email?.split('@')[0] || "Guest",
    email: user?.email || "guest@example.com",
    avatar: userSettings?.avatar || "https://lh3.googleusercontent.com/aida-public/AB6AXuAcAEnws9rS2HbwbG3qPnV8_qGytOlvQRoBUvYhiaVPLZIa4g3zNkVrS3z4C1R2Gbq0OTL5idod4LZAASaT5biqRGu3mxbSwJOhbRO5OShUb_GRgTbznnKyUQuwDW35BXcZC0Oh1UqghJzMaO0lgpHY-rRRUimUx5fPDfdb9MWmfRrowenbz-VjWW0l9lHfFVohrsyEmZihRRFDCHDBn-vAL2HRkGjV-GKMJPZT0H4sfVYDg3Y74VjQTGSHFveW2NZVgTRxbW1aSCI",
    plan: "Pro Plan"
  };

  // --- RENDERING CONDITIONS ---
  if (loading) return <div className="h-screen w-full bg-background-dark flex items-center justify-center text-primary"><span className="material-symbols-outlined text-4xl animate-spin">sync</span></div>;
  if (!user) return <LoginScreen />;
  if (isAppLocked) return <PinLockScreen />;
  if (currentView === View.ONBOARDING) return <OnboardingScreen />;

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background-light dark:bg-background-dark text-text-light-main dark:text-text-dark-main transition-colors duration-300 font-display">
      
      {/* Desktop Sidebar */}
      <Sidebar currentView={currentView} onNavigate={handleNavigate} user={displayUser} />
      
      {/* Mobile Drawer */}
      <Sidebar currentView={currentView} onNavigate={handleNavigate} user={displayUser} isOpen={mobileMenuOpen} onClose={() => setMobileMenuOpen(false)} />

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col h-full overflow-hidden relative">
         
         {/* Mobile Header */}
         <header className="lg:hidden flex items-center justify-between p-4 border-b border-border-light dark:border-border-dark bg-surface-darker z-30">
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-primary text-2xl">account_balance_wallet</span>
              <h1 className="text-white font-bold">ExpenseTracker</h1>
            </div>
            <button onClick={() => setMobileMenuOpen(true)} className="text-white p-2 hover:bg-surface-dark rounded-full transition-colors"><span className="material-symbols-outlined">menu</span></button>
        </header>

        {/* Dynamic View Rendering */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden relative scroll-smooth">
          {currentView === View.DASHBOARD && <DashboardScreen onNavigate={handleNavigate} />}
          {currentView === View.TRANSACTIONS_CALENDAR && <TransactionsCalendarScreen onNavigate={handleNavigate} />}
          {currentView === View.SIMULATOR && <SimulatorScreen />}
          {currentView === View.VAULT && <ImpulseVaultScreen />}
          {currentView === View.SPLIT_BILL && <SplitBillScreen />}
          {currentView === View.SCANNER && <ScannerScreen onNavigate={handleNavigate} />}
          {currentView === View.SETTINGS && <SettingsScreen />}
          {currentView === View.GOALS && <BudgetGoalsScreen />}
        </div>
        
        {/* Global Overlays */}
        <TransactionDetailsPanel />
        <UndoSnackbar />
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
