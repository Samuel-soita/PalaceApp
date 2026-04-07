import { db } from './db';

/**
 * 📱 Device Identity Service
 * Generates and persists a unique fingerprint for the current installation.
 * Essential for conflict resolution and audit logging.
 */

export const DeviceService = {
    /**
     * Retrieves the current device ID from local storage or Dexie.
     * Generates a new one if it doesn't exist.
     */
    async getDeviceId(): Promise<string> {
        // 1. Check Dexie for persistent settings
        const settings = await db.deviceSettings.get('current_device');
        if (settings) return settings.deviceId;

        // 2. Check LocalStorage fallback
        let deviceId = localStorage.getItem('palace_device_id');
        
        if (!deviceId) {
            // 3. Generate new unique identity
            deviceId = crypto.randomUUID();
            localStorage.setItem('palace_device_id', deviceId);
        }

        // 4. Persist in Dexie for version 11+
        await db.deviceSettings.put({
            id: 'current_device',
            deviceId,
            deviceType: this.detectDeviceType(),
            firstLaunch: new Date().toISOString(),
            trustScore: 100
        });

        return deviceId;
    },

    /**
     * Detects basic device metadata.
     */
    detectDeviceType(): string {
        const ua = navigator.userAgent;
        if (/(tablet|ipad|playbook|silk)|(android(?!.*mobi))/i.test(ua)) return 'TABLET';
        if (/Mobile|Android|iP(hone|od)|IEMobile|BlackBerry|Kindle|Silk-Accelerated/i.test(ua)) return 'MOBILE';
        return 'DESKTOP';
    },

    /**
     * Validates that the local identity hasn't been tampered with.
     */
    async validateTrust(): Promise<boolean> {
        const dexieId = (await db.deviceSettings.get('current_device'))?.deviceId;
        const localId = localStorage.getItem('palace_device_id');
        
        // If IDs exist but don't match, trust is broken
        if (dexieId && localId && dexieId !== localId) {
            console.error('[DeviceService] Identity mismatch detected. Security alert triggered.');
            return false;
        }
        return true;
    }
};
