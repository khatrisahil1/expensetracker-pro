import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import basicSsl from '@vitejs/plugin-basic-ssl';

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

        VitePWA({
            registerType: 'autoUpdate',

            devOptions: {
              enabled: true,
            },

            includeAssets: [
              'favicon.ico',
              'apple-touch-icon.png',
              'pwa-192.png',
              'pwa-512.png',
              'pwa-512-maskable.png',
            ],

            workbox: {
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

                // Firestore background sync
                {
                  urlPattern: /firestore.googleapis.com/,
                  handler: 'NetworkOnly',
                  options: {
                    backgroundSync: {
                      name: 'expense-sync',
                      options: {
                        maxRetentionTime: 24 * 60, // minutes
                      },
                    },
                  },
                },
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
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
