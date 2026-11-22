import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import basicSsl from '@vitejs/plugin-basic-ssl';
import type { Plugin } from 'vite';

/**
 * Dev only: answer the old service-worker URLs (/sw.js, /dev-sw.js) with a
 * worker that removes itself. Browsers that registered one of the old workers
 * (a phone on the Wi-Fi URL, say) fetch it on their next update check, and it
 * unregisters, clears its caches and reloads the page, instead of serving a
 * stale "You're offline" page for ever.
 */
const retireOldServiceWorkers = (): Plugin => ({
  name: 'retire-old-service-workers',
  apply: 'serve',
  configureServer(server) {
    const killSwitch = `
      self.addEventListener('install', () => self.skipWaiting());
      self.addEventListener('activate', (event) => {
        event.waitUntil((async () => {
          await self.registration.unregister();
          const keys = await caches.keys();
          await Promise.all(keys.map((k) => caches.delete(k)));
          const clients = await self.clients.matchAll({ type: 'window' });
          clients.forEach((c) => c.navigate(c.url));
        })());
      });`;
    server.middlewares.use((req, res, next) => {
      const path = (req.url || '').split('?')[0];
      if (path !== '/sw.js' && path !== '/dev-sw.js') return next();
      res.setHeader('Content-Type', 'application/javascript');
      res.setHeader('Cache-Control', 'no-store');
      res.end(killSwitch);
    });
  },
});

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    // `npm run dev:phone`: serve on the Wi-Fi network over HTTPS so a phone can
    // open it. HTTPS matters: on a plain http://192.168.x.x address browsers
    // disable crypto.randomUUID, crypto.subtle (PIN hashing), the camera and
    // service workers, all of which the app uses. The certificate is
    // self-signed, so the phone shows a warning once.
    const phone = mode === 'phone';
    return {
      server: phone
        ? { port: 5174, host: true, strictPort: true }
        : { port: 3000, host: 'localhost' },
      plugins: [
        react(),
        ...(phone ? [basicSsl()] : []),
        retireOldServiceWorkers(),

        VitePWA({
            registerType: 'autoUpdate',

            // No service worker in `npm run dev`: it cached dev pages and kept
            // serving them (or an offline page) after the code or server changed.
            // Offline support is tested with `npm run build && npm run preview`.
            devOptions: {
              enabled: false,
            },

            includeAssets: [
              'favicon.ico',
              'apple-touch-icon.png',
              'pwa-192.png',
              'pwa-512.png',
              'pwa-512-maskable.png',
            ],

            workbox: {
              // Push notification handlers (public/push-sw.js).
              importScripts: ['/push-sw.js'],
              // The app uses client-side routes (/budget, /settings, ...). Offline, any
              // page URL must load the app shell so the router can render it. Serving
              // offline.html here broke every deep link and refresh while offline.
              navigateFallback: '/index.html',

              runtimeCaching: [
                // Page navigation (offline fallback)
                {
                  urlPattern: ({ request }) => request.mode === 'navigate',
                  handler: 'NetworkFirst',
                  options: {
                    cacheName: 'pages',
                  },
                },

                // Firestore isn't cached here: the Firestore SDK keeps its own
                // offline cache and queues writes until the connection returns.
              ],
            },

            manifest: {
              name: 'ExpenseTracker Pro',
              short_name: 'ExpenseTracker',
              description: 'Track expenses, streaks & finances smartly',
              theme_color: '#0E1111',
              background_color: '#0E1111',
              display: 'standalone',
              start_url: '/',
              scope: '/',
              // Long-press the installed app icon (Android, desktop Chrome/Edge)
              // to jump straight to these. The app reads ?action= on arrival.
              shortcuts: [
                { name: 'Add expense', short_name: 'Add', description: 'Log a new expense', url: '/transactions?action=add', icons: [{ src: '/icon-96x96.png', sizes: '96x96', type: 'image/png' }] },
                { name: 'Scan receipt', short_name: 'Scan', description: 'Scan a receipt with the camera', url: '/transactions?action=scan', icons: [{ src: '/icon-96x96.png', sizes: '96x96', type: 'image/png' }] },
                { name: 'Monthly Wrapped', short_name: 'Wrapped', description: 'See your month, wrapped', url: '/?action=wrapped', icons: [{ src: '/icon-96x96.png', sizes: '96x96', type: 'image/png' }] },
                { name: 'History', short_name: 'History', description: 'Search all transactions', url: '/transactions/history', icons: [{ src: '/icon-96x96.png', sizes: '96x96', type: 'image/png' }] },
              ],
              icons: [
                { src: '/pwa-192.png', sizes: '192x192', type: 'image/png' },
                { src: '/pwa-512.png', sizes: '512x512', type: 'image/png' },
                {
                  src: '/pwa-512-maskable.png',
                  sizes: '512x512',
                  type: 'image/png',
                  purpose: 'maskable',
                },
              ],
            },
          })
      ],
      define: {
        // Support both `GEMINI_API_KEY` and `VITE_GEMINI_API_KEY` env var naming conventions.
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY || env.VITE_GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY || env.VITE_GEMINI_API_KEY)
      },
      build: {
        rollupOptions: {
          output: {
            // Libraries that rarely change get their own files, so an app update
            // doesn't make returning users re-download them.
            manualChunks: {
              react: ['react', 'react-dom', 'react-router'],
              firebase: ['firebase/app', 'firebase/auth', 'firebase/firestore'],
            },
          },
        },
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
