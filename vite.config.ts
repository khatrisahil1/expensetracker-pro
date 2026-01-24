import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [
        react(),

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
              navigateFallback: '/offline.html',

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
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
