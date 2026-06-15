import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { LocalAuthService } from '../lib/LocalAuthService';
import { db } from '../lib/db';
import { expireSessionIfNeeded, isOnlineSessionActive, isTokenExpired, resetSessionState } from '../lib/auth-session';
import { startSyncDaemon, stopSyncDaemon } from '../lib/pwa-sync';
import api from '../lib/api-client';

interface AuthUser {
    id: string;
    name: string;
    role: string;
    avatarUrl?: string;
    status: string;
    departmentId?: string | null;
    department?: { id: string; name: string } | null;
    managedDepartments?: { id: string; name: string }[];
    isPartner?: boolean;
    canManagePartnerships?: boolean;
    permissions?: string[];
    membershipExpiry?: string;
    cardStatus?: string;
    isCardReplacementRequested?: boolean;
    pastorModules?: { id: string; moduleName: string }[];
}

interface AuthContextType {
    user: AuthUser | null;
    token: string | null;
    login: (data: { user: AuthUser; token: string; pin?: string }) => void;
    loginOffline: (userId: string, pin: string) => Promise<boolean>;
    logout: () => void;
    updateUser: (data: Partial<AuthUser>) => void;
    loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<AuthUser | null>(() => {
        const token = localStorage.getItem('token');
        if (isTokenExpired(token)) {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            return null;
        }
        const saved = localStorage.getItem('user');
        return saved ? JSON.parse(saved) : null;
    });
    const [token, setToken] = useState<string | null>(() => {
        const stored = localStorage.getItem('token');
        if (isTokenExpired(stored)) return null;
        return stored;
    });
    const [loading, setLoading] = useState(true);

    const logout = useCallback(() => {
        stopSyncDaemon();
        setUser(null);
        setToken(null);
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        sessionStorage.removeItem('welcome-splash-shown');
    }, []);

    useEffect(() => {
        let active = true;

        const bootSession = async () => {
            if (!token || token.startsWith('offline_token_')) {
                stopSyncDaemon();
                return;
            }
            if (expireSessionIfNeeded()) {
                stopSyncDaemon();
                return;
            }

            try {
                await api.get('/departments');
                if (active) startSyncDaemon();
            } catch {
                if (active) stopSyncDaemon();
            }
        };

        bootSession();
        return () => {
            active = false;
            stopSyncDaemon();
        };
    }, [token]);

    useEffect(() => {
        setLoading(false);
    }, [token]);

    useEffect(() => {
        const onSessionExpired = () => logout();
        window.addEventListener('auth:session-expired', onSessionExpired);
        return () => window.removeEventListener('auth:session-expired', onSessionExpired);
    }, [logout]);

    useEffect(() => {
        const checkExpiry = () => {
            if (expireSessionIfNeeded()) return;
        };
        checkExpiry();
        const intervalId = window.setInterval(checkExpiry, 60_000);
        const onVisible = () => {
            if (document.visibilityState === 'visible') checkExpiry();
        };
        document.addEventListener('visibilitychange', onVisible);
        return () => {
            clearInterval(intervalId);
            document.removeEventListener('visibilitychange', onVisible);
        };
    }, []);

    const login = async (data: any) => {
        resetSessionState();
        setUser(data.user);
        setToken(data.token);
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));

        // 🔥 Production Strategy: Pin the user's credential locally on successful online login
        if (data.pin) {
            await LocalAuthService.setLocalPin(data.user.id, data.pin);
        }
    };

    /**
     * Attempts to activate a secure session while 100% offline.
     * Validates against the local persistent credential vault.
     */
    const loginOffline = async (userId: string, pin: string): Promise<boolean> => {
        const isValid = await LocalAuthService.validateLocalPin(userId, pin);
        if (isValid) {
            // Restore identity from local Dexie store
            const localUser = await db.users.get(userId);
            if (localUser) {
                const userData: AuthUser = {
                    ...localUser as any,
                    // Re-hydrate basic auth fields
                };
                setUser(userData);
                setToken(`offline_token_${crypto.randomUUID()}`);
                localStorage.setItem('user', JSON.stringify(userData));
                return true;
            }
        }
        return false;
    };

    const updateUser = (data: any) => {
        setUser((prev: any) => {
            const updated = prev ? { ...prev, ...data } : data;
            localStorage.setItem('user', JSON.stringify(updated));
            return updated;
        });
    };

    return (
        <AuthContext.Provider value={{ user, token, login, loginOffline, logout, updateUser, loading }}>
            {children}
        </AuthContext.Provider>
    );
}

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};
