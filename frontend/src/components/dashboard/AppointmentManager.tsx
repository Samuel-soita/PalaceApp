import React, { useState } from 'react';
import { 
    Dialog, DialogTitle, DialogContent, Box, Typography, Card, 
    CardContent, Avatar, Chip, Button, IconButton, Tooltip,
    Divider, TextField, Grid, Alert
} from '@mui/material';
import { 
    Calendar, X, CheckCircle, Clock, Shield, 
    ChevronRight, Info, MessageSquare, UserCheck
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../lib/api-client';
import { useAuth } from '../../contexts/AuthContext';

export default function AppointmentManager({ open, onClose }: { open: boolean, onClose: () => void }) {
    const { user: authUser } = useAuth();
    const queryClient = useQueryClient();
    const [selectedAppointment, setSelectedAppointment] = useState<any>(null);
    const [approvedDate, setApprovedDate] = useState('');
    const [approvedTime, setApprovedTime] = useState('');
    const [adminNotes, setAdminNotes] = useState('');

    const { data: appointments = [], isLoading } = useQuery(['appointments-all'], async () => {
        const res = await api.get('/appointments/all');
        return res.data;
    }, { enabled: open });

    const updateStatusMutation = useMutation(
        async ({ id, status, approvedDate, approvedTime, adminNotes }: any) => {
            return api.patch(`/appointments/${id}/status`, { status, approvedDate, approvedTime, adminNotes });
        },
        {
            onSuccess: () => {
                queryClient.invalidateQueries(['appointments-all']);
                setSelectedAppointment(null);
                setApprovedDate('');
                setApprovedTime('');
                setAdminNotes('');
            }
        }
    );

    const canApprove = (appointment: any) => {
        if (!authUser) return false;
        const role = authUser.role;
        
        // WATUA and SYSTEM_ADMIN can approve anything
        if (role === 'WATUA' || role === 'SYSTEM_ADMIN' || role === 'SECRETARY' || role === 'SUPER_ADMIN') return true;
        
        // Target pastor can approve their own
        if (appointment.targetId === authUser.id) return true;
        
        // Sector pastors can approve appointments for their role
        if (role === 'PASTOR' && appointment.targetRole === 'PASTOR') return true;
        if (role === 'ASSOCIATE_PASTOR' && appointment.targetRole === 'ASSOCIATE_PASTOR') return true;

        return false;
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
                    <Calendar size={24} color="var(--primary)" />
                    <Typography variant="h6" fontWeight="950" className="glow-text">APPOINTMENT SACRAMENT OVERSIGHT</Typography>
                </Box>
                <IconButton onClick={onClose} size="small" sx={{ color: 'text.secondary' }}>
                    <X size={22} />
                </IconButton>
            </DialogTitle>

            <DialogContent sx={{ p: 0 }}>
                <Box sx={{ display: 'flex', height: '65vh' }}>
                    {/* List Area */}
                    <Box sx={{ width: '35%', borderRight: '1px solid rgba(255,255,255,0.05)', overflowY: 'auto', p: 2 }}>
                        {appointments.length === 0 ? (
                            <Box sx={{ textAlign: 'center', py: 8, opacity: 0.5 }}>
                                <Typography variant="body2">No pending appointments.</Typography>
                            </Box>
                        ) : (
                            appointments.map((a: any) => (
                                <Card 
                                    key={a.id} 
                                    onClick={() => {
                                        setSelectedAppointment(a);
                                        if (a.status === 'APPROVED') {
                                            setApprovedDate(a.approvedDate?.split('T')[0] || '');
                                            setApprovedTime(a.approvedTime || '');
                                            setAdminNotes(a.adminNotes || '');
                                        }
                                    }}
                                    sx={{ 
                                        mb: 1.5, 
                                        cursor: 'pointer',
                                        bgcolor: selectedAppointment?.id === a.id ? 'rgba(79, 139, 255, 0.1)' : 'rgba(255,255,255,0.02)',
                                        border: '1px solid',
                                        borderColor: selectedAppointment?.id === a.id ? 'var(--primary)' : 'var(--glass-border)',
                                        '&:hover': { bgcolor: 'rgba(255,255,255,0.05)' }
                                    }}
                                >
                                    <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
                                        <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={1}>
                                            <Typography variant="subtitle2" fontWeight="900" noWrap sx={{ maxWidth: '70%' }}>{a.member.name}</Typography>
                                            <Chip 
                                                label={a.status} 
                                                size="small" 
                                                sx={{ 
                                                    fontSize: '0.55rem', 
                                                    fontWeight: 900, 
                                                    height: 18,
                                                    bgcolor: a.status === 'PENDING' ? 'rgba(255,152,0,0.1)' : 'rgba(76,175,80,0.1)',
                                                    color: a.status === 'PENDING' ? 'orange' : 'success.main',
                                                    border: '1px solid currentColor'
                                                }} 
                                            />
                                        </Box>
                                        <Typography variant="caption" color="textSecondary" sx={{ display: 'block' }}>{a.type} · {a.targetRole}</Typography>
                                    </CardContent>
                                </Card>
                            ))
                        )}
                    </Box>

                    {/* Detail Area */}
                    <Box sx={{ width: '65%', p: 4, bgcolor: 'rgba(0,0,0,0.2)', overflowY: 'auto' }}>
                        {selectedAppointment ? (
                            <Box>
                                <Box display="flex" alignItems="center" gap={2} mb={4}>
                                    <Avatar sx={{ width: 64, height: 64, bgcolor: 'var(--primary)', fontWeight: 900, fontSize: '1.5rem', border: '2px solid rgba(79,139,255,0.3)' }}>
                                        {selectedAppointment.member.name.charAt(0)}
                                    </Avatar>
                                    <Box>
                                        <Typography variant="h5" fontWeight="950" sx={{ letterSpacing: -1 }}>{selectedAppointment.member.name}</Typography>
                                        <Typography variant="body2" color="textSecondary" fontWeight={700}>MEMBERSHIP: {selectedAppointment.member.membershipNumber}</Typography>
                                    </Box>
                                </Box>

                                <Divider sx={{ mb: 4, borderColor: 'rgba(255,255,255,0.05)' }} />

                                <Grid container spacing={3} mb={4}>
                                    <Grid item xs={12}>
                                        <Typography variant="caption" fontWeight="900" color="primary" sx={{ letterSpacing: 2, mb: 1, display: 'block' }}>REQUEST DETAILS</Typography>
                                        <Typography variant="body2" fontWeight={600} sx={{ p: 2, bgcolor: 'rgba(255,255,255,0.03)', borderRadius: 2, border: '1px solid var(--glass-border)' }}>
                                            {selectedAppointment.reason}
                                        </Typography>
                                    </Grid>
                                    <Grid item xs={6}>
                                        <Typography variant="caption" fontWeight="900" sx={{ opacity: 0.5, display: 'block', mb: 1 }}>PREFERRED DATE</Typography>
                                        <Box display="flex" alignItems="center" gap={1}>
                                            <Calendar size={14} color="var(--primary)" />
                                            <Typography variant="body2" fontWeight={800}>
                                                {new Date(selectedAppointment.preferredDate).toLocaleDateString()}
                                            </Typography>
                                        </Box>
                                    </Grid>
                                    <Grid item xs={6}>
                                        <Typography variant="caption" fontWeight="900" sx={{ opacity: 0.5, display: 'block', mb: 1 }}>PREFERRED TIME</Typography>
                                        <Box display="flex" alignItems="center" gap={1}>
                                            <Clock size={14} color="var(--primary)" />
                                            <Typography variant="body2" fontWeight={800}>{selectedAppointment.preferredTime}</Typography>
                                        </Box>
                                    </Grid>
                                </Grid>

                                {canApprove(selectedAppointment) ? (
                                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                                        <Typography variant="caption" fontWeight="900" color="primary" sx={{ letterSpacing: 2, mb: -1, display: 'block' }}>OFFICIAL SCHEDULING</Typography>
                                        <Grid container spacing={2}>
                                            <Grid item xs={6}>
                                                <TextField
                                                    fullWidth
                                                    type="date"
                                                    label="Authorized Date"
                                                    value={approvedDate}
                                                    onChange={(e) => setApprovedDate(e.target.value)}
                                                    InputLabelProps={{ shrink: true }}
                                                    sx={{ '& .MuiInputBase-root': { borderRadius: 2, bgcolor: 'rgba(255,255,255,0.02)' } }}
                                                />
                                            </Grid>
                                            <Grid item xs={6}>
                                                <TextField
                                                    fullWidth
                                                    label="Authorized Time"
                                                    placeholder="e.g. 2:30 PM"
                                                    value={approvedTime}
                                                    onChange={(e) => setApprovedTime(e.target.value)}
                                                    sx={{ '& .MuiInputBase-root': { borderRadius: 2, bgcolor: 'rgba(255,255,255,0.02)' } }}
                                                />
                                            </Grid>
                                            <Grid item xs={12}>
                                                <TextField
                                                    fullWidth
                                                    multiline
                                                    rows={2}
                                                    label="Executive Notes"
                                                    placeholder="Instructions for the member..."
                                                    value={adminNotes}
                                                    onChange={(e) => setAdminNotes(e.target.value)}
                                                    sx={{ '& .MuiInputBase-root': { borderRadius: 2, bgcolor: 'rgba(255,255,255,0.02)' } }}
                                                />
                                            </Grid>
                                        </Grid>

                                        <Box display="flex" gap={2}>
                                            <Button 
                                                fullWidth 
                                                variant="contained" 
                                                onClick={() => updateStatusMutation.mutate({ 
                                                    id: selectedAppointment.id, 
                                                    status: 'APPROVED',
                                                    approvedDate,
                                                    approvedTime,
                                                    adminNotes
                                                })}
                                                disabled={updateStatusMutation.isLoading || !approvedDate || !approvedTime}
                                                sx={{ 
                                                    py: 1.5, fontWeight: 950, 
                                                    bgcolor: 'success.main',
                                                    '&:hover': { bgcolor: 'success.dark' }
                                                }}
                                            >
                                                AUTHORIZE APPOINTMENT
                                            </Button>
                                            <Button 
                                                variant="outlined" 
                                                onClick={() => updateStatusMutation.mutate({ 
                                                    id: selectedAppointment.id, 
                                                    status: 'CANCELLED',
                                                    adminNotes: 'Appointment declined by executive oversight.'
                                                })}
                                                disabled={updateStatusMutation.isLoading}
                                                sx={{ px: 4, fontWeight: 900, color: 'error.main', borderColor: 'error.main' }}
                                            >
                                                DECLINE
                                            </Button>
                                        </Box>
                                    </Box>
                                ) : (
                                    <Box sx={{ p: 3, bgcolor: 'rgba(255,0,0,0.05)', border: '1px solid rgba(255,0,0,0.2)', borderRadius: 2, display: 'flex', gap: 2 }}>
                                        <Shield size={24} color="#f44336" />
                                        <Box>
                                            <Typography variant="caption" fontWeight="950" color="error" sx={{ letterSpacing: 2 }}>AUTHORIZATION REQUIRED</Typography>
                                            <Typography variant="body2" color="textSecondary" sx={{ mt: 0.5, fontWeight: 600 }}>
                                                Only authorized tactical leaders or the target official can schedule this mission.
                                            </Typography>
                                        </Box>
                                    </Box>
                                )}
                            </Box>
                        ) : (
                            <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', opacity: 0.3 }}>
                                <MessageSquare size={48} />
                                <Typography variant="body1" mt={2} fontWeight="700">Select an appointment request</Typography>
                            </Box>
                        )}
                    </Box>
                </Box>
            </DialogContent>
        </Dialog>
    );
}
