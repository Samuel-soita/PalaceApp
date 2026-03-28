import { useState, useEffect } from 'react';

interface BeforeInstallPromptEvent extends Event {
    readonly platforms: string[];
    readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
    prompt(): Promise<void>;
}

interface PWAState {
    needRefresh: boolean;
    offlineReady: boolean;
    canInstall: boolean;
    installPromptEvent: BeforeInstallPromptEvent | null;
    triggerInstall: () => Promise<void>;
    isStandalone: boolean;
    updateSW: () => void;
    dismissUpdate: () => void;
    dismissInstall: () => void;
}

let updateSwCallback: (() => void) | null = null;

export function setUpdateSWCallback(cb: () => void) {
    updateSwCallback = cb;
}

export function usePWA(): PWAState {
    const [needRefresh, setNeedRefresh] = useState(false);
    const [offlineReady, setOfflineReady] = useState(false);
    const [installPromptEvent, setInstallPromptEvent] = useState<BeforeInstallPromptEvent | null>(null);
    const [canInstall, setCanInstall] = useState(false);
    const [isStandalone, setIsStandalone] = useState(false);

    useEffect(() => {
        // Capture the install prompt
        const handleBeforeInstall = (e: Event) => {
            e.preventDefault();
            setInstallPromptEvent(e as BeforeInstallPromptEvent);
            setCanInstall(true);
        };

        // Listen for SW update events dispatched from main.tsx
        const handleNeedRefresh = () => setNeedRefresh(true);
        const handleOfflineReady = () => setOfflineReady(true);

        window.addEventListener('beforeinstallprompt', handleBeforeInstall);
        window.addEventListener('pwa-need-refresh', handleNeedRefresh);
        window.addEventListener('pwa-offline-ready', handleOfflineReady);

        // Already installed (standalone) — no install prompt needed
        const checkStandalone = () => {
            const standalone = window.matchMedia('(display-mode: standalone)').matches 
                || (window.navigator as any).standalone === true;
            setIsStandalone(standalone);
            if (standalone) setCanInstall(false);
        };

        checkStandalone();

        return () => {
            window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
            window.removeEventListener('pwa-need-refresh', handleNeedRefresh);
            window.removeEventListener('pwa-offline-ready', handleOfflineReady);
        };
    }, []);

    const triggerInstall = async () => {
        if (!installPromptEvent) return;
        await installPromptEvent.prompt();
        const { outcome } = await installPromptEvent.userChoice;
        if (outcome === 'accepted') {
            setCanInstall(false);
            setInstallPromptEvent(null);
        }
    };

    const updateSW = () => {
        updateSwCallback?.();
        setNeedRefresh(false);
        window.location.reload();
    };

    const dismissUpdate = () => setNeedRefresh(false);
    const dismissInstall = () => {
        setCanInstall(false);
        setInstallPromptEvent(null);
    };

    return { 
        needRefresh, 
        offlineReady, 
        canInstall, 
        installPromptEvent, 
        triggerInstall, 
        isStandalone,
        updateSW, 
        dismissUpdate, 
        dismissInstall 
    };
}
