import React, { createContext, useContext, useState, useEffect } from 'react';
import { LocalAuthService } from '../lib/LocalAuthService';
import { db } from '../lib/db';

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
        const saved = localStorage.getItem('user');
        return saved ? JSON.parse(saved) : null;
    });
    const [token, setToken] = useState(localStorage.getItem('token'));
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Local-First: Initial load is complete once state is restored from localStorage.
        setLoading(false);
    }, [token]);

    const login = async (data: any) => {
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

    const logout = () => {
        setUser(null);
        setToken(null);
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        sessionStorage.removeItem('welcome-splash-shown');
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
