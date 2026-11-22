import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// In development there is no service worker (see vite.config.ts). Remove any
// left over from older builds, along with their caches, so a stale worker can't
// keep serving old pages or an "offline" page while the dev server is running.
if (import.meta.env.DEV && 'serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then(regs => {
    if (regs.length === 0) return;
    regs.forEach(r => r.unregister());
    caches?.keys().then(keys => keys.forEach(k => caches.delete(k)));
    console.info(`Removed ${regs.length} stale service worker(s) in dev.`);
  });
}

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// Fade out the boot splash from index.html once the app has painted. It stays
// at least BOOT_MIN_MS so the piggy catches at least one coin on fast loads.
const BOOT_MIN_MS = 1200;
const boot = document.getElementById('boot');
if (boot) {
  const shownFor = performance.now();
  requestAnimationFrame(() => {
    setTimeout(() => {
      boot.classList.add('hide');
      setTimeout(() => boot.remove(), 400);
    }, Math.max(0, BOOT_MIN_MS - shownFor));
  });
}