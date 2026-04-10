import { Suspense, lazy, useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import { Box, CircularProgress, Typography } from '@mui/material';
import { GlobalSkeleton } from './components/layout/GlobalSkeleton';
import ProfileModal from './components/modals/ProfileModal';
import ConflictResolutionModal from './components/ConflictResolutionModal';

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
    if (loading) return <LoadingFallback />;
    if (!token) return <Navigate to="/login" />;
    return (
        <Suspense fallback={<GlobalSkeleton />}>
            {children}
        </Suspense>
    );
}

function RootRedirect() {
    const { user } = useAuth();
    
    if (user?.role === 'SUPER_ADMIN') {
        return <Navigate to="/bishop" replace />;
    }

    if (user?.role === 'WATUA') {
        return <Navigate to="/watua" replace />;
    }

    if (user?.role === 'SYSTEM_ADMIN' || user?.role === 'SECRETARY') {
        return <Navigate to="/executive" replace />;
    }

    if (user?.role === 'MEMBER' || user?.role === 'USER') {
        return <MemberPortal />;
    }

    if (user?.role === 'PASTOR' || user?.role === 'ASSOCIATE_PASTOR') {
        return <Navigate to="/pastor" replace />;
    }

    if (user?.role === 'DEPARTMENT_LEADER') {
        return <Navigate to={`/department/${user.departmentId}`} replace />;
    }

    // Default fallback
    return <MemberPortal />;
}

function BishopGuard({ children }: { children: React.ReactNode }) {
    const { user } = useAuth();
    if (user?.role === 'SUPER_ADMIN') return <>{children}</>;
    return <Navigate to="/" replace />;
}

function ExecutiveGuard({ children }: { children: React.ReactNode }) {
    const { user } = useAuth();
    // Universal Override: System Ops + Bishop + Watua + Dept Leaders (Restricted View)
    const isExecutive = ['SYSTEM_ADMIN', 'SECRETARY', 'SUPER_ADMIN', 'WATUA', 'DEPARTMENT_LEADER'].includes(user?.role || '');
    if (isExecutive) return <>{children}</>;
    
    return <Navigate to="/" replace />;
}

function PastorGuard({ children }: { children: React.ReactNode }) {
    const { user } = useAuth();
    const isPastor = ['PASTOR', 'ASSOCIATE_PASTOR', 'SUPER_ADMIN', 'WATUA'].includes(user?.role || '');
    if (isPastor) return <>{children}</>;
    return <Navigate to="/" replace />;
}

function WatuaGuard({ children }: { children: React.ReactNode }) {
    const { user } = useAuth();
    if (user?.role === 'WATUA') return <>{children}</>;
    return <Navigate to="/login" replace />;
}

function LeaderGuard({ children }: { children: React.ReactNode }) {
    const { user } = useAuth();
    if (!user || user.role === 'MEMBER') return <Navigate to="/" replace />;
    return <>{children}</>;
}

import { PermissionService } from './lib/PermissionService';
import { DeviceService } from './lib/DeviceService';

function App() {
    const { user } = useAuth();

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
                <Route path="/health" element={<PrivateRoute><ExecutiveGuard><HealthDashboard /></ExecutiveGuard></PrivateRoute>} />
                
                {/* PASTOR & ABOVE (Global Visibility) */}
                <Route path="/announcements" element={<PrivateRoute><PastorGuard><Announcements /></PastorGuard></PrivateRoute>} />
                <Route path="/calendar" element={<PrivateRoute><PastorGuard><Events /></PastorGuard></PrivateRoute>} />
                <Route path="/projects" element={<PrivateRoute><PastorGuard><Projects /></PastorGuard></PrivateRoute>} />
                <Route path="/pastor" element={<PrivateRoute><PastorGuard><PastorsDashboard /></PastorGuard></PrivateRoute>} />
                
                {/* SCOPED MISSIONS */}
                <Route path="/department/:id" element={<PrivateRoute><DepartmentDashboard /></PrivateRoute>} />
                <Route path="/plans" element={<PrivateRoute><Plans /></PrivateRoute>} />
                <Route path="/meetings" element={<PrivateRoute><Meetings /></PrivateRoute>} />
                
                {/* ALL AUTHENTICATED */}
                <Route path="/messages" element={<PrivateRoute><LeaderGuard><Messages /></LeaderGuard></PrivateRoute>} />
                <Route path="/register-child" element={<PrivateRoute><ChildRegistration /></PrivateRoute>} />
                <Route path="/profile" element={<PrivateRoute><ProfileModal open={true} onClose={() => window.history.back()} /></PrivateRoute>} />
                
                <Route path="/member-portal" element={<PrivateRoute><MemberPortal /></PrivateRoute>} />
                
                <Route path="/" element={<PrivateRoute><RootRedirect /></PrivateRoute>} />
                <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
        </Suspense>
    );
}

export default App;
