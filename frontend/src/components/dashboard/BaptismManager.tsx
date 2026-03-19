import React, { useState } from 'react';
import { 
    Dialog, DialogTitle, DialogContent, Box, Typography, Card, 
    CardContent, Avatar, Chip, Button, IconButton, Tooltip,
    Divider, TextField, MenuItem, Select, FormControl, InputLabel,
    Grid, Alert
} from '@mui/material';
import { 
    Droplet, X, CheckCircle, Clock, CreditCard, Shield, 
    ChevronRight, Info, User
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../lib/api-client';
import { useAuth } from '../../contexts/AuthContext';

const STATUS_FLOW = [
    'PENDING_PASTOR_APPROVAL',
    'ADMIN_PAYMENT_VERIFICATION',
    'BISHOP_RITE_PENDING',
    'COMPLETED'
];

export default function BaptismManager({ open, onClose }: { open: boolean, onClose: () => void }) {
    const { user: authUser } = useAuth();
    const queryClient = useQueryClient();
    const [selectedBaptism, setSelectedBaptism] = useState<any>(null);
    const [plannedDate, setPlannedDate] = useState('');
    const [plannedTime, setPlannedTime] = useState('');
    const [baptismCardNumber, setBaptismCardNumber] = useState('');

    const { data: baptisms = [], isLoading } = useQuery(['baptisms'], async () => {
        const res = await api.get('/workflows/baptism');
        return res.data;
    }, { enabled: open });

    const updateStatusMutation = useMutation(
        async ({ id, status, notes, plannedDate, plannedTime, baptismCardNumber }: any) => {
            return api.patch(`/workflows/baptism/${id}/status`, { status, notes, plannedDate, plannedTime, baptismCardNumber });
        },
        {
            onSuccess: () => {
                queryClient.invalidateQueries(['baptisms']);
                setSelectedBaptism(null);
                setPlannedDate('');
                setPlannedTime('');
                setBaptismCardNumber('');
            }
        }
    );

    const getNextStatus = (currentStatus: string) => {
        const index = STATUS_FLOW.indexOf(currentStatus);
        if (index === -1 || index === STATUS_FLOW.length - 1) return null;
        return STATUS_FLOW[index + 1];
    };

    const canApprove = (baptism: any) => {
        if (!authUser) return false;
        const role = authUser.role;
        const status = baptism.status;

        if (role === 'WATUA' || role === 'SUPER_ADMIN') return true; 
        if ((role === 'PASTOR' || role === 'ASSOCIATE_PASTOR') && status === 'PENDING_PASTOR_APPROVAL') return true;
        if ((role === 'SYSTEM_ADMIN' || role === 'SECRETARY') && status === 'ADMIN_PAYMENT_VERIFICATION') return true;
        if (role === 'SUPER_ADMIN' && status === 'BISHOP_RITE_PENDING') return true;

        return false;
    };

    const getActionLabel = (status: string) => {
        switch (status) {
            case 'PENDING_PASTOR_APPROVAL': return 'PROPOSE SCHEDULE & SEND TO ADMIN';
            case 'ADMIN_PAYMENT_VERIFICATION': return 'VERIFY PAYMENT & SEND TO BISHOP';
            case 'BISHOP_RITE_PENDING': return 'MARK RITE AS COMPLETED';
            default: return 'ADVANCE PHASE';
        }
    };

    return (
        <Dialog 
            open={open} 
            onClose={onClose}
            maxWidth="md"
            fullWidth
            PaperProps={{
                sx: { 
                    bgcolor: 'rgba(16, 20, 32, 0.98)', 
                    backdropFilter: 'blur(20px)',
                    border: '1px solid var(--glass-border)',
                    borderRadius: 3,
                    minHeight: '60vh'
                }
            }}
        >
            <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', p: 3 }}>
                <Box display="flex" alignItems="center" gap={1.5}>
                    <Droplet size={24} color="var(--cyan)" />
                    <Typography variant="h6" fontWeight="950" className="glow-text">BAPTISM SACRAMENT WORKFLOW</Typography>
                </Box>
                <IconButton onClick={onClose} size="small" sx={{ color: 'text.secondary' }}>
                    <X size={22} />
                </IconButton>
            </DialogTitle>

            <DialogContent sx={{ p: 0 }}>
                <Box sx={{ display: 'flex', height: '65vh' }}>
                    {/* List Area */}
                    <Box sx={{ width: '35%', borderRight: '1px solid rgba(255,255,255,0.05)', overflowY: 'auto', p: 2 }}>
                        {baptisms.length === 0 ? (
                            <Box sx={{ textAlign: 'center', py: 8, opacity: 0.5 }}>
                                <Typography variant="body2">No active baptism missions.</Typography>
                            </Box>
                        ) : (
                            baptisms.map((b: any) => (
                                <Card 
                                    key={b.id} 
                                    onClick={() => setSelectedBaptism(b)}
                                    sx={{ 
                                        mb: 1.5, 
                                        cursor: 'pointer',
                                        bgcolor: selectedBaptism?.id === b.id ? 'rgba(0, 200, 255, 0.1)' : 'rgba(255,255,255,0.02)',
                                        border: '1px solid',
                                        borderColor: selectedBaptism?.id === b.id ? 'var(--cyan)' : 'var(--glass-border)',
                                        '&:hover': { bgcolor: 'rgba(255,255,255,0.05)' }
                                    }}
                                >
                                    <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
                                        <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={1}>
                                            <Typography variant="subtitle2" fontWeight="900" noWrap sx={{ maxWidth: '70%' }}>{b.user.name}</Typography>
                                            <Chip 
                                                label={b.status === 'PENDING_PASTOR_APPROVAL' ? 'PASTOR' : b.status === 'ADMIN_PAYMENT_VERIFICATION' ? 'ADMIN' : 'BISHOP'} 
                                                size="small" 
                                                sx={{ 
                                                    fontSize: '0.55rem', 
                                                    fontWeight: 900, 
                                                    height: 18,
                                                    bgcolor: b.status.includes('PASTOR') ? 'rgba(255,152,0,0.1)' : b.status.includes('ADMIN') ? 'rgba(76,175,80,0.1)' : 'rgba(124,58,237,0.1)',
                                                    color: b.status.includes('PASTOR') ? 'orange' : b.status.includes('ADMIN') ? 'success.main' : 'var(--purple)',
                                                    border: '1px solid currentColor'
                                                }} 
                                            />
                                        </Box>
                                        <Typography variant="caption" color="textSecondary" sx={{ display: 'block' }}>{b.user.department?.name || 'General'} Sector</Typography>
                                    </CardContent>
                                </Card>
                            ))
                        )}
                    </Box>

                    {/* Detail Area */}
                    <Box sx={{ width: '65%', p: 4, bgcolor: 'rgba(0,0,0,0.2)', overflowY: 'auto' }}>
                        {selectedBaptism ? (
                            <Box>
                                <Box display="flex" alignItems="center" gap={2} mb={4}>
                                    <Avatar sx={{ width: 64, height: 64, bgcolor: 'var(--cyan)', fontWeight: 900, fontSize: '1.5rem', border: '2px solid rgba(0,200,255,0.3)' }}>
                                        {selectedBaptism.user.name.charAt(0)}
                                    </Avatar>
                                    <Box>
                                        <Typography variant="h5" fontWeight="950" sx={{ letterSpacing: -1 }}>{selectedBaptism.user.name}</Typography>
                                        <Typography variant="body2" color="textSecondary" fontWeight={700}>{selectedBaptism.user.phoneNumber || 'NO CONTACT RECORDED'}</Typography>
                                    </Box>
                                </Box>

                                <Divider sx={{ mb: 4, borderColor: 'rgba(255,255,255,0.05)' }} />

                                <Typography variant="caption" fontWeight="900" color="primary" sx={{ letterSpacing: 2, mb: 1, display: 'block' }}>SACRAMENT PHASE</Typography>
                                <Box sx={{ p: 2, bgcolor: 'rgba(0,200,255,0.05)', borderRadius: 2, mb: 4, border: '1px solid rgba(0,200,255,0.2)' }}>
                                    <Box display="flex" alignItems="center" gap={1.5}>
                                        <Clock size={20} color="var(--cyan)" />
                                        <Typography variant="body1" fontWeight="900" sx={{ color: 'var(--cyan)', letterSpacing: 1 }}>
                                            {selectedBaptism.status.split('_').join(' ')}
                                        </Typography>
                                    </Box>
                                </Box>

                                {selectedBaptism.plannedDate && (
                                    <Box sx={{ mb: 4, p: 2, bgcolor: 'rgba(255,255,255,0.02)', border: '1px solid var(--glass-border)', borderRadius: 2 }}>
                                        <Typography variant="caption" fontWeight="900" sx={{ opacity: 0.5, display: 'block', mb: 1 }}>PLANNED SCHEDULE</Typography>
                                        <Typography variant="body2" fontWeight="800" sx={{ color: 'var(--orange)' }}>
                                            {new Date(selectedBaptism.plannedDate).toLocaleDateString()} — {selectedBaptism.plannedTime}
                                        </Typography>
                                        {selectedBaptism.baptismCardNumber && (
                                            <Typography variant="caption" sx={{ color: 'var(--cyan)', mt: 1, display: 'block', fontWeight: 900 }}>CARD NO: {selectedBaptism.baptismCardNumber}</Typography>
                                        )}
                                    </Box>
                                )}

                                {canApprove(selectedBaptism) ? (
                                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                                        {selectedBaptism.status === 'PENDING_PASTOR_APPROVAL' && (
                                            <Grid container spacing={2}>
                                                <Grid item xs={6}>
                                                    <TextField
                                                        fullWidth
                                                        type="date"
                                                        label="Planned Date"
                                                        value={plannedDate}
                                                        onChange={(e) => setPlannedDate(e.target.value)}
                                                        InputLabelProps={{ shrink: true }}
                                                        inputProps={{ min: new Date().toISOString().split('T')[0] }}
                                                        sx={{ '& .MuiInputBase-root': { borderRadius: 2, bgcolor: 'rgba(255,255,255,0.02)' } }}
                                                    />
                                                </Grid>
                                                <Grid item xs={6}>
                                                    <TextField
                                                        fullWidth
                                                        type="time"
                                                        label="Planned Time"
                                                        value={plannedTime}
                                                        onChange={(e) => setPlannedTime(e.target.value)}
                                                        InputLabelProps={{ shrink: true }}
                                                        sx={{ '& .MuiInputBase-root': { borderRadius: 2, bgcolor: 'rgba(255,255,255,0.02)' } }}
                                                    />
                                                </Grid>
                                            </Grid>
                                        )}

                                        {selectedBaptism.status === 'ADMIN_PAYMENT_VERIFICATION' && (
                                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                                <Alert icon={<CreditCard size={18} />} severity="info" sx={{ bgcolor: 'rgba(0,200,255,0.05)', color: 'var(--cyan)', border: '1px solid rgba(0,200,255,0.2)', borderRadius: 2 }}>
                                                    <Typography variant="caption" fontWeight={900}>Confirm card payment before advancing to Bishop's final review.</Typography>
                                                </Alert>
                                                <TextField
                                                    fullWidth
                                                    label="Baptism Card Number"
                                                    value={baptismCardNumber}
                                                    onChange={(e) => setBaptismCardNumber(e.target.value)}
                                                    sx={{ '& .MuiInputBase-root': { borderRadius: 2, bgcolor: 'rgba(255,255,255,0.02)' } }}
                                                />
                                            </Box>
                                        )}

                                        <Button 
                                            fullWidth 
                                            variant="contained" 
                                            size="large"
                                            onClick={() => updateStatusMutation.mutate({ 
                                                id: selectedBaptism.id, 
                                                status: getNextStatus(selectedBaptism.status)!,
                                                plannedDate,
                                                plannedTime,
                                                baptismCardNumber
                                            })}
                                            disabled={updateStatusMutation.isLoading || 
                                                (selectedBaptism.status === 'PENDING_PASTOR_APPROVAL' && (!plannedDate || !plannedTime)) ||
                                                (selectedBaptism.status === 'ADMIN_PAYMENT_VERIFICATION' && !baptismCardNumber)
                                            }
                                            sx={{ 
                                                py: 2, fontWeight: 950, letterSpacing: 1,
                                                bgcolor: 'var(--primary)',
                                                boxShadow: '0 8px 32px rgba(79, 139, 255, 0.3)',
                                                '&:hover': { bgcolor: 'var(--primary-hover)', transform: 'translateY(-2px)' }
                                            }}
                                        >
                                            {getActionLabel(selectedBaptism.status)}
                                        </Button>
                                    </Box>
                                ) : (
                                    <Box sx={{ p: 3, bgcolor: 'rgba(255,0,0,0.05)', border: '1px solid rgba(255,0,0,0.2)', borderRadius: 2, display: 'flex', gap: 2 }}>
                                        <Shield size={24} color="#f44336" />
                                        <Box>
                                            <Typography variant="caption" fontWeight="950" color="error" sx={{ letterSpacing: 2 }}>AUTHORIZATION REQUIRED</Typography>
                                            <Typography variant="body2" color="textSecondary" sx={{ mt: 0.5, fontWeight: 600 }}>
                                                Current phase must be cleared by {selectedBaptism.status.includes('PASTOR') ? 'PASTORAL' : selectedBaptism.status.includes('ADMIN') ? 'ADMINISTRATIVE' : 'EPISCOPAL'} AUTHORITY.
                                            </Typography>
                                        </Box>
                                    </Box>
                                )}
                            </Box>
                        ) : (
                            <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', opacity: 0.3 }}>
                                <Info size={48} />
                                <Typography variant="body1" mt={2} fontWeight="700">Select a request to manage</Typography>
                            </Box>
                        )}
                    </Box>
                </Box>
            </DialogContent>
        </Dialog>
    );
}
