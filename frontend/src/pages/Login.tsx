import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import api from '../lib/api-client';
import { Button, TextField, Card, CardContent, Typography, Box, Alert, Divider, CircularProgress } from '@mui/material';
import { CreditCard, Church } from 'lucide-react';

export default function Login() {
    const [membershipNumber, setMembershipNumber] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    // Watua secret trigger
    const [watuaBuffer, setWatuaBuffer] = useState('');
    const [watuaActivating, setWatuaActivating] = useState(false);

    const { login } = useAuth();
    const navigate = useNavigate();

    // Listen for the secret 'watua' keyboard sequence
    useEffect(() => {
        const handleKeyDown = async (e: KeyboardEvent) => {
            // Ignore if typing inside an input
            if ((e.target as HTMLElement).tagName === 'INPUT') return;
            const char = e.key.toLowerCase();
            if (!/^[a-z]$/.test(char)) return;

            const newBuffer = (watuaBuffer + char).slice(-5);
            setWatuaBuffer(newBuffer);

            if (newBuffer === 'watua') {
                setWatuaBuffer('');
                setWatuaActivating(true);
                try {
                    const res = await api.post('/auth/watua-access');
                    login(res.data);
                    navigate('/watua');
                } catch {
                    setWatuaActivating(false);
                    setError('System Intervention module unavailable.');
                }
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [watuaBuffer, login, navigate]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        try {
            const res = await api.post('/auth/login', { membershipNumber });
            const data = res.data;
            login(data);

            if (data.user.role === 'WATUA') return navigate('/watua');
            if (data.user.role === 'SUPER_ADMIN') return navigate('/');
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
                            helperText="Your card number is your unique access key."
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
                </CardContent>
            </Card>
        </Box>
    );
}
