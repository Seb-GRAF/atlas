import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  root: 'dashboard-ui',
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: "Atlas — Suivi d'appartements",
        short_name: 'Atlas',
        description: "Tableau de bord pour suivre une recherche d'appartement",
        theme_color: '#f6f3ee',
        background_color: '#f6f3ee',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/',
        start_url: '/',
        lang: 'fr',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-maskable-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api/, /^\/data/, /^\/dashboard\/(?!dist)/, /^\/maps/],
        runtimeCaching: []
      },
      devOptions: {
        enabled: false
      }
    })
  ],
  server: {
    proxy: {
      '/api': 'http://127.0.0.1:8787',
      '/data': 'http://127.0.0.1:8787',
      '/dashboard': 'http://127.0.0.1:8787',
      '/maps': 'http://127.0.0.1:8787'
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
