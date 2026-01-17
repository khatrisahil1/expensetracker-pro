
import React from 'react';
import { View, User } from '../types';

interface SidebarProps {
  currentView: View;
  onNavigate: (view: View) => void;
  user: User;
  isOpen?: boolean;
  onClose?: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ currentView, onNavigate, user, isOpen, onClose }) => {
  
  const navItemClass = (view: View) => `
    flex items-center gap-3 px-4 py-3 rounded-full transition-all cursor-pointer select-none font-bold
    ${currentView === view 
      ? 'bg-green-100 dark:bg-primary/10 text-green-800 dark:text-primary' 
      : 'text-text-light-muted dark:text-text-dark-muted hover:bg-gray-100 dark:hover:bg-surface-dark hover:text-text-light-main dark:hover:text-text-dark-main'}
  `;

  const isMobileMode = isOpen !== undefined;
  const containerClasses = isMobileMode
    ? `fixed inset-y-0 left-0 z-50 w-72 bg-surface-lighter dark:bg-surface-darker border-r border-border-light dark:border-border-dark p-6 flex flex-col justify-between transition-transform duration-300 ease-in-out shadow-2xl ${isOpen ? 'translate-x-0' : '-translate-x-full'} lg:hidden`
    : `hidden lg:flex flex-col w-72 bg-surface-lighter dark:bg-surface-darker border-r border-border-light dark:border-border-dark h-full p-6 justify-between z-20`;

  return (
    <>
      {isMobileMode && isOpen && (<div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden animate-fade-in" onClick={onClose}></div>)}

      <aside className={containerClasses}>
        <div className="flex flex-col gap-8">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="bg-center bg-no-repeat bg-cover rounded-xl size-10 flex items-center justify-center bg-primary/10 text-primary shadow-glow">
                        <span className="material-symbols-outlined text-2xl">account_balance_wallet</span>
                    </div>
                    <div className="flex flex-col">
                        <h1 className="text-text-light-main dark:text-text-dark-main text-lg font-bold tracking-tight">ExpenseTracker</h1>
                        <span className="text-xs text-primary font-bold uppercase tracking-wider">Pro Plan</span>
                    </div>
                </div>
                {isMobileMode && (<button onClick={onClose} className="text-text-light-muted dark:text-text-dark-muted hover:text-text-light-main dark:hover:text-text-dark-main"><span className="material-symbols-outlined">close</span></button>)}
            </div>

            <nav className="flex flex-col gap-2">
              <div className={navItemClass(View.DASHBOARD)} onClick={() => onNavigate(View.DASHBOARD)}>
                  <span className={`material-symbols-outlined ${currentView === View.DASHBOARD ? 'fill-1' : ''}`}>grid_view</span>
                  <span className="text-sm">Dashboard</span>
              </div>
              <div className={navItemClass(View.SCANNER)} onClick={() => onNavigate(View.SCANNER)}>
                  <span className={`material-symbols-outlined ${currentView === View.SCANNER ? 'fill-1' : ''}`}>receipt_long</span>
                  <span className="text-sm">Transactions</span>
              </div>
              {/* Time Machine and Peacemaker hidden as requested */}
              <div className={navItemClass(View.VAULT)} onClick={() => onNavigate(View.VAULT)}>
                  <span className={`material-symbols-outlined ${currentView === View.VAULT ? 'fill-1' : ''}`}>lock</span>
                  <span className="text-sm">Impulse Vault</span>
              </div>
              <div className={navItemClass(View.GOALS)} onClick={() => onNavigate(View.GOALS)}>
                  <span className={`material-symbols-outlined ${currentView === View.GOALS ? 'fill-1' : ''}`}>pie_chart</span>
                  <span className="text-sm">Budget & Goals</span>
              </div>
            </nav>
        </div>

        <div className="flex flex-col gap-3">
            <div className={navItemClass(View.SETTINGS)} onClick={() => onNavigate(View.SETTINGS)}>
                <span className={`material-symbols-outlined ${currentView === View.SETTINGS ? 'fill-1' : ''}`}>settings</span>
                <span className="text-sm">Settings</span>
            </div>

            <div className="h-px bg-border-light dark:bg-border-dark w-full my-1"></div>

            <div className="flex items-center gap-3 px-2 py-1">
                <div className="size-10 rounded-full bg-cover bg-center border-2 border-border-light dark:border-border-dark shrink-0" style={{backgroundImage: `url('${user.avatar}')`}}></div>
                <div className="flex flex-col overflow-hidden">
                  <p className="text-sm font-medium text-text-light-main dark:text-text-dark-main truncate">{user.name}</p>
                  <p className="text-xs text-text-light-muted dark:text-gray-400 truncate">{user.email}</p>
                </div>
            </div>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
