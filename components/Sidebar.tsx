// Navigation. Renders the desktop sidebar (and the phone bottom bar) or, with
// isOpen/onClose, the mobile slide-in drawer. Items come from NAV_ITEMS in routes.ts.
import React, { useEffect, useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router';
import WrappedAvatar from './wrapped/WrappedAvatar';
import { User } from '../types';
import { ROUTES, NAV_ITEMS, MOBILE_NAV_ITEMS } from '../routes';


interface SidebarProps {
  user: User;
  isOpen?: boolean;
  onClose?: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({
  user,
  isOpen,
  onClose,
}) => {
  const navigate = useNavigate();
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 1024);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  const navItemClass = ({ isActive }: { isActive: boolean }) => `
    group flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 cursor-pointer select-none font-semibold
    ${isActive
      ? 'bg-green-100 dark:bg-primary/10 text-green-800 dark:text-primary shadow-[inset_3px_0_0_#2ECC71]'
      : 'text-text-light-muted dark:text-text-dark-muted hover:bg-gray-100 dark:hover:bg-surface-dark hover:text-text-light-main dark:hover:text-text-dark-main hover:translate-x-1'
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
            <Link
              to={ROUTES.DASHBOARD}
              className="flex items-center gap-3 cursor-pointer group"
            >
              <img src="/icon-hero.svg" alt="logo" className="w-10 h-10 object-contain group-hover:scale-105 transition-transform" />
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold leading-tight group-hover:text-primary transition-colors">ExpenseTracker</h1>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-gradient-to-r from-green-400 to-emerald-500 text-black font-bold tracking-wide shadow-md">
                  PRO+
                </span>
              </div>
            </Link>

            {isMobileMode && (
              <button
                onClick={onClose}
                aria-label="Close menu"
                className="size-9 flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-surface-dark transition"
              >
                <span aria-hidden="true" className="material-symbols-outlined">close</span>
              </button>
            )}
          </div>

          {/* Navigation */}
          <nav className="flex flex-col gap-2">
            {NAV_ITEMS.map(item => (
              // `end` keeps "/" from matching every page.
              <NavLink key={item.to} to={item.to} end={item.to === ROUTES.DASHBOARD} className={navItemClass}>
                <span className="material-symbols-outlined transition-transform duration-300 group-hover:scale-110" aria-hidden="true">{item.icon}</span>
                {item.label}
              </NavLink>
            ))}
          </nav>
        </div>

        {/* Desktop profile */}
        {/* Picture: tap = Profile, press and hold = Monthly Wrapped. Name links to Profile. */}
        <div className="flex items-center gap-3 pt-4 border-t border-border-light dark:border-border-dark w-full">
          <WrappedAvatar size={40} src={user.avatar && !user.avatar.endsWith('avatar-placeholder.png') ? user.avatar : undefined}
            initials={user.name.split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase()}
            onTap={() => navigate(ROUTES.SETTINGS)} />
          <Link to={ROUTES.SETTINGS} className="overflow-hidden text-left hover:opacity-80 transition-opacity">
            <p className="text-sm font-medium truncate">{user.name}</p>
            <p className="text-xs text-text-light-muted truncate">{user.email}</p>
          </Link>
        </div>

      </aside>

      {/* Bottom navigation on phones. Only the main sidebar instance renders it;
          the drawer instance rendering it too stacked two bars on top of each other. */}
      {isMobile && !isMobileMode && (
        <nav className="fixed bottom-0 left-0 right-0 z-50 lg:hidden">
          <div className="  bg-white dark:bg-surface-darker
                  border border-border-light dark:border-border-dark shadow-l
                  grid grid-cols-5 items-center py-3">
            {MOBILE_NAV_ITEMS.map(item => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === ROUTES.DASHBOARD}
                className={({ isActive }) => `flex flex-col items-center gap-1 text-xs transition-colors
                  ${isActive
                    ? 'text-primary font-semibold'
                    : 'text-gray-400'
                  }`}
              >
                {({ isActive }) => (
                  <>
                    {/* Active tab: a pill grows behind the icon and the icon pops */}
                    <span className={`relative flex items-center justify-center h-7 w-12 rounded-full transition-all duration-300 ${isActive ? 'bg-primary/15' : 'bg-transparent'}`}>
                      <span key={String(isActive)} className={`material-symbols-outlined ${isActive ? 'animate-pop' : ''}`} aria-hidden="true">{item.icon}</span>
                    </span>
                    {item.shortLabel}
                  </>
                )}
              </NavLink>
            ))}
          </div>
        </nav>
      )}
    </>
  );
};

export default Sidebar;