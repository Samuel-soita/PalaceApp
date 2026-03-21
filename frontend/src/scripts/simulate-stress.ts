import { queueAction, processQueue } from '../lib/pwa-sync';

/**
 * 💣 PORTAL STRESS SIMULATOR
 * Mission: Inject 1200+ actions and measure UI responsiveness
 */
export async function runStressTest() {
    console.log('🚀 INITIALIZING STRESS TEST: 1200 MISSIONS...');
    
    const startTime = Date.now();
    
    // 1. Inject 1200 actions while offline
    // (Force offline state for simulation)
    const originalOnLine = navigator.onLine;
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });

    for (let i = 0; i < 1200; i++) {
        await queueAction({
            method: 'POST',
            url: '/api/test-stress',
            payload: { index: i, data: 'Stress Test Payload ' + i },
            priority: i % 10 === 0 ? 'HIGH' : 'MEDIUM'
        });
        
        if (i % 100 === 0) console.log(`[Stress] Queued ${i} missions...`);
    }

    const injectionTime = Date.now() - startTime;
    console.log(`✅ INJECTION COMPLETE: 1200 missions in ${injectionTime}ms`);

    // 2. Simulate Online & Sync
    console.log('📡 SIMULATING NETWORK RECOVERY...');
    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
    
    // Monitor FPS during sync (simple console check)
    let lastTime = performance.now();
    let frames = 0;
    const checkFPS = () => {
        frames++;
        const now = performance.now();
        if (now - lastTime >= 1000) {
            console.log(`[Performance] UI FPS: ${frames}`);
            frames = 0;
            lastTime = now;
        }
        if ((window as any)._isSyncing) requestAnimationFrame(checkFPS);
    };
    
    requestAnimationFrame(checkFPS);
    processQueue();
}

// Attach to window for easy access in console
if (typeof window !== 'undefined') {
    (window as any).runStressTest = runStressTest;
}
