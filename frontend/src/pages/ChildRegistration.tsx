import React, { useState } from 'react';
import {
    Container, Paper, TextField, Button, Typography, Box,
    Alert, MenuItem, Divider, CircularProgress, IconButton, Grid,
    FormControlLabel, Switch, Collapse, Card
} from '@mui/material';
import { UserPlus, Baby, ArrowLeft, Plus, ShieldCheck, Heart } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../lib/api-client';
import DashboardLayout from '../components/layout/DashboardLayout';
import { Stack } from '@mui/material';

const GENDER_OPTIONS = [
    { value: 'MALE', label: 'MALE' },
    { value: 'FEMALE', label: 'FEMALE' },
];

const BRANCH_OPTIONS = [
    { value: 'HQ', label: 'HEADQUARTERS (HQ)' },
    { value: 'ELDORET', label: 'ELDORET' },
    { value: 'BUNGOMA', label: 'BUNGOMA' },
    { value: 'NAIVASHA', label: 'NAIVASHA' },
    { value: 'NAIROBI', label: 'NAIROBI REGION' },
];

export default function ChildRegistration() {
    const [name, setName] = useState('');
    const [dob, setDob] = useState('');
    const [gender, setGender] = useState('');
    const [branch, setBranch] = useState('HQ');
    const [isDedicated, setIsDedicated] = useState(false);
    const [dedicationCardNumber, setDedicationCardNumber] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);
    const [dedicationNumber, setDedicationNumber] = useState('');

    const navigate = useNavigate();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        const localId = `TEMP-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
        setDedicationNumber(localId);

        try {
            const res = await api.post('/children', { 
                name, dob, gender, branch, 
                isDedicated, dedicationCardNumber,
                localId // Pass to sync engine via api-client
            });

            if (res.data._queued) {
                console.log('[Palace-Portal] Mission queued offline:', localId);
            } else {
                setDedicationNumber(res.data.child.dedicationNumber);
            }
            setSuccess(true);
            // Reset form
            setName('');
            setDob('');
            setGender('');
            setIsDedicated(false);
            setDedicationCardNumber('');
        } catch (err: any) {
            setError(err.response?.data?.error || 'Failed to register child. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    if (success) {
        return (
            <Container maxWidth="sm" sx={{ py: 8 }}>
                <Paper className="holographic-card" sx={{ p: 4, textAlign: 'center', bgcolor: 'background.paper', border: '1px solid var(--cyan)' }}>
                    <Typography variant="h4" fontWeight="950" gutterBottom className="glow-text">
                        {dedicationNumber.startsWith('TEMP-') ? 'REGISTRATION QUEUED' : 'REGISTRATION SECURED'}
                    </Typography>
                    <Typography color="textSecondary" sx={{ mb: 3, fontWeight: 500 }}>
                        {dedicationNumber.startsWith('TEMP-') 
                            ? 'Your mission has been queued locally and will sync once connectivity returns.'
                            : 'Your child has been successfully integrated into the ministry registry.'}
                    </Typography>

                    <Box sx={{ bgcolor: 'rgba(0,180,216,0.1)', p: 3, borderRadius: 0, mb: 4, border: '1px dashed var(--cyan)' }}>
                        <Typography variant="caption" color="var(--cyan)" sx={{ letterSpacing: 2, fontWeight: 900 }}>
                            {dedicationNumber.startsWith('TEMP-') ? 'OFFLINE TRACKING ID' : 'MINISTRY TRACKING ID'}
                        </Typography>
                        <Typography variant="h4" fontWeight="900" sx={{ mt: 1, letterSpacing: -1 }}>
                            {dedicationNumber}
                        </Typography>
                    </Box>

                    <Stack spacing={2}>
                        <Button 
                            variant="contained" 
                            fullWidth 
                            startIcon={<Plus size={20} />}
                            onClick={() => setSuccess(false)}
                            sx={{ py: 1.5, fontWeight: 950, borderRadius: 0 }}
                        >
                            REGISTER ANOTHER
                        </Button>
                        <Button 
                            variant="outlined" 
                            fullWidth 
                            onClick={() => navigate('/')}
                            sx={{ py: 1.5, fontWeight: 950, borderRadius: 0, borderColor: 'var(--glass-border)' }}
                        >
                            BACK TO PRAYER PALACE PORTAL
                        </Button>
                    </Stack>
                </Paper>
            </Container>
        );
    }

    return (
        <DashboardLayout>
            <Container maxWidth="md" sx={{ py: 4 }}>
                <Box display="flex" alignItems="center" gap={2} mb={6}>
                    <IconButton onClick={() => navigate(-1)} sx={{ color: 'var(--cyan)', bgcolor: 'rgba(0,180,216,0.1)' }}>
                        <ArrowLeft size={22} />
                    </IconButton>
                    <Box>
                        <Typography variant="h3" fontWeight="950" className="glow-text" sx={{ letterSpacing: -2 }}>
                            FAMILY <span className="text-cyan/70">REGISTRY</span>
                        </Typography>
                        <Typography variant="subtitle2" color="textSecondary" sx={{ fontWeight: 800 }}>
                            ENLISTING THE NEXT GENERATION OF BELIEVERS
                        </Typography>
                    </Box>
                </Box>

                <Grid container spacing={4}>
                    <Grid item xs={12} md={7}>
                        <Paper className="holographic-card" sx={{ p: 4 }}>
                            <form onSubmit={handleSubmit}>
                                <Stack spacing={3}>
                                    <TextField
                                        fullWidth label="FULL NAME" value={name}
                                        onChange={e => setName(e.target.value)}
                                        required placeholder="Child's full legal name"
                                    />

                                    <Grid container spacing={2}>
                                        <Grid item xs={12} sm={6}>
                                            <TextField
                                                fullWidth label="DATE OF BIRTH" type="date"
                                                value={dob} onChange={e => setDob(e.target.value)}
                                                required InputLabelProps={{ shrink: true }}
                                                helperText="Age determines mapping"
                                            />
                                        </Grid>
                                        <Grid item xs={12} sm={6}>
                                            <TextField
                                                fullWidth select label="GENDER" value={gender}
                                                onChange={e => setGender(e.target.value)}
                                                required
                                            >
                                                {GENDER_OPTIONS.map(opt => (
                                                    <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
                                                ))}
                                            </TextField>
                                        </Grid>
                                    </Grid>

                                    <TextField
                                        fullWidth select label="CHURCH BRANCH" value={branch}
                                        onChange={e => setBranch(e.target.value)}
                                        required
                                    >
                                        {BRANCH_OPTIONS.map(opt => (
                                            <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
                                        ))}
                                    </TextField>

                                    <Divider sx={{ opacity: 0.1 }} />

                                    <Box sx={{ p: 2, bgcolor: 'rgba(255,255,255,0.02)', border: '1px solid var(--glass-border)' }}>
                                        <FormControlLabel
                                            control={
                                                <Switch 
                                                    checked={isDedicated} 
                                                    onChange={e => setIsDedicated(e.target.checked)}
                                                    color="primary"
                                                />
                                            }
                                            label={<Typography variant="subtitle2" fontWeight="950">HAS BEEN DEDICATED?</Typography>}
                                        />
                                        
                                        <Collapse in={isDedicated}>
                                            <TextField
                                                fullWidth label="DEDICATION CARD NUMBER" 
                                                value={dedicationCardNumber}
                                                onChange={e => setDedicationCardNumber(e.target.value)}
                                                sx={{ mt: 2 }}
                                                placeholder="Enter Card ID (if available)"
                                            />
                                        </Collapse>

                                        {!isDedicated && (
                                            <Box sx={{ mt: 2, p: 2, bgcolor: 'rgba(79, 139, 255, 0.05)', border: '1px solid var(--primary-glow)' }}>
                                                <Typography variant="caption" color="primary" sx={{ fontWeight: 900, display: 'flex', alignItems: 'center', gap: 1 }}>
                                                    <Heart size={14} /> DEDICATION REQUEST WILL BE INITIATED
                                                </Typography>
                                            </Box>
                                        )}
                                    </Box>

                                    {error && <Alert severity="error" sx={{ bgcolor: 'rgba(211, 47, 47, 0.1)', color: '#ffbaba', border: '1px solid #d32f2f' }}>{error}</Alert>}

                                    <Button
                                        fullWidth size="large" type="submit" variant="contained"
                                        disabled={loading}
                                        startIcon={loading ? <CircularProgress size={20} /> : <UserPlus size={20} />}
                                        sx={{ py: 2, fontWeight: 950, borderRadius: 0, fontSize: '1rem', boxShadow: '0 0 20px var(--primary-glow)' }}
                                    >
                                        {loading ? 'SYNCING...' : 'SECURE REGISTRATION'}
                                    </Button>
                                </Stack>
                            </form>
                        </Paper>
                    </Grid>

                    <Grid item xs={12} md={5}>
                        <Stack spacing={3}>
                            <Card className="holographic-card" sx={{ p: 3, bgcolor: 'rgba(0,180,216,0.05)' }}>
                                <Box display="flex" alignItems="center" gap={2} mb={2}>
                                    <ShieldCheck size={24} color="var(--cyan)" />
                                    <Typography variant="h6" fontWeight="950">MAPPING INTEL</Typography>
                                </Box>
                                <Typography variant="body2" sx={{ opacity: 0.7, lineHeight: 1.6, mb: 3 }}>
                                    Children are automatically assigned to tactical spiritual units based on their chronological age:
                                </Typography>
                                <Stack spacing={1.5}>
                                    {[
                                        { range: '0-3 YRS', unit: 'CRADLE ROLL' },
                                        { range: '4-12 YRS', unit: 'Rising star generation' },
                                        { range: '14-19 YRS', unit: '3 SixTeen Generation' },
                                        { range: '20+ YRS', unit: 'Royal Tribe of Light' },
                                    ].map((unit, i) => (
                                        <Box key={i} display="flex" justifyContent="space-between" sx={{ p: 1, borderBottom: '1px solid var(--glass-border)' }}>
                                            <Typography variant="caption" fontWeight="950">{unit.range}</Typography>
                                            <Typography variant="caption" color="var(--cyan)" fontWeight="950">{unit.unit}</Typography>
                                        </Box>
                                    ))}
                                </Stack>
                            </Card>

                            <Card sx={{ p: 3, background: 'linear-gradient(rich-black, #1a1c24)', border: '1px solid var(--glass-border)' }}>
                                <Typography variant="h6" fontWeight="950" mb={1}>REGISTRY POLICY</Typography>
                                <Typography variant="body2" sx={{ opacity: 0.6, fontSize: '0.8rem' }}>
                                    Registration securely maps children to their parents profile for unified family health oversight and direct communication from department leaders.
                                </Typography>
                            </Card>
                        </Stack>
                    </Grid>
                </Grid>
            </Container>
        </DashboardLayout>
    );
}
