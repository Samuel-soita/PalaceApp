import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
    plugins: [
        react(),
        VitePWA({
            strategies: 'injectManifest',
            srcDir: 'src',
            filename: 'sw.ts',
            registerType: 'autoUpdate',
            injectRegister: 'auto',
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
            devOptions: {
                enabled: true,
                type: 'module',
            },
        }),
    ],
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src'),
        },
    },
    build: {
        rollupOptions: {
            output: {
                // Only packages the entry already needs belong here; anything used solely by lazy pages
                // must stay out so it keeps loading on demand.
                manualChunks(id) {
                    if (id.includes('commonjsHelpers')) return 'vendor-react';
                    if (!id.includes('node_modules')) return undefined;
                    if (/[\\/]node_modules[\\/](react|react-dom|react-is|scheduler|prop-types|use-sync-external-store|hoist-non-react-statics|react-router|react-router-dom|@remix-run)[\\/]/.test(id)) return 'vendor-react';
                    if (/[\\/]node_modules[\\/](@emotion|stylis|@mui[\\/](system|utils|styled-engine|private-theming)|@popperjs|react-transition-group)[\\/]/.test(id)) return 'vendor-mui-core';
                    if (/[\\/]node_modules[\\/](dexie|dexie-react-hooks|@tanstack|axios|socket\.io-client|socket\.io-parser|engine\.io-client|engine\.io-parser)[\\/]/.test(id)) return 'vendor-data';
                    return undefined;
                },
            },
        },
    },
    server: {
        port: 5173,
        proxy: {
            '/api': {
                target: 'http://localhost:4000',
                changeOrigin: true,
                rewrite: (path) => path.replace(/^\/api/, ''),
            },
            '/socket.io': {
                target: 'http://localhost:4000',
                ws: true,
                changeOrigin: true,
            },
            '/uploads': {
                target: 'http://localhost:4000',
                changeOrigin: true,
            }
        },
    },
});
