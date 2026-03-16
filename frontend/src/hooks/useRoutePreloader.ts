import { useCallback } from 'react';

/**
 * Tactical Route Preloader
 * Predicts user navigation targets and triggers lazy component pre-fetching.
 */
export const useRoutePreloader = () => {
    const preloadRoute = useCallback((route: string) => {
        switch (route) {
            case 'login':
                import('../pages/Login');
                break;
            case 'register':
                import('../pages/Register');
                break;
            case 'departments':
                import('../pages/Departments');
                break;
            case 'announcements':
                import('../pages/Announcements');
                break;
            case 'calendar':
                import('../pages/Events');
                break;
            case 'plans':
                import('../pages/Plans');
                break;
            case 'projects':
                import('../pages/Projects');
                break;
            case 'messages':
                import('../pages/Messages');
                break;
            case 'support':
                import('../pages/Support');
                break;
            case 'dashboard':
                import('../pages/AdminDashboard');
                break;
            case 'department':
                import('../pages/DepartmentDashboard');
                break;
        }
    }, []);

    return { preloadRoute };
};
