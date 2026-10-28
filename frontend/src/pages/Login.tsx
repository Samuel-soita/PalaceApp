import { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import api from '../lib/api-client';
import { Button, TextField, Card, CardContent, Typography, Box, Alert, Divider, CircularProgress, Dialog, DialogTitle, DialogContent, List, ListItemButton, ListItemText } from '@mui/material';
import { CreditCard, Church, User, PlayCircle } from 'lucide-react';
import { DEMO_PERSONAS, isDemoSession, type DemoPersona } from '../demo/demo-session';
import { endDemo, hasUnsyncedRealChanges, startDemo } from '../demo/demo-controls';

export default function Login() {
    const [membershipNumber, setMembershipNumber] = useState('');
    const [idNumber, setIdNumber] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    // Watua secret trigger
    const watuaBufferRef = useRef('');
    const [watuaActivating, setWatuaActivating] = useState(false);

    const location = useLocation();
    const [demoOpen, setDemoOpen] = useState(() => new URLSearchParams(location.search).has('demo'));
    const [demoStarting, setDemoStarting] = useState<string | null>(null);
    const [demoError, setDemoError] = useState('');

    const { login, logout } = useAuth();
    const navigate = useNavigate();

    // Only the demo banner ends a demo; a login page open in another tab must not.
    const leavingDemo = !!(location.state as { leaveDemo?: boolean } | null)?.leaveDemo;
    useEffect(() => {
        if (!leavingDemo) return;
        if (isDemoSession()) endDemo(logout);
        navigate(`${location.pathname}${location.search}`, { replace: true, state: null });
    }, [leavingDemo, logout, navigate, location.pathname, location.search]);

    useEffect(() => {
        if (new URLSearchParams(location.search).has('demo')) setDemoOpen(true);
    }, [location.search]);

    const openDemo = async (persona: DemoPersona) => {
        if (demoStarting) return;
        setDemoError('');
        setDemoStarting(persona.role);
        try {
            if (await hasUnsyncedRealChanges()) {
                setDemoError('This device has changes waiting to sync. Sign in and let them sync before opening the demo.');
                return;
            }
            navigate(await startDemo(persona, login));
        } catch {
            setDemoError('The demo could not start. Please try again.');
        } finally {
            setDemoStarting(null);
        }
    };

    useEffect(() => {
        const notice = sessionStorage.getItem('auth-expired-notice');
        if (notice) {
            setError(notice);
            sessionStorage.removeItem('auth-expired-notice');
        }
    }, []);

    // Listen for the secret 'watua' keyboard sequence
    // Layout effect so the listener is live as soon as the form is on screen.
    useLayoutEffect(() => {
        const handleKeyDown = async (e: KeyboardEvent) => {
            // Ignore if typing inside an input
            if ((e.target as HTMLElement).tagName === 'INPUT') return;
            const char = e.key.toLowerCase();
            if (!/^[a-z]$/.test(char)) return;

            const newBuffer = (watuaBufferRef.current + char).slice(-5);
            watuaBufferRef.current = newBuffer;

            if (newBuffer === 'watua') {
                watuaBufferRef.current = '';
                const accessKey = window.prompt('Enter the system access key');
                if (!accessKey) return;
                setWatuaActivating(true);
                try {
                    const res = await api.post('/auth/watua-access', { accessKey });
                    await login(res.data);
                    navigate('/watua');
                } catch (err: any) {
                    setWatuaActivating(false);
                    setError(err.response?.data?.error || 'System Intervention module unavailable.');
                }
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [login, navigate]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        try {
            const res = await api.post('/auth/login', { membershipNumber, idNumber });
            const data = res.data;
            await login(data);

            if (data.user.role === 'WATUA') return navigate('/watua');
            if (data.user.role === 'SUPER_ADMIN') return navigate('/bishop');
            if (data.user.role === 'PASTOR' || data.user.role === 'ASSOCIATE_PASTOR') {
                return navigate('/pastor');
            }
            if (data.user.role === 'DEPARTMENT_LEADER' && data.user.departmentId) {
                return navigate(`/department/${data.user.departmentId}`);
            }
            navigate('/');
        } catch (err: any) {
            const msg = err.response?.data?.error || '';
            setError(msg || 'Login failed. Check your credentials.');
        } finally {
            setLoading(false);
        }
    };

    // Overlay when watua trigger fires
    if (watuaActivating) {
        return (
            <Box sx={{
                minHeight: '100vh', display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center',
                background: '#0c0e14', gap: 2
            }}>
                <CircularProgress sx={{ color: '#c175ff' }} />
                <Typography fontWeight={900} sx={{ color: '#c175ff', letterSpacing: 3, textTransform: 'uppercase' }}>
                    Initializing System Terminal...
                </Typography>
            </Box>
        );
    }

    return (
        <Box
            sx={{
                minHeight: '100vh',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'var(--bg-deep, #0a0c13)',
                p: 2,
            }}
        >
            <Card
                sx={{
                    maxWidth: 420,
                    width: '100%',
                    boxShadow: 3,
                    border: '1px solid rgba(255,255,255,0.08)',
                    bgcolor: 'background.paper',
                }}
            >
                <CardContent sx={{ p: 4 }}>
                    {/* Header */}
                    <Box display="flex" flexDirection="column" alignItems="center" mb={3}>
                        <Church size={32} color="var(--cyan, #00b4d8)" />
                        <Typography variant="h5" fontWeight="bold" mt={1}>
                            Welcome Back
                        </Typography>
                        <Typography color="textSecondary" variant="caption">
                            Log in to your Prayer Palace account
                        </Typography>
                    </Box>

                    {error && (
                        <Alert
                            severity={error.toLowerCase().includes('pending') ? 'info' : 'error'}
                            sx={{ mb: 3 }}
                            onClose={() => setError('')}
                        >
                            {error.toLowerCase().includes('pending') ? (
                                <Box>
                                    <Typography variant="body2" fontWeight="bold">Verification Pending</Typography>
                                    <Typography variant="caption">
                                        Your account is awaiting admin activation. Contact the church office.
                                    </Typography>
                                </Box>
                            ) : error}
                        </Alert>
                    )}

                    <form onSubmit={handleSubmit}>
                        <TextField
                            fullWidth
                            label="Membership Card Number"
                            value={membershipNumber}
                            onChange={e => setMembershipNumber(e.target.value)}
                            margin="normal"
                            required
                            placeholder="e.g. 063/001/2026"
                            InputProps={{
                                startAdornment: <CreditCard size={18} style={{ marginRight: 8, opacity: 0.5 }} />
                            }}
                            helperText="Your card number."
                        />

                        <TextField
                            fullWidth
                            label="National ID Number"
                            value={idNumber}
                            onChange={e => setIdNumber(e.target.value)}
                            margin="normal"
                            required
                            type="password"
                            placeholder="Enter your ID Number"
                            InputProps={{
                                startAdornment: <User size={18} style={{ marginRight: 8, opacity: 0.5 }} />
                            }}
                            helperText="Used to verify your identity securely."
                        />

                        <Button
                            fullWidth variant="contained"
                            type="submit" size="large"
                            disabled={loading}
                            sx={{ mt: 3, mb: 2, py: 1.5, textTransform: 'none', fontWeight: 'bold' }}
                        >
                            {loading ? 'Verifying...' : 'Sign In'}
                        </Button>
                    </form>

                    <Divider sx={{ my: 1, borderColor: 'rgba(255,255,255,0.05)' }} />
                    <Box display="flex" justifyContent="center">
                        <Typography variant="body2">
                            New member?{' '}
                            <Link to="/register" style={{ color: 'inherit', fontWeight: '600' }}>
                                Register here
                            </Link>
                        </Typography>
                    </Box>

                    <Button
                        fullWidth variant="outlined"
                        onClick={() => setDemoOpen(true)}
                        startIcon={<PlayCircle size={18} />}
                        sx={{ mt: 2, py: 1.25, textTransform: 'none', fontWeight: 'bold' }}
                    >
                        Explore the demo
                    </Button>
                </CardContent>
            </Card>

            <Dialog open={demoOpen} onClose={() => !demoStarting && setDemoOpen(false)} fullWidth maxWidth="xs">
                <DialogTitle sx={{ pb: 0.5 }}>Explore the demo</DialogTitle>
                <DialogContent sx={{ px: { xs: 1.5, sm: 3 } }}>
                    <Typography variant="body2" color="textSecondary" sx={{ mb: 1.5 }}>
                        Pick a role. The demo uses sample data only, so nothing you do reaches the church system.
                    </Typography>
                    {demoError && <Alert severity="warning" sx={{ mb: 1.5 }}>{demoError}</Alert>}
                    <List disablePadding>
                        {DEMO_PERSONAS.map((persona) => (
                            <ListItemButton
                                key={persona.role}
                                onClick={() => openDemo(persona)}
                                disabled={!!demoStarting}
                                sx={{ borderRadius: 1, mb: 0.5, minHeight: 56, border: '1px solid rgba(255,255,255,0.08)' }}
                            >
                                <ListItemText
                                    primary={persona.label}
                                    secondary={persona.description}
                                    primaryTypographyProps={{ fontWeight: 'bold' }}
                                />
                                {demoStarting === persona.role && <CircularProgress size={18} sx={{ ml: 1 }} />}
                            </ListItemButton>
                        ))}
                    </List>
                </DialogContent>
            </Dialog>
        </Box>
    );
}
