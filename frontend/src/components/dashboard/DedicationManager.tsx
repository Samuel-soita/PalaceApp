import React, { useState } from 'react';
import { 
    Dialog, DialogTitle, DialogContent, Box, Typography, Card, 
    CardContent, Avatar, Chip, Button, IconButton, 
    Divider, Grid, Alert, TextField
} from '@mui/material';
import { 
    Baby, X, CheckCircle, Clock as ClockIcon, Shield as ShieldIcon, 
    User, ArrowRight, Info, CreditCard
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../lib/api-client';
import { useAuth } from '../../contexts/AuthContext';

const DEDICATION_FLOW = [
    'PENDING_DEDICATION',
    'ADMIN_PAYMENT_VERIFICATION',
    'BISHOP_RITE_PENDING',
    'DEDICATED'
];

export default function DedicationManager({ open, onClose }: { open: boolean, onClose: () => void }) {
    const { user: authUser } = useAuth();
    const queryClient = useQueryClient();
    const [selectedChild, setSelectedChild] = useState<any>(null);
    const [plannedDate, setPlannedDate] = useState('');
    const [plannedTime, setPlannedTime] = useState('');
    const [dedicationCardNumber, setDedicationCardNumber] = useState('');

    const { data: children = [], isLoading } = useQuery(['all-children'], async () => {
        const res = await api.get('/children');
        return res.data.data || [];
    }, { enabled: open });

    const pendingDedication = children.filter((c: any) => c.workflowStatus !== 'DEDICATED');

    const updateStatusMutation = useMutation(
        async ({ id, workflowStatus, plannedDate, plannedTime, dedicationCardNumber }: any) => {
            return api.patch(`/workflows/dedication/${id}/status`, { workflowStatus, plannedDate, plannedTime, dedicationCardNumber });
        },
        {
            onSuccess: () => {
                queryClient.invalidateQueries(['all-children']);
                setSelectedChild(null);
                setPlannedDate('');
                setPlannedTime('');
                setDedicationCardNumber('');
            }
        }
    );

    const getNextStatus = (currentStatus: string) => {
        const index = DEDICATION_FLOW.indexOf(currentStatus);
        if (index === -1 || index === DEDICATION_FLOW.length - 1) return null;
        return DEDICATION_FLOW[index + 1];
    };

    const canApprove = (child: any) => {
        if (!authUser) return false;
        const role = authUser.role;
        const status = child.workflowStatus;

        if (role === 'WATUA' || role === 'SUPER_ADMIN') return true;
        if ((role === 'PASTOR' || role === 'ASSOCIATE_PASTOR') && status === 'PENDING_DEDICATION') return true;
        if ((role === 'SYSTEM_ADMIN' || role === 'SECRETARY') && status === 'ADMIN_PAYMENT_VERIFICATION') return true;
        if (role === 'SUPER_ADMIN' && status === 'BISHOP_RITE_PENDING') return true;

        return false;
    };

    const getActionLabel = (status: string) => {
        switch (status) {
            case 'PENDING_DEDICATION': return 'PROPOSE SCHEDULE & SEND TO ADMIN';
            case 'ADMIN_PAYMENT_VERIFICATION': return 'VERIFY PAYMENT & SEND TO BISHOP';
            case 'BISHOP_RITE_PENDING': return 'MARK AS DEDICATED';
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
                    <Baby size={24} color="orange" />
                    <Typography variant="h6" fontWeight="950" className="glow-text">CHILD DEDICATION MISSION CONTROL</Typography>
                </Box>
                <IconButton onClick={onClose} size="small" sx={{ color: 'text.secondary' }}>
                    <X size={22} />
                </IconButton>
            </DialogTitle>

            <DialogContent sx={{ p: 0 }}>
                <Box sx={{ display: 'flex', height: '65vh' }}>
                    {/* List Area */}
                    <Box sx={{ width: '35%', borderRight: '1px solid rgba(255,255,255,0.05)', overflowY: 'auto', p: 2 }}>
                        {pendingDedication.length === 0 ? (
                            <Box sx={{ textAlign: 'center', py: 8, opacity: 0.5 }}>
                                <Typography variant="body2">No pending child dedications.</Typography>
                            </Box>
                        ) : (
                            pendingDedication.map((c: any) => (
                                <Card 
                                    key={c.id} 
                                    onClick={() => setSelectedChild(c)}
                                    sx={{ 
                                        mb: 1.5, 
                                        cursor: 'pointer',
                                        bgcolor: selectedChild?.id === c.id ? 'rgba(255, 152, 0, 0.1)' : 'rgba(255,255,255,0.02)',
                                        border: '1px solid',
                                        borderColor: selectedChild?.id === c.id ? 'orange' : 'var(--glass-border)',
                                        '&:hover': { bgcolor: 'rgba(255,255,255,0.05)' }
                                    }}
                                >
                                    <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
                                        <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={1}>
                                            <Typography variant="subtitle2" fontWeight="900" noWrap sx={{ maxWidth: '70%' }}>{c.name}</Typography>
                                            <Chip 
                                                label={c.workflowStatus === 'PENDING_DEDICATION' ? 'PASTOR' : c.workflowStatus === 'ADMIN_PAYMENT_VERIFICATION' ? 'ADMIN' : 'BISHOP'} 
                                                size="small" 
                                                sx={{ 
                                                    fontSize: '0.55rem', 
                                                    fontWeight: 900, 
                                                    height: 18,
                                                    bgcolor: c.workflowStatus.includes('PENDING') ? 'rgba(255,152,0,0.1)' : c.workflowStatus.includes('ADMIN') ? 'rgba(76,175,80,0.1)' : 'rgba(124,58,237,0.1)',
                                                    color: c.workflowStatus.includes('PENDING') ? 'orange' : c.workflowStatus.includes('ADMIN') ? 'success.main' : 'var(--purple)',
                                                    border: '1px solid currentColor'
                                                }} 
                                            />
                                        </Box>
                                        <Typography variant="caption" color="textSecondary" sx={{ display: 'block' }}>Reg No: {c.dedicationNumber || c.idNumber}</Typography>
                                    </CardContent>
                                </Card>
                            ))
                        )}
                    </Box>

                    {/* Detail Area */}
                    <Box sx={{ width: '65%', p: 4, bgcolor: 'rgba(0,0,0,0.2)', overflowY: 'auto' }}>
                        {selectedChild ? (
                            <Box>
                                <Box display="flex" alignItems="center" gap={2} mb={4}>
                                    <Avatar sx={{ width: 64, height: 64, bgcolor: 'orange', fontWeight: 900, fontSize: '1.5rem', border: '2px solid rgba(255,152,0,0.3)' }}>
                                        {selectedChild.name.charAt(0)}
                                    </Avatar>
                                    <Box>
                                        <Typography variant="h5" fontWeight="950" sx={{ letterSpacing: -1 }}>{selectedChild.name}</Typography>
                                        <Typography variant="body2" color="textSecondary" fontWeight={700}>BORN: {new Date(selectedChild.dob).toLocaleDateString()}</Typography>
                                    </Box>
                                </Box>

                                <Divider sx={{ mb: 4, borderColor: 'rgba(255,255,255,0.05)' }} />

                                <Typography variant="caption" fontWeight="900" color="primary" sx={{ letterSpacing: 2, mb: 1, display: 'block' }}>MISSION STATUS</Typography>
                                <Box sx={{ p: 2, bgcolor: 'rgba(255,152,0,0.05)', borderRadius: 2, mb: 4, border: '1px solid rgba(255,152,0,0.2)' }}>
                                    <Box display="flex" alignItems="center" gap={1.5}>
                                        <ClockIcon size={20} color="orange" />
                                        <Typography variant="body1" fontWeight="900" sx={{ color: 'orange', letterSpacing: 1 }}>
                                            {selectedChild.workflowStatus.split('_').join(' ')}
                                        </Typography>
                                    </Box>
                                </Box>

                                {selectedChild.plannedDate && (
                                    <Box sx={{ mb: 4, p: 2, bgcolor: 'rgba(255,255,255,0.02)', border: '1px solid var(--glass-border)', borderRadius: 2 }}>
                                        <Typography variant="caption" fontWeight="900" sx={{ opacity: 0.5, display: 'block', mb: 1 }}>PLANNED SCHEDULE</Typography>
                                        <Typography variant="body2" fontWeight="800" sx={{ color: 'var(--cyan)' }}>
                                            {new Date(selectedChild.plannedDate).toLocaleDateString()} — {selectedChild.plannedTime}
                                        </Typography>
                                    </Box>
                                )}

                                {canApprove(selectedChild) ? (
                                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                                        {selectedChild.workflowStatus === 'PENDING_DEDICATION' && (
                                            <Grid container spacing={2}>
                                                <Grid item xs={6}>
                                                    <TextField
                                                        fullWidth
                                                        type="date"
                                                        label="Planned Date"
                                                        value={plannedDate}
                                                        onChange={(e) => setPlannedDate(e.target.value)}
                                                        InputLabelProps={{ shrink: true }}
                                                        sx={{ '& .MuiInputBase-root': { borderRadius: 2, bgcolor: 'rgba(255,255,255,0.02)' } }}
                                                    />
                                                </Grid>
                                                <Grid item xs={6}>
                                                    <TextField
                                                        fullWidth
                                                        label="Planned Time"
                                                        placeholder="e.g. 11:30 AM"
                                                        value={plannedTime}
                                                        onChange={(e) => setPlannedTime(e.target.value)}
                                                        sx={{ '& .MuiInputBase-root': { borderRadius: 2, bgcolor: 'rgba(255,255,255,0.02)' } }}
                                                    />
                                                </Grid>
                                            </Grid>
                                        )}

                                        {selectedChild.workflowStatus === 'ADMIN_PAYMENT_VERIFICATION' && (
                                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                                <Alert icon={<CreditCard size={18} />} severity="warning" sx={{ bgcolor: 'rgba(255,152,0,0.05)', color: 'orange', border: '1px solid rgba(255,152,0,0.2)', borderRadius: 2 }}>
                                                    <Typography variant="caption" fontWeight={900}>Verify card payment and issue Dedication Number below.</Typography>
                                                </Alert>
                                                <TextField
                                                    fullWidth
                                                    label="Dedication Card Number"
                                                    value={dedicationCardNumber}
                                                    onChange={(e) => setDedicationCardNumber(e.target.value)}
                                                    sx={{ '& .MuiInputBase-root': { borderRadius: 2, bgcolor: 'rgba(255,255,255,0.02)' } }}
                                                />
                                            </Box>
                                        )}

                                        <Button 
                                            fullWidth 
                                            variant="contained" 
                                            size="large"
                                            onClick={() => updateStatusMutation.mutate({ 
                                                id: selectedChild.id, 
                                                workflowStatus: getNextStatus(selectedChild.workflowStatus)!,
                                                plannedDate,
                                                plannedTime,
                                                dedicationCardNumber
                                            })}
                                            disabled={updateStatusMutation.isLoading || 
                                                (selectedChild.workflowStatus === 'PENDING_DEDICATION' && (!plannedDate || !plannedTime)) ||
                                                (selectedChild.workflowStatus === 'ADMIN_PAYMENT_VERIFICATION' && !dedicationCardNumber)
                                            }
                                            sx={{ 
                                                py: 2, fontWeight: 950, letterSpacing: 1,
                                                bgcolor: 'orange',
                                                color: 'black',
                                                boxShadow: '0 8px 32px rgba(255, 152, 0, 0.3)',
                                                '&:hover': { bgcolor: '#f57c00', transform: 'translateY(-2px)' }
                                            }}
                                        >
                                            {getActionLabel(selectedChild.workflowStatus)}
                                        </Button>
                                    </Box>
                                ) : (
                                    <Box sx={{ p: 3, bgcolor: 'rgba(255,0,0,0.05)', border: '1px solid rgba(255,0,0,0.2)', borderRadius: 2, display: 'flex', gap: 2 }}>
                                        <ShieldIcon size={24} color="#f44336" />
                                        <Box>
                                            <Typography variant="caption" fontWeight="950" color="error" sx={{ letterSpacing: 2 }}>AUTHORIZATION REQUIRED</Typography>
                                            <Typography variant="body2" color="textSecondary" sx={{ mt: 0.5, fontWeight: 600 }}>
                                                Verification requires elevation to {selectedChild.workflowStatus.includes('PENDING') ? 'PASTORAL' : selectedChild.workflowStatus.includes('ADMIN') ? 'ADMINISTRATIVE' : 'EPISCOPAL'} AUTHORITY.
                                            </Typography>
                                        </Box>
                                    </Box>
                                )}
                            </Box>
                        ) : (
                            <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', opacity: 0.3 }}>
                                <Info size={48} />
                                <Typography variant="body1" mt={2} fontWeight="700">Select child for dedication tracking</Typography>
                            </Box>
                        )}
                    </Box>
                </Box>
            </DialogContent>
        </Dialog>
    );
}
