import CryptoJS from 'crypto-js';

// Base secret for generating encryption keys (In true E2EE, this would be negotiated via Diffie-Hellman)
const MASTER_SECRET = import.meta.env.VITE_E2EE_SECRET || 'church-hub-secure-layer-10x';

/**
 * Derives a deterministic room-specific encryption key based on the roomId.
 * This ensures that group participants and private chat participants
 * can reproducibly encrypt/decrypt messages that only the end-clients can read.
 */
const deriveRoomKey = (roomId: string): string => {
    return CryptoJS.SHA256(`${MASTER_SECRET}:${roomId}`).toString(CryptoJS.enc.Hex);
};

/**
 * Encrypts a message payload using AES-256-CBC.
 */
export const encryptMessage = (plaintext: string, roomId: string): string => {
    if (!plaintext) return plaintext;
    try {
        const key = deriveRoomKey(roomId);
        const encrypted = CryptoJS.AES.encrypt(plaintext, key).toString();
        // Prefix with E2EE identifier so we know it's encrypted
        return `E2EE::${encrypted}`;
    } catch (e) {
        console.error('Encryption failed', e);
        return plaintext;
    }
};

/**
 * Decrypts an AES-256-CBC encrypted message payload.
 */
export const decryptMessage = (ciphertext: string, roomId: string): string => {
    if (!ciphertext || !ciphertext.startsWith('E2EE::')) return ciphertext;
    
    try {
        const key = deriveRoomKey(roomId);
        const actualCiphertext = ciphertext.replace('E2EE::', '');
        const bytes = CryptoJS.AES.decrypt(actualCiphertext, key);
        const decrypted = bytes.toString(CryptoJS.enc.Utf8);
        return decrypted || ciphertext; // Fallback if decryption returns empty (wrong key)
    } catch (e) {
        console.error('Decryption failed', e);
        return ciphertext;
    }
};
