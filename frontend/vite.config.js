import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    host: true,
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './vitest.setup.js',
    // Only src/** is a test source. Anything else (node_modules, dist, the
    // build/ docker context) must never be collected.
    include: ['src/**/*.{test,spec}.{js,jsx}'],
    exclude: ['**/node_modules/**', 'dist/**', 'build/**'],
    restoreMocks: true,
  },
});
