import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

/**
 * BUG FIX vite.config.js:
 *
 * 1. backgroundSync + NetworkOnly kombinatsiyasi noto'g'ri edi.
 *    backgroundSync faqat POST so'rovlar uchun ishlaydi va NetworkFirst/NetworkOnly
 *    bilan to'g'ri ishlamaydi. Bu o'chirib tashlandi — bizning sync mexanizmi
 *    Dexie outbox orqali o'zi boshqaradi.
 *
 * 2. globPatterns ga woff (woff2 bilan birga) qo'shildi.
 *
 * 3. navigateFallback: '/index.html' — SPA routing uchun majburiy.
 *    Bu bo'lmasa offline holatda /admin/profile kabi URL lar 404 beradi.
 *
 * 4. cleanupOutdatedCaches: true — eski Service Worker keshlarini tozalaydi.
 *    Bu yangi deploy dan keyin qurilmalarda eski kesh qolmasligini ta'minlaydi.
 *
 * 5. skipWaiting: true — yangi SW darhol faollashadi, tab yopilishini kutmaydi.
 */
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',

      // BUG FIX: devOptions — development muhitida ham SW ishlashi uchun
      devOptions: {
        enabled: false, // dev da SW o'chirib qo'yiladi (hot reload bilan ziddiyat)
        type: 'module',
      },

      includeAssets: [
        // Faqat public/ papkasida MAVJUD fayllar ro'yxati
        'robots.txt',
        'pwa-192x192.png',
        'pwa-512x512.png',
        'YNlogo_without_word.png',
        'yaxshi_niyat_logo.png',
      ],

      manifest: {
        name: 'YaxshiNiyat Ta\'lim CRM',
        short_name: 'EduCRM',
        description: 'Offline-First ta\'lim markazi boshqaruv tizimi',
        theme_color: '#0a0a0a',
        background_color: '#0a0a0a',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/',
        start_url: '/',
        lang: 'uz',
        icons: [
          {
            src: '/pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },

      workbox: {
        // BUG FIX: SPA routing — offline holatda barcha yo'llar index.html ga
        navigateFallback: '/index.html',

        // Statik fayllarni (JS, CSS, HTML, Media, Shriftlar) to'liq keshga olish
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2,ttf,eot}'],

        // BUG FIX: Eski keshlarni tozalash — yangi deploy dan keyin muammo bo'lmasin
        cleanupOutdatedCaches: true,

        // BUG FIX: Yangi SW tab yopilishini kutmay darhol faollashadi
        skipWaiting: true,
        clientsClaim: true,

        // Kesh hajmi chegarasi: 5MB gacha fayllar keshlanadi
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,

        runtimeCaching: [
          {
            // Google Fonts va web shriftlarni keshlash (CacheFirst — bir yil)
            urlPattern: /^https:\/\/fonts\.(?:googleapis|gstatic)\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache-v1',
              expiration: {
                maxEntries: 30,
                maxAgeSeconds: 60 * 60 * 24 * 365, // 1 yil
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          {
            // Oflayn o'qish: Guruhlar, o'quvchilar, foydalanuvchi ma'lumotlari NetworkFirst orqali keshlanadi
            urlPattern: /\/api\/(?:groups|user|branches|reports|homework_attends)\/.*/i,
            handler: 'NetworkFirst',
            method: 'GET',
            options: {
              cacheName: 'api-get-cache-v1',
              networkTimeoutSeconds: 3,
              expiration: {
                maxEntries: 150,
                maxAgeSeconds: 60 * 60 * 24 * 7, // 7 kun saqlanadi
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          {
            // Boshqa API so'rovlari (POST, PUT, DELETE va Sync) NetworkOnly — Dexie outbox o'zi boshqaradi
            urlPattern: /\/api\/.*/i,
            handler: 'NetworkOnly',
          },
          {
            // Rasm va media fayllar uchun StaleWhileRevalidate
            urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp|ico)$/i,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'images-cache-v1',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24 * 30, // 30 kun
              },
            },
          },
        ],
      },
    }),
  ],

  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
    },
  },

  build: {
    chunkSizeWarningLimit: 1600,
    // BUG FIX: source map production da o'chiriladi (xavfsizlik)
    sourcemap: false,
    rollupOptions: {
      output: {
        // Vendor kutubxonalarini alohida chunk ga ajratish (cache samaradorligi)
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-dexie': ['dexie', 'dexie-react-hooks'],
          'vendor-redux': ['react-redux', '@reduxjs/toolkit'],
          'vendor-query': ['@tanstack/react-query'],
        },
      },
    },
  },
});
