let sessionExpiredHandled = false;
let sessionInvalidated = false;

/** Decode JWT exp without a dependency. Offline tokens never expire online. */
export function isTokenExpired(token: string | null | undefined): boolean {
    if (!token || token.startsWith('offline_token_')) return false;
    try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        if (!payload.exp) return false;
        return Date.now() >= payload.exp * 1000;
    } catch {
        return true;
    }
}

/** True when a real online JWT exists and is still valid (not offline mode). */
export function isOnlineSessionActive(): boolean {
    if (sessionInvalidated) return false;
    const token = localStorage.getItem('token');
    if (!token || token.startsWith('offline_token_')) return false;
    return !isTokenExpired(token);
}

/** True when any session token exists (includes offline mode). */
export function isSessionActive(): boolean {
    if (sessionInvalidated) return false;
    const token = localStorage.getItem('token');
    if (!token) return false;
    if (token.startsWith('offline_token_')) return true;
    return !isTokenExpired(token);
}

/** Call after a successful online login to re-enable API traffic. */
export function resetSessionState() {
    sessionInvalidated = false;
    sessionExpiredHandled = false;
}

/** Clear stale credentials once and notify the app to redirect to login. */
export function handleSessionExpired(reason = 'Session expired') {
    sessionInvalidated = true;
    if (sessionExpiredHandled) return;
    sessionExpiredHandled = true;

    localStorage.removeItem('token');
    localStorage.removeItem('user');
    sessionStorage.setItem('auth-expired-notice', reason);
    window.dispatchEvent(new CustomEvent('auth:session-expired', { detail: { reason } }));
}

/** Proactively end session when expiry is detected locally (no server round-trip). */
export function expireSessionIfNeeded(): boolean {
    const token = localStorage.getItem('token');
    if (!token || token.startsWith('offline_token_')) return false;
    if (!isTokenExpired(token)) return false;
    handleSessionExpired('Session expired');
    return true;
}
