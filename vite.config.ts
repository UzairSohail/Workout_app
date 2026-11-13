import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// Relative base so the build works on any static host or sub-path.
export default defineConfig({
  base: './',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon-pink.png', 'apple-touch-icon-pink.png'],
      manifest: {
        name: 'Workout',
        short_name: 'Workout',
        description: 'Free workout tracker: splits, history, PRs and progression.',
        theme_color: '#09090f',
        background_color: '#09090f',
        display: 'standalone',
        start_url: './',
        scope: './',
        icons: [
          { src: 'icon-192-pink.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512-pink.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-maskable-512-pink.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Rest-timer notification taps (public/sw-rest.js).
        importScripts: ['sw-rest.js'],
        globPatterns: ['**/*.{js,css,html,svg,png,json}'],
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
        runtimeCaching: [
          {
            // Exercise photos: cache as they're viewed so they work offline at the gym.
            urlPattern: /^https:\/\/(cdn\.jsdelivr\.net|raw\.githubusercontent\.com)\/.*\.(jpg|png|gif)$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'exercise-images',
              expiration: { maxEntries: 2000, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // Geist font files and their stylesheet, so the look holds up offline.
            urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'fonts',
              expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
});
