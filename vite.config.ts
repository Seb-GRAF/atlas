import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  root: 'dashboard-ui',
  plugins: [react()],
  server: {
    proxy: {
      '/api': 'http://127.0.0.1:8787',
      '/data': 'http://127.0.0.1:8787',
      '/dashboard': 'http://127.0.0.1:8787'
    }
  },
  build: {
    outDir: '../dashboard/dist',
    emptyOutDir: true
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    globals: true
  }
});
