import React from 'react';
import { 
    Box, Typography, Card, CardContent, Button, Stack, Chip, 
    Avatar, Divider, IconButton, Tooltip, Alert
} from '@mui/material';
import { Wrench, CheckCircle2, CloudLightning, ShieldCheck, UserCheck } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../lib/api-client';
import { useAuth } from '../../contexts/AuthContext';

export default function RepairApprovalManager() {
    const { user } = useAuth();
    const queryClient = useQueryClient();

    const { data: repairs, isLoading } = useQuery(['repairs-pending'], async () => {
        const res = await api.get('/repairs');
        return res.data;
    }, { 
        refetchInterval: 10000 
    });

    const approveMutation = useMutation(async (id: string) => {
        return await api.patch(`/repairs/${id}/approve`);
    }, {
        onSuccess: () => {
            queryClient.invalidateQueries(['repairs-pending']);
            queryClient.invalidateQueries(['dashboard-sync']);
        }
    });

    // Filter repairs that need THIS user's role approval
    const pendingRepairs = repairs?.filter((r: any) => {
        if (r.status === 'APPROVED' || r.status === 'REJECTED') return false;
        
        if (user?.role === 'PASTOR' && (r.status === 'PENDING_PASTOR_1' || r.status === 'PENDING_PASTOR_2')) {
            // Ensure they haven't already signed as Pastor 1
            const alreadySigned = r.approvals?.some((a: any) => a.userId === user.id);
            return !alreadySigned;
        }
        if (user?.role === 'SYSTEM_ADMIN' && r.status === 'PENDING_ADMIN') return true;
        if (user?.role === 'SUPER_ADMIN' || user?.role === 'WATUA') {
             if (r.status === 'PENDING_BISHOP') return true;
        }
        return false;
    }) || [];

    if (isLoading) return null;

    if (pendingRepairs.length === 0) return (
        <Alert severity="info" variant="outlined" sx={{ borderRadius: 0, borderColor: 'rgba(0,255,255,0.1)', color: 'rgba(255,255,255,0.5)', bgcolor: 'transparent' }}>
            Mission Ready: No technical repair authorizations pending in your sector.
        </Alert>
    );

    return (
        <Stack spacing={2}>
            {pendingRepairs.map((repair: any) => (
                <Card key={repair.id} className="holographic-card" sx={{ borderRadius: 0, borderLeft: '4px solid #ff4d4d' }}>
                    <CardContent sx={{ p: 2 }}>
                        <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={2}>
                            <Box display="flex" alignItems="center" gap={1.5}>
                                <Avatar sx={{ bgcolor: 'rgba(255, 77, 77, 0.1)', color: '#ff4d4d', width: 32, height: 32 }}>
                                    <Wrench size={16} />
                                </Avatar>
                                <Box>
                                    <Typography variant="subtitle2" fontWeight="1000">{repair.instrumentName?.toUpperCase()}</Typography>
                                    <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)', fontWeight: 800 }}>
                                        {repair.department?.name} | REQ: {repair.requester?.name}
                                    </Typography>
                                </Box>
                            </Box>
                            <Chip 
                                label={repair.status.replace(/_/g, ' ')} 
                                size="small" 
                                sx={{ bgcolor: 'rgba(255, 77, 77, 0.1)', color: '#ff4d4d', fontWeight: 950, fontSize: '0.6rem', borderRadius: 0 }} 
                            />
                        </Box>

                        <Typography variant="body2" sx={{ mb: 2, opacity: 0.8, fontSize: '0.8rem', lineHeight: 1.4 }}>
                            {repair.problemDescription}
                        </Typography>

                        <Box display="flex" justifyContent="space-between" alignItems="center">
                            <Box>
                                <Typography variant="caption" sx={{ display: 'block', fontWeight: 900, color: 'var(--cyan)' }}>
                                    ESTIMATED COST: KES {repair.estimatedCost?.toLocaleString()}
                                </Typography>
                            </Box>
                            <Button 
                                size="small" 
                                variant="contained" 
                                startIcon={<CheckCircle2 size={14} />}
                                onClick={() => approveMutation.mutate(repair.id)}
                                disabled={approveMutation.isLoading}
                                sx={{ 
                                    bgcolor: '#ff4d4d', color: '#000', fontWeight: 950, fontSize: '0.7rem', 
                                    borderRadius: 0, '&:hover': { bgcolor: '#ff6666' } 
                                }}
                            >
                                {approveMutation.isLoading ? 'AUTHORIZING...' : 'SIGN & AUTHORIZE'}
                            </Button>
                        </Box>

                        {repair.approvals?.length > 0 && (
                            <Box mt={2} pt={2} sx={{ borderTop: '1px dashed rgba(255,255,255,0.1)' }}>
                                <Typography variant="caption" sx={{ display: 'block', mb: 1, fontWeight: 900, opacity: 0.5 }}>APPROVAL CHAIN HISTORY:</Typography>
                                <Stack direction="row" spacing={1}>
                                    {repair.approvals.map((app: any) => (
                                        <Tooltip key={app.id} title={`${app.role}: ${app.user?.name}`}>
                                            <Chip 
                                                avatar={<Avatar sx={{ bgcolor: 'var(--cyan)', color: '#000' }}>{app.user?.name[0]}</Avatar>}
                                                label={app.role} 
                                                size="small" 
                                                sx={{ bgcolor: 'rgba(0,255,255,0.05)', color: 'var(--cyan)', fontWeight: 800, fontSize: '0.6rem', borderRadius: 0 }} 
                                            />
                                        </Tooltip>
                                    ))}
                                </Stack>
                            </Box>
                        )}
                    </CardContent>
                </Card>
            ))}
        </Stack>
    );
}
