import React from 'react';
import { View, User } from '../types';
import { useEffect, useState } from 'react';


interface SidebarProps {
  currentView: View;
  onNavigate: (view: View) => void;
  user: User;
  isOpen?: boolean;
  onClose?: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({
  currentView,
  onNavigate,
  user,
  isOpen,
  onClose,
}) => {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 1024);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  const navItemClass = (view: View) => `
    flex items-center gap-3 px-4 py-3 rounded-xl transition-all cursor-pointer select-none font-semibold
    ${
      currentView === view
        ? 'bg-green-100 dark:bg-primary/10 text-green-800 dark:text-primary'
        : 'text-text-light-muted dark:text-text-dark-muted hover:bg-gray-100 dark:hover:bg-surface-dark hover:text-text-light-main dark:hover:text-text-dark-main'
    }
  `;

  const isMobileMode = isOpen !== undefined;

  const containerClasses = isMobileMode
    ? `fixed inset-y-0 left-0 z-50 w-72 bg-surface-lighter dark:bg-surface-darker border-r border-border-light dark:border-border-dark
       p-6 flex flex-col justify-between transition-transform duration-300 ease-in-out shadow-2xl
       ${isOpen ? 'translate-x-0' : '-translate-x-full'} lg:hidden`
    : `hidden lg:flex flex-col w-72 bg-surface-lighter dark:bg-surface-darker border-r border-border-light dark:border-border-dark
       h-full p-6 justify-between z-20`;

  return (
    <>
      {/* Mobile overlay */}
      {isMobileMode && isOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside className={containerClasses}>
        <div className="flex flex-col gap-8">
          {/* Brand */}
          <div className="flex items-center justify-between">
            <div 
              onClick={() => onNavigate(View.DASHBOARD)}
              className="flex items-center gap-3 cursor-pointer group"
            >
              <img src="/icon-hero.svg" alt="logo" className="w-10 h-10 object-contain group-hover:scale-105 transition-transform" />
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold leading-tight group-hover:text-primary transition-colors">ExpenseTracker</h1>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-gradient-to-r from-green-400 to-emerald-500 text-black font-bold tracking-wide shadow-md">
                  PRO+
                </span>
              </div>
            </div>

            {isMobileMode && (
              <button
                onClick={onClose}
                className="size-9 flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-surface-dark transition"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            )}
          </div>

          {/* Navigation */}
          <nav className="flex flex-col gap-2">
            <div onClick={() => onNavigate(View.DASHBOARD)} className={navItemClass(View.DASHBOARD)}>
              <span className="material-symbols-outlined">home</span>
              Dashboard
            </div>

            <div onClick={() => onNavigate(View.SCANNER)} className={navItemClass(View.SCANNER)}>
              <span className="material-symbols-outlined">receipt_long</span>
              Transactions
            </div>

            <div onClick={() => onNavigate(View.VAULT)} className={navItemClass(View.VAULT)}>
              <span className="material-symbols-outlined">savings</span>
              Vault
            </div>

            <div onClick={() => onNavigate(View.GOALS)} className={navItemClass(View.GOALS)}>
              <span className="material-symbols-outlined">money_bag</span>
              Budget
            </div>
          </nav>
        </div>

        {/* Desktop profile */}
        <button
          onClick={() => onNavigate(View.SETTINGS)}
          className="flex items-center gap-3 pt-4 border-t border-border-light dark:border-border-dark w-full hover:opacity-80 transition-opacity"
        >
          <img
            src={user.avatar}
            className="size-10 rounded-full flex-shrink-0"
            alt="Profile"
          />
          <div className="overflow-hidden text-left">
            <p className="text-sm font-medium truncate">{user.name}</p>
            <p className="text-xs text-text-light-muted truncate">{user.email}</p>
          </div>
        </button>

      </aside>

      {/* Bottom Navigation (MOBILE) */}
      {isMobile && (
        <nav className="fixed bottom-0 left-0 right-0 z-50 lg:hidden">
              <div className="  bg-white dark:bg-surface-darker
                  border border-border-light dark:border-border-dark shadow-l
                  grid grid-cols-5 items-center py-3">
            {[
              { view: View.DASHBOARD, icon: 'home', label: 'Home' },
              { view: View.SCANNER, icon: 'receipt_long', label: 'Transactions' },
              { view: View.VAULT, icon: 'savings', label: 'Vault' },
              { view: View.GOALS, icon: 'money_bag', label: 'Budget' },
              { view: View.SETTINGS, icon: 'person', label: 'Profile' },
            ].map(item => (
              <button
                key={item.label}
                onClick={() => onNavigate(item.view)}
                className={`flex flex-col items-center gap-1 text-xs transition
                  ${
                    currentView === item.view
                      ? 'text-primary font-semibold'
                      : 'text-gray-400'
                  }`}
              >
                <span className="material-symbols-outlined">{item.icon}</span>
                {item.label}
              </button>
            ))}
          </div>
        </nav>
      )}
    </>
  );
};

export default Sidebar;