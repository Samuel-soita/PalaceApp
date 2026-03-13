import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import Login from './pages/Login';
import Register from './pages/Register';
import Departments from './pages/Departments';
import Announcements from './pages/Announcements';
import PrayerRequests from './pages/PrayerRequests';
import AdminDashboard from './pages/AdminDashboard';
import DepartmentDashboard from './pages/DepartmentDashboard';
import Plans from './pages/Plans';
import Events from './pages/Events';
import Projects from './pages/Projects';
import Messages from './pages/Messages';
import Support from './pages/Support';

function PrivateRoute({ children }: { children: React.ReactNode }) {
    const { token, loading } = useAuth();
    if (loading) return <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Loading...</div>;
    if (!token) return <Navigate to="/login" />;
    return <>{children}</>;
}

function RootRedirect() {
    // All departments should see the main dashboard of the church 
    // events and plans to stay in sync and not collide.
    return <AdminDashboard />;
}

function DepartmentGuard({ children }: { children: React.ReactNode }) {
    const { user } = useAuth();
    if (user?.role === 'SUPER_ADMIN') return <>{children}</>;
    return <Navigate to="/" replace />;
}

function App() {
    return (
        <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/departments" element={
                <PrivateRoute>
                    <DepartmentGuard><Departments /></DepartmentGuard>
                </PrivateRoute>
            } />
            <Route path="/announcements" element={<PrivateRoute><Announcements /></PrivateRoute>} />
            <Route path="/prayer-requests" element={<PrivateRoute><PrayerRequests /></PrivateRoute>} />
            <Route path="/calendar" element={<PrivateRoute><Events /></PrivateRoute>} />
            <Route path="/plans" element={<PrivateRoute><Plans /></PrivateRoute>} />
            <Route path="/projects" element={<PrivateRoute><Projects /></PrivateRoute>} />
            <Route path="/messages" element={<PrivateRoute><Messages /></PrivateRoute>} />
            <Route path="/support" element={<PrivateRoute><Support /></PrivateRoute>} />
            <Route path="/department/:id" element={<PrivateRoute><DepartmentDashboard /></PrivateRoute>} />
            <Route path="/" element={<PrivateRoute><RootRedirect /></PrivateRoute>} />
        </Routes>
    );
}

export default App;
