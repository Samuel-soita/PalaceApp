import { useState, useEffect, useCallback, useSyncExternalStore } from 'react';
import {
    canShowInstallBanner,
    dismissInstallBanner,
    isStandalone as checkStandalone,
    subscribePwaInstall,
    triggerInstallPrompt,
} from '../lib/pwa-install';

interface PWAState {
    needRefresh: boolean;
    offlineReady: boolean;
    canInstall: boolean;
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

function subscribeInstallBanner(onStoreChange: () => void) {
    const unsubscribeInstall = subscribePwaInstall(onStoreChange);
    const onAvailable = () => onStoreChange();
    window.addEventListener('pwa-install-available', onAvailable);
    return () => {
        unsubscribeInstall();
        window.removeEventListener('pwa-install-available', onAvailable);
    };
}

function getInstallBannerSnapshot() {
    return canShowInstallBanner();
}

function getStandaloneSnapshot() {
    return checkStandalone();
}

export function usePWA(): PWAState {
    const [needRefresh, setNeedRefresh] = useState(false);
    const [offlineReady, setOfflineReady] = useState(false);
    const canInstall = useSyncExternalStore(subscribeInstallBanner, getInstallBannerSnapshot, () => false);
    const isStandalone = useSyncExternalStore(subscribeInstallBanner, getStandaloneSnapshot, () => false);

    useEffect(() => {
        const handleNeedRefresh = () => setNeedRefresh(true);
        const handleOfflineReady = () => setOfflineReady(true);

        window.addEventListener('pwa-need-refresh', handleNeedRefresh);
        window.addEventListener('pwa-offline-ready', handleOfflineReady);

        return () => {
            window.removeEventListener('pwa-need-refresh', handleNeedRefresh);
            window.removeEventListener('pwa-offline-ready', handleOfflineReady);
        };
    }, []);

    const triggerInstall = useCallback(async () => {
        await triggerInstallPrompt();
    }, []);

    const updateSW = useCallback(() => {
        updateSwCallback?.();
        setNeedRefresh(false);
        window.location.reload();
    }, []);

    const dismissUpdate = useCallback(() => setNeedRefresh(false), []);
    const dismissInstall = useCallback(() => dismissInstallBanner(), []);

    return {
        needRefresh,
        offlineReady,
        canInstall,
        triggerInstall,
        isStandalone,
        updateSW,
        dismissUpdate,
        dismissInstall,
    };
}
