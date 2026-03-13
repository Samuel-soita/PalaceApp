import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import api from '../lib/api-client';
import { Button, TextField, Card, CardContent, Typography, Box, Alert } from '@mui/material';

export default function Login() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const { login } = useAuth();
    const navigate = useNavigate();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        try {
            const res = await api.post('/auth/login', { email, password });
            const data = res.data;
            login(data);
            if (data.user.role === 'SUPER_ADMIN') {
                navigate('/');
            } else {
                navigate(`/department/${data.user.departmentId}`);
            }
        } catch (err: any) {
            setError(err.response?.data?.error || 'Login failed');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Box className="min-h-screen flex items-center justify-center bg-background p-4">
            <Card sx={{ maxWidth: 400, w: '100%', boxShadow: 3 }}>
                <CardContent sx={{ p: 4 }}>
                    <Typography variant="h5" component="h1" fontWeight="bold" gutterBottom>
                        Welcome Back
                    </Typography>
                    <Typography color="textSecondary" mb={3}>
                        Log in to your ChurchHub account
                    </Typography>

                    {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

                    <form onSubmit={handleSubmit}>
                        <TextField
                            fullWidth
                            label="Email Address"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            margin="normal"
                            required
                            type="email"
                        />
                        <TextField
                            fullWidth
                            label="Password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            margin="normal"
                            required
                            type="password"
                        />
                        <Button
                            fullWidth
                            variant="contained"
                            type="submit"
                            size="large"
                            disabled={loading}
                            sx={{ mt: 3, mb: 2, py: 1.5, textTransform: 'none', fontWeight: 'bold' }}
                        >
                            {loading ? 'Logging in...' : 'Sign In'}
                        </Button>
                    </form>

                    <Box display="flex" justifyContent="center">
                        <Typography variant="body2">
                            Don't have an account? <Link to="/register" style={{ color: 'inherit', fontWeight: '600' }}>Register here</Link>
                        </Typography>
                    </Box>
                </CardContent>
            </Card>
        </Box>
    );
}
