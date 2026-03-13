import React, { useState } from 'react';
import {
    Container, Paper, TextField, Button, Typography, Box,
    Alert, Link as MuiLink, MenuItem
} from '@mui/material';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';

export default function Register() {
    const [formData, setFormData] = useState({
        email: '',
        password: '',
        name: '',
        role: 'MEMBER',
        membershipNumber: ''
    });
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        try {
            await axios.post('http://localhost:4000/auth/register', formData);
            navigate('/login');
        } catch (err: any) {
            setError(err.response?.data?.error || 'Registration failed');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Box
            sx={{
                height: '100vh',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
            }}
        >
            <Container maxWidth="xs">
                <Paper elevation={10} sx={{ p: 5, borderRadius: 4 }}>
                    <Box display="flex" flexDirection="column" alignItems="center" mb={4}>
                        <div className="w-12 h-12 rounded-xl bg-primary flex items-center justify-center text-white font-bold text-2xl mb-2">C</div>
                        <Typography variant="h5" fontWeight="bold">Join CDMS</Typography>
                        <Typography color="textSecondary" variant="body2">Create your account</Typography>
                    </Box>

                    {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}

                    <form onSubmit={handleSubmit}>
                        <TextField
                            fullWidth
                            label="Full Name"
                            name="name"
                            required
                            variant="outlined"
                            sx={{ mb: 2 }}
                            value={formData.name}
                            onChange={handleChange}
                        />
                        <TextField
                            fullWidth
                            label="Email Address"
                            name="email"
                            type="email"
                            required
                            variant="outlined"
                            sx={{ mb: 2 }}
                            value={formData.email}
                            onChange={handleChange}
                        />
                        <TextField
                            fullWidth
                            label="Password"
                            name="password"
                            type="password"
                            required
                            variant="outlined"
                            sx={{ mb: 2 }}
                            value={formData.password}
                            onChange={handleChange}
                        />
                        <TextField
                            fullWidth
                            label="Membership Card Number"
                            name="membershipNumber"
                            required
                            variant="outlined"
                            sx={{ mb: 2 }}
                            value={formData.membershipNumber}
                            onChange={handleChange}
                        />
                        <TextField
                            fullWidth
                            select
                            label="Role"
                            name="role"
                            variant="outlined"
                            sx={{ mb: 3 }}
                            value={formData.role}
                            onChange={handleChange}
                        >
                            <MenuItem value="MEMBER">Member</MenuItem>
                            <MenuItem value="DEPARTMENT_LEADER">Department Leader</MenuItem>
                            <MenuItem value="SUPER_ADMIN">Super Admin</MenuItem>
                        </TextField>
                        <Button
                            fullWidth
                            size="large"
                            type="submit"
                            variant="contained"
                            disabled={loading}
                            sx={{
                                py: 1.5,
                                borderRadius: 2,
                                fontWeight: 'bold',
                                textTransform: 'none',
                                fontSize: '1.1rem'
                            }}
                        >
                            {loading ? 'Registering...' : 'Sign Up'}
                        </Button>
                    </form>

                    <Box mt={3} textAlign="center">
                        <Typography variant="body2" color="textSecondary">
                            Already have an account? <MuiLink component={Link} to="/login" sx={{ fontWeight: 'bold' }}>Login here</MuiLink>
                        </Typography>
                    </Box>
                </Paper>
            </Container>
        </Box>
    );
}
