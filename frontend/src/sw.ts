/// <reference lib="webworker" />
import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching';
import { registerRoute, NavigationRoute, setCatchHandler } from 'workbox-routing';
import { StaleWhileRevalidate, CacheFirst, NetworkOnly } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';
import { CacheableResponsePlugin } from 'workbox-cacheable-response';
import { BackgroundSyncPlugin } from 'workbox-background-sync';

declare let self: ServiceWorkerGlobalScope;

/**
 * ⚡ ENTERPRISE-GRADE SERVICE WORKER
 * Mission: Zero-Latency, Self-Healing, High-Performance
 */

cleanupOutdatedCaches();

// 1. PRECACHE CRITICAL ASSETS (App Shell)
precacheAndRoute(self.__WB_MANIFEST);

// 2. BACKGROUND SYNC (Native Workbox Plugin)
// This handles low-level retries for failed mutations
const bgSyncPlugin = new BackgroundSyncPlugin('ministerial-queue', {
    maxRetentionTime: 24 * 60, // 24 hours
});

// 3. CACHING STRATEGIES

// A. STATIC ASSETS (Zero-Latency)
registerRoute(
    ({ request }) => request.destination === 'style' || request.destination === 'script' || request.destination === 'worker',
    new CacheFirst({
        cacheName: 'system-assets',
        plugins: [
            new CacheableResponsePlugin({ statuses: [0, 200] }),
            new ExpirationPlugin({ maxEntries: 50, maxAgeSeconds: 30 * 24 * 60 * 60 }),
        ],
    })
);

// B. HIGH-FIDELITY MEDIA (Logo, Icons)
registerRoute(
    /\.(?:png|jpg|jpeg|svg|gif|webp|ico)$/i,
    new CacheFirst({
        cacheName: 'media-assets',
        plugins: [
            new CacheableResponsePlugin({ statuses: [200] }),
            new ExpirationPlugin({ maxEntries: 100, maxAgeSeconds: 60 * 24 * 60 * 60 }), // 60 days
        ],
    })
);

// C. DYNAMIC DATA (Instant Reads via Stale-While-Revalidate)
registerRoute(
    ({ url }) => url.pathname.startsWith('/api') && !url.pathname.includes('/auth'),
    new StaleWhileRevalidate({
        cacheName: 'api-telemetry',
        plugins: [
            new CacheableResponsePlugin({ statuses: [200] }),
            new ExpirationPlugin({ maxEntries: 200, maxAgeSeconds: 24 * 60 * 60 }),
        ],
    })
);

// D. MUTATIONS (Network Only + Background Sync Fallback)
registerRoute(
    ({ url, request }) => url.pathname.startsWith('/api') && ['POST', 'PUT', 'DELETE'].includes(request.method),
    new NetworkOnly({
        plugins: [bgSyncPlugin],
    })
);

// 4. NAVIGATION FALLBACK (App Shell)
registerRoute(new NavigationRoute(new StaleWhileRevalidate({
    cacheName: 'navigations',
    plugins: [
        new CacheableResponsePlugin({ statuses: [200] }),
    ],
})));

// 5. GLOBAL CATCH HANDLER (Offline Fallback Page)
setCatchHandler(async ({ request }) => {
    if (request.destination === 'document') {
        const cache = await caches.open('navigations');
        const cachedResponse = await cache.match('/offline.html');
        return cachedResponse || Response.error();
    }
    return Response.error();
});

// 6. SW LIFECYCLE
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});
