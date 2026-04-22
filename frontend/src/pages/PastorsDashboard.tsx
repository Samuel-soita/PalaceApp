import React, { useState } from 'react';
import {
    Container, Grid, Typography, Box, Card, CardContent, Button, Avatar, Chip,
    IconButton, LinearProgress, Modal, Backdrop, Fade, Stack, Divider,
    Snackbar, Alert, Badge
} from '@mui/material';
import {
    Bell, Calendar, UserPlus, Baby, Heart, BookOpen, Quote, Star,
    ArrowRight, Droplet, CheckCircle2, Clock, Sparkles, Megaphone,
    ThumbsUp, Smile, Send, Shield, ChevronRight, TrendingUp, Zap, Wrench, FileText
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../lib/api-client';
import DashboardLayout from '../components/layout/DashboardLayout';
import { Link } from 'react-router-dom';
import RequestBaptismModal from '../components/modals/RequestBaptismModal';
import BaptismManager from '../components/dashboard/BaptismManager';
import DedicationManager from '../components/dashboard/DedicationManager';
import AppointmentManager from '../components/dashboard/AppointmentManager';
import PartnershipManager from '../components/dashboard/PartnershipManager';
import EventFormModal from '../components/modals/EventFormModal';
import ProjectFormModal from '../components/modals/ProjectFormModal';
import PlanFormModal from '../components/modals/PlanFormModal';
import AnnouncementFormModal from '../components/modals/AnnouncementFormModal';
import DevotionFormModal from '../components/modals/DevotionFormModal';
import RepairApprovalManager from '../components/dashboard/RepairApprovalManager';
import MissionReportsViewer from '../components/dashboard/MissionReportsViewer';
import DepartmentReportModal from '../components/modals/DepartmentReportModal';
import { OperationalTimeline } from '../components/dashboard/OperationalTimeline';
import { BroadcastTrack } from '../components/dashboard/BroadcastTrack';
import { useLocalFirstDashboard } from '../hooks/useLocalFirstDashboard';
import SyncIndicator from '../components/SyncIndicator';

export default function PastorsDashboard() {
    const { user, updateUser } = useAuth();
    const queryClient = useQueryClient();

    // 👨‍⚖️ Module Scoping Helper
    const hasModule = (moduleName: string) => {
        if (['SUPER_ADMIN', 'SYSTEM_ADMIN', 'WATUA', 'BISHOP'].includes(user?.role || '')) return true;
        return user?.pastorModules?.some(m => m.moduleName === moduleName);
    };

    // Pastoral Tool States
    const [baptismsOpen, setBaptismsOpen] = useState(false);
    const [dedicationOpen, setDedicationOpen] = useState(false);
    const [appointmentsOpen, setAppointmentsOpen] = useState(false);
    const [partnershipManagerOpen, setPartnershipManagerOpen] = useState(false);
    const [devotionModalOpen, setDevotionModalOpen] = useState(false);

    // Personal Family States
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

    // Operational Commands
    const [projectModalOpen, setProjectModalOpen] = useState(false);
    const [eventModalOpen, setEventModalOpen] = useState(false);
    const [planModalOpen, setPlanModalOpen] = useState(false);
    const [announcementModalOpen, setAnnouncementModalOpen] = useState(false);
    const [reportModalOpen, setReportModalOpen] = useState(false);

    // ─── Edit States ────────────────────────────────────────────────────────
    const [editingProject, setEditingProject] = useState<any>(null);
    const [editingEvent, setEditingEvent] = useState<any>(null);
    const [editingPlan, setEditingPlan] = useState<any>(null);
    const [editingAnnouncement, setEditingAnnouncement] = useState<any>(null);

    // --- Data Streams (Tactical Mirror) ---
    const { data: syncData, isLoading: isSyncLoading } = useLocalFirstDashboard();
    
    // Legacy support for direct interaction, but display will favor syncData
    const devotion = syncData?.devotion;

    const { data: myDevotions, isLoading: isMyDevotionsLoading } = useQuery(['my-devotions'], async () => {
        const res = await api.get('/devotions/authored/me');
        return res.data?.data || [];
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

    const createAppointmentMutation = useMutation(
        async (data: { targetRole: string, type: string, reason: string, preferredDate: string, preferredTime: string }) =>
            api.post('/appointments', data),
        {
            onSuccess: () => {
                setAppointmentModalOpen(false);
                setToast({ open: true, message: 'Your personal appointment request submitted.', severity: 'success' });
                queryClient.invalidateQueries(['dashboard-sync']);
            },
            onError: (err: any) => {
                setToast({ open: true, message: err.response?.data?.error || 'Failed to submit request.', severity: 'error' });
            }
        }
    );

    // ─── Delete Mutation ─────────────────────────────────────────────────────
    const deleteMutation = useMutation(
        async ({ id, type }: { id: string; type: string }) => {
            const endpoint = {
                PROJECT: `/projects/${id}`,
                EVENT: `/events/${id}`,
                PLAN: `/plans/${id}`,
                MEETING: `/meetings/${id}`,
                ANNOUNCEMENT: `/announcements/${id}`
            }[type];
            return api.delete(endpoint!);
        },
        {
            onSuccess: () => {
                queryClient.invalidateQueries(['dashboard-sync']);
                setToast({ open: true, message: 'Record decommissioned successfully.', severity: 'success' });
            },
            onError: (err: any) => {
                setToast({
                    open: true,
                    message: err.response?.data?.error || 'Failed to delete record.',
                    severity: 'error'
                });
            }
        }
    );

    const handleEdit = (item: any) => {
        const type = item.type || (item.priority ? 'ANNOUNCEMENT' : 'PROJECT');
        if (type === 'PROJECT') { setEditingProject(item); setProjectModalOpen(true); }
        if (type === 'EVENT') { setEditingEvent(item); setEventModalOpen(true); }
        if (type === 'PLAN') { setEditingPlan(item); setPlanModalOpen(true); }
        if (type === 'ANNOUNCEMENT' || type === 'INTEL') { setEditingAnnouncement(item); setAnnouncementModalOpen(true); }
    };

    const handleDelete = (item: any) => {
        const type = item.type || (item.priority ? 'ANNOUNCEMENT' : 'PROJECT');
        deleteMutation.mutate({ id: item.id, type });
    };

    return (
        <DashboardLayout>
            <style>
                {`
                    @keyframes marquee-pastor {
                        0% { transform: translateX(0); }
                        100% { transform: translateX(-50%); }
                    }
                    .mission-marquee-pastor {
                        display: flex;
                        gap: 16px;
                        animation: marquee-pastor 1000s linear infinite;
                        width: max-content;
                    }
                    .mission-marquee-pastor:hover {
                        animation-play-state: paused;
                    }
                    @keyframes pulse-pastor-live {
                        0% { box-shadow: 0 0 0 0 rgba(0, 255, 255, 0.4); border-color: var(--cyan); }
                        70% { box-shadow: 0 0 0 10px rgba(0, 255, 255, 0); border-color: var(--primary); }
                        100% { box-shadow: 0 0 0 0 rgba(0, 255, 255, 0); border-color: var(--cyan); }
                    }
                    .pastor-live-card {
                        animation: pulse-pastor-live 2s infinite;
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

            <Container maxWidth="xl" sx={{ mt: 2 }}>
                {/* Header Section */}
                <Box sx={{ mb: 6, textAlign: 'center', maxWidth: 900, mx: 'auto' }}>
                    <Typography variant="h2" fontWeight="1000" sx={{
                        background: 'linear-gradient(45deg, #fff, var(--cyan))',
                        WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                        mb: 1, letterSpacing: -3, fontSize: { xs: '2.5rem', md: '4rem' }
                    }}>
                        PASTORAL <span className="text-primary/70">PALACE PORTAL</span>
                    </Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2, mb: 2, flexWrap: 'wrap' }}>
                        <Typography variant="subtitle1" fontWeight="800" color="textSecondary">
                            WELCOME, <span style={{ color: 'var(--cyan)' }}>{user?.name?.toUpperCase()}</span>
                        </Typography>
                        <Chip label={user?.role?.replace('_', ' ')} size="small" sx={{ bgcolor: 'rgba(0, 255, 255, 0.1)', color: 'var(--cyan)', fontWeight: 900, borderRadius: 0 }} />
                        
                        {/* OFFLINE STATUS INDICATOR */}
                        {syncData?.isOffline && (
                            <Chip 
                                label="LOCAL TACTICAL MODE" 
                                color="warning" 
                                size="small" 
                                sx={{ fontWeight: 900, borderRadius: 0, animation: 'pulse 2s infinite' }} 
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

                {/* 🛡️ APPROVAL MISSION TERMINAL (Items assigned to current user) */}
                {(() => {
                    const isForMe = (item: any) => 
                        item.targetPastorId === user?.id || 
                        (item.approvals || []).some((a: any) => a.userId === user?.id);

                    const pendingApprovals = [
                        ...(syncData?.projects || []).filter((p: any) => isForMe(p) && p.approvalStatus === 'PENDING_APPROVAL').map((p: any) => ({ ...p, type: 'PROJECT' })),
                        ...(syncData?.events || []).filter((e: any) => isForMe(e) && e.approvalStatus === 'PENDING_APPROVAL').map((e: any) => ({ ...e, type: 'EVENT' })),
                        ...(syncData?.plans || []).filter((p: any) => isForMe(p) && p.approvalStatus === 'PENDING_APPROVAL').map((p: any) => ({ ...p, type: 'PLAN' })),
                        ...(syncData?.announcements || []).filter((a: any) => isForMe(a) && a.status === 'PENDING').map((a: any) => ({ ...a, type: 'ANNOUNCEMENT' })),
                        ...(syncData?.meetings || []).filter((m: any) => isForMe(m) && m.meetingStatus === 'PENDING_APPROVAL').map((m: any) => ({ ...m, type: 'MEETING' })),
                        ...(syncData?.repairs || []).filter((r: any) => isForMe(r) && r.status?.includes('PENDING')).map((r: any) => ({ ...r, type: 'REPAIR' })),
                        ...(syncData?.transactions || []).filter((t: any) => isForMe(t) && t.status?.includes('PENDING')).map((t: any) => ({ ...t, type: 'FINANCE' }))
                    ];

                    if (pendingApprovals.length === 0) return null;

                    return (
                        <Box sx={{ mb: 6 }}>
                            <Box display="flex" alignItems="center" gap={1.5} mb={3}>
                                <Shield size={20} color="orange" />
                                <Typography variant="caption" fontWeight="1000" sx={{ color: 'orange', letterSpacing: 2 }}>
                                    CRITICAL: PENDING APPROVAL REQUESTS ({pendingApprovals.length})
                                </Typography>
                            </Box>
                            <Grid container spacing={2}>
                                {pendingApprovals.map((item) => (
                                    <Grid item xs={12} md={4} key={item.id}>
                                        <Card 
                                            className="holographic-card" 
                                            sx={{ 
                                                border: '1px solid orange', 
                                                bgcolor: 'rgba(255,165,0,0.05)',
                                                animation: 'pulse-pastor-live 3s infinite'
                                            }}
                                        >
                                            <CardContent sx={{ p: 2 }}>
                                                <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
                                                    <Typography variant="caption" fontWeight="950" color="orange">{item.type}</Typography>
                                                    <Chip label="ACTION REQUIRED" size="small" sx={{ height: 16, fontSize: '0.55rem', fontWeight: 950, bgcolor: 'orange', color: '#000' }} />
                                                </Box>
                                                <Typography variant="subtitle2" fontWeight="950" mb={1}>{item.title?.toUpperCase()}</Typography>
                                                <Typography variant="caption" sx={{ opacity: 0.6, display: 'block', mb: 2 }}>
                                                    Requested: {new Date(item.createdAt).toLocaleDateString()}
                                                </Typography>
                                                <Button 
                                                    variant="outlined" 
                                                    size="small" 
                                                    fullWidth 
                                                    onClick={() => handleEdit(item)}
                                                    sx={{ 
                                                        borderColor: 'orange', color: 'orange', fontWeight: 900, fontSize: '0.65rem',
                                                        '&:hover': { bgcolor: 'orange', color: 'black' }
                                                    }}
                                                >
                                                    REVIEW & APPROVE
                                                </Button>
                                            </CardContent>
                                        </Card>
                                    </Grid>
                                ))}
                            </Grid>
                        </Box>
                    );
                })()}

                <Grid container spacing={4}>
                    {/* Left Column (6): Spiritual, Personal & Major Intelligence */}
                    <Grid item xs={12} lg={6}>
                        {/* Interactive Devotion */}
                        <Card sx={{ mb: 4, bgcolor: 'rgba(255,255,255,0.02)', border: '1px solid var(--glass-border)', borderRadius: 4 }}>
                            <CardContent sx={{ p: 4 }}>
                                <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={2}>
                                    <Box display="flex" alignItems="center" gap={2}>
                                        <Sparkles size={24} color="var(--cyan)" />
                                        <Typography variant="h5" fontWeight="950" sx={{ letterSpacing: -1 }}>MINISTERIAL DEVOTION</Typography>
                                    </Box>
                                    {user?.pastorModules?.some(m => m.moduleName === 'DevotionPublishing') && (
                                        <Button 
                                            size="small" 
                                            variant="outlined" 
                                            onClick={() => setDevotionModalOpen(true)}
                                            sx={{ color: 'var(--cyan)', borderColor: 'var(--cyan-glow)', fontWeight: 900 }}
                                        >
                                            {devotion ? 'UPDATE DEVOTION' : 'POST DEVOTION'}
                                        </Button>
                                    )}
                                </Box>
                                <Chip
                                    label={devotion?.themeOfMonth?.toUpperCase() || syncData?.ministrySettings?.themeOfMonth?.toUpperCase()}
                                    size="small" variant="outlined"
                                    sx={{ color: 'var(--cyan)', borderColor: 'var(--cyan-glow)', fontWeight: 900, mb: 2 }}
                                />

                                {isSyncLoading ? <LinearProgress /> : (
                                    <>
                                        <Typography variant="h4" fontWeight="950" sx={{ mb: 2, color: 'primary.main', opacity: 0.9 }}>{devotion?.title}</Typography>
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
                                                        <Button key={btn.value} size="small" startIcon={<btn.icon size={16} />} onClick={() => devotionMutation.mutate({ type: btn.type, value: btn.value })}
                                                            sx={{ borderRadius: 20, px: 2, bgcolor: isActive ? 'rgba(0,180,216,0.2)' : 'rgba(255,255,255,0.03)', color: isActive ? 'var(--cyan)' : 'inherit', border: isActive ? '1px solid var(--cyan)' : '1px solid transparent' }}
                                                        >
                                                            {btn.label} {count > 0 && `(${count})`}
                                                        </Button>
                                                    );
                                                })}
                                            </Stack>
                                            <Typography variant="caption" fontWeight="900" sx={{ opacity: 0.4 }}>{new Date().toLocaleDateString()}</Typography>
                                        </Box>
                                    </>
                                )}
                            </CardContent>
                        </Card>

                        {/* Recent Authored Devotions - Personal History */}
                        {myDevotions && myDevotions.length > 0 && (
                            <Card sx={{ mb: 4, bgcolor: 'rgba(0, 255, 255, 0.02)', border: '1px solid rgba(0, 255, 255, 0.1)', borderRadius: 4 }}>
                                <CardContent sx={{ p: 4 }}>
                                    <Box display="flex" alignItems="center" gap={2} mb={3}>
                                        <BookOpen size={24} color="var(--cyan)" />
                                        <Typography variant="h5" fontWeight="950" sx={{ letterSpacing: -1 }}>MY RECENT BROADCASTS</Typography>
                                    </Box>
                                    <Stack spacing={2}>
                                        {myDevotions.map((d: any) => (
                                            <Box key={d.id} sx={{ p: 2, bgcolor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 2 }}>
                                                <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
                                                    <Typography variant="subtitle2" fontWeight="900" color="var(--cyan)">{d.title?.toUpperCase()}</Typography>
                                                    <Typography variant="caption" sx={{ opacity: 0.5 }}>{new Date(d.date).toLocaleDateString()}</Typography>
                                                </Box>
                                                <Typography variant="caption" sx={{ display: 'block', opacity: 0.7, mb: 1, fontStyle: 'italic' }}>
                                                    &quot;{d.affirmations?.[0]?.content || "No affirmation extracted"}&quot;
                                                </Typography>
                                                <Divider sx={{ my: 1, opacity: 0.05 }} />
                                                <Box display="flex" gap={2}>
                                                    <Typography variant="caption" fontWeight="bold" sx={{ color: 'var(--primary)' }}>
                                                        {d.interactions?.length || 0} Interactions
                                                    </Typography>
                                                </Box>
                                            </Box>
                                        ))}
                                    </Stack>
                                </CardContent>
                            </Card>
                        )}

                        {/* Personal Tactical Grid */}
                        <Typography variant="caption" fontWeight="900" sx={{ letterSpacing: 2, color: 'primary.main', mb: 2, display: 'block', textAlign: 'center' }}>PERSONAL FAMILY MISSIONS</Typography>
                        <Grid container spacing={2} mb={4}>
                            {[
                                { label: 'CHILD REGISTRY', icon: Baby, color: 'cyan', href: '/register-child' },
                                { label: 'BAPTISM REQ', icon: Droplet, color: 'info', onClick: () => setBaptismModalOpen(true) },
                                { label: 'APPOINT BISHOP', icon: Star, color: 'primary', onClick: () => setAppointmentModalOpen(true) },
                            ].map((action, i) => (
                                <Grid item xs={12} sm={4} key={i}>
                                    <Button fullWidth component={action.href ? Link : 'button'} {...(action.href ? { to: action.href } : { onClick: action.onClick })}
                                        sx={{
                                            height: 90, display: 'flex', flexDirection: 'column', gap: 1,
                                            bgcolor: 'rgba(255,255,255,0.02)', border: '1px solid var(--glass-border)', borderRadius: 2, color: 'white',
                                            '&:hover': { bgcolor: 'rgba(0,255,255,0.05)', borderColor: 'var(--cyan)', transform: 'translateY(-2px)' }
                                        }}
                                    >
                                        <action.icon size={20} color={`var(--${action.color})`} />
                                        <Typography variant="caption" fontWeight="950" sx={{ fontSize: '0.6rem' }}>{action.label}</Typography>
                                    </Button>
                                </Grid>
                            ))}
                        </Grid>

                        {/* Mission Stream Marquee */}
                        <Box sx={{ mb: 4, overflow: 'hidden' }}>
                            <Typography variant="caption" fontWeight="900" sx={{ letterSpacing: 2, color: 'var(--cyan)', mb: 2, display: 'block' }}>CHURCH-WIDE TELEMETRY</Typography>
                            <Box className="mission-marquee-pastor">
                                {[...(syncData?.announcements || []), ...(syncData?.events || [])].map((item, i) => (
                                    <Card key={i} sx={{ minWidth: 250, bgcolor: 'rgba(255,255,255,0.02)', border: '1px solid var(--glass-border)', borderRadius: 2 }}>
                                        <CardContent sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 2 }}>
                                            <Avatar sx={{ bgcolor: 'rgba(0,255,255,0.1)', color: 'var(--cyan)', width: 32, height: 32 }}><Bell size={16} /></Avatar>
                                            <Box sx={{ minWidth: 0 }}>
                                                <Typography variant="caption" fontWeight="950" color="cyan" sx={{ textTransform: 'uppercase', fontSize: '0.55rem' }}>UPDATE</Typography>
                                                <Typography variant="subtitle2" fontWeight="950" noWrap sx={{ display: 'block' }}>{item.title?.toUpperCase()}</Typography>
                                            </Box>
                                        </CardContent>
                                    </Card>
                                ))}
                            </Box>
                        </Box>

                        {/* Latest Church Intel (Moved to Left Column for balance) */}
                        <Card className="holographic-card" sx={{ p: 0, borderRadius: 0, mb: 4 }}>
                            <CardContent sx={{ p: 3 }}>
                                <Box display="flex" alignItems="center" gap={1.5} mb={4}>
                                    <Bell size={20} color="var(--primary)" />
                                    <Typography variant="caption" fontWeight="950" sx={{ letterSpacing: 2 }}>LATEST CHURCH INTEL</Typography>
                                </Box>

                                <Stack spacing={2}>
                                    {(() => {
                                        const globalIntel = [
                                            ...(syncData?.announcements || []).filter((a: any) => a.isGlobal).map((a: any) => ({ ...a, intelType: 'CHURCH UPDATE', icon: Megaphone, color: 'cyan' })),
                                            ...(syncData?.events || []).filter((e: any) => e.isMajor).map((e: any) => ({ ...e, intelType: 'MAJOR EVENT', icon: Calendar, color: 'primary' })),
                                            ...(syncData?.projects || []).filter((p: any) => p.isMajor).map((p: any) => ({ ...p, intelType: 'STRATEGIC PROJECT', icon: Star, color: 'cyan' })),
                                            ...(syncData?.plans || []).filter((p: any) => p.isMajor).map((p: any) => ({ ...p, intelType: 'MINISTRY PLAN', icon: BookOpen, color: 'orange' })),
                                        ].sort((a, b) => new Date(b.createdAt || b.date).getTime() - new Date(a.createdAt || a.date).getTime()).slice(0, 10);

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
                                                            {intel.createdAt || intel.date ? new Date(intel.createdAt || intel.date).toLocaleDateString() : 'N/A'}
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

                        {/* Divine Mandate (Moved to Left Column for balance) */}
                        <Card className="holographic-card divine-mandate-card" sx={{ p: 4, mb: 4, border: '1px solid var(--primary-glow) !important' }}>
                            <Typography variant="h6" fontWeight="950" mb={1} sx={{ color: 'var(--cyan)', letterSpacing: 2 }}>DIVINE MANDATE</Typography>
                            <Typography variant="h5" className="divine-text" sx={{ opacity: 0.9, lineHeight: 1.4, fontStyle: 'italic' }}>
                                &quot;{syncData?.affirmation?.content || "I walk in divine health and supernatural protection."}&quot;
                            </Typography>
                        </Card>
                    </Grid>

                    {/* Right Column (6): Pastoral Command & Tactical Mission */}
                    <Grid item xs={12} lg={6}>
                        <Stack spacing={4}>
                            {/* 💰 PARTNER INTELLIGENCE / CTA (Apex of Right Stack) */}
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
                                            sx={{ borderColor: 'orange', color: 'orange', fontWeight: 900, borderRadius: 0, fontSize: '0.65rem', '&:hover': { bgcolor: 'orange', color: 'black' } }}
                                        >
                                            ENROLL IN PARTNERSHIP
                                        </Button>
                                    </CardContent>
                                )}
                            </Card>

                            {/* Mission Action Terminal (Pastoral Tools) */}
                            <Card className="pastor-live-card" sx={{ bgcolor: 'rgba(255,255,255,0.03)', border: '2px solid var(--cyan)', borderRadius: 4 }}>
                                <CardContent sx={{ p: 3 }}>
                                    <Typography variant="caption" fontWeight="1000" sx={{ color: 'var(--cyan)', letterSpacing: 2, mb: 3, display: 'flex', alignItems: 'center', gap: 1 }}>
                                        <Shield size={16} /> PASTORAL ACTION TERMINAL
                                    </Typography>
                                    <Stack spacing={2}>
                                        <Button fullWidth onClick={() => setBaptismsOpen(true)} sx={{ justifyContent: 'space-between', bgcolor: 'rgba(255,255,255,0.05)', p: 2, border: '1px solid rgba(255,255,255,0.1)' }}>
                                            <Box display="flex" alignItems="center" gap={2}>
                                                <Droplet size={20} color="var(--cyan)" />
                                                <Typography variant="subtitle2" fontWeight="900">Baptism Pipeline</Typography>
                                            </Box>
                                            <Badge badgeContent={syncData?.baptisms?.length} color="error"><ChevronRight size={18} /></Badge>
                                        </Button>
                                        {hasModule('Child Dedication Registry') && (
                                            <Button fullWidth onClick={() => setDedicationOpen(true)} sx={{ justifyContent: 'space-between', bgcolor: 'rgba(255,255,255,0.05)', p: 2, border: '1px solid rgba(255,255,255,0.1)' }}>
                                                <Box display="flex" alignItems="center" gap={2}>
                                                    <Baby size={20} color="orange" />
                                                    <Typography variant="subtitle2" fontWeight="900">Dedication Registry</Typography>
                                                </Box>
                                                <Badge badgeContent={syncData?.children?.length} color="error"><ChevronRight size={18} /></Badge>
                                            </Button>
                                        )}
                                        <Button fullWidth onClick={() => setAppointmentsOpen(true)} sx={{ justifyContent: 'space-between', bgcolor: 'rgba(255,255,255,0.05)', p: 2, border: '1px solid rgba(255,255,255,0.1)' }}>
                                            <Box display="flex" alignItems="center" gap={2}>
                                                <Calendar size={20} color="var(--soft-red)" />
                                                <Typography variant="subtitle2" fontWeight="900">Appointment Manager</Typography>
                                            </Box>
                                            <ChevronRight size={18} />
                                        </Button>

                                        {hasModule('Partnership Management') && (
                                            <Button
                                                fullWidth
                                                onClick={() => setPartnershipManagerOpen(true)}
                                                sx={{
                                                    justifyContent: 'space-between',
                                                    bgcolor: 'rgba(255,165,0,0.1)',
                                                    p: 2,
                                                    border: '1px solid rgba(255,165,0,0.3)',
                                                    '&:hover': { bgcolor: 'rgba(255,165,0,0.2)', borderColor: 'orange' }
                                                }}
                                            >
                                                <Box display="flex" alignItems="center" gap={2}>
                                                    <Star size={20} color="orange" />
                                                    <Typography variant="subtitle2" fontWeight="1000" sx={{ color: 'orange' }}>Partnership Reconciliation</Typography>
                                                </Box>
                                                <ChevronRight size={18} color="orange" />
                                            </Button>
                                        )}
                                    </Stack>
                                </CardContent>
                            </Card>

                            {/* ⚔️ STRATEGIC COMMAND CENTER for Pastors */}
                            <Card sx={{ bgcolor: 'rgba(255,165,0,0.02)', border: '1px solid orange', borderRadius: 0, mb: 4 }}>
                                <CardContent sx={{ p: 3 }}>
                                    <Box display="flex" alignItems="center" gap={1.5} mb={3}>
                                        <Wrench size={20} color="orange" />
                                        <Typography variant="caption" fontWeight="950" sx={{ letterSpacing: 2 }}>TECH REPAIR AUTHORIZATIONS</Typography>
                                    </Box>
                                    <RepairApprovalManager />
                                </CardContent>
                            </Card>

                            <Card sx={{ bgcolor: 'rgba(255,255,255,0.02)', border: '1px solid var(--primary)', borderRadius: 4 }}>
                                <CardContent sx={{ p: 3 }}>
                                    <Box display="flex" alignItems="center" gap={1.5} mb={3}>
                                        <Zap size={20} color="var(--primary)" />
                                        <Typography variant="caption" fontWeight="950" sx={{ letterSpacing: 2 }}>STRATEGIC COMMAND ACTIONS</Typography>
                                    </Box>
                                    <Grid container spacing={2}>
                                        {hasModule('Event Oversight') && (
                                            <Grid item xs={6}>
                                                <Button fullWidth onClick={() => setEventModalOpen(true)} sx={{ height: 60, display: 'flex', flexDirection: 'column', gap: 0.5, bgcolor: 'rgba(79, 139, 255, 0.1)', border: '1px solid var(--primary)', borderRadius: 2 }}>
                                                    <Calendar size={18} color="var(--primary)" />
                                                    <Typography variant="caption" fontWeight="950" sx={{ fontSize: '0.6rem' }}>NEW EVENT</Typography>
                                                </Button>
                                            </Grid>
                                        )}
                                        <Grid item xs={6}>
                                            <Button fullWidth onClick={() => setProjectModalOpen(true)} sx={{ height: 60, display: 'flex', flexDirection: 'column', gap: 0.5, bgcolor: 'rgba(0, 255, 255, 0.1)', border: '1px solid var(--cyan)', borderRadius: 2 }}>
                                                <Star size={18} color="var(--cyan)" />
                                                <Typography variant="caption" fontWeight="950" sx={{ fontSize: '0.6rem' }}>NEW PROJECT</Typography>
                                            </Button>
                                        </Grid>
                                        <Grid item xs={6}>
                                            <Button fullWidth onClick={() => setPlanModalOpen(true)} sx={{ height: 60, display: 'flex', flexDirection: 'column', gap: 0.5, bgcolor: 'rgba(255, 165, 0, 0.1)', border: '1px solid orange', borderRadius: 2 }}>
                                                <BookOpen size={18} color="orange" />
                                                <Typography variant="caption" fontWeight="950" sx={{ fontSize: '0.6rem' }}>NEW PLAN</Typography>
                                            </Button>
                                        </Grid>
                                        {hasModule('DevotionPublishing') && (
                                            <Grid item xs={6}>
                                                <Button fullWidth onClick={() => setDevotionModalOpen(true)} sx={{ height: 60, display: 'flex', flexDirection: 'column', gap: 0.5, bgcolor: 'rgba(255, 255, 255, 0.05)', border: '1px solid var(--glass-border)', borderRadius: 2 }}>
                                                    <Megaphone size={18} />
                                                    <Typography variant="caption" fontWeight="950" sx={{ fontSize: '0.6rem' }}>NEW INTEL</Typography>
                                                </Button>
                                            </Grid>
                                        )}
                                        <Grid item xs={6}>
                                            <Button fullWidth onClick={() => setReportModalOpen(true)} sx={{ height: 60, display: 'flex', flexDirection: 'column', gap: 0.5, bgcolor: 'rgba(0, 255, 255, 0.05)', border: '1px solid var(--cyan)', borderRadius: 2 }}>
                                                <FileText size={18} color="var(--cyan)" />
                                                <Typography variant="caption" fontWeight="950" sx={{ fontSize: '0.6rem', color: 'var(--cyan)' }}>SUBMIT REPORT</Typography>
                                            </Button>
                                        </Grid>
                                    </Grid>
                                </CardContent>
                            </Card>

                            {/* MISSION REPORTS OVERWATCH - Bishop/System Admin Only */}
                            {['SUPER_ADMIN', 'SYSTEM_ADMIN', 'WATUA'].includes(user?.role || '') && (
                                <Card className="holographic-card" sx={{ borderRadius: 0, mb: 4, border: '1px solid rgba(0, 255, 255, 0.2)' }}>
                                    <CardContent sx={{ p: 3 }}>
                                        <Box display="flex" alignItems="center" gap={1.5} mb={3}>
                                            <FileText size={20} color="var(--cyan)" />
                                            <Typography variant="caption" fontWeight="950" sx={{ letterSpacing: 2 }}>MISSION COMMAND REPORTS (PDF)</Typography>
                                        </Box>
                                        <MissionReportsViewer limit={5} />
                                    </CardContent>
                                </Card>
                            )}

                            <Card className="holographic-card" sx={{ p: 0, borderRadius: 0, mb: 4 }}>
                                <CardContent sx={{ p: 3 }}>
                                    <Box display="flex" alignItems="center" gap={1.5} mb={3}>
                                        <Calendar size={20} color="var(--primary)" />
                                        <Typography variant="caption" fontWeight="950" sx={{ letterSpacing: 2 }}>CHURCH MISSION TIMELINE</Typography>
                                    </Box>
                                    {(() => {
                                        const timelineItems = [
                                            ...(syncData?.events || []).map((e: any) => ({ ...e, type: 'EVENT' })),
                                            ...(syncData?.projects || []).map((p: any) => ({ ...p, type: 'PROJECT', date: p.deadline || p.createdAt })),
                                            ...(syncData?.plans || []).map((p: any) => ({ ...p, type: 'PLAN', date: p.createdAt })),
                                            ...(syncData?.meetings || []).map((m: any) => ({ ...m, type: 'MEETING' })),
                                        ].sort((a: any, b: any) => new Date(a.date || a.createdAt).getTime() - new Date(b.date || b.createdAt).getTime());

                                        return (
                                            <OperationalTimeline
                                                items={timelineItems}
                                                onEdit={handleEdit}
                                                onDelete={handleDelete}
                                            />
                                        );
                                    })()}
                                </CardContent>
                            </Card>
                        </Stack>
                    </Grid>
                </Grid>
            </Container>

            {/* Pastoral Modals */}
            <BaptismManager open={baptismsOpen} onClose={() => setBaptismsOpen(false)} />
            <DedicationManager open={dedicationOpen} onClose={() => setDedicationOpen(false)} />
            <AppointmentManager open={appointmentsOpen} onClose={() => setAppointmentsOpen(false)} />
            <PartnershipManager open={partnershipManagerOpen} onClose={() => setPartnershipManagerOpen(false)} />

            {/* 💰 PARTNERSHIP ENROLLMENT MODAL */}
            <Modal
                open={enrollModalOpen}
                onClose={() => setEnrollModalOpen(false)}
                closeAfterTransition
                BackdropComponent={Backdrop}
                BackdropProps={{ timeout: 500, sx: { backdropFilter: 'blur(12px)', bgcolor: 'rgba(0,0,0,0.8)' } }}
            >
                <Fade in={enrollModalOpen}>
                    <Box tabIndex={-1} sx={{ 
                        position: 'absolute', top: 80, right: 24,
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
                            &quot;Honor the Lord with your wealth and with the firstfruits of all your produce.&quot; <br />
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

            {/* 🗓️ APPOINTMENT MODAL */}
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
                        width: { xs: '90%', sm: 500 },
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
                                targetRole: 'BISHOP',
                                type: formData.get('type') as string,
                                reason: formData.get('reason') as string,
                                preferredDate: formData.get('preferredDate') as string,
                                preferredTime: formData.get('preferredTime') as string,
                            });
                        }}>
                            <Stack spacing={3}>
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
                                        <option value="STRATEGIC" style={{ background: '#000' }}>STRATEGIC MEETING</option>
                                    </select>
                                </Box>

                                <Box sx={{ display: 'flex', gap: 2, flexDirection: 'row' }}>
                                    <Box flexGrow={1}>
                                        <Typography variant="caption" fontWeight="900" sx={{ mb: 1, display: 'block', opacity: 0.5 }}>PREFERRED DATE</Typography>
                                        <input
                                            type="date"
                                            name="preferredDate"
                                            required
                                            style={{
                                                width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--glass-border)',
                                                color: '#fff', padding: '12px', fontSize: '1rem', fontWeight: 800, outline: 'none'
                                            }}
                                        />
                                    </Box>
                                    <Box flexGrow={1}>
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

            <RequestBaptismModal open={baptismModalOpen} onClose={() => setBaptismModalOpen(false)} onSuccess={() => queryClient.invalidateQueries(['dashboard-sync'])} />

            {/* Operational Modals */}
            <EventFormModal open={eventModalOpen} onClose={() => { setEventModalOpen(false); setEditingEvent(null); }} event={editingEvent} onSuccess={() => queryClient.invalidateQueries(['dashboard-sync'])} />
            <ProjectFormModal open={projectModalOpen} onClose={() => { setProjectModalOpen(false); setEditingProject(null); }} project={editingProject} onSuccess={() => queryClient.invalidateQueries(['dashboard-sync'])} />
            <PlanFormModal open={planModalOpen} onClose={() => { setPlanModalOpen(false); setEditingPlan(null); }} plan={editingPlan} onSuccess={() => queryClient.invalidateQueries(['dashboard-sync'])} />
            <AnnouncementFormModal open={announcementModalOpen} onClose={() => { setAnnouncementModalOpen(false); setEditingAnnouncement(null); }} announcement={editingAnnouncement} onSuccess={() => queryClient.invalidateQueries(['dashboard-sync'])} />
            <DevotionFormModal open={devotionModalOpen} onClose={() => setDevotionModalOpen(false)} onSuccess={() => { queryClient.invalidateQueries(['devotion']); setToast({ open: true, message: 'Devotion published globally.', severity: 'success' }); }} />

            <Snackbar open={toast.open} autoHideDuration={6000} onClose={() => setToast({ ...toast, open: false })}>
                <Alert severity={toast.severity} sx={{ width: '100%', fontWeight: 800 }}>{toast.message}</Alert>
            </Snackbar>
            <DepartmentReportModal
                open={reportModalOpen}
                onClose={() => setReportModalOpen(false)}
                departmentId={user?.departmentId || undefined}
                onSuccess={() => queryClient.invalidateQueries(['dashboard-sync'])}
            />
        </DashboardLayout>
    );
}
