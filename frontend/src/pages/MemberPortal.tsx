import React, { useState } from 'react';
import { 
    Container, Grid, Typography, Box, Card, CardContent, Button, Avatar, Chip, 
    IconButton, LinearProgress, Modal, Backdrop, Fade, Stack, Divider,
    Snackbar, Alert
} from '@mui/material';
import { 
    Bell, Calendar, UserPlus, Baby, Heart, BookOpen, Quote, Star, 
    ArrowRight, Droplet, CheckCircle2, Clock, Sparkles, Megaphone, 
    ThumbsUp, Smile, Send
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../lib/api-client';
import DashboardLayout from '../components/layout/DashboardLayout';
import { Link } from 'react-router-dom';
import RequestBaptismModal from '../components/modals/RequestBaptismModal';

export default function MemberPortal() {
    const { user, updateUser } = useAuth();
    const queryClient = useQueryClient();
    const [baptismModalOpen, setBaptismModalOpen] = useState(false);
    const [calendarModalOpen, setCalendarModalOpen] = useState(false);
    const [enrollModalOpen, setEnrollModalOpen] = useState(false);
    const [appointmentModalOpen, setAppointmentModalOpen] = useState(false);
    const [enrollAmount, setEnrollAmount] = useState<number>(700);
    const [toast, setToast] = useState<{ open: boolean; message: string; severity: 'success' | 'error' | 'info' | 'warning' }>({
        open: false,
        message: '',
        severity: 'info'
    });

    // --- Data Streams ---
    const { data: syncData, isLoading: isSyncLoading } = useQuery(['dashboard-sync'], async () => {
        const res = await api.get('/dashboard/sync');
        return res.data;
    }, {
        enabled: !!user,
        refetchInterval: 5000, // 5s polling for real-time sync
        staleTime: 3000
    });

    const { data: devotion, isLoading: isDevotionLoading } = useQuery(['daily-devotion'], async () => {
        const res = await api.get('/devotions/daily');
        return res.data;
    });

    const devotionMutation = useMutation(async ({ type, value }: { type: string, value: string }) => {
        return await api.post(`/devotions/${devotion?.id}/interact`, { type, value });
    }, {
        onSuccess: () => queryClient.invalidateQueries(['daily-devotion'])
    });

    const createAppointmentMutation = useMutation(
        async (data: { targetRole: string, type: string, reason: string, preferredDate: string, preferredTime: string }) => 
            api.post('/appointments', data),
        {
            onSuccess: () => {
                setAppointmentModalOpen(false);
                setToast({ open: true, message: 'Appointment request submitted to the Administrator.', severity: 'success' });
                queryClient.invalidateQueries(['my-appointments']);
            },
            onError: (err: any) => {
                setToast({ open: true, message: err.response?.data?.error || 'Failed to submit request.', severity: 'error' });
            }
        }
    );

    const enrollPartnershipMutation = useMutation(
        async (amount: number) => api.post('/users/partnership/enroll', { amount }),
        {
            onSuccess: (data: any) => {
                updateUser({ isPartner: true });
                queryClient.invalidateQueries(['dashboard-sync']);
                setEnrollModalOpen(false);
                setToast({ open: true, message: data.data.message, severity: 'success' });
            },
            onError: (err: any) => {
                setToast({ open: true, message: err.response?.data?.error || 'Enrollment failed.', severity: 'error' });
            }
        }
    );

    const requestRenewalMutation = useMutation(
        async () => api.post('/users/card-renewal/request'),
        {
            onSuccess: () => {
                setToast({ open: true, message: 'Renewal request submitted. Processing...', severity: 'success' });
                queryClient.invalidateQueries(['dashboard-sync']);
            },
            onError: (err: any) => {
                setToast({ open: true, message: err.response?.data?.error || 'Failed to request renewal.', severity: 'error' });
            }
        }
    );

    const announcements = syncData?.announcements || [];
    const events = syncData?.events || [];
    const myChildren = syncData?.children || [];
    const baptisms = syncData?.baptisms || [];
    const activeBaptism = baptisms?.find((b: any) => b.status !== 'COMPLETED');

    const getStatusColor = (status: string) => {
        if (status.includes('APPROVED') || status === 'COMPLETED' || status === 'DEDICATED') return 'success';
        if (status.includes('PENDING')) return 'warning';
        return 'info';
    };

    return (
        <DashboardLayout>
            <style>
                {`
                    @keyframes marquee {
                        0% { transform: translateX(0); }
                        100% { transform: translateX(-50%); }
                    }
                    .mission-marquee-container {
                        display: flex;
                        gap: 16px;
                        animation: marquee 100s linear infinite;
                        width: max-content;
                    }
                    .mission-marquee-container:hover {
                        animation-play-state: paused;
                    }
                    @keyframes pulse-live {
                        0% { box-shadow: 0 0 0 0 rgba(79, 139, 255, 0.4); border-color: var(--primary); }
                        70% { box-shadow: 0 0 0 10px rgba(79, 139, 255, 0); border-color: var(--cyan); }
                        100% { box-shadow: 0 0 0 0 rgba(79, 139, 255, 0); border-color: var(--primary); }
                    }
                    .live-card {
                        animation: pulse-live 2s infinite;
                    }
                    .divine-mandate-card {
                        background: linear-gradient(135deg, rgba(0,0,0,0.6), rgba(79, 139, 255, 0.1)) !important;
                        border: 1px solid rgba(79, 139, 255, 0.3) !important;
                    }
                    .divine-text {
                        background: linear-gradient(90deg, #fff, var(--cyan), #fff);
                        background-size: 200% auto;
                        color: transparent;
                        -webkit-background-clip: text;
                        animation: shine 3s linear infinite;
                        font-weight: 950;
                    }
                    @keyframes shine {
                        to { background-position: 200% center; }
                    }
                `}
            </style>
            {/* 🗓️ CALENDAR TERMINAL (Animated floating element) */}
            <Box sx={{ position: 'fixed', bottom: 32, left: 32, zIndex: 10, display: { xs: 'none', lg: 'block' } }}>
                <Card
                    className="holographic-card floating"
                    onClick={() => setCalendarModalOpen(true)}
                    sx={{
                        width: 140, cursor: 'pointer', p: 2, textAlign: 'center',
                        border: '1px solid var(--primary-glow)',
                        boxShadow: '0 0 20px rgba(79, 139, 255, 0.4)',
                        background: 'rgba(79, 139, 255, 0.1)'
                    }}
                >
                    <Calendar size={32} color="var(--primary)" style={{ margin: '0 auto 8px' }} />
                    <Typography variant="caption" fontWeight="950" sx={{ display: 'block', mb: 0.5 }}>CALENDAR</Typography>
                    <Typography variant="caption" color="primary" fontWeight="bold">{events.length} UPCOMING</Typography>
                </Card>
            </Box>

            <Container maxWidth="xl" sx={{ mt: 2 }}>
                <Box sx={{ mb: 8, textAlign: 'center', maxWidth: 900, mx: 'auto' }}>
                    <Typography variant="h2" fontWeight="950" className="glow-text" sx={{ letterSpacing: -3, mb: 1, fontSize: { xs: '2.5rem', md: '4rem' } }}>
                        PRAYER <span className="text-cyan/70">PALACE PORTAL</span>
                    </Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2, mb: 2, flexWrap: 'wrap' }}>
                        <Typography variant="subtitle1" fontWeight="800" color="textSecondary">
                            WELCOME, <span style={{ color: 'var(--cyan)' }}>{user?.name?.toUpperCase()}</span>
                        </Typography>
                        {user?.department?.name && (
                            <Chip 
                                label={user.department.name.toUpperCase()} 
                                size="small" 
                                sx={{ bgcolor: 'rgba(193, 117, 255, 0.1)', color: '#c175ff', fontWeight: 900, borderRadius: 0, border: '1px solid rgba(193, 117, 255, 0.2)' }} 
                            />
                        )}
                        {syncData?.isPartner && (
                            <Chip 
                                icon={<Star size={12} />}
                                label="COVENANT PARTNER" 
                                size="small" 
                                sx={{ bgcolor: 'rgba(255, 165, 0, 0.1)', color: 'orange', fontWeight: 950, borderRadius: 0, border: '1px solid rgba(255, 165, 0, 0.3)', '.MuiChip-icon': { color: 'orange' } }} 
                            />
                        )}
                    </Box>

                    {(() => {
                        if (!user?.membershipExpiry) return null;
                        const expiry = new Date(user.membershipExpiry);
                        const now = new Date();
                        const diffTime = expiry.getTime() - now.getTime();
                        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                        const isExpired = diffDays <= 0;
                        const isGracePeriod = diffDays > -14 && diffDays <= 0;
                        const canRenew = diffDays <= 21;

                        if (isExpired) {
                            return (
                                <Alert 
                                    severity="error" 
                                    variant="filled"
                                    sx={{ 
                                        mb: 4, 
                                        bgcolor: '#ff0000', 
                                        color: '#fff', 
                                        fontWeight: 900,
                                        borderRadius: 0,
                                        animation: 'pulse-live 2s infinite',
                                        '& .MuiAlert-icon': { color: '#fff' }
                                    }}
                                    action={
                                        user?.isCardReplacementRequested ? (
                                            <Chip label="RENEWAL PENDING" size="small" sx={{ bgcolor: 'rgba(255,255,255,0.2)', color: '#fff', fontWeight: 900, borderRadius: 0 }} />
                                        ) : (
                                            <Button 
                                                color="inherit" 
                                                size="small" 
                                                variant="outlined" 
                                                onClick={() => requestRenewalMutation.mutate()}
                                                sx={{ fontWeight: 950, borderRadius: 0 }}
                                            >
                                                REQUEST NEW CARD
                                            </Button>
                                        )
                                    }
                                >
                                    {isGracePeriod 
                                        ? `DANGER: YOUR MEMBERSHIP CARD EXPIRED ON ${expiry.toLocaleDateString()}. GRACE PERIOD ENDS IN ${14 + diffDays} DAYS.`
                                        : `CRITICAL: MEMBERSHIP CARD EXPIRED. PLEASE REQUEST A NEW CARD IMMEDIATELY TO RETAIN ACCESS.`
                                    }
                                </Alert>
                            );
                        }

                        if (canRenew) {
                            return (
                                <Alert 
                                    severity="warning" 
                                    variant="outlined"
                                    sx={{ 
                                        mb: 4, 
                                        border: '1px solid orange', 
                                        color: 'orange', 
                                        fontWeight: 900,
                                        borderRadius: 0,
                                        '& .MuiAlert-icon': { color: 'orange' }
                                    }}
                                    action={
                                        user?.isCardReplacementRequested ? (
                                            <Chip label="REQUESTED" size="small" sx={{ bgcolor: 'rgba(255, 165, 0, 0.2)', color: 'orange', fontWeight: 900, borderRadius: 0 }} />
                                        ) : (
                                            <Button 
                                                color="warning" 
                                                size="small" 
                                                variant="contained" 
                                                onClick={() => requestRenewalMutation.mutate()}
                                                sx={{ fontWeight: 950, borderRadius: 0, bgcolor: 'orange', color: '#000' }}
                                            >
                                                RENEW CARD NOW
                                            </Button>
                                        )
                                    }
                                >
                                    YOUR CARD EXPIRES IN {diffDays} DAYS. RENEWAL IS NOW OPEN.
                                </Alert>
                            );
                        }

                        return (
                            <Box sx={{ mb: 4, p: 2, bgcolor: 'rgba(255,255,255,0.03)', border: '1px dashed rgba(255,255,255,0.1)', textAlign: 'center' }}>
                                <Typography variant="caption" fontWeight="900" sx={{ opacity: 0.6 }}>
                                    MEMBERSHIP ACTIVE UNTIL {expiry.toLocaleDateString()} | RENEWAL OPENS {new Date(expiry.getTime() - 21 * 24 * 60 * 60 * 1000).toLocaleDateString()}
                                </Typography>
                            </Box>
                        );
                    })()}

                    <Box sx={{ display: 'flex', justifyContent: 'center', gap: 2, flexWrap: 'wrap' }}>
                        <Chip 
                            label={`YEAR: ${syncData?.ministrySettings?.themeOfYear || 'YEAR OF DIVINE ESTABLISHMENT'}`} 
                            size="small" 
                            sx={{ bgcolor: 'rgba(79, 139, 255, 0.1)', color: 'var(--primary)', fontWeight: 900, borderRadius: 0 }} 
                        />
                        <Chip 
                            label={`MONTH: ${syncData?.ministrySettings?.themeOfMonth || 'MONTH OF NEW BEGINNINGS'}`} 
                            size="small" 
                            sx={{ bgcolor: 'rgba(0, 180, 216, 0.1)', color: 'var(--cyan)', fontWeight: 900, borderRadius: 0 }} 
                        />
                    </Box>
                </Box>

                <Grid container spacing={4} sx={{ alignItems: 'stretch' }}>
                    {/* Left Column: Spiritual & Workflows */}
                    <Grid item xs={12} lg={7}>
                        {/* ✨ DAILY DEVOTION ENGINE */}
                        <Card className="holographic-card" sx={{ mb: 6, p: 1 }}>
                            <CardContent>
                                <Box display="flex" justifyContent="space-between" alignItems="center" mb={4}>
                                    <Box display="flex" alignItems="center" gap={2}>
                                        <Sparkles size={24} color="var(--cyan)" />
                                        <Typography variant="h5" fontWeight="950" sx={{ letterSpacing: -1 }}>DAILY DEVOTION</Typography>
                                    </Box>
                                    <Chip 
                                        label={devotion?.themeOfMonth?.toUpperCase() || syncData?.ministrySettings?.themeOfMonth?.toUpperCase()} 
                                        size="small" variant="outlined" 
                                        sx={{ color: 'var(--cyan)', borderColor: 'var(--cyan-glow)', fontWeight: 900 }} 
                                    />
                                </Box>

                                {isDevotionLoading ? <LinearProgress /> : 
                                    !devotion ? (
                                        <Box sx={{ p: 4, textAlign: 'center', border: '1px dashed rgba(0,255,255,0.3)', bgcolor: 'rgba(0,255,255,0.02)', borderRadius: 2 }}>
                                            <Sparkles size={24} color="var(--cyan)" style={{ marginBottom: 8, opacity: 0.5 }} />
                                            <Typography variant="subtitle2" fontWeight="950" sx={{ color: 'var(--cyan)', opacity: 0.7 }}>AWAITING TODAY&apos;S MINISTERIAL DEVOTION</Typography>
                                            <Typography variant="caption" sx={{ display: 'block', mt: 1, opacity: 0.5 }}>The leadership has not yet published the devotion for today.</Typography>
                                        </Box>
                                    ) : (
                                    <>
                                        <Typography variant="h4" fontWeight="950" sx={{ mb: 2, color: 'primary.main', opacity: 0.9 }}>
                                            {devotion?.title}
                                        </Typography>
                                        <Typography variant="body1" sx={{ mb: 4, lineHeight: 1.8, fontSize: '1.1rem', opacity: 0.8, fontStyle: 'italic' }}>
                                            &quot;{devotion?.content}&quot;
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
                                                        <Button
                                                            key={btn.value}
                                                            size="small"
                                                            startIcon={<btn.icon size={16} />}
                                                            onClick={() => devotionMutation.mutate({ type: btn.type, value: btn.value })}
                                                            sx={{ 
                                                                borderRadius: 20, 
                                                                px: 2,
                                                                bgcolor: isActive ? 'rgba(0,180,216,0.2)' : 'rgba(255,255,255,0.03)',
                                                                color: isActive ? 'var(--cyan)' : 'inherit',
                                                                border: isActive ? '1px solid var(--cyan)' : '1px solid transparent',
                                                                '&:hover': { bgcolor: 'rgba(255,255,255,0.1)' }
                                                            }}
                                                        >
                                                            {btn.label} {count > 0 && `(${count})`}
                                                        </Button>
                                                    );
                                                })}
                                            </Stack>
                                            <Typography variant="caption" fontWeight="900" sx={{ opacity: 0.5 }}>
                                                THEME: {devotion?.themeOfYear || syncData?.ministrySettings?.themeOfYear}
                                            </Typography>
                                        </Box>
                                    </>
                                )}
                            </CardContent>
                        </Card>

                        {/* Tactical Access Grid (Removed Message Leaders) */}
                        <Typography variant="caption" fontWeight="900" sx={{ letterSpacing: 2, color: 'primary.main', mb: 2, display: 'block', textAlign: 'center' }}>TACTICAL INTERFACE</Typography>
                        <Grid container spacing={2} mb={4} justifyContent="center">
                            {[
                                { label: 'REGISTER CHILD', icon: Baby, color: 'cyan', href: '/register-child' },
                                { label: 'BAPTISM REQ', icon: Droplet, color: 'info', onClick: () => setBaptismModalOpen(true) },
                                { label: 'MAKE APPOINTMENT', icon: Calendar, color: 'primary', onClick: () => setAppointmentModalOpen(true) },
                            ].map((action, i) => (
                                <Grid item xs={12} sm={4} key={i}>
                                    <Button
                                        fullWidth
                                        component={action.href ? Link : 'button'}
                                        {...(action.href ? { to: action.href } : { onClick: action.onClick })}
                                        sx={{
                                            height: 100,
                                            display: 'flex',
                                            flexDirection: 'column',
                                            gap: 1.5,
                                            bgcolor: 'rgba(255,255,255,0.02)',
                                            border: '1px solid var(--glass-border)',
                                            borderRadius: 0,
                                            color: 'white',
                                            '&:hover': {
                                                bgcolor: `rgba(var(--${action.color}-rgb || 0, 180, 216), 0.1)`,
                                                borderColor: `var(--${action.color})`,
                                                transform: 'translateY(-4px)'
                                            }
                                        }}
                                    >
                                        <action.icon size={24} color={`var(--${action.color})`} />
                                        <Typography variant="caption" fontWeight="950" sx={{ fontSize: '0.65rem' }}>{action.label}</Typography>
                                    </Button>
                                </Grid>
                            ))}
                        </Grid>

                        {/* 🌊 MISSION STREAM (Horizontal Slider) */}
                        <Box sx={{ mb: 6 }}>
                            <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                                <Typography variant="caption" fontWeight="900" sx={{ letterSpacing: 2, color: 'var(--cyan)' }}>DEPARTMENT UPDATES</Typography>
                                <Box display="flex" gap={1}>
                                    <IconButton size="small" sx={{ bgcolor: 'rgba(255,255,255,0.05)' }} onClick={() => document.getElementById('mission-stream')?.scrollBy({ left: -300, behavior: 'smooth' })}>
                                        <ArrowRight size={16} style={{ transform: 'rotate(180deg)' }} />
                                    </IconButton>
                                    <IconButton size="small" sx={{ bgcolor: 'rgba(255,255,255,0.05)' }} onClick={() => document.getElementById('mission-stream')?.scrollBy({ left: 300, behavior: 'smooth' })}>
                                        <ArrowRight size={16} />
                                    </IconButton>
                                </Box>
                            </Box>
                            
                            <Box 
                                id="mission-stream"
                                sx={{ 
                                    display: 'flex', 
                                    gap: 2, 
                                    overflowX: 'hidden', 
                                    pb: 0,
                                    scrollBehavior: 'smooth',
                                    '&::-webkit-scrollbar': { display: 'none' },
                                    msOverflowStyle: 'none',
                                    scrollbarWidth: 'none',
                                    position: 'relative',
                                    height: 120, // Allow for hovering cards
                                    alignItems: 'center'
                                }}
                            >
                                <style>
                                    {`
                                        @keyframes marquee {
                                            0% { transform: translateX(0); }
                                            100% { transform: translateX(-50%); }
                                        }
                                        .mission-marquee-container {
                                            display: flex;
                                            gap: 16px;
                                            animation: marquee 100s linear infinite;
                                            width: max-content;
                                        }
                                        .mission-marquee-container:hover {
                                            animation-play-state: paused;
                                        }
                                        @keyframes pulse-live {
                                            0% { box-shadow: 0 0 0 0 rgba(79, 139, 255, 0.4); border-color: var(--primary); }
                                            70% { box-shadow: 0 0 0 10px rgba(79, 139, 255, 0); border-color: var(--cyan); }
                                            100% { box-shadow: 0 0 0 0 rgba(79, 139, 255, 0); border-color: var(--primary); }
                                        }
                                        .live-card {
                                            animation: pulse-live 2s infinite;
                                        }
                                    `}
                                </style>
                                {(() => {
                                    const allItems = [
                                        ...(syncData?.events || []).map((e: any) => ({ ...e, type: 'EVENT', icon: Calendar, color: 'primary', isPersistent: new Date(e.date).toDateString() === new Date().toDateString() })),
                                        ...(syncData?.projects || []).map((p: any) => ({ ...p, type: 'PROJECT', icon: Star, color: 'cyan', isPersistent: p.status === 'IN_PROGRESS' })),
                                        ...(syncData?.plans || []).map((p: any) => ({ ...p, type: 'PLAN', icon: BookOpen, color: 'orange', isPersistent: p.approvalStatus === 'APPROVED' || p.approvalStatus === 'PENDING_APPROVAL' })),
                                        ...(syncData?.meetings || []).map((m: any) => ({ ...m, type: m.isPartnerOnly ? 'PARTNER MTG' : 'MEETING', icon: Clock, color: m.isPartnerOnly ? 'primary' : 'info', isPersistent: new Date(m.date).toDateString() === new Date().toDateString() })),
                                        ...(syncData?.announcements || []).map((a: any) => ({ ...a, type: 'INTEL', icon: Bell, color: 'error', isPersistent: a.priority === 'HIGH' })),
                                    ].filter(item => (item.departmentId === user?.departmentId || (item.type === 'PARTNER MTG' && syncData?.isPartner)))
                                     .sort((a,b) => new Date(b.createdAt || b.date).getTime() - new Date(a.createdAt || a.date).getTime());

                                    const streamingItems = allItems.filter(item => !item.isPersistent);
                                    // Triple-up for continuous marquee effect if small item count
                                    const doubledStreamingItems = [...streamingItems, ...streamingItems, ...streamingItems]; 

                                    return (
                                        <Box className="mission-marquee-container" sx={{ py: 1 }}>
                                            {doubledStreamingItems.map((item, i) => (
                                                <Card 
                                                    key={`${item.type}-${item.id}-${i}`}
                                                    sx={{ 
                                                        minWidth: 280, 
                                                        height: 100, 
                                                        bgcolor: 'rgba(255,255,255,0.02)', 
                                                        border: '1px solid var(--glass-border)',
                                                        borderRadius: 0,
                                                        flexShrink: 0,
                                                        cursor: 'pointer',
                                                        transition: 'all 0.3s',
                                                        '&:hover': { 
                                                            bgcolor: 'rgba(255,255,255,0.05)', 
                                                            borderColor: `var(--${item.color})`,
                                                            transform: 'scale(1.02)',
                                                            zIndex: 2
                                                        }
                                                    }}
                                                >
                                                    <CardContent sx={{ p: 2, height: '100%', display: 'flex', alignItems: 'center', gap: 2 }}>
                                                        <Avatar sx={{ bgcolor: `rgba(var(--${item.color}-rgb), 0.1)`, color: `var(--${item.color})`, width: 40, height: 40 }}>
                                                            <item.icon size={20} />
                                                        </Avatar>
                                                        <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                                                            <Box display="flex" alignItems="center" gap={1}>
                                                                <Typography variant="caption" fontWeight="900" color={item.color} sx={{ textTransform: 'uppercase', fontSize: '0.6rem' }}>{item.type}</Typography>
                                                                {(i % streamingItems.length === 0) && <Chip label="NEXT" size="small" sx={{ height: 14, fontSize: '0.55rem', fontWeight: 900, bgcolor: 'var(--cyan)', color: 'black', borderRadius: 0.5 }} />}
                                                            </Box>
                                                            <Typography variant="subtitle2" fontWeight="950" noWrap sx={{ display: 'block' }}>{item.title?.toUpperCase()}</Typography>
                                                            <Typography variant="caption" sx={{ opacity: 0.6, display: 'block' }}>{item.date ? new Date(item.date).toLocaleDateString() : 'ACTIVE'}</Typography>
                                                        </Box>
                                                        <ArrowRight size={16} style={{ opacity: 0.4 }} />
                                                    </CardContent>
                                                </Card>
                                            ))}
                                        </Box>
                                    );
                                })()}
                            </Box>
                        </Box>

                        {/* 🏢 CURRENTLY HAPPENING: DEPARTMENTAL MISSIONS */}
                        <Box sx={{ mb: 6 }}>
                            <Typography variant="caption" fontWeight="900" sx={{ letterSpacing: 2, color: 'primary.main', mb: 2, display: 'block' }}>CURRENTLY HAPPENING: DEPARTMENTAL MISSIONS</Typography>
                            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 2 }}>
                                {(() => {
                                    const deptId = user?.departmentId;
                                    const isToday = (d: string) => new Date(d).toDateString() === new Date().toDateString();
                                    const isTomorrow = (d: string) => {
                                        const tom = new Date(); tom.setDate(tom.getDate() + 1);
                                        return new Date(d).toDateString() === tom.toDateString();
                                    };

                                    const departmentalLiveOps = [
                                        ...(syncData?.events || []).map((e: any) => ({ ...e, type: 'EVENT', icon: Calendar, color: 'primary', isLive: isToday(e.date), isNext: isTomorrow(e.date) })),
                                        ...(syncData?.projects || []).map((p: any) => ({ ...p, type: 'PROJECT', icon: Star, color: 'cyan', isLive: p.status === 'IN_PROGRESS', isNext: false })),
                                        ...(syncData?.meetings || []).map((m: any) => ({ ...m, type: 'MEETING', icon: Clock, color: 'info', isLive: isToday(m.date), isNext: isTomorrow(m.date) })),
                                        ...(syncData?.plans || []).map((p: any) => ({ ...p, type: 'PLAN', icon: BookOpen, color: 'orange', isLive: p.approvalStatus === 'APPROVED' || p.approvalStatus === 'PENDING_APPROVAL', isNext: false })),
                                    ].filter(item => item.departmentId === deptId && (item.isLive || item.isNext));

                                    if (departmentalLiveOps.length === 0) {
                                        return (
                                            <Card sx={{ height: 100, bgcolor: 'rgba(255,255,255,0.01)', border: '1px dashed var(--glass-border)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                <Typography variant="caption" sx={{ opacity: 0.4, fontWeight: 800 }}>NO CURRENT OR UPCOMING MISSIONS IN YOUR DEPARTMENT</Typography>
                                            </Card>
                                        );
                                    }

                                    return departmentalLiveOps.map((item) => (
                                        <Card 
                                            key={`${item.type}-${item.id}`}
                                            className="live-card"
                                            sx={{ 
                                                height: 100, 
                                                bgcolor: item.isLive ? 'rgba(79, 139, 255, 0.1)' : 'rgba(0, 255, 255, 0.05)', 
                                                border: item.isLive ? '2px solid var(--primary)' : '1px solid var(--cyan)',
                                                borderRadius: 0,
                                                cursor: 'pointer',
                                                transition: 'all 0.3s',
                                                '&:hover': { bgcolor: 'rgba(79, 139, 255, 0.2)', transform: 'translateY(-4px)' }
                                            }}
                                        >
                                            <CardContent sx={{ p: 2, height: '100%', display: 'flex', alignItems: 'center', gap: 2 }}>
                                                <Avatar sx={{ bgcolor: item.isLive ? 'var(--primary)' : 'var(--cyan)', color: 'white', width: 44, height: 44, boxShadow: item.isLive ? '0 0 20px var(--primary-glow)' : 'none' }}>
                                                    <item.icon size={24} />
                                                </Avatar>
                                                <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                                                    <Box display="flex" alignItems="center" gap={1}>
                                                        <Typography variant="caption" fontWeight="950" sx={{ color: item.isLive ? 'var(--cyan)' : 'var(--primary)', textTransform: 'uppercase', fontSize: '0.65rem' }}>{item.type}</Typography>
                                                        <Chip 
                                                            label={item.isLive ? "LIVE" : "NEXT"} 
                                                            size="small" 
                                                            sx={{ height: 16, fontSize: '0.55rem', fontWeight: 900, bgcolor: item.isLive ? 'error.main' : 'var(--cyan)', color: 'white', border: 'none' }} 
                                                        />
                                                    </Box>
                                                    <Typography variant="h6" fontWeight="950" noWrap sx={{ fontSize: '0.9rem', letterSpacing: -0.5 }}>{item.title?.toUpperCase()}</Typography>
                                                    <Typography variant="caption" fontWeight="900" sx={{ opacity: 0.8, color: 'var(--primary)' }}>
                                                        {item.isLive ? 'MISSION ACTIVE' : 'UPCOMING ASSIGNMENT'}
                                                    </Typography>
                                                </Box>
                                                <ArrowRight size={20} color={item.isLive ? "var(--primary)" : "var(--cyan)"} />
                                            </CardContent>
                                        </Card>
                                    ));
                                })()}
                            </Box>
                        </Box>
                    </Grid>

                    {/* Right Column: Tactical Comms */}
                    <Grid item xs={12} lg={5}>
                        <Stack spacing={4}>
                            <Card className="holographic-card" sx={{ p: 0, borderRadius: 0, mb: 4 }}>
                                <CardContent sx={{ p: 3 }}>
                                    <Box display="flex" alignItems="center" gap={1.5} mb={3}>
                                        <Calendar size={20} color="var(--primary)" />
                                        <Typography variant="caption" fontWeight="950" sx={{ letterSpacing: 2 }}>CHURCH MISSION TIMELINE</Typography>
                                    </Box>
                                    <Stack spacing={2} sx={{ maxHeight: 400, overflowY: 'auto', pr: 1, '&::-webkit-scrollbar': { width: 4 }, '&::-webkit-scrollbar-thumb': { bgcolor: 'rgba(255,255,255,0.1)' } }}>
                                        {(() => {
                                            const timeline = [
                                                ...(syncData?.events || []).map((e: any) => ({ ...e, type: 'EVENT', icon: Calendar, color: 'primary' })),
                                                ...(syncData?.projects || []).map((p: any) => ({ ...p, type: 'PROJECT', icon: Star, color: 'cyan' })),
                                                ...(syncData?.plans || []).map((p: any) => ({ ...p, type: 'PLAN', icon: BookOpen, color: 'orange' })),
                                            ].sort((a, b) => new Date(a.date || a.createdAt).getTime() - new Date(b.date || b.createdAt).getTime());

                                            if (timeline.length === 0) return <Typography variant="caption" sx={{ opacity: 0.3, textAlign: 'center', py: 2 }}>NO UPCOMING MISSIONS</Typography>;

                                            return timeline.map((item, idx) => (
                                                <Box key={idx} sx={{ display: 'flex', gap: 2, p: 2, bgcolor: 'rgba(255,255,255,0.02)', borderLeft: `3px solid var(--${item.color})` }}>
                                                    <Box sx={{ minWidth: 45, textAlign: 'center' }}>
                                                        <Typography variant="h6" fontWeight="950" sx={{ lineHeight: 1 }}>{item.date || item.createdAt ? (new Date(item.date || item.createdAt).getDate() || '--') : '--'}</Typography>
                                                        <Typography variant="caption" sx={{ fontSize: '0.6rem', opacity: 0.6 }}>{item.date || item.createdAt ? new Date(item.date || item.createdAt).toLocaleString('default', { month: 'short' }).toUpperCase() : 'N/A'}</Typography>
                                                    </Box>
                                                    <Box sx={{ flexGrow: 1 }}>
                                                        <Typography variant="subtitle2" fontWeight="950" sx={{ lineHeight: 1.2 }}>{item.title?.toUpperCase()}</Typography>
                                                        <Typography variant="caption" sx={{ opacity: 0.5, display: 'block' }}>{item.type} | {item.location || 'GLOBAL'}</Typography>
                                                    </Box>
                                                </Box>
                                            ));
                                        })()}
                                    </Stack>
                                </CardContent>
                            </Card>

                            <Card className="holographic-card" sx={{ p: 0, borderRadius: 0 }}>
                                <CardContent sx={{ p: 3 }}>
                                    <Box display="flex" alignItems="center" gap={1.5} mb={4}>
                                        <Bell size={20} color="var(--primary)" />
                                        <Typography variant="caption" fontWeight="950" sx={{ letterSpacing: 2 }}>LATEST CHURCH INTEL</Typography>
                                    </Box>

                                    <Stack spacing={2}>
                                        {/* 💰 PARTNER INTELLIGENCE / CTA */}
                                        {/* 💰 PARTNER INTELLIGENCE / CTA */}
                                        <Card 
                                            sx={{ 
                                                p: 0, 
                                                borderRadius: 0, 
                                                border: syncData?.isPartner ? '1px solid var(--primary-glow)' : '1px solid rgba(255, 165, 0, 0.4)',
                                                background: syncData?.isPartner ? 'rgba(79, 139, 255, 0.05)' : 'rgba(255, 165, 0, 0.05)'
                                            }}
                                        >
                                            {syncData?.isPartner ? (
                                                <CardContent sx={{ p: 2 }}>
                                                    <Box display="flex" alignItems="center" gap={2} mb={2}>
                                                        <Avatar sx={{ bgcolor: 'orange', width: 32, height: 32, boxShadow: '0 0 10px rgba(255,165,0,0.5)' }}><Star size={16} /></Avatar>
                                                        <Typography variant="caption" fontWeight="1000" sx={{ color: 'orange', letterSpacing: 1 }}>COVENANT PARTNERSHIP STATUS</Typography>
                                                    </Box>
                                                    
                                                    <Grid container spacing={1} mb={2}>
                                                        <Grid item xs={6}>
                                                            <Typography variant="caption" sx={{ opacity: 0.5, fontWeight: 800 }}>COMMITTED</Typography>
                                                            <Typography variant="h6" fontWeight={950}>{(syncData?.partnership?.amount || 0).toLocaleString()} KES</Typography>
                                                        </Grid>
                                                        <Grid item xs={6}>
                                                            <Typography variant="caption" sx={{ opacity: 0.5, fontWeight: 800 }}>PAID TO DATE</Typography>
                                                            <Typography variant="h6" fontWeight={950} color="success.main">{(syncData?.partnership?.paidAmount || 0).toLocaleString()} KES</Typography>
                                                        </Grid>
                                                        <Grid item xs={12}>
                                                            <Box sx={{ mt: 1, p: 1.5, bgcolor: 'rgba(255,0,0,0.05)', border: '1px solid rgba(255,0,0,0.1)', textAlign: 'center' }}>
                                                                <Typography variant="caption" fontWeight={900} color="error" sx={{ display: 'block' }}>
                                                                    OUTSTANDING BALANCE: {(syncData?.partnership?.balance || 0).toLocaleString()} KES
                                                                </Typography>
                                                                <Typography variant="caption" sx={{ fontSize: '0.65rem', fontWeight: 700, opacity: 0.7, mt: 0.5, display: 'block' }}>
                                                                    KINDLY PURPOSE TO COMPLETE YOUR PARTNERSHIP AMOUNT FOR THE CHURCH BUDGET
                                                                </Typography>
                                                            </Box>
                                                        </Grid>
                                                    </Grid>

                                                    <Typography variant="caption" sx={{ opacity: 0.6, fontStyle: 'italic', fontWeight: 700 }}>
                                                    &quot;Partnering with Prayer Palace Apostolic Ministry for Global impact by making sure the church Budget is met&quot;
                                                    </Typography>
                                                </CardContent>
                                            ) : (
                                                <CardContent sx={{ p: 2 }}>
                                                    <Box display="flex" alignItems="center" gap={2} mb={1}>
                                                        <Avatar sx={{ bgcolor: 'orange', width: 32, height: 32 }}><Star size={16} /></Avatar>
                                                        <Typography variant="caption" fontWeight="900" sx={{ color: 'orange' }}>PARTNERSHIP VISION</Typography>
                                                    </Box>
                                                    <Typography variant="subtitle2" fontWeight="950" sx={{ mb: 1 }}>BECOME A PRAYER PALACE PARTNER</Typography>
                                                    <Typography variant="caption" sx={{ opacity: 0.7, display: 'block', mb: 2, lineHeight: 1.4 }}>
                                                        Fuel the mission. Enroll monthly to receive strategic financial intelligence. Renew with varying amounts as led.
                                                    </Typography>
                                                    <Button 
                                                        variant="outlined" 
                                                        fullWidth 
                                                        size="small" 
                                                        component={Link}
                                                        to="/"
                                                        onClick={(e) => { e.preventDefault(); setEnrollModalOpen(true); }}
                                                        sx={{ borderColor: 'orange', color: 'orange', fontWeight: 900, borderRadius: 0, fontSize: '0.65rem' }}
                                                    >
                                                        ENROLL IN PARTNERSHIP
                                                    </Button>
                                                </CardContent>
                                            )}
                                        </Card>

                                        {(() => {
                                            const globalIntel = [
                                                ...(syncData?.announcements || []).filter((a: any) => a.isGlobal).map((a: any) => ({ ...a, intelType: 'CHURCH UPDATE', icon: Megaphone, color: 'cyan' })),
                                                ...(syncData?.events || []).filter((e: any) => e.isMajor).map((e: any) => ({ ...e, intelType: 'MAJOR EVENT', icon: Calendar, color: 'primary' })),
                                                ...(syncData?.projects || []).filter((p: any) => p.isMajor).map((p: any) => ({ ...p, intelType: 'STRATEGIC PROJECT', icon: Star, color: 'cyan' })),
                                                ...(syncData?.plans || []).filter((p: any) => p.isMajor).map((p: any) => ({ ...p, intelType: 'MINISTRY PLAN', icon: BookOpen, color: 'orange' })),
                                            ].sort((a,b) => new Date(b.createdAt || b.date).getTime() - new Date(a.createdAt || a.date).getTime()).slice(0, 5);

                                            if (globalIntel.length === 0) {
                                                return (
                                                    <Typography variant="caption" sx={{ textAlign: 'center', opacity: 0.3, py: 4, fontWeight: 900 }}>
                                                        NO GLOBAL INTEL REPORTED
                                                    </Typography>
                                                );
                                            }

                                            return globalIntel.map((intel) => (
                                                <Card key={`${intel.intelType}-${intel.id}`} sx={{ p: 0, bgcolor: 'rgba(255,255,255,0.02)', borderLeft: `3px solid var(--${intel.color})`, borderRadius: 0 }}>
                                                    <CardContent sx={{ p: 2 }}>
                                                        <Box display="flex" alignItems="center" gap={1} mb={0.5}>
                                                            <intel.icon size={12} color={`var(--${intel.color})`} />
                                                            <Typography variant="caption" fontWeight="950" color={intel.color}>{intel.intelType}</Typography>
                                                        </Box>
                                                        <Typography variant="subtitle2" fontWeight="950" sx={{ lineHeight: 1.2 }}>{intel.title?.toUpperCase()}</Typography>
                                                        {intel.content && (
                                                            <Typography variant="caption" sx={{ opacity: 0.6, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', mt: 0.5, lineHeight: 1.3 }}>
                                                                {intel.content}
                                                            </Typography>
                                                        )}
                                                        <Box display="flex" justifyContent="space-between" alignItems="center" mt={1}>
                                                            <Typography variant="caption" sx={{ opacity: 0.4, fontSize: '0.6rem', fontWeight: 700 }}>
                                                                {new Date(intel.createdAt || intel.date).toLocaleDateString()}
                                                            </Typography>
                                                            <Button size="small" sx={{ p: 0, minWidth: 0, color: 'var(--cyan)', fontWeight: 900, fontSize: '0.65rem' }}>DETAILS</Button>
                                                        </Box>
                                                    </CardContent>
                                                </Card>
                                            ));
                                        })()}
                                    </Stack>
                                </CardContent>
                            </Card>

                            <Card className="holographic-card divine-mandate-card" sx={{ p: 4, border: '1px solid var(--primary-glow) !important' }}>
                                <Typography variant="h6" fontWeight="950" mb={1} sx={{ color: 'var(--cyan)', letterSpacing: 2 }}>DIVINE MANDATE</Typography>
                                {!syncData?.affirmation ? (
                                    <Typography variant="h5" sx={{ opacity: 0.5, lineHeight: 1.4, fontStyle: 'italic' }}>
                                        Awaiting today&apos;s mandate...
                                    </Typography>
                                ) : (
                                    <Typography variant="h5" className="divine-text" sx={{ opacity: 0.9, lineHeight: 1.4, fontStyle: 'italic' }}>
                                        &quot;{syncData.affirmation.content}&quot;
                                    </Typography>
                                )}
                            </Card>
                        </Stack>
                    </Grid>
                </Grid>
            </Container>

            {/* 🗓️ CALENDAR MODAL */}
            <Modal
                open={calendarModalOpen}
                onClose={() => setCalendarModalOpen(false)}
                closeAfterTransition
                BackdropComponent={Backdrop}
                BackdropProps={{ timeout: 500, sx: { backdropFilter: 'blur(8px)' } }}
            >
                <Fade in={calendarModalOpen}>
                    <Box sx={{ 
                        position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
                        width: { xs: '90%', sm: 500 },
                        bgcolor: 'var(--bg-color)', border: '2px solid var(--primary)',
                        p: 4, outline: 'none', boxShadow: '0 0 50px var(--primary-glow)'
                    }}>
                        <Typography variant="h4" fontWeight="950" sx={{ mb: 4, letterSpacing: -2 }}>CHURCH <span className="text-primary/70">OPERATIONS</span></Typography>
                        <Stack spacing={3}>
                            {events.map((evt: any) => (
                                <Box key={evt.id} display="flex" gap={3} sx={{ p: 2, bgcolor: 'rgba(255,255,255,0.03)', border: '1px solid var(--glass-border)' }}>
                                    <Box sx={{ 
                                        minWidth: 60, height: 60, bgcolor: 'rgba(79, 139, 255, 0.1)', 
                                        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' 
                                    }}>
                                        <Typography variant="h6" fontWeight="950">{new Date(evt.date).getDate()}</Typography>
                                        <Typography variant="caption" sx={{ fontSize: '0.6rem' }}>{new Date(evt.date).toLocaleString('default', { month: 'short' }).toUpperCase()}</Typography>
                                    </Box>
                                    <Box>
                                        <Typography variant="subtitle1" fontWeight="950">{evt.title?.toUpperCase()}</Typography>
                                        <Typography variant="caption" color="textSecondary" sx={{ display: 'block' }}>{evt.location}</Typography>
                                        <Typography variant="caption" color="primary" sx={{ fontWeight: 'bold' }}>{new Date(evt.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Typography>
                                    </Box>
                                </Box>
                            ))}
                        </Stack>
                        <Button fullWidth variant="contained" sx={{ mt: 4, py: 1.5, fontWeight: 950 }} onClick={() => setCalendarModalOpen(false)}>CLOSE TERMINAL</Button>
                    </Box>
                </Fade>
            </Modal>

            {/* 💰 PARTNERSHIP ENROLLMENT MODAL */}
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
                            &quot;Honor the Lord with your wealth and with the firstfruits of all your produce.&quot; <br/>
                            Enroll with a minimum monthly seed of <b>700 KES</b> to fuel the global mission.
                        </Typography>

                        <Stack spacing={3}>
                            <Box>
                                <Typography variant="caption" fontWeight="900" sx={{ mb: 1, display: 'block', opacity: 0.5 }}>AMOUNT TO PARTNER WITH (MIN 700 KES)</Typography>
                                <input 
                                    type="number" 
                                    value={enrollAmount}
                                    onChange={(e) => setEnrollAmount(Number(e.target.value))}
                                    style={{ 
                                        width: '100%', 
                                        background: 'rgba(255,255,255,0.05)', 
                                        border: '1px solid rgba(255, 165, 0, 0.3)', 
                                        color: '#fff', 
                                        padding: '12px', 
                                        fontSize: '1.2rem', 
                                        fontWeight: 900,
                                        outline: 'none'
                                    }}
                                />
                                {enrollAmount < 700 && (
                                    <Typography variant="caption" color="error" sx={{ mt: 0.5, display: 'block', fontWeight: 800 }}>Minimum amount is 700 KES</Typography>
                                )}
                            </Box>

                            <Button 
                                variant="contained" 
                                fullWidth 
                                disabled={enrollAmount < 700 || enrollPartnershipMutation.isLoading}
                                onClick={() => enrollPartnershipMutation.mutate(enrollAmount)}
                                sx={{ 
                                    bgcolor: 'orange', 
                                    color: '#000', 
                                    fontWeight: 950, 
                                    py: 1.5,
                                    borderRadius: 0,
                                    '&:hover': { bgcolor: '#ffb347' },
                                    '&:disabled': { opacity: 0.5 }
                                }}
                            >
                                {enrollPartnershipMutation.isLoading ? 'COMMITTING SEED...' : 'ENROLL AS PARTNER'}
                            </Button>

                            <Button 
                                fullWidth 
                                variant="text" 
                                onClick={() => setEnrollModalOpen(false)}
                                sx={{ color: 'rgba(255,255,255,0.4)', fontWeight: 800, fontSize: '0.7rem' }}
                            >
                                DISMISS FOR NOW
                            </Button>
                        </Stack>
                    </Box>
                </Fade>
            </Modal>

            <RequestBaptismModal 
                open={baptismModalOpen} 
                onClose={() => setBaptismModalOpen(false)}
                onSuccess={() => queryClient.invalidateQueries(['dashboard-sync'])}
            />

            <Modal
                open={appointmentModalOpen}
                onClose={() => setAppointmentModalOpen(false)}
                closeAfterTransition
                BackdropComponent={Backdrop}
                BackdropProps={{ timeout: 500, sx: { backdropFilter: 'blur(10px)', bgcolor: 'rgba(0,0,0,0.8)' } }}
            >
                <Fade in={appointmentModalOpen}>
                    <Box sx={{ 
                        position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
                        width: { xs: '95%', sm: 500 },
                        bgcolor: '#0a0a0a', border: '1px solid var(--primary)',
                        p: 4, outline: 'none', boxShadow: '0 0 60px rgba(79, 139, 255, 0.2)',
                        borderRadius: 0,
                        maxHeight: '90vh',
                        overflowY: 'auto'
                    }}>
                        <Box display="flex" alignItems="center" gap={2} mb={3}>
                            <Avatar sx={{ bgcolor: 'var(--primary)', width: 48, height: 48 }}><Calendar size={24} /></Avatar>
                            <Box>
                                <Typography variant="h5" fontWeight="950" sx={{ letterSpacing: -1 }}>MAKE AN APPOINTMENT</Typography>
                                <Typography variant="caption" sx={{ color: 'var(--primary)', fontWeight: 900 }}>SPIRITUAL GUIDANCE & STRATEGIC MEETINGS</Typography>
                            </Box>
                        </Box>

                        <form onSubmit={(e) => {
                            e.preventDefault();
                            const formData = new FormData(e.currentTarget);
                            createAppointmentMutation.mutate({
                                targetRole: formData.get('targetRole') as string,
                                type: formData.get('type') as string,
                                reason: formData.get('reason') as string,
                                preferredDate: formData.get('preferredDate') as string,
                                preferredTime: formData.get('preferredTime') as string,
                            });
                        }}>
                            <Stack spacing={3}>
                                <Box>
                                    <Typography variant="caption" fontWeight="900" sx={{ mb: 1, display: 'block', opacity: 0.5 }}>WHO WOULD YOU LIKE TO SEE?</Typography>
                                    <select 
                                        name="targetRole"
                                        required
                                        style={{ 
                                            width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--glass-border)',
                                            color: '#fff', padding: '12px', fontSize: '1rem', fontWeight: 800, outline: 'none'
                                        }}
                                    >
                                        <option value="BISHOP" style={{ background: '#000' }}>THE BISHOP (HIGH LEVEL ADMIN)</option>
                                        <option value="PASTOR" style={{ background: '#000' }}>PASTOR</option>
                                        <option value="ASSOCIATE_PASTOR" style={{ background: '#000' }}>ASSOCIATE PASTOR</option>
                                    </select>
                                </Box>

                                <Box>
                                    <Typography variant="caption" fontWeight="900" sx={{ mb: 1, display: 'block', opacity: 0.5 }}>APPOINTMENT CATEGORY</Typography>
                                    <select 
                                        name="type"
                                        required
                                        style={{ 
                                            width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--glass-border)',
                                            color: '#fff', padding: '12px', fontSize: '1rem', fontWeight: 800, outline: 'none'
                                        }}
                                    >
                                        <option value="PRAYER" style={{ background: '#000' }}>PRAYER REQUEST</option>
                                        <option value="COUNSELING" style={{ background: '#000' }}>SPIRITUAL COUNSELING</option>
                                        <option value="DELIVERANCE" style={{ background: '#000' }}>DELIVERANCE SESSION</option>
                                        <option value="MEETING" style={{ background: '#000' }}>GENERAL MEETING</option>
                                    </select>
                                </Box>

                                <Box>
                                    <Typography variant="caption" fontWeight="900" sx={{ mb: 1, display: 'block', opacity: 0.5 }}>PREFERRED DATE</Typography>
                                    <input 
                                        type="date" 
                                        name="preferredDate"
                                        required
                                        min={new Date().toISOString().split('T')[0]}
                                        style={{ 
                                            width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--glass-border)',
                                            color: '#fff', padding: '12px', fontSize: '1rem', fontWeight: 800, outline: 'none'
                                        }}
                                    />
                                </Box>

                                <Box>
                                    <Typography variant="caption" fontWeight="900" sx={{ mb: 1, display: 'block', opacity: 0.5 }}>PREFERRED TIME</Typography>
                                    <input 
                                        type="time" 
                                        name="preferredTime"
                                        required
                                        style={{ 
                                            width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--glass-border)',
                                            color: '#fff', padding: '12px', fontSize: '1rem', fontWeight: 800, outline: 'none'
                                        }}
                                    />
                                </Box>

                                <Box>
                                    <Typography variant="caption" fontWeight="900" sx={{ mb: 1, display: 'block', opacity: 0.5 }}>REASON FOR APPOINTMENT</Typography>
                                    <textarea 
                                        name="reason"
                                        required
                                        rows={3}
                                        placeholder="Briefly describe your request..."
                                        style={{ 
                                            width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--glass-border)',
                                            color: '#fff', padding: '12px', fontSize: '1rem', fontWeight: 600, outline: 'none', resize: 'none'
                                        }}
                                    />
                                </Box>

                                <Button 
                                    type="submit"
                                    variant="contained" 
                                    fullWidth 
                                    disabled={createAppointmentMutation.isLoading}
                                    sx={{ 
                                        bgcolor: 'var(--primary)', color: '#fff', fontWeight: 950, py: 1.5,
                                        borderRadius: 0, '&:hover': { bgcolor: 'var(--primary-glow)' }
                                    }}
                                >
                                    {createAppointmentMutation.isLoading ? 'SUBMITTING REQUEST...' : 'SUBMIT APPOINTMENT REQUEST'}
                                </Button>

                                <Button 
                                    fullWidth 
                                    variant="text" 
                                    onClick={() => setAppointmentModalOpen(false)}
                                    sx={{ color: 'rgba(255,255,255,0.4)', fontWeight: 800, fontSize: '0.7rem' }}
                                >
                                    BACK TO PORTAL
                                </Button>
                            </Stack>
                        </form>
                    </Box>
                </Fade>
            </Modal>


            {/* 🔔 NOTIFICATION SYSTEM */}
            <Snackbar
                open={toast.open}
                autoHideDuration={6000}
                onClose={() => setToast({ ...toast, open: false })}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
            >
                <Alert 
                    onClose={() => setToast({ ...toast, open: false })} 
                    severity={toast.severity} 
                    variant="filled" 
                    sx={{ borderRadius: 0, fontWeight: 900 }}
                >
                    {toast.message}
                </Alert>
            </Snackbar>
        </DashboardLayout>
    );
}
