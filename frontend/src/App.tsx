import { Suspense, lazy } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import { Box, CircularProgress, Typography } from '@mui/material';
import { GlobalSkeleton } from './components/layout/GlobalSkeleton';
import ProfileModal from './components/modals/ProfileModal';
import { OfflineStatus } from './components/common/OfflineStatus';

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
    
    if (user?.role === 'WATUA') {
        return <Navigate to="/watua" replace />;
    }

    if (user?.role === 'MEMBER') {
        return <MemberPortal />;
    }

    if (user?.role === 'PASTOR' || user?.role === 'ASSOCIATE_PASTOR') {
        return <Navigate to="/pastor" replace />;
    }

    if (user?.role === 'DEPARTMENT_LEADER') {
        return <Navigate to={`/department/${user.departmentId}`} replace />;
    }

    // High Executives (SUPER_ADMIN, SYSTEM_ADMIN, SECRETARY) see Executive Command
    return <AdminDashboard />;
}

function DepartmentGuard({ children }: { children: React.ReactNode }) {
    const { user } = useAuth();
    if (user?.role === 'SUPER_ADMIN') return <>{children}</>;
    return <Navigate to="/" replace />;
}

function ExecutiveGuard({ children }: { children: React.ReactNode }) {
    const { user } = useAuth();
    // Only executives and leaders can access these routes. Members are strictly forbidden.
    const isExecutive = ['SUPER_ADMIN', 'SYSTEM_ADMIN', 'SECRETARY', 'PASTOR', 'DEPARTMENT_LEADER', 'WATUA'].includes(user?.role || '');
    if (isExecutive) return <>{children}</>;
    
    // Explicit bounce for members or unidentified roles
    return <Navigate to="/" replace />;
}

function WatuaGuard({ children }: { children: React.ReactNode }) {
    const { user } = useAuth();
    if (user?.role === 'WATUA') return <>{children}</>;
    return <Navigate to="/login" replace />;
}

function App() {
    return (
        <Suspense fallback={<LoadingFallback />}>
            <OfflineStatus />
            <Routes>
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />
                <Route path="/departments" element={
                    <PrivateRoute>
                        <DepartmentGuard><Departments /></DepartmentGuard>
                    </PrivateRoute>
                } />
                <Route path="/announcements" element={<PrivateRoute><ExecutiveGuard><Announcements /></ExecutiveGuard></PrivateRoute>} />
                <Route path="/calendar" element={<PrivateRoute><ExecutiveGuard><Events /></ExecutiveGuard></PrivateRoute>} />
                <Route path="/plans" element={<PrivateRoute><ExecutiveGuard><Plans /></ExecutiveGuard></PrivateRoute>} />
                <Route path="/projects" element={<PrivateRoute><ExecutiveGuard><Projects /></ExecutiveGuard></PrivateRoute>} />
                <Route path="/meetings" element={<PrivateRoute><ExecutiveGuard><Meetings /></ExecutiveGuard></PrivateRoute>} />
                <Route path="/messages" element={<PrivateRoute><Messages /></PrivateRoute>} />
                <Route path="/support" element={<PrivateRoute><ExecutiveGuard><Support /></ExecutiveGuard></PrivateRoute>} />
                <Route path="/register-child" element={<PrivateRoute><ChildRegistration /></PrivateRoute>} />
                <Route path="/profile" element={<PrivateRoute><ProfileModal open={true} onClose={() => window.history.back()} /></PrivateRoute>} />
                <Route path="/pastor" element={<PrivateRoute><ExecutiveGuard><PastorsDashboard /></ExecutiveGuard></PrivateRoute>} />
                <Route path="/department/:id" element={<PrivateRoute><DepartmentDashboard /></PrivateRoute>} />
                <Route path="/executive" element={<PrivateRoute><ExecutiveGuard><AdminDashboard /></ExecutiveGuard></PrivateRoute>} />
                <Route path="/watua" element={<WatuaGuard><WatuaDashboard /></WatuaGuard>} />
                <Route path="/" element={<PrivateRoute><RootRedirect /></PrivateRoute>} />
                <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
        </Suspense>
    );
}

export default App;
