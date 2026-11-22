/* Push notifications, imported into the generated service worker
   (vite.config.ts → workbox.importScripts). Works when the app is closed.
   Messages come from Firebase Cloud Messaging (see functions/index.js) with
   { notification: { title, body }, data: { url } } or data-only payloads. */
/* eslint-disable no-restricted-globals */

self.addEventListener('push', (event) => {
  let payload = {};
  try { payload = event.data ? event.data.json() : {}; } catch (e) { payload = { notification: { body: event.data && event.data.text() } }; }
  const n = payload.notification || {};
  const data = payload.data || {};
  const title = n.title || data.title || 'ExpenseTracker';
  event.waitUntil(self.registration.showNotification(title, {
    body: n.body || data.body || '',
    icon: '/pwa-192.png',
    badge: '/icon-96x96.png',
    tag: data.tag || undefined,
    data: { url: data.url || '/' },
  }));
});

// Tapping a notification focuses an open window (and navigates it) or opens one.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of windows) {
      if ('focus' in client) {
        await client.focus();
        if ('navigate' in client) await client.navigate(url);
        return;
      }
    }
    await self.clients.openWindow(url);
  })());
});
