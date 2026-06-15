export interface BeforeInstallPromptEvent extends Event {
    readonly platforms: string[];
    readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
    prompt(): Promise<void>;
}

const DISMISS_KEY = 'pwa-install-dismissed-until';
const INSTALL_AVAILABLE_EVENT = 'pwa-install-available';

let deferredPrompt: BeforeInstallPromptEvent | null = null;
const listeners = new Set<() => void>();

function notify() {
    listeners.forEach((listener) => listener());
}

export function isStandalone(): boolean {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(display-mode: standalone)').matches
        || (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
}

export function isInstallDismissed(): boolean {
    const until = sessionStorage.getItem(DISMISS_KEY);
    if (!until) return false;
    if (Date.now() > Number(until)) {
        sessionStorage.removeItem(DISMISS_KEY);
        return false;
    }
    return true;
}

export function canShowInstallBanner(): boolean {
    if (isStandalone()) return false;
    if (isInstallDismissed()) return false;
    return deferredPrompt !== null;
}

export function getDeferredInstallPrompt(): BeforeInstallPromptEvent | null {
    return deferredPrompt;
}

export function subscribePwaInstall(listener: () => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
}

/** Register before React mounts so we never miss the browser event. */
export function initPwaInstallCapture(): void {
    if (typeof window === 'undefined') return;

    window.addEventListener('beforeinstallprompt', (event) => {
        event.preventDefault();
        deferredPrompt = event as BeforeInstallPromptEvent;
        sessionStorage.removeItem(DISMISS_KEY);
        notify();
        window.dispatchEvent(new Event(INSTALL_AVAILABLE_EVENT));
    });

    window.addEventListener('appinstalled', () => {
        deferredPrompt = null;
        sessionStorage.removeItem(DISMISS_KEY);
        notify();
    });
}

export function dismissInstallBanner(snoozeHours = 24): void {
    sessionStorage.setItem(DISMISS_KEY, String(Date.now() + snoozeHours * 60 * 60 * 1000));
    notify();
}

export async function triggerInstallPrompt(): Promise<'accepted' | 'dismissed' | 'unavailable'> {
    const prompt = deferredPrompt;
    if (!prompt) return 'unavailable';

    await prompt.prompt();
    const { outcome } = await prompt.userChoice;

    if (outcome === 'accepted') {
        deferredPrompt = null;
    }

    notify();
    return outcome;
}
