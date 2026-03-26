import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../lib/api-client.js';

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
}

interface AuthContextType {
    user: AuthUser | null;
    token: string | null;
    login: (data: { user: AuthUser; token: string }) => void;
    logout: () => void;
    updateUser: (data: Partial<AuthUser>) => void;
    loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<AuthUser | null>(null);
    const [token, setToken] = useState(localStorage.getItem('token'));
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function fetchProfile() {
            if (token) {
                try {
                    const res = await api.get('/auth/profile');
                    setUser(res.data);
                } catch (error) {
                    logout();
                }
            }
            setLoading(false);
        }
        fetchProfile();
    }, [token]);

    const login = (data: any) => {
        setUser(data.user);
        setToken(data.token);
        localStorage.setItem('token', data.token);
    };

    const logout = () => {
        setUser(null);
        setToken(null);
        localStorage.removeItem('token');
        sessionStorage.removeItem('welcome-splash-shown');
    };

    const updateUser = (data: any) => {
        setUser((prev: any) => prev ? { ...prev, ...data } : data);
    };

    return (
        <AuthContext.Provider value={{ user, token, login, logout, updateUser, loading }}>
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
