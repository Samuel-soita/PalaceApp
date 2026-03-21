import { useAuth } from '../contexts/AuthContext';
import { DEFAULT_ROLE_PERMISSIONS } from '../utils/permissions';

/**
 * Hook to check if the current user has a specific permission.
 * Works seamlessly with the backend's Central Permission Engine.
 * Falls back to DEFAULT_ROLE_PERMISSIONS when DB permissions are not yet populated.
 */
export function usePermission() {
    const { user } = useAuth();

    const hasPermission = (permissionCode: string): boolean => {
        if (!user) return false;
        
        // WATUA role bypasses all checks (System Engineers)
        if (user.role === 'WATUA') return true;

        // If DB permissions are populated, use them (granular control)
        if (user.permissions && user.permissions.length > 0) {
            return user.permissions.includes(permissionCode);
        }

        // Fallback: use the hardcoded DEFAULT_ROLE_PERMISSIONS map
        // This ensures the app works even when RolePermission table is empty
        const defaults = DEFAULT_ROLE_PERMISSIONS[user.role] || [];
        return defaults.includes(permissionCode as any);
    };

    return { hasPermission };
}
