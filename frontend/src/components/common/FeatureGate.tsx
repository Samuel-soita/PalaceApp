import React, { useEffect, useState } from 'react';
import api from '../../lib/api-client';
import { useAuth } from '../../contexts/AuthContext';

interface FeatureGateProps {
    flag: string;
    children: React.ReactNode;
    fallback?: React.ReactNode;
}

/**
 * FeatureGate Component
 * Conditionally renders children based on a server-side feature flag.
 */
export const FeatureGate: React.FC<FeatureGateProps> = ({ flag, children, fallback = null }) => {
    const [isEnabled, setIsEnabled] = useState<boolean | null>(null);
    const { user } = useAuth();

    useEffect(() => {
        const checkFlag = async () => {
            try {
                // Use centralized API client (base /api)
                const response = await api.get(`/settings/flags/check/${flag}`);
                setIsEnabled(response.data.enabled);
            } catch (error) {
                console.error(`[FeatureGate] Error checking flag ${flag}:`, error);
                setIsEnabled(false); // Default to disabled on error for safety
            }
        };

        if (user) {
            checkFlag();
        }
    }, [flag, user]);

    if (isEnabled === null) return null; // Loading state (could be a spinner)
    
    return isEnabled ? <>{children}</> : <>{fallback}</>;
};
