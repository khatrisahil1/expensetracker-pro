// Gets people onto a new deploy quickly, without interrupting them.
//
// The service worker serves the app from its offline cache, so the first open
// after a deploy shows the *old* version while the new worker installs in the
// background (it then takes control straight away: skipWaiting + clientsClaim).
// Without this, people only see the update after closing and reopening the app,
// sometimes twice, and installed iPhone apps check for updates rarely.
//
//  - Check for a new version on start, whenever the app comes back to the
//    foreground, and every 30 minutes while it stays open.
//  - When a new version takes control of a page that an older one loaded:
//      * within the first few seconds (still on the splash / first screen) →
//        reload now, so it looks like a normal start;
//      * otherwise → wait until the app is in the background, and reload then,
//        so nobody loses what they're typing.

/** A new version arriving this soon after the page loaded reloads straight away. */
export const EARLY_RELOAD_MS = 8000;
const CHECK_EVERY_MS = 30 * 60 * 1000;

/** What to do when a new service worker takes control. */
export const updateAction = (msSinceLoad: number, hidden: boolean): 'reload' | 'when-hidden' =>
  msSinceLoad < EARLY_RELOAD_MS || hidden ? 'reload' : 'when-hidden';

export function watchForAppUpdates(): void {
  if (!('serviceWorker' in navigator)) return;
  const sw = navigator.serviceWorker;
  // No controller at load means this is the very first visit: the worker
  // taking control then is not an update, so don't reload.
  const hadController = !!sw.controller;
  let reloading = false;

  const reload = () => {
    if (reloading) return;
    reloading = true;
    window.location.reload();
  };

  sw.addEventListener('controllerchange', () => {
    if (!hadController) return;
    if (updateAction(performance.now(), document.visibilityState === 'hidden') === 'reload') return reload();
    const onHide = () => {
      if (document.visibilityState !== 'hidden') return;
      document.removeEventListener('visibilitychange', onHide);
      reload();
    };
    document.addEventListener('visibilitychange', onHide);
  });

  const check = () => sw.getRegistration().then(r => r?.update()).catch(() => {});
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void check();
  });
  window.setInterval(check, CHECK_EVERY_MS);
  void check();
}
