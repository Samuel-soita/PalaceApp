import { Suspense, lazy } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import { Box, CircularProgress, Typography } from '@mui/material';
import { GlobalSkeleton } from './components/layout/GlobalSkeleton';

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
            SYNCHRONIZING HUB...
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

    if (user?.role === 'DEPARTMENT_LEADER' && user?.departmentId) {
        return <Navigate to={`/department/${user.departmentId}`} replace />;
    }

    // Super Admins (and any other roles) see the main command dashboard
    return <AdminDashboard />;
}

function DepartmentGuard({ children }: { children: React.ReactNode }) {
    const { user } = useAuth();
    if (user?.role === 'SUPER_ADMIN') return <>{children}</>;
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
            <Routes>
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />
                <Route path="/departments" element={
                    <PrivateRoute>
                        <DepartmentGuard><Departments /></DepartmentGuard>
                    </PrivateRoute>
                } />
                <Route path="/announcements" element={<PrivateRoute><Announcements /></PrivateRoute>} />
                <Route path="/calendar" element={<PrivateRoute><Events /></PrivateRoute>} />
                <Route path="/plans" element={<PrivateRoute><Plans /></PrivateRoute>} />
                <Route path="/projects" element={<PrivateRoute><Projects /></PrivateRoute>} />
                <Route path="/messages" element={<PrivateRoute><Messages /></PrivateRoute>} />
                <Route path="/support" element={<PrivateRoute><Support /></PrivateRoute>} />
                <Route path="/department/:id" element={<PrivateRoute><DepartmentDashboard /></PrivateRoute>} />
                <Route path="/watua" element={<WatuaGuard><WatuaDashboard /></WatuaGuard>} />
                <Route path="/" element={<PrivateRoute><RootRedirect /></PrivateRoute>} />
            </Routes>
        </Suspense>
    );
}

export default App;
