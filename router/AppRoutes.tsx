import React, { lazy } from 'react';
import { Navigate, Outlet, Route, Routes, useLocation } from 'react-router';
import { useStore } from '../context/Store';
import { ROUTES } from '../routes';
import AppLayout from '../components/AppLayout';
import LoginScreen from '../components/LoginScreen';
import OnboardingScreen from '../components/OnboardingScreen';
import { LoadingScreen } from '../components/LoadingScreen';
import { PinLockScreen } from '../components/PinLockScreen';

// Pages load on first visit, so the initial download only contains what the
// current page needs.
const DashboardScreen = lazy(() => import('../components/DashboardScreen'));
const TransactionsScreen = lazy(() => import('../components/TransactionsScreen').then(m => ({ default: m.TransactionsScreen })));
const TransactionsCalendarScreen = lazy(() => import('../components/TransactionsCalendarScreen'));
const ImpulseVaultScreen = lazy(() => import('../components/ImpulseVaultScreen'));
const SubscriptionsScreen = lazy(() => import('../components/SubscriptionsScreen'));
const BudgetGoalsScreen = lazy(() => import('../components/BudgetGoalsScreen'));
const SettingsScreen = lazy(() => import('../components/SettingsScreen'));
const SimulatorScreen = lazy(() => import('../components/SimulatorScreen'));
const SplitBillScreen = lazy(() => import('../components/SplitBillScreen'));

/** Where a signed-in user was headed before being sent to /login. */
type RedirectState = { from?: string } | null;

const needsOnboarding = (settings: ReturnType<typeof useStore>['userSettings']) =>
  settings?.hasCompletedOnboarding === false;

/**
 * Gate for every signed-in page:
 *   still loading     → loading screen
 *   signed out        → /login (remembers the page they asked for)
 *   app PIN locked    → lock screen, shown in place so the URL is kept
 */
const RequireAuth: React.FC = () => {
  const { user, loading, isAppLocked } = useStore();
  const location = useLocation();

  if (loading) return <LoadingScreen />;
  if (!user) {
    return <Navigate to={ROUTES.LOGIN} replace state={{ from: location.pathname + location.search } satisfies RedirectState} />;
  }
  if (isAppLocked) return <PinLockScreen />;
  return <Outlet />;
};

/** Main app pages need onboarding finished first. */
const RequireOnboarded: React.FC = () => {
  const { userSettings } = useStore();
  if (needsOnboarding(userSettings)) return <Navigate to={ROUTES.ONBOARDING} replace />;
  return <Outlet />;
};

/** /onboarding is only for users who haven't finished it. */
const OnboardingRoute: React.FC = () => {
  const { userSettings } = useStore();
  if (!needsOnboarding(userSettings)) return <Navigate to={ROUTES.DASHBOARD} replace />;
  return <OnboardingScreen />;
};

/** /login is only for signed-out users. Once signed in, go back where they were headed. */
const LoginRoute: React.FC = () => {
  const { user, loading } = useStore();
  const location = useLocation();
  if (loading) return <LoadingScreen />;
  if (user) {
    const from = (location.state as RedirectState)?.from;
    return <Navigate to={from && from !== ROUTES.LOGIN ? from : ROUTES.DASHBOARD} replace />;
  }
  return <LoginScreen />;
};

/** The full route table. Paths live in routes.ts. */
const AppRoutes: React.FC = () => (
  <Routes>
    <Route path={ROUTES.LOGIN} element={<LoginRoute />} />

    <Route element={<RequireAuth />}>
      <Route path={ROUTES.ONBOARDING} element={<OnboardingRoute />} />

      <Route element={<RequireOnboarded />}>
        <Route element={<AppLayout />}>
          <Route index element={<DashboardScreen />} />
          <Route path={ROUTES.TRANSACTIONS} element={<TransactionsScreen />} />
          <Route path={ROUTES.TRANSACTION_HISTORY} element={<TransactionsCalendarScreen />} />
          <Route path={ROUTES.VAULT} element={<ImpulseVaultScreen />} />
          <Route path={ROUTES.SUBSCRIPTIONS} element={<SubscriptionsScreen />} />
          <Route path={ROUTES.BUDGET} element={<BudgetGoalsScreen />} />
          <Route path={ROUTES.SETTINGS} element={<SettingsScreen />} />
          <Route path={ROUTES.SIMULATOR} element={<SimulatorScreen />} />
          <Route path={ROUTES.SPLIT_BILL} element={<SplitBillScreen />} />
        </Route>
      </Route>
    </Route>

    {/* Unknown URLs go to the dashboard (or to /login when signed out). */}
    <Route path="*" element={<Navigate to={ROUTES.DASHBOARD} replace />} />
  </Routes>
);

export default AppRoutes;
