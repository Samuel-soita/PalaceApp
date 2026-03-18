import { useAuth } from '../contexts/AuthContext';

/**
 * Hook to check if the current user has a specific permission.
 * Works seamlessly with the backend's Central Permission Engine.
 */
export function usePermission() {
    const { user } = useAuth();

    const hasPermission = (permissionCode: string): boolean => {
        if (!user) return false;
        
        // WATUA role bypasses all checks (System Engineers)
        if (user.role === 'WATUA') return true;

        // Check if the permission exists in the user's permission set
        // (This will be populated in AuthContext after login/refresh)
        return user.permissions?.includes(permissionCode) || false;
    };

    return { hasPermission };
}
