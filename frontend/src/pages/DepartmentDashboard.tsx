import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import api from '../lib/api-client';
import {
    Typography, Grid, Card, CardContent, Box, Button, Chip, Divider, LinearProgress,
    Avatar, Tooltip, Paper, IconButton, Skeleton, useMediaQuery, useTheme,
    Table, TableBody, TableCell, TableContainer, TableHead, TableRow, 
    InputAdornment, TextField, Modal, Backdrop, Fade, Stack, Snackbar, Alert, Badge, Container
} from '@mui/material';
import {
    Calendar, Users, Briefcase, ChevronRight, CheckCircle2,
    Package, TrendingUp, AlertCircle, ArrowUpRight, ShieldCheck, Plus, MapPin,
    Heart, FileText, Download, Share2, Edit, Trash2, MessageSquare, Coins, Clock, Zap, Shield,
    User, Search, Filter, Sparkles, ThumbsUp, Smile, Quote, Star, Bell, Megaphone, BookOpen, Droplet
} from 'lucide-react';
import DashboardLayout from '../components/layout/DashboardLayout';
import { useAuth } from '../contexts/AuthContext';
import { usePermission } from '../hooks/usePermission';
import { PERMISSIONS } from '../utils/permissions';

// Modal Imports
import ProjectFormModal from '../components/modals/ProjectFormModal';
import EventFormModal from '../components/modals/EventFormModal';
import PlanFormModal from '../components/modals/PlanFormModal';
import AnnouncementFormModal from '../components/modals/AnnouncementFormModal';

export default function DepartmentDashboard() {
    const { id } = useParams();
    const { user } = useAuth();
    const { hasPermission } = usePermission();
    const queryClient = useQueryClient();
    const navigate = useNavigate();
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

    const effectiveId = (id && id !== 'undefined') ? id : user?.departmentId;

    // Permission-based flags
    const canViewDepartment = hasPermission(PERMISSIONS.VIEW_DEPARTMENT);

    // Access validation
    useEffect(() => {
        if (!canViewDepartment) {
            navigate('/', { replace: true });
            return;
        }
        if (user?.role === 'DEPARTMENT_LEADER' && effectiveId && effectiveId !== user.departmentId) {
            navigate(`/department/${user.departmentId}`, { replace: true });
        }
    }, [canViewDepartment, effectiveId, user, navigate]);

    // Modal & Toast State
    const [projectModal, setProjectModal] = useState({ open: false, data: null });
    const [eventModal, setEventModal] = useState({ open: false, data: null });
    const [planModal, setPlanModal] = useState({ open: false, data: null });
    const [announcementModal, setAnnouncementModal] = useState({ open: false, data: null });
    const [enrollModalOpen, setEnrollModalOpen] = useState(false);
    const [enrollAmount, setEnrollAmount] = useState<number>(700);
    const [toast, setToast] = useState<{ open: boolean; message: string; severity: 'success' | 'error' | 'info' | 'warning' }>({
        open: false, message: '', severity: 'info'
    });

    const isReady = !!effectiveId && effectiveId !== 'undefined';

    const { data: syncData, isLoading: isSyncLoading } = useQuery(['dashboard-sync', effectiveId], async () => {
        const res = await api.get('/dashboard/sync', { params: { departmentId: effectiveId } });
        return res.data;
    }, { enabled: isReady, refetchInterval: 10000 });

    const { data: devotion, isLoading: isDevotionLoading } = useQuery(['daily-devotion'], async () => {
        const res = await api.get('/devotions/daily');
        return res.data;
    });

    const devotionMutation = useMutation(async ({ type, value }: { type: string, value: string }) => {
        return await api.post(`/devotions/${devotion?.id}/interact`, { type, value });
    }, {
        onSuccess: () => queryClient.invalidateQueries(['daily-devotion'])
    });

    const enrollPartnershipMutation = useMutation(
        async (amount: number) => api.post('/users/partnership/enroll', { amount }),
        {
            onSuccess: (data: any) => {
                queryClient.invalidateQueries(['dashboard-sync', effectiveId]);
                setEnrollModalOpen(false);
                setToast({ open: true, message: data.data.message, severity: 'success' });
            },
            onError: (err: any) => {
                setToast({ open: true, message: err.response?.data?.error || 'Enrollment failed.', severity: 'error' });
            }
        }
    );

    if (isSyncLoading || isDevotionLoading) return (
        <DashboardLayout>
            <Box p={4} display="flex" flexDirection="column" gap={3}>
                <Skeleton variant="rectangular" height={150} sx={{ borderRadius: 0 }} />
                <Grid container spacing={4}>
                    <Grid item xs={12} lg={7}><Skeleton variant="rectangular" height={400} sx={{ borderRadius: 0 }} /></Grid>
                    <Grid item xs={12} lg={5}><Skeleton variant="rectangular" height={400} sx={{ borderRadius: 0 }} /></Grid>
                </Grid>
            </Box>
        </DashboardLayout>
    );

    const department = syncData?.departments?.find((d: any) => d.id === effectiveId);
    const announcements = syncData?.announcements || [];
    const projects = syncData?.projects || [];
    const events = syncData?.events || [];
    const plans = syncData?.plans || [];
    const isPartner = syncData?.isPartner;
    const settings = syncData?.ministrySettings;
    const account = syncData?.account;
    
    return (
        <DashboardLayout>
            <style>
                {`
                    @keyframes fade-in-up {
                        from { opacity: 0; transform: translateY(30px); }
                        to { opacity: 1; transform: translateY(0); }
                    }
                    .animate-fade-in-up {
                        animation: fade-in-up 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards;
                    }
                    @keyframes marquee-leader {
                        0% { transform: translateX(0); }
                        100% { transform: translateX(-50%); }
                    }
                    .mission-marquee-leader {
                        display: flex;
                        gap: 16px;
                        animation: marquee-leader 300s linear infinite;
                        width: max-content;
                    }
                    .mission-marquee-leader:hover {
                        animation-play-state: paused;
                    }
                    @keyframes shine {
                        to { background-position: 200% center; }
                    }
                    /* Relying on global holographic-card styles from index.css for shimmer/hover */
                    .divine-text-premium {
                        background: linear-gradient(90deg, #fff, var(--cyan), #fff);
                        background-size: 200% auto;
                        color: transparent;
                        -webkit-background-clip: text;
                        animation: shine 3s linear infinite;
                        font-weight: 950;
                    }
                    .divine-mandate-card-leader {
                        background: linear-gradient(135deg, rgba(0,0,0,0.6), rgba(79, 139, 255, 0.1)) !important;
                        border: 1px solid rgba(79, 139, 255, 0.3) !important;
                    }
                `}
            </style>

            <Container maxWidth="xl" sx={{ mt: 2 }} className="animate-fade-in-up">
                {/* Header Section - Exactly as PastorsDashboard */}
                <Box sx={{ mb: 6, textAlign: 'center', maxWidth: 900, mx: 'auto' }}>
                    <Typography variant="h2" fontWeight="1000" sx={{ 
                        background: 'linear-gradient(45deg, #fff, var(--cyan))',
                        WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                        mb: 1, letterSpacing: -3, fontSize: { xs: '2.5rem', md: '4rem' }
                    }}>
                        {department?.name?.toUpperCase()}
                    </Typography>
                    
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2, mb: 2, flexWrap: 'wrap' }}>
                        <Typography variant="subtitle1" fontWeight="800" color="textSecondary">
                            <span style={{ color: 'var(--cyan)' }}>{user?.name?.toUpperCase()}</span>
                        </Typography>
                        <Chip label={user?.role?.replace('_', ' ')} size="small" sx={{ bgcolor: 'rgba(0, 255, 255, 0.1)', color: 'var(--cyan)', fontWeight: 900, borderRadius: 0 }} />
                        {isPartner && (
                            <Chip 
                                icon={<Star size={12} />}
                                label="COVENANT PARTNER" 
                                size="small" 
                                sx={{ bgcolor: 'rgba(255, 165, 0, 0.1)', color: 'orange', fontWeight: 950, borderRadius: 0, border: '1px solid rgba(255, 165, 0, 0.3)', '.MuiChip-icon': { color: 'orange' } }} 
                            />
                        )}
                    </Box>

                    <Box sx={{ display: 'flex', justifyContent: 'center', gap: 2, flexWrap: 'wrap' }}>
                        <Chip 
                            label={`YEAR: ${settings?.themeOfYear || 'YEAR OF DIVINE ESTABLISHMENT'}`} 
                            size="small" 
                            sx={{ bgcolor: 'rgba(79, 139, 255, 0.1)', color: 'var(--primary)', fontWeight: 900, borderRadius: 0 }} 
                        />
                        <Chip 
                            label={`MONTH: ${settings?.themeOfMonth || 'MONTH OF NEW BEGINNINGS'}`} 
                            size="small" 
                            sx={{ bgcolor: 'rgba(0, 180, 216, 0.1)', color: 'var(--cyan)', fontWeight: 900, borderRadius: 0 }} 
                        />
                    </Box>
                </Box>

                <Grid container spacing={4}>
                    {/* LEFT COLUMN (7): SPIRITUAL & LOCAL TACTICAL */}
                    <Grid item xs={12} lg={7}>
                        <Stack spacing={4}>
                            {/* INTERACTIVE DEVOTION - Now Holographic */}
                            <Card className="holographic-card" sx={{ borderRadius: 0 }}>
                                <CardContent sx={{ p: isMobile ? 3 : 4 }}>
                                    <Box display="flex" alignItems="center" gap={2} mb={2}>
                                        <Sparkles size={24} color="var(--cyan)" />
                                        <Typography variant="h5" fontWeight="950" sx={{ letterSpacing: -1 }}>MINISTERIAL DEVOTION</Typography>
                                    </Box>
                                    <Chip 
                                        label={devotion?.themeOfMonth?.toUpperCase() || settings?.themeOfMonth?.toUpperCase()} 
                                        size="small" variant="outlined" 
                                        sx={{ color: 'var(--cyan)', borderColor: 'var(--cyan-glow)', fontWeight: 900, mb: 3 }} 
                                    />
                                    
                                    <Typography variant="h4" fontWeight="950" sx={{ mb: 2, color: 'primary.main', opacity: 0.9 }}>{devotion?.title}</Typography>
                                    <Typography variant="body1" sx={{ mb: 4, lineHeight: 1.8, fontSize: '1.1rem', opacity: 0.8, fontStyle: 'italic' }}>
                                        "{devotion?.content}"
                                    </Typography>

                                    <Divider sx={{ mb: 3, opacity: 0.1 }} />

                                    <Box display="flex" justifyContent="space-between" alignItems="center">
                                        <Stack direction="row" spacing={1}>
                                            {[
                                                { icon: ThumbsUp, label: 'Amen', value: 'AMEN', type: 'AMEN' },
                                                { icon: Smile, label: 'Blessed', value: '😊', type: 'EMOJI' },
                                                { icon: Heart, label: 'Love', value: '❤️', type: 'EMOJI' },
                                            ].map((btn) => {
                                                const count = devotion?.interactions?.filter((i: any) => i.value === btn.value).length || 0;
                                                const isActive = devotion?.interactions?.some((i: any) => i.value === btn.value && i.userId === user?.id);
                                                return (
                                                    <Button key={btn.value} size="small" startIcon={<btn.icon size={16} />} onClick={() => devotionMutation.mutate({ type: btn.type, value: btn.value })}
                                                        sx={{ 
                                                            borderRadius: 20, px: 2, 
                                                            bgcolor: isActive ? 'rgba(0,180,216,0.2)' : 'rgba(255,255,255,0.03)', 
                                                            color: isActive ? 'var(--cyan)' : 'inherit', 
                                                            border: isActive ? '1px solid var(--cyan)' : '1px solid transparent',
                                                            '&:hover': { bgcolor: 'rgba(0,180,216,0.1)' }
                                                        }}
                                                    >
                                                        {btn.label} {count > 0 && `(${count})`}
                                                    </Button>
                                                );
                                            })}
                                        </Stack>
                                        <Typography variant="caption" fontWeight="900" sx={{ opacity: 0.4 }}>{new Date().toLocaleDateString()}</Typography>
                                    </Box>
                                </CardContent>
                            </Card>

                            {/* TACTICAL PROGRESSION GRID */}
                            <Box>
                                <Typography variant="caption" fontWeight="900" sx={{ letterSpacing: 2, color: 'var(--cyan)', mb: 2, display: 'block', textAlign: 'center' }}>TACTICAL MISSIONS</Typography>
                                <Grid container spacing={2}>
                                    {[
                                        { label: 'NEW PROJECT', icon: Briefcase, color: 'cyan', onClick: () => setProjectModal({ open: true, data: null }) },
                                        { label: 'HOST EVENT', icon: Calendar, color: 'primary', onClick: () => setEventModal({ open: true, data: null }) },
                                        { label: 'STRATEGIC PLAN', icon: FileText, color: 'cyan', onClick: () => setPlanModal({ open: true, data: null }) },
                                    ].map((action, i) => (
                                        <Grid item xs={12} sm={4} key={i}>
                                            <Button fullWidth onClick={action.onClick}
                                                className="holographic-card"
                                                sx={{ 
                                                    height: 90, display: 'flex', flexDirection: 'column', gap: 1, 
                                                    border: '1px solid var(--glass-border)', borderRadius: 0, color: 'white',
                                                    '&:hover': { bgcolor: 'rgba(0,255,255,0.05)', borderColor: 'var(--cyan)', transform: 'translateY(-2px)' }
                                                }}
                                            >
                                                <action.icon size={20} color={`var(--${action.color})`} />
                                                <Typography variant="caption" fontWeight="950" sx={{ fontSize: '0.6rem' }}>{action.label}</Typography>
                                            </Button>
                                        </Grid>
                                    ))}
                                </Grid>
                            </Box>

                            {/* MISSION STREAM MARQUEE - Exactly as PastorsDashboard */}
                            <Box sx={{ mb: 4, overflow: 'hidden' }}>
                                <Typography variant="caption" fontWeight="900" sx={{ letterSpacing: 2, color: 'var(--cyan)', mb: 2, display: 'block' }}>CHURCH-WIDE TELEMETRY</Typography>
                                <Box className="mission-marquee-leader">
                                    {[...announcements, ...events, ...projects].map((item: any, i) => (
                                        <Box key={`mq-${i}`} sx={{ display: 'flex', alignItems: 'center', gap: 1.5, px: 2 }}>
                                            <div className="w-2 h-2 rounded-full bg-cyan-500 animate-pulse" />
                                            <Typography variant="caption" fontWeight="1000" sx={{ whiteSpace: 'nowrap', opacity: 0.8 }}>
                                                {item.intelType || 'MISSION'}: {item.title?.toUpperCase()}
                                            </Typography>
                                        </Box>
                                    ))}
                                </Box>
                            </Box>

                             {/* SECTOR FINANCIAL TELEMETRY - Restored & Holographic */}
                             <Card className="holographic-card" sx={{ borderRadius: 0, border: '1px solid var(--glass-border)', background: 'linear-gradient(to right, rgba(0,255,0,0.03), transparent)' }}>
                                <CardContent sx={{ p: 4 }}>
                                    <Box display="flex" alignItems="center" gap={1.5} mb={2}>
                                        <Coins size={20} color="var(--cyan)" />
                                        <Typography variant="caption" fontWeight="1000" sx={{ letterSpacing: 2 }}>FINANCIAL LEDGER</Typography>
                                    </Box>
                                    <Grid container spacing={2}>
                                        <Grid item xs={6}>
                                            <Typography variant="caption" sx={{ opacity: 0.5, fontWeight: 800 }}>AVAILABLE BUDGET</Typography>
                                            <Typography variant="h4" fontWeight="950" sx={{ color: 'success.main', letterSpacing: -1 }}>
                                                KES {account?.balance?.toLocaleString() || '0'}
                                            </Typography>
                                        </Grid>
                                        <Grid item xs={6}>
                                            <Typography variant="caption" sx={{ opacity: 0.5, fontWeight: 800 }}>TOTAL ALLOCATED</Typography>
                                            <Typography variant="h4" fontWeight="950" sx={{ opacity: 0.8 }}>
                                                KES {account?.totalIncome?.toLocaleString() || '0'}
                                            </Typography>
                                        </Grid>
                                    </Grid>
                                    <Box sx={{ mt: 4, bgcolor: 'rgba(0,0,0,0.2)', p: 2, borderRadius: 0, border: '1px solid rgba(255,255,255,0.05)' }}>
                                        <Box display="flex" justifyContent="space-between" mb={1}>
                                            <Typography variant="caption" fontWeight="900" sx={{ opacity: 0.6 }}>BUDGET UTILIZATION</Typography>
                                            <Typography variant="caption" fontWeight="900" color="success.main">
                                                {account?.totalIncome ? Math.round((account.totalExpenditure / account.totalIncome) * 100) : 0}%
                                            </Typography>
                                        </Box>
                                        <LinearProgress 
                                            variant="determinate" 
                                            value={account?.totalIncome ? (account.totalExpenditure / account.totalIncome) * 100 : 0} 
                                            sx={{ height: 4, borderRadius: 0, bgcolor: 'rgba(255,255,255,0.03)', '& .MuiLinearProgress-bar': { bgcolor: 'var(--cyan)' } }} 
                                        />
                                    </Box>
                                </CardContent>
                            </Card>
                        </Stack>
                    </Grid>

                    {/* RIGHT COLUMN (5): OPERATIONS & GLOBAL INTELLIGENCE */}
                    <Grid item xs={12} lg={5}>
                        <Stack spacing={4}>
                            {/* LATEST CHURCH INTEL - Unified Card Structure */}
                            <Card className="holographic-card" sx={{ p: 0, borderRadius: 0 }}>
                                <CardContent sx={{ p: 3 }}>
                                    <Box display="flex" alignItems="center" gap={1.5} mb={3}>
                                        <Bell size={20} color="var(--primary)" />
                                        <Typography variant="caption" fontWeight="950" sx={{ letterSpacing: 2 }}>LATEST MISSION COMMAND INTEL</Typography>
                                    </Box>
                                    <Stack spacing={2}>
                                        {(() => {
                                            const globalIntel = [
                                                ...(announcements || []).filter((a: any) => a.isGlobal).map((a: any) => ({ ...a, intelType: 'CHURCH UPDATE', icon: Megaphone, color: 'cyan' })),
                                                ...(events || []).filter((e: any) => e.isMajor).map((e: any) => ({ ...e, intelType: 'MAJOR EVENT', icon: Calendar, color: 'primary' })),
                                                ...(projects || []).filter((p: any) => p.isMajor).map((p: any) => ({ ...p, intelType: 'STRATEGIC PROJECT', icon: Star, color: 'cyan' })),
                                                ...(plans || []).filter((p: any) => p.isMajor).map((p: any) => ({ ...p, intelType: 'MINISTRY PLAN', icon: BookOpen, color: 'orange' })),
                                            ].sort((a,b) => new Date(b.createdAt || b.date).getTime() - new Date(a.createdAt || a.date).getTime()).slice(0, 10);

                                            if (globalIntel.length === 0) return <Typography variant="caption" sx={{ textAlign: 'center', opacity: 0.3, py: 4, fontWeight: 900 }}>NO GLOBAL INTEL REPORTED</Typography>;

                                            return globalIntel.map((intel) => (
                                                <Card key={`${intel.intelType}-${intel.id}`} sx={{ p: 0, bgcolor: 'rgba(255,255,255,0.02)', borderLeft: `3px solid var(--${intel.color})`, borderRadius: 0, '&:hover': { bgcolor: 'rgba(255,255,255,0.05)' } }}>
                                                    <CardContent sx={{ p: 2 }}>
                                                        <Box display="flex" alignItems="center" gap={1} mb={0.5}>
                                                            <intel.icon size={12} color={`var(--${intel.color})`} />
                                                            <Typography variant="caption" fontWeight="950" sx={{ color: `var(--${intel.color})` }}>{intel.intelType}</Typography>
                                                        </Box>
                                                        <Typography variant="subtitle2" fontWeight="950" sx={{ lineHeight: 1.2 }}>{intel.title?.toUpperCase()}</Typography>
                                                        <Box display="flex" justifyContent="space-between" alignItems="center" mt={1}>
                                                            <Typography variant="caption" sx={{ opacity: 0.4, fontSize: '0.6rem', fontWeight: 700 }}>{new Date(intel.createdAt || intel.date).toLocaleDateString()}</Typography>
                                                            <Button size="small" sx={{ p: 0, minWidth: 0, color: 'var(--cyan)', fontWeight: 900, fontSize: '0.65rem', '&:hover': { color: 'white' } }}>DETAILS</Button>
                                                        </Box>
                                                    </CardContent>
                                                </Card>
                                            ));
                                        })()}
                                    </Stack>
                                </CardContent>
                            </Card>

                            {/* DIVINE MANDATE - Matched Classes */}
                            <Card className="holographic-card divine-mandate-card-leader" sx={{ p: 4, borderRadius: 0 }}>
                                <Typography variant="h6" fontWeight="950" mb={1} sx={{ color: 'var(--cyan)', letterSpacing: 2 }}>DIVINE MANDATE</Typography>
                                <Typography variant="h5" className="divine-text-premium" sx={{ opacity: 0.9, lineHeight: 1.4, fontStyle: 'italic' }}>
                                    "{settings?.themeOfMonth?.toUpperCase() || "WALKING IN DIVINE AUTHORITY"}"
                                </Typography>
                            </Card>

                            {/* BROADCAST CENTER TERMINAL - Holographic */}
                            <Card className="holographic-card" sx={{ borderRadius: 0, border: '1px solid var(--glass-border)', bgcolor: 'rgba(255,165,0,0.02)' }}>
                                <CardContent sx={{ p: 3 }}>
                                    <Typography variant="caption" fontWeight="1000" sx={{ letterSpacing: 2, mb: 2, display: 'block' }}>COMMS TERMINAL</Typography>
                                    <Button fullWidth onClick={() => setAnnouncementModal({ open: true, data: null })}
                                        sx={{ 
                                            height: 60, bgcolor: 'rgba(255,165,0,0.1)', border: '1px solid orange', borderRadius: 0, 
                                            color: 'orange', fontWeight: 900, '&:hover': { bgcolor: 'rgba(255,165,0,0.2)', transform: 'translateY(-2px)', borderColor: '#fff' } 
                                        }}
                                    > BROADCAST ALERT </Button>
                                </CardContent>
                            </Card>

                            {/* PARTNER CTA - Right Column Sidebar as well */}
                            <Card className="holographic-card" sx={{ borderRadius: 0, border: '1px solid rgba(255, 165, 0, 0.4)', background: 'rgba(255, 165, 0, 0.05)' }}>
                                <CardContent sx={{ p: 3 }}>
                                    <Box display="flex" alignItems="center" gap={2} mb={1}>
                                        <Avatar sx={{ bgcolor: 'orange', width: 32, height: 32 }}><Star size={16} /></Avatar>
                                        <Typography variant="caption" fontWeight="900" sx={{ color: 'orange' }}>PARTNERSHIP VISION</Typography>
                                    </Box>
                                    <Typography variant="subtitle2" fontWeight="950" sx={{ mb: 1 }}>BECOME A PRAYER PALACE PARTNER</Typography>
                                    <Typography variant="caption" sx={{ opacity: 0.6, fontStyle: 'italic', fontWeight: 700, display: 'block', mb: 2 }}>
                                        "Partnering with Prayer Palace Apostolic Ministry for Global impact by making sure the church Budget is met"
                                    </Typography>
                                    <Button variant="outlined" fullWidth size="small" onClick={() => setEnrollModalOpen(true)}
                                        sx={{ borderColor: 'orange', color: 'orange', fontWeight: 900, borderRadius: 0, fontSize: '0.65rem', '&:hover': { bgcolor: 'orange', color: 'black' } }}
                                    > ENROLL IN PARTNERSHIP </Button>
                                </CardContent>
                            </Card>
                        </Stack>
                    </Grid>
                </Grid>
            </Container>

            {/* Modals - Aligned with PastorsDashboardraw terminal feel */}
            <ProjectFormModal open={projectModal.open} onClose={() => setProjectModal({ open: false, data: null })} project={projectModal.data} onSuccess={() => queryClient.invalidateQueries(['dashboard-sync', effectiveId])} />
            <EventFormModal open={eventModal.open} onClose={() => setEventModal({ open: false, data: null })} event={eventModal.data} onSuccess={() => queryClient.invalidateQueries(['dashboard-sync', effectiveId])} />
            <PlanFormModal open={planModal.open} onClose={() => setPlanModal({ open: false, data: null })} plan={planModal.data} onSuccess={() => queryClient.invalidateQueries(['dashboard-sync', effectiveId])} />
            <AnnouncementFormModal open={announcementModal.open} onClose={() => setAnnouncementModal({ open: false, data: null })} announcement={announcementModal.data} onSuccess={() => queryClient.invalidateQueries(['dashboard-sync', effectiveId])} />

            {/* 💰 COVENANT PARTNERSHIP ENROLLMENT MODAL - pixel-perfect from PastorsDashboard */}
            <Modal
                open={enrollModalOpen}
                onClose={() => setEnrollModalOpen(false)}
                closeAfterTransition
                BackdropComponent={Backdrop}
                BackdropProps={{ timeout: 500, sx: { backdropFilter: 'blur(12px)', bgcolor: 'rgba(0,0,0,0.8)' } }}
            >
                <Fade in={enrollModalOpen}>
                    <Box sx={{ 
                        position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
                        width: { xs: '90%', sm: 400 },
                        bgcolor: '#0a0a0a', border: '1px solid orange',
                        p: 4, outline: 'none', boxShadow: '0 0 60px rgba(255, 165, 0, 0.3)',
                        borderRadius: 0
                    }}>
                        <Box display="flex" alignItems="center" gap={2} mb={3}>
                            <Avatar sx={{ bgcolor: 'orange', width: 48, height: 48 }}><Star size={24} /></Avatar>
                            <Box>
                                <Typography variant="h5" fontWeight="950" sx={{ letterSpacing: -1 }}>COVENANT PARTNERSHIP</Typography>
                                <Typography variant="caption" sx={{ color: 'orange', fontWeight: 900 }}>STRATEGIC SEED ENROLLMENT</Typography>
                            </Box>
                        </Box>

                        <Typography variant="body2" sx={{ mb: 4, opacity: 0.7, lineHeight: 1.6 }}>
                            "Honor the Lord with your wealth and with the firstfruits of all your produce." <br/>
                            Enroll with a minimum monthly seed of <b>700 KES</b> to fuel the global mission.
                        </Typography>

                        <Stack spacing={3}>
                            <Box>
                                <Typography variant="caption" fontWeight="900" sx={{ mb: 1, display: 'block', opacity: 0.5 }}>AMOUNT TO PARTNER WITH (MIN 700 KES)</Typography>
                                <input 
                                    type="number" value={enrollAmount} onChange={(e) => setEnrollAmount(Number(e.target.value))}
                                    style={{ 
                                        width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255, 165, 0, 0.3)', 
                                        color: '#fff', padding: '12px', fontSize: '1.2rem', fontWeight: 900, outline: 'none'
                                    }}
                                />
                                {enrollAmount < 700 && (
                                    <Typography variant="caption" color="error" sx={{ mt: 0.5, display: 'block', fontWeight: 800 }}>Minimum amount is 700 KES</Typography>
                                )}
                            </Box>

                            <Button 
                                variant="contained" fullWidth 
                                disabled={enrollAmount < 700 || enrollPartnershipMutation.isLoading}
                                onClick={() => enrollPartnershipMutation.mutate(enrollAmount)}
                                sx={{ bgcolor: 'orange', color: '#000', fontWeight: 950, py: 1.5, borderRadius: 0, '&:hover': { bgcolor: '#ffb347' }, '&:disabled': { opacity: 0.5 } }}
                            >
                                {enrollPartnershipMutation.isLoading ? 'COMMITTING SEED...' : 'ENROLL AS PARTNER'}
                            </Button>

                            <Button fullWidth variant="text" onClick={() => setEnrollModalOpen(false)}
                                sx={{ color: 'rgba(255,255,255,0.4)', fontWeight: 800, fontSize: '0.7rem' }}
                            > DISMISS FOR NOW </Button>
                        </Stack>
                    </Box>
                </Fade>
            </Modal>

            <Snackbar open={toast.open} autoHideDuration={6000} onClose={() => setToast({ ...toast, open: false })} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}>
                <Alert severity={toast.severity} sx={{ width: '100%', fontWeight: 'bold', borderRadius: 0 }}>{toast.message}</Alert>
            </Snackbar>
        </DashboardLayout>
    );
}
