import React, { useState } from 'react';
import { 
    Container, Grid, Typography, Box, Card, CardContent, Button, Avatar, Chip, 
    IconButton, LinearProgress, Stack, Divider, Badge, Paper, Tooltip
} from '@mui/material';
import { 
    Shield, Activity, Users, Landmark, Zap, Globe, 
    TrendingUp, MessageSquare, Bell, Star, ChevronRight, 
    Search, Filter, LayoutDashboard, Briefcase, Coins,
    ArrowUpRight, Clock, CheckCircle2, AlertCircle, Send
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../lib/api-client';
import DashboardLayout from '../components/layout/DashboardLayout';
import { Link } from 'react-router-dom';
import FinancialLedger from '../components/dashboard/FinancialLedger';

export default function BishopDashboard() {
    const { user } = useAuth();
    const queryClient = useQueryClient();
    
    // --- Data Streams ---
    const { data: syncData, isLoading: isSyncLoading } = useQuery(['dashboard-sync'], async () => {
        const res = await api.get('/dashboard/sync');
        return res.data;
    }, {
        enabled: !!user,
        refetchInterval: 5000,
    });

    const { data: departments } = useQuery(['departments'], async () => {
        const res = await api.get('/departments');
        return res.data;
    });

    // --- Intelligence Analytics ---
    const totalBalance = syncData?.account?.balance || 0;
    const pendingApprovals = syncData?.transactions?.filter((tx: any) => tx.status !== 'APPROVED' && tx.type === 'WITHDRAWAL').length || 0;

    return (
        <DashboardLayout>
            <style>
                {`
                    @keyframes pulse-mission {
                        0% { box-shadow: 0 0 0 0 rgba(0, 255, 255, 0.2); }
                        70% { box-shadow: 0 0 0 20px rgba(0, 255, 255, 0); }
                        100% { box-shadow: 0 0 0 0 rgba(0, 255, 255, 0); }
                    }
                    .mission-intel-card {
                        background: linear-gradient(135deg, rgba(0,0,0,0.95), rgba(0, 180, 216, 0.05)) !important;
                        border: 1px solid rgba(0, 255, 255, 0.15) !important;
                        position: relative;
                        overflow: hidden;
                    }
                    .mission-intel-card::after {
                        content: '';
                        position: absolute;
                        top: 0; left: 0; right: 0; height: 1px;
                        background: linear-gradient(90deg, transparent, var(--cyan), transparent);
                    }
                    .status-glow {
                        width: 8px; height: 8px; border-radius: 50%;
                        background: #00ff00;
                        box-shadow: 0 0 10px #00ff00;
                        display: inline-block;
                        margin-right: 8px;
                    }
                `}
            </style>

            <Container maxWidth="xl" sx={{ mt: 2 }}>
                {/* MISSION COMMAND HEADER */}
                <Box sx={{ mb: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', borderBottom: '1px solid rgba(255,255,255,0.05)', pb: 4 }}>
                    <Box>
                        <Box display="flex" alignItems="center" gap={2} mb={1}>
                            <Shield size={32} color="var(--cyan)" />
                            <Typography variant="caption" fontWeight="1000" sx={{ letterSpacing: 4, color: 'var(--cyan)' }}>MISSION COMMAND INTELLIGENCE</Typography>
                        </Box>
                        <Typography variant="h2" fontWeight="1000" sx={{ letterSpacing: -3, color: 'white', lineHeight: 1 }}>
                            BISHOP'S <span style={{ color: 'rgba(255,255,255,0.3)' }}>STRATEGIC PORTAL</span>
                        </Typography>
                    </Box>
                    <Box sx={{ textAlign: 'right' }}>
                        <Typography variant="subtitle2" fontWeight="900" sx={{ opacity: 0.5 }}>OPERATIONAL STATUS</Typography>
                        <Box display="flex" alignItems="center" gap={1} justifyContent="flex-end">
                            <span className="status-glow" />
                            <Typography variant="h6" fontWeight="1000" sx={{ color: '#00ff00' }}>ACTIVE OVERWATCH</Typography>
                        </Box>
                    </Box>
                </Box>

                <Grid container spacing={4}>
                    {/* TOP ANALYTICS STRIP */}
                    <Grid item xs={12} md={3}>
                        <Card className="mission-intel-card">
                            <CardContent sx={{ p: 3 }}>
                                <Typography variant="caption" fontWeight="1000" sx={{ opacity: 0.5, letterSpacing: 2 }}>TOTAL CHURCH LIQUIDITY</Typography>
                                <Typography variant="h4" fontWeight="1000" sx={{ color: 'var(--cyan)', mt: 1 }}>
                                    KES {totalBalance.toLocaleString()}
                                </Typography>
                                <LinearProgress variant="determinate" value={75} sx={{ mt: 2, height: 2, bgcolor: 'rgba(255,255,255,0.05)', '& .MuiLinearProgress-bar': { bgcolor: 'var(--cyan)' } }} />
                            </CardContent>
                        </Card>
                    </Grid>
                    <Grid item xs={12} md={3}>
                        <Card className="mission-intel-card">
                            <CardContent sx={{ p: 3 }}>
                                <Typography variant="caption" fontWeight="1000" sx={{ opacity: 0.5, letterSpacing: 2 }}>MISSION CRITICAL APPROVALS</Typography>
                                <Box display="flex" justifyContent="space-between" alignItems="center" sx={{ mt: 1 }}>
                                    <Typography variant="h4" fontWeight="1000" sx={{ color: (syncData?.globalMetrics?.pendingApprovals > 0) ? '#ff4f4f' : 'white' }}>
                                        {syncData?.globalMetrics?.pendingApprovals || 0} PENDING
                                    </Typography>
                                    {(syncData?.globalMetrics?.pendingApprovals > 0) && <AlertCircle size={24} color="#ff4f4f" className="animate-pulse" />}
                                </Box>
                                <LinearProgress variant="determinate" value={syncData?.globalMetrics?.pendingApprovals > 0 ? 100 : 0} sx={{ mt: 2, height: 2, bgcolor: 'rgba(255,255,255,0.05)', '& .MuiLinearProgress-bar': { bgcolor: '#ff4f4f' } }} />
                            </CardContent>
                        </Card>
                    </Grid>
                    <Grid item xs={12} md={3}>
                        <Card className="mission-intel-card">
                            <CardContent sx={{ p: 3 }}>
                                <Typography variant="caption" fontWeight="1000" sx={{ opacity: 0.5, letterSpacing: 2 }}>GLOBAL PARTNERSHIP NETWORK</Typography>
                                <Typography variant="h4" fontWeight="1000" sx={{ mt: 1 }}>
                                    {syncData?.globalMetrics?.totalPartners || 0} PARTNERS
                                </Typography>
                                <LinearProgress variant="determinate" value={60} sx={{ mt: 2, height: 2, bgcolor: 'rgba(255,255,255,0.05)', '& .MuiLinearProgress-bar': { bgcolor: 'var(--primary)' } }} />
                            </CardContent>
                        </Card>
                    </Grid>
                    <Grid item xs={12} md={3}>
                        <Card className="mission-intel-card">
                            <CardContent sx={{ p: 3 }}>
                                <Typography variant="caption" fontWeight="1000" sx={{ opacity: 0.5, letterSpacing: 2 }}>TOTAL CHURCH STRENGTH</Typography>
                                <Typography variant="h4" fontWeight="1000" sx={{ mt: 1 }}>
                                    {syncData?.globalMetrics?.totalUsers || 0} MEMBERS
                                </Typography>
                                <LinearProgress variant="determinate" value={85} sx={{ mt: 2, height: 2, bgcolor: 'rgba(255,255,255,0.05)', '& .MuiLinearProgress-bar': { bgcolor: 'lightgreen' } }} />
                            </CardContent>
                        </Card>
                    </Grid>

                    {/* MAIN COMMAND AREA */}
                    <Grid item xs={12} lg={8}>
                        <Stack spacing={4}>
                            {/* GLOBAL FINANCIAL COMMAND */}
                            <FinancialLedger 
                                account={syncData?.account} 
                                transactions={syncData?.transactions || []} 
                            />

                            {/* SECTORAL OVERWATCH */}
                            <Card className="mission-intel-card">
                                <CardContent sx={{ p: 4 }}>
                                    <Box display="flex" justifyContent="space-between" alignItems="center" mb={4}>
                                        <Box display="flex" alignItems="center" gap={2}>
                                            <Globe size={24} color="var(--primary)" />
                                            <Typography variant="h5" fontWeight="950" sx={{ letterSpacing: -1 }}>SECTORAL OVERWATCH</Typography>
                                        </Box>
                                        <Button size="small" sx={{ color: 'var(--cyan)', fontWeight: 900 }}>DASHBOARD MAP</Button>
                                    </Box>
                                    
                                    <Grid container spacing={2}>
                                        {departments?.map((dept: any) => (
                                            <Grid item xs={12} sm={6} md={4} key={dept.id}>
                                                <Card 
                                                    component={Link} 
                                                    to={`/department/${dept.id}`} 
                                                    sx={{ 
                                                        p: 2, 
                                                        display: 'block',
                                                        bgcolor: 'rgba(255,255,255,0.03)', 
                                                        border: '1px solid rgba(255,255,255,0.05)',
                                                        textDecoration: 'none', 
                                                        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                                        cursor: 'pointer',
                                                        position: 'relative',
                                                        overflow: 'hidden',
                                                        '&:hover': { 
                                                            bgcolor: 'rgba(0,180,216,0.08)', 
                                                            borderColor: 'var(--cyan)', 
                                                            transform: 'translateY(-6px)',
                                                            boxShadow: '0 12px 24px -10px rgba(0, 255, 255, 0.2)'
                                                        },
                                                        '&::before': {
                                                            content: '""',
                                                            position: 'absolute',
                                                            top: 0, left: 0, width: '2px', height: '100%',
                                                            bgcolor: 'var(--cyan)',
                                                            opacity: 0,
                                                            transition: 'opacity 0.3s'
                                                        },
                                                        '&:hover::before': { opacity: 1 }
                                                    }}
                                                >
                                                    <Box display="flex" justifyContent="space-between" alignItems="flex-start">
                                                        <Typography variant="subtitle2" fontWeight="1000" color="white" sx={{ letterSpacing: 0.5 }}>
                                                            {dept.name.toUpperCase()}
                                                        </Typography>
                                                        <ArrowUpRight size={14} color="var(--cyan)" />
                                                    </Box>
                                                    <Box display="flex" justifyContent="space-between" mt={3}>
                                                        <Typography variant="caption" sx={{ opacity: 0.5, fontWeight: 900 }}>MEMBERSHIP</Typography>
                                                        <Typography variant="caption" fontWeight="1000" color="var(--cyan)">{dept._count?.users || 0}</Typography>
                                                    </Box>
                                                    <Box display="flex" justifyContent="space-between" mt={0.5}>
                                                        <Typography variant="caption" sx={{ opacity: 0.5, fontWeight: 900 }}>ACTIVE MISSIONS</Typography>
                                                        <Typography variant="caption" fontWeight="1000" color="var(--primary)">{dept._count?.projects || 0}</Typography>
                                                    </Box>
                                                </Card>
                                            </Grid>
                                        ))}
                                    </Grid>
                                </CardContent>
                            </Card>

                            {/* GLOBAL PARTNERSHIP OVERWATCH */}
                            <Card className="mission-intel-card">
                                <CardContent sx={{ p: 4 }}>
                                    <Box display="flex" alignItems="center" gap={2} mb={3}>
                                        <Landmark size={24} color="var(--cyan)" />
                                        <Typography variant="h5" fontWeight="950" sx={{ letterSpacing: -1 }}>PARTNERSHIP INTELLIGENCE</Typography>
                                    </Box>
                                    <Stack spacing={2}>
                                        {syncData?.allPartnerships?.slice(0, 5).map((p: any) => (
                                            <Box key={p.id} sx={{ p: 2, bgcolor: 'rgba(255,255,255,0.02)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                <Box>
                                                    <Typography variant="subtitle2" fontWeight="1000">{p.user.name}</Typography>
                                                    <Typography variant="caption" sx={{ opacity: 0.5 }}>{p.user.membershipNumber}</Typography>
                                                </Box>
                                                <Box sx={{ textAlign: 'right' }}>
                                                    <Typography variant="subtitle2" fontWeight="1000" color="var(--cyan)">KES {p.amount.toLocaleString()}</Typography>
                                                    <Chip label={p.status} size="small" color={p.status === 'ACTIVE' ? 'success' : 'warning'} sx={{ fontSize: '0.6rem', height: 16 }} />
                                                </Box>
                                            </Box>
                                        ))}
                                    </Stack>
                                </CardContent>
                            </Card>
                        </Stack>
                    </Grid>

                    {/* SIDEBAR INTELLIGENCE */}
                    <Grid item xs={12} lg={4}>
                        <Stack spacing={4}>
                            {/* MISSION BROADCAST TERMINAL */}
                            <Card className="mission-intel-card" sx={{ border: '2px solid orange !important' }}>
                                <CardContent sx={{ p: 3 }}>
                                    <Typography variant="caption" fontWeight="1000" sx={{ color: 'orange', letterSpacing: 2, display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
                                        <Bell size={16} /> BROADCAST CENTER
                                    </Typography>
                                    <Typography variant="subtitle2" fontWeight="900" sx={{ mb: 2, opacity: 0.8 }}>EXECUTIVE GLOBAL ALERT</Typography>
                                    <textarea 
                                        placeholder="Enter strategic command for all departments..."
                                        style={{ 
                                            width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,165,0,0.3)',
                                            borderRadius: 0, padding: '12px', color: '#fff', fontSize: '0.9rem', minHeight: 100, outline: 'none', resize: 'none'
                                        }}
                                    />
                                    <Button fullWidth variant="contained" sx={{ mt: 2, bgcolor: 'orange', color: '#000', fontWeight: 950, borderRadius: 0 }}>
                                        BROADCAST COMMAND
                                    </Button>
                                </CardContent>
                            </Card>

                             {/* RECENT INTEL STREAM */}
                             <Card className="mission-intel-card">
                                <CardContent sx={{ p: 3 }}>
                                    <Typography variant="caption" fontWeight="1000" sx={{ letterSpacing: 2, mb: 3, display: 'block' }}>MISSION LOG: GLOBAL FEED</Typography>
                                    <Stack spacing={2}>
                                        {/* Combine various items for a "Universal Feed" */}
                                        {[
                                            ...(syncData?.projects?.map((p: any) => ({ ...p, type: 'PROJECT' })) || []),
                                            ...(syncData?.events?.map((e: any) => ({ ...e, type: 'EVENT' })) || []),
                                            ...(syncData?.announcements?.map((a: any) => ({ ...a, type: 'ALERT' })) || []),
                                            ...(syncData?.baptisms?.map((b: any) => ({ ...b, title: `Baptism Request: ${b.user.name}`, type: 'BAPTISM' })) || []),
                                            ...(syncData?.children?.map((c: any) => ({ ...c, title: `Child Dedication: ${c.name}`, type: 'DEDICATION' })) || [])
                                        ].sort((a, b) => new Date(b.createdAt || b.date).getTime() - new Date(a.createdAt || a.date).getTime()).slice(0, 10).map((item: any, idx: number) => (
                                            <Box key={idx} sx={{ p: 2, bgcolor: 'rgba(255,255,255,0.02)', borderLeft: `2px solid ${item.type === 'ALERT' ? '#ff4f4f' : 'var(--cyan)'}` }}>
                                                <Typography variant="caption" fontWeight="900" color="var(--cyan)" sx={{ fontSize: '0.6rem' }}>{item.type} — {new Date(item.createdAt || item.date).toLocaleDateString()}</Typography>
                                                <Typography variant="subtitle2" fontWeight="900" sx={{ mt: 0.5 }}>{item.title?.toUpperCase()}</Typography>
                                            </Box>
                                        ))}
                                    </Stack>
                                </CardContent>
                            </Card>

                            {/* AUDIT COMMAND LOG */}
                            <Card className="mission-intel-card" sx={{ border: '1px solid rgba(255,255,255,0.05) !important' }}>
                                <CardContent sx={{ p: 3 }}>
                                    <Typography variant="caption" fontWeight="1000" sx={{ color: 'var(--cyan)', letterSpacing: 2, mb: 3, display: 'block' }}>ADMINISTRATIVE AUDIT LOG</Typography>
                                    <Box sx={{ maxHeight: 250, overflowY: 'auto', pr: 1, '&::-webkit-scrollbar': { width: 4 }, '&::-webkit-scrollbar-thumb': { bgcolor: 'rgba(255,255,255,0.1)' } }}>
                                        {syncData?.auditLogs?.map((log: any) => (
                                            <Box key={log.id} mb={2}>
                                                <Typography variant="caption" sx={{ display: 'block', color: 'rgba(255,255,255,0.4)', fontSize: '0.6rem' }}>
                                                    {new Date(log.createdAt).toLocaleString()}
                                                </Typography>
                                                <Typography variant="caption" fontWeight="900" sx={{ color: 'var(--cyan)' }}>[{log.actor.name}]</Typography>
                                                <Typography variant="caption" sx={{ ml: 1, opacity: 0.7 }}>{log.actionType}</Typography>
                                                <Typography variant="caption" sx={{ display: 'block', fontStyle: 'italic', fontSize: '0.7rem', opacity: 0.5 }}>{log.entityType}: {log.entityId}</Typography>
                                            </Box>
                                        ))}
                                    </Box>
                                </CardContent>
                            </Card>

                            {/* SYSTEM HEALTH */}
                            <Card className="mission-intel-card" sx={{ p: 0 }}>
                                <CardContent sx={{ p: 3 }}>
                                    <Typography variant="caption" fontWeight="1000" sx={{ letterSpacing: 2, mb: 2, display: 'block' }}>SYSTEM INFRASTRUCTURE</Typography>
                                    <Box display="flex" justifyContent="space-between" mb={1}>
                                        <Typography variant="caption" sx={{ opacity: 0.5 }}>COVENANT NETWORK</Typography>
                                        <Typography variant="caption" color="#00ff00" fontWeight="900">HEALTHY</Typography>
                                    </Box>
                                    <Box display="flex" justifyContent="space-between" mb={1}>
                                        <Typography variant="caption" sx={{ opacity: 0.5 }}>SECURED LEDGER</Typography>
                                        <Typography variant="caption" color="#00ff00" fontWeight="900">ENCRYPTED</Typography>
                                    </Box>
                                    <Box display="flex" justifyContent="space-between">
                                        <Typography variant="caption" sx={{ opacity: 0.5 }}>MEMBERSHIP PIPELINE</Typography>
                                        <Typography variant="caption" color="#00ff00" fontWeight="900">OPTIMIZED</Typography>
                                    </Box>
                                </CardContent>
                            </Card>
                        </Stack>
                    </Grid>
                </Grid>
            </Container>
        </DashboardLayout>
    );
}
