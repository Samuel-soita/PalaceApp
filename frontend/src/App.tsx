import { Suspense, lazy, useEffect } from 'react';
import { Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import RouteErrorBoundary from './components/RouteErrorBoundary';
import { useRealtimeSync } from './hooks/useRealtimeSync';
import { useAuth } from './contexts/AuthContext';
import { Box, CircularProgress, Typography } from '@mui/material';
import { GlobalSkeleton } from './components/layout/GlobalSkeleton';
import ProfileModal from './components/modals/ProfileModal';
import ConflictResolutionModal from './components/ConflictResolutionModal';
import { ROUTE_ROLES, hasRole, homePathFor } from './lib/route-access';

// Lazy load components
const Login = lazy(() => import('./pages/Login'));
const Register = lazy(() => import('./pages/Register'));
const Departments = lazy(() => import('./pages/Departments'));
const Announcements = lazy(() => import('./pages/Announcements'));
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'));
const DepartmentDashboard = lazy(() => import('./pages/DepartmentDashboard'));
const Plans = lazy(() => import('./pages/Plans'));
const Events = lazy(() => import('./pages/Events'));
const Projects = lazy(() => import('./pages/Projects'));
const Messages = lazy(() => import('./pages/Messages'));
const Support = lazy(() => import('./pages/Support'));
const WatuaDashboard = lazy(() => import('./pages/WatuaDashboard'));
const ChildRegistration = lazy(() => import('./pages/ChildRegistration'));
const MemberPortal = lazy(() => import('./pages/MemberPortal'));
const Meetings = lazy(() => import('./pages/Meetings'));
const PastorsDashboard = lazy(() => import('./pages/PastorsDashboard'));
const BishopDashboard = lazy(() => import('./pages/BishopDashboard'));
const HealthDashboard = lazy(() => import('./pages/HealthDashboard'));

const LoadingFallback = () => (
    <Box sx={{ 
        height: '100vh', 
        display: 'flex', 
        flexDirection: 'column', 
        alignItems: 'center', 
        justifyContent: 'center',
        bgcolor: 'background.default',
        gap: 2
    }}>
        <CircularProgress size={40} thickness={4} sx={{ color: 'primary.main' }} />
        <Typography variant="caption" fontWeight="900" sx={{ letterSpacing: 2, opacity: 0.5 }}>
            SYNCHRONIZING PORTAL...
        </Typography>
    </Box>
);

function PrivateRoute({ children }: { children: React.ReactNode }) {
    const { token, loading } = useAuth();
    const location = useLocation();
    if (loading) return <LoadingFallback />;
    if (!token) return <Navigate to="/login" />;
    return (
        <RouteErrorBoundary key={location.pathname}>
            <Suspense fallback={<GlobalSkeleton />}>
                {children}
            </Suspense>
        </RouteErrorBoundary>
    );
}

function RootRedirect() {
    const { user } = useAuth();
    const home = homePathFor(user?.role, user?.departmentId);
    if (home === '/') return <MemberPortal />;
    return <Navigate to={home} replace />;
}

function RoleGuard({ roles, children, fallback = '/' }: { roles: readonly string[]; children: React.ReactNode; fallback?: string }) {
    const { user } = useAuth();
    if (hasRole(user?.role, roles)) return <>{children}</>;
    return <Navigate to={fallback} replace />;
}

const BishopGuard = ({ children }: { children: React.ReactNode }) => <RoleGuard roles={ROUTE_ROLES.bishop}>{children}</RoleGuard>;
// System Ops + Bishop + Watua + Dept Leaders (Restricted View)
const ExecutiveGuard = ({ children }: { children: React.ReactNode }) => <RoleGuard roles={ROUTE_ROLES.executive}>{children}</RoleGuard>;
const PastorGuard = ({ children }: { children: React.ReactNode }) => <RoleGuard roles={ROUTE_ROLES.pastor}>{children}</RoleGuard>;
const ContentPagesGuard = ({ children }: { children: React.ReactNode }) => <RoleGuard roles={ROUTE_ROLES.content}>{children}</RoleGuard>;
const WatuaGuard = ({ children }: { children: React.ReactNode }) => <RoleGuard roles={ROUTE_ROLES.watua} fallback="/login">{children}</RoleGuard>;

function ProfileRoute() {
    const navigate = useNavigate();
    // React Router stores the in-app history position in history.state.idx; 0 means this is the first in-app page.
    const close = () => ((window.history.state?.idx ?? 0) > 0 ? navigate(-1) : navigate('/', { replace: true }));
    return <ProfileModal open={true} onClose={close} />;
}

function LeaderGuard({ children }: { children: React.ReactNode }) {
    const { user } = useAuth();
    if (!user || user.role === 'MEMBER') return <Navigate to="/" replace />;
    return <>{children}</>;
}

import { PermissionService } from './lib/PermissionService';
import { DeviceService } from './lib/DeviceService';
import PublicUpdateToast from './components/PublicUpdateToast';

function App() {
    const { user } = useAuth();
    useRealtimeSync();

    useEffect(() => {
        const initKernel = async () => {
            // 🔐 1. Initialize Device Identity
            await DeviceService.getDeviceId();
            
            // 🛡️ 2. Sync Permission Engine with Cloud Source of Truth (Authorized roles only)
            const isAuthorizedForPermissions = ['SUPER_ADMIN', 'WATUA'].includes(user?.role || '');
            if (isAuthorizedForPermissions) {
                await PermissionService.syncWithCloud();
            }
        };

        if (user) {
            initKernel();
        }
    }, [user]);

    return (
        <Suspense fallback={<LoadingFallback />}>
            <PublicUpdateToast />
            <ConflictResolutionModal />
            <Routes>
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />
                
                {/* BISHOP ONLY */}
                <Route path="/departments" element={<PrivateRoute><BishopGuard><Departments /></BishopGuard></PrivateRoute>} />
                <Route path="/bishop" element={<PrivateRoute><BishopGuard><BishopDashboard /></BishopGuard></PrivateRoute>} />
                
                {/* EXECUTIVE ONLY (System Admin / Secretary) */}
                <Route path="/executive" element={<PrivateRoute><ExecutiveGuard><AdminDashboard /></ExecutiveGuard></PrivateRoute>} />
                <Route path="/support" element={<PrivateRoute><ExecutiveGuard><Support /></ExecutiveGuard></PrivateRoute>} />
                
                {/* WATUA ONLY */}
                <Route path="/watua" element={<PrivateRoute><WatuaGuard><WatuaDashboard /></WatuaGuard></PrivateRoute>} />
                <Route path="/health" element={<PrivateRoute><RoleGuard roles={ROUTE_ROLES.health}><HealthDashboard /></RoleGuard></PrivateRoute>} />
                
                {/* PASTOR & ABOVE (Global Visibility) */}
                <Route path="/announcements" element={<PrivateRoute><ContentPagesGuard><Announcements /></ContentPagesGuard></PrivateRoute>} />
                <Route path="/calendar" element={<PrivateRoute><ContentPagesGuard><Events /></ContentPagesGuard></PrivateRoute>} />
                <Route path="/projects" element={<PrivateRoute><ContentPagesGuard><Projects /></ContentPagesGuard></PrivateRoute>} />
                <Route path="/pastor" element={<PrivateRoute><PastorGuard><PastorsDashboard /></PastorGuard></PrivateRoute>} />
                
                {/* SCOPED MISSIONS */}
                <Route path="/department/:id" element={<PrivateRoute><DepartmentDashboard /></PrivateRoute>} />
                <Route path="/plans" element={<PrivateRoute><Plans /></PrivateRoute>} />
                <Route path="/meetings" element={<PrivateRoute><Meetings /></PrivateRoute>} />
                
                {/* ALL AUTHENTICATED */}
                <Route path="/messages" element={<PrivateRoute><LeaderGuard><Messages /></LeaderGuard></PrivateRoute>} />
                <Route path="/register-child" element={<PrivateRoute><ChildRegistration /></PrivateRoute>} />
                <Route path="/profile" element={<PrivateRoute><ProfileRoute /></PrivateRoute>} />
                
                <Route path="/member-portal" element={<PrivateRoute><MemberPortal /></PrivateRoute>} />
                
                <Route path="/" element={<PrivateRoute><RootRedirect /></PrivateRoute>} />
                <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
        </Suspense>
    );
}

export default App;
