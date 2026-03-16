import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
    plugins: [
        react(),
        VitePWA({
            registerType: 'autoUpdate',
            includeAssets: ['logo.png', 'favicon.ico', 'apple-touch-icon.png', 'icons/*.png'],
            devOptions: {
                enabled: false,
                type: 'module',
            },
            manifest: {
                name: 'Prayer Palace Apostolic Ministry',
                short_name: 'Prayer Palace',
                description: 'Prayer Palace Apostolic Ministry — Unified Church Management & Communications.',
                theme_color: '#0c0e14',
                background_color: '#0c0e14',
                display: 'standalone',
                orientation: 'portrait',
                scope: '/',
                start_url: '/',
                icons: [
                    {
                        src: 'logo.png',
                        sizes: '192x192',
                        type: 'image/png',
                        purpose: 'any',
                    },
                    {
                        src: 'logo.png',
                        sizes: '512x512',
                        type: 'image/png',
                        purpose: 'any',
                    },
                    {
                        src: 'logo.png',
                        sizes: '512x512',
                        type: 'image/png',
                        purpose: 'maskable',
                    },
                ],
            },
            workbox: {
                cleanupOutdatedCaches: true,
                // Removed aggressive navigateFallback to prevent dev-mode interruptions
                navigateFallbackDenylist: [/^\/api\//, /\/auth\//, /^\/uploads\//],
                
                // Pre-cache the app shell
                globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],

                runtimeCaching: [
                    // Google Fonts
                    {
                        urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
                        handler: 'CacheFirst',
                        options: {
                            cacheName: 'google-fonts-cache',
                            expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
                            cacheableResponse: { statuses: [0, 200] },
                        },
                    },
                    // Backend API & Uploads — StaleWhileRevalidate for "Instant" UI
                    {
                        urlPattern: ({ url }) => 
                            url.pathname.startsWith('/api') || 
                            url.pathname.startsWith('/uploads'),
                        handler: 'StaleWhileRevalidate',
                        options: {
                            cacheName: 'api-cache',
                            expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 }, // 24 hours
                            cacheableResponse: { statuses: [0, 200] },
                        },
                    },
                    // Images — StaleWhileRevalidate
                    {
                        urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp|ico)$/i,
                        handler: 'StaleWhileRevalidate',
                        options: {
                            cacheName: 'image-cache',
                            expiration: { maxEntries: 60, maxAgeSeconds: 60 * 60 * 24 * 30 },
                            cacheableResponse: { statuses: [0, 200] },
                        },
                    },
                ],
            },
        }),
    ],
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src'),
        },
    },
    server: {
        port: 3000,
        proxy: {
            '/api': {
                target: 'http://localhost:4000',
                changeOrigin: true,
                rewrite: (path) => path.replace(/^\/api/, ''),
            },
            '/uploads': {
                target: 'http://localhost:4000',
                changeOrigin: true,
            }
        },
    },
});
