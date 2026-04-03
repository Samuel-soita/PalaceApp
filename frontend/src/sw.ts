/// <reference lib="webworker" />
import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching';
import { registerRoute, NavigationRoute, setCatchHandler } from 'workbox-routing';
import { StaleWhileRevalidate, CacheFirst, NetworkFirst, NetworkOnly } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';
import { CacheableResponsePlugin } from 'workbox-cacheable-response';

declare let self: ServiceWorkerGlobalScope;

/**
 * ⚡ ENTERPRISE-GRADE SERVICE WORKER (OFFLINE-FIRST)
 * Mission: Zero-Latency, Self-Healing, High-Performance
 */

cleanupOutdatedCaches();

// 1. PRECACHE CRITICAL ASSETS (App Shell)
precacheAndRoute(self.__WB_MANIFEST);

// 2. CACHING STRATEGIES

// A. STATIC ASSETS (Zero-Latency, Cache-First)
registerRoute(
    ({ request }) => request.destination === 'style' || request.destination === 'script' || request.destination === 'worker',
    new CacheFirst({
        cacheName: 'system-assets',
        plugins: [
            new CacheableResponsePlugin({ statuses: [0, 200] }),
            new ExpirationPlugin({ maxEntries: 100, maxAgeSeconds: 30 * 24 * 60 * 60 }), // 30 Days
        ],
    })
);

// B. HIGH-FIDELITY MEDIA (Logo, Icons, Cache-First)
registerRoute(
    /\.(?:png|jpg|jpeg|svg|gif|webp|ico)$/i,
    new CacheFirst({
        cacheName: 'media-assets',
        plugins: [
            new CacheableResponsePlugin({ statuses: [200] }),
            new ExpirationPlugin({ maxEntries: 200, maxAgeSeconds: 60 * 24 * 60 * 60 }), // 60 days
        ],
    })
);

// API EXCLUSION (Sync Daemon & Critical Finance Bypass Only)
// We intentionally DO NOT cache /api/ calls here.
// True Local-First means the UI queries Dexie, and the SW stays out of the Sync Daemon's way.
registerRoute(
    ({ url }) => url.pathname.startsWith('/api'),
    new NetworkOnly()
);

// 3. NAVIGATION FALLBACK (App Shell with StaleWhileRevalidate)
registerRoute(new NavigationRoute(new StaleWhileRevalidate({
    cacheName: 'navigations',
    plugins: [
        new CacheableResponsePlugin({ statuses: [200] }),
    ],
})));

// 4. GLOBAL CATCH HANDLER (Offline Fallback Page)
setCatchHandler(async ({ request }) => {
    if (request.destination === 'document') {
        const cache = await caches.open('navigations');
        const cachedResponse = await cache.match('/index.html') || await cache.match('/offline.html');
        return cachedResponse || Response.error();
    }
    return Response.error();
});

// 5. SW LIFECYCLE
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});
