import React, { useState } from 'react';
import {
    Container, Paper, TextField, Button, Typography, Box,
    Alert, Link as MuiLink, MenuItem, Stepper, Step, StepLabel, Divider
} from '@mui/material';
import { Link } from 'react-router-dom';
import { UserPlus, Church } from 'lucide-react';
import api from '../lib/api-client';

const STEPS = ['Identity', 'Membership', 'Confirmation'];

const GENDER_OPTIONS = [
    { value: 'MALE', label: 'Male' },
    { value: 'FEMALE', label: 'Female' },
];

const INITIAL_FORM = {
    name: '',
    idNumber: '',
    membershipNumber: '',
    phoneNumber: '',
    dob: '',
    gender: '',
};

export default function Register() {
    const [formData, setFormData] = useState(INITIAL_FORM);
    const [error, setError] = useState('');
    const [cardError, setCardError] = useState('');
    const [loading, setLoading] = useState(false);
    const [successMsg, setSuccessMsg] = useState('');

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
        // Live card format validation
        if (name === 'membershipNumber') {
            const pattern = /^\d{3}\/\d{3}\/(\d{4})$/;
            const match = value.match(pattern);
            
            // Allow 'watua' as a special secret key
            if (value.toLowerCase() === 'watua') {
                setCardError('');
                return;
            }

            if (value && !match) {
                setCardError('Format must be: 063/001/2026');
            } else if (match) {
                const yr = parseInt(match[1], 10);
                const now = new Date().getFullYear();
                setCardError(yr < now ? `Card year ${yr} is expired.` : '');
            } else {
                setCardError('');
            }
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            const res = await api.post('/auth/register', formData);
            setSuccessMsg(res.data.message);
        } catch (err: any) {
            setError(err.response?.data?.error || 'Registration failed. Please check your details.');
        } finally {
            setLoading(false);
        }
    };

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
            <Container maxWidth="sm">
                <Paper
                    elevation={0}
                    sx={{
                        p: { xs: 3, md: 5 },
                        bgcolor: 'background.paper',
                        border: '1px solid rgba(255,255,255,0.08)',
                    }}
                >
                    {/* Header */}
                    <Box display="flex" flexDirection="column" alignItems="center" mb={4}>
                        <Church size={36} color="var(--cyan, #00b4d8)" />
                        <Typography variant="h5" fontWeight="900" mt={1} letterSpacing="-0.04em">
                            Prayer Palace
                        </Typography>
                        <Typography color="textSecondary" variant="caption" letterSpacing={2} textTransform="uppercase">
                            Member Registration
                        </Typography>
                    </Box>

                    {successMsg ? (
                        <Box textAlign="center">
                            <Alert severity="success" sx={{ mb: 3 }}>
                                <Typography variant="body2" fontWeight="bold">Registration Successful!</Typography>
                                <Typography variant="caption" display="block" mt={1}>{successMsg}</Typography>
                            </Alert>
                            <Button fullWidth variant="outlined" component={Link} to="/login" sx={{ textTransform: 'none', fontWeight: 'bold' }}>
                                Go to Login
                            </Button>
                        </Box>
                    ) : (
                        <form onSubmit={handleSubmit} noValidate>
                            {error && (
                                <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError('')}>
                                    {error}
                                </Alert>
                            )}

                            <Typography variant="overline" color="textSecondary" sx={{ letterSpacing: 2 }}>
                                Personal Identity
                            </Typography>
                            <Divider sx={{ mb: 2, borderColor: 'rgba(255,255,255,0.05)' }} />

                            <TextField
                                fullWidth label="Full Names" name="name" required
                                variant="outlined" sx={{ mb: 2 }}
                                value={formData.name} onChange={handleChange}
                                placeholder="e.g. John Doe"
                            />
                            <TextField
                                fullWidth label="National ID Number" name="idNumber" required
                                variant="outlined" sx={{ mb: 2 }}
                                value={formData.idNumber} onChange={handleChange}
                                placeholder="Must be unique"
                                helperText="This is used to verify your identity and cannot be changed."
                            />
                            <Box display="flex" flexDirection={{ xs: 'column', sm: 'row' }} gap={2} mb={2}>
                                <TextField
                                    fullWidth label="Date of Birth" name="dob" type="date" required
                                    variant="outlined"
                                    value={formData.dob} onChange={handleChange}
                                    InputLabelProps={{ shrink: true }}
                                    helperText="Used to assign your department automatically."
                                />
                                <TextField
                                    fullWidth select label="Gender" name="gender" required
                                    variant="outlined"
                                    value={formData.gender} onChange={handleChange}
                                >
                                    {GENDER_OPTIONS.map(opt => (
                                        <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
                                    ))}
                                </TextField>
                            </Box>

                            <Typography variant="overline" color="textSecondary" sx={{ letterSpacing: 2 }}>
                                Membership
                            </Typography>
                            <Divider sx={{ mb: 2, borderColor: 'rgba(255,255,255,0.05)' }} />

                            <TextField
                                fullWidth label="Membership Card Number" name="membershipNumber" required
                                variant="outlined" sx={{ mb: 3 }}
                                value={formData.membershipNumber} onChange={handleChange}
                                placeholder="e.g. 063/001/2026"
                                error={!!cardError}
                                helperText={cardError || 'Format: member/branch/year. This number is also your login key.'}
                            />

                            <Typography variant="overline" color="textSecondary" sx={{ letterSpacing: 2 }}>
                                Contact Information
                            </Typography>
                            <Divider sx={{ mb: 2, borderColor: 'rgba(255,255,255,0.05)' }} />

                            <TextField
                                fullWidth label="Phone Number" name="phoneNumber" required
                                variant="outlined" sx={{ mb: 3 }}
                                value={formData.phoneNumber} onChange={handleChange}
                                placeholder="e.g. +254 712 345 678"
                            />

                            <Button
                                fullWidth size="large" type="submit" variant="contained"
                                disabled={loading}
                                startIcon={<UserPlus size={20} />}
                                sx={{ py: 1.5, fontWeight: 900, textTransform: 'none', fontSize: '1rem' }}
                            >
                                {loading ? 'Registering...' : 'Complete Registration'}
                            </Button>
                        </form>
                    )}

                    <Box mt={3} textAlign="center">
                        <Typography variant="body2" color="textSecondary">
                            Already registered?{' '}
                            <MuiLink component={Link} to="/login" fontWeight="bold">
                                Login with your card
                            </MuiLink>
                        </Typography>
                    </Box>
                </Paper>
            </Container>
        </Box>
    );
}
