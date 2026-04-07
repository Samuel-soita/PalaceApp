import { db } from './db';

/**
 * 🔒 Local Authentication Service
 * Manages zero-network secure authentication using pinned credentials in Dexie.
 * Uses SHA-256 for basic local hashing of PINs/Passwords.
 */

export const LocalAuthService = {
    /**
     * Hashes a string using the browser's crypto API (SubtleCrypto).
     */
    async hash(value: string): Promise<string> {
        const encoder = new TextEncoder();
        const data = encoder.encode(value);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
        return hashHex;
    },

    /**
     * Sets or updates the local PIN for a user in the browser persistent vault.
     */
    async setLocalPin(userId: string, pin: string): Promise<void> {
        const hashedPin = await this.hash(pin);
        await db.localCredentials.put({
            id: userId,
            hashedPin,
            isActive: true,
            updatedAt: new Date().toISOString()
        });
        console.log(`[LocalAuth] Secure identity PIN pinned locally for user: ${userId}`);
    },

    /**
     * Validates an incoming PIN against the local persistent vault.
     */
    async validateLocalPin(userId: string, pin: string): Promise<boolean> {
        const creds = await db.localCredentials.get(userId);
        if (!creds || !creds.isActive) return false;

        const incomingHash = await this.hash(pin);
        return incomingHash === creds.hashedPin;
    },

    /**
     * Deactivates the local authentication identity for a user.
     */
    async deactivate(userId: string): Promise<void> {
        await db.localCredentials.update(userId, { isActive: false });
    },

    /**
     * Clears all local credentials (Emergency Wipe).
     */
    async wipe(): Promise<void> {
        await db.localCredentials.clear();
        console.warn('[LocalAuth] Local authentication vault purged.');
    }
};
