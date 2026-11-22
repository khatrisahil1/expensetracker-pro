// Mounted once in AppLayout. Opens Monthly Wrapped when any WrappedAvatar is
// held (see wrappedEvents), and shows the first-time spotlight tutorial
// ("press and hold your profile") once there's enough data to wrap.
import React, { useCallback, useEffect, useState } from 'react';
import { useLocation } from 'react-router';
import { useStore } from '../../context/Store';
import { STORAGE_KEYS } from '../../constants/app';
import { ROUTES } from '../../routes';
import { getCurrencySymbol } from '../../utils/currency';
import { defaultWrappedMonth } from '../../utils/wrapped';
import Spotlight from '../ui/Spotlight';
import MonthlyWrapped from './MonthlyWrapped';
import { onOpenWrapped, openWrapped } from './wrappedEvents';

/** Need at least this many entries before teaching the gesture. */
const MIN_TRANSACTIONS = 3;

const seen = () => { try { return localStorage.getItem(STORAGE_KEYS.WRAPPED_TUTORIAL_SEEN) === '1'; } catch { return true; } };
const markSeen = () => { try { localStorage.setItem(STORAGE_KEYS.WRAPPED_TUTORIAL_SEEN, '1'); } catch { /* private mode */ } };

const WrappedHost: React.FC = () => {
  const { transactions, userSettings } = useStore();
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);

  useEffect(() => onOpenWrapped(() => { markSeen(); setShowTutorial(false); setOpen(true); }), []);

  // First visit to the Dashboard with some data: teach the gesture once.
  useEffect(() => {
    if (pathname !== ROUTES.DASHBOARD || seen() || transactions.length < MIN_TRANSACTIONS) return;
    const id = window.setTimeout(() => setShowTutorial(true), 1800);
    return () => window.clearTimeout(id);
  }, [pathname, transactions.length]);

  const dismissTutorial = useCallback(() => { markSeen(); setShowTutorial(false); }, []);

  return (
    <>
      {showTutorial && !open && (
        <Spotlight
          target="[data-wrapped-target]"
          title="Your Monthly Wrapped is here 🎁"
          body={<>Press and <b>hold</b> your profile picture to see how your month went: top spends, savings, and your piggy’s verdict.</>}
          hint={<span className="block text-4xl animate-[spot-press_1.4s_ease-in-out_infinite] drop-shadow-lg" aria-hidden="true">👆</span>}
          primaryLabel="Show me"
          onPrimary={openWrapped}
          onDismiss={dismissTutorial}
        />
      )}
      {open && (
        <MonthlyWrapped
          transactions={transactions}
          symbol={getCurrencySymbol(userSettings?.currency)}
          initialMonth={defaultWrappedMonth(transactions)}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
};

export default WrappedHost;
