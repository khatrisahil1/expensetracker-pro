import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// Kept separate from vite.config.ts so tests don't load the PWA plugin.
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    include: ['**/*.test.{ts,tsx}'],
    exclude: ['node_modules', 'dist', 'dev-dist'],
  },
});
