import React, { useState, useEffect } from 'react';
import { 
    Switch, CircularProgress, Dialog, DialogTitle, DialogContent, DialogActions, TextField, 
    IconButton, LinearProgress, Stack, Divider, Badge, Paper, Tooltip, Snackbar, Alert,
    Container, Grid, Typography, Box, Card, CardContent, Button, Avatar, Chip
} from '@mui/material';
import { 
    Calendar, Target, Search, UserCheck, Smartphone, CheckCircle, Zap, ShieldCheck, PenTool, Trash2, 
    ArrowRight, MessageSquare, Bell, Star, ChevronRight, Filter, LayoutDashboard, Briefcase, Coins,
    ArrowUpRight, Clock, CheckCircle2, AlertCircle, Send, Wrench, FileText, SwitchCamera,
    Shield, Activity, Users, Landmark, Globe, TrendingUp
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { useLiveQuery } from 'dexie-react-hooks';
import api from '../lib/api-client';
import { db } from '../lib/db';
import DashboardLayout from '../components/layout/DashboardLayout';
import { Link } from 'react-router-dom';
import FinancialLedger from '../components/dashboard/FinancialLedger';
import RepairApprovalManager from '../components/dashboard/RepairApprovalManager';
import MissionReportsViewer from '../components/dashboard/MissionReportsViewer';
import { OperationalTimeline } from '../components/dashboard/OperationalTimeline';
import EventFormModal from '../components/modals/EventFormModal';
import ProjectFormModal from '../components/modals/ProjectFormModal';
import PlanFormModal from '../components/modals/PlanFormModal';
import AnnouncementFormModal from '../components/modals/AnnouncementFormModal';
import DevotionFormModal from '../components/modals/DevotionFormModal';
import DepartmentReportModal from '../components/modals/DepartmentReportModal';
import ThemeFormModal from '../components/modals/ThemeFormModal';
import { ExecutiveTaskTrack } from '../components/dashboard/ExecutiveTaskTrack';
import { MissionAchievementTrack } from '../components/dashboard/MissionAchievementTrack';
import AppointmentManager from '../components/dashboard/AppointmentManager';
import BaptismManager from '../components/dashboard/BaptismManager';
import DedicationManager from '../components/dashboard/DedicationManager';
import PartnershipManager from '../components/dashboard/PartnershipManager';
import { useLocalFirstDashboard } from '../hooks/useLocalFirstDashboard';

export default function BishopDashboard() {
    const { user } = useAuth();
    const queryClient = useQueryClient();
    
    // --- Data Streams (Tactical Mirror) ---
    const { data: syncData, isLoading: isSyncLoading } = useLocalFirstDashboard();

    const { data: departments } = useQuery(['departments'], async () => {
        const res = await api.get('/departments');
        return res.data;
    });

    const [eventModalOpen, setEventModalOpen] = useState(false);
    const [projectModalOpen, setProjectModalOpen] = useState(false);
    const [planModalOpen, setPlanModalOpen] = useState(false);
    const [announcementModalOpen, setAnnouncementModalOpen] = useState(false);
    const [reportModalOpen, setReportModalOpen] = useState(false);
    const [themeModalOpen, setThemeModalOpen] = useState(false);
    const [baptismsOpen, setBaptismsOpen] = useState(false);
    const [dedicationManagerOpen, setDedicationManagerOpen] = useState(false);
    const [appointmentManagerOpen, setAppointmentManagerOpen] = useState(false);
    const [partnershipManagerOpen, setPartnershipManagerOpen] = useState(false);
    const [toast, setToast] = useState<{ open: boolean; message: string; severity: 'success' | 'error' | 'info' | 'warning' }>({
        open: false,
        message: '',
        severity: 'info'
    });

    // --- Pastor Module Management ---
    const [pastorManagementOpen, setPastorManagementOpen] = useState(false);
    const [moduleDialog, setModuleDialog] = useState<{ open: boolean; userId: string; name: string }>({
        open: false, userId: '', name: ''
    });
    const [pastorModules, setPastorModules] = useState<any[]>([]);
    const [moduleLoading, setModuleLoading] = useState(false);

    // --- MISSION: OFFLINE-FIRST PASTORAL LIST ---
    const pastorsData = useLiveQuery(() => 
        db.users.filter(u => ['PASTOR', 'ASSOCIATE_PASTOR', 'BISHOP', 'SUPER_ADMIN'].includes(u.role) && u.status === 'ACTIVE').toArray()
    , []) || [];
    const isPastorsLoading = false;

    const fetchPastorModules = async (userId: string) => {
        setModuleLoading(true);
        try {
            const res = await api.get(`/users/pastor/assigned-modules?userId=${userId}`);
            setPastorModules(res.data.data);
        } catch (err) {
            console.error('Failed to fetch pastor modules:', err);
        } finally {
            setModuleLoading(false);
        }
    };

    const handleToggleModule = async (userId: string, moduleKey: string, active: boolean) => {
        try {
            if (active) {
                await api.post('/users/pastor/modules/assign', { pastorId: userId, moduleKey, permissions: {} });
            } else {
                const existing = pastorModules.find(m => m.moduleKey === moduleKey);
                if (existing) {
                    await api.delete(`/users/pastor/modules/revoke/${existing.id}`);
                }
            }
            fetchPastorModules(userId);
            setToast({ open: true, message: `Module ${moduleKey} updated.`, severity: 'success' });
        } catch (err) {
            setToast({ open: true, message: 'Failed to update module.', severity: 'error' });
        }
    };

    // ─── Edit States ────────────────────────────────────────────────────────
    const [editingProject, setEditingProject] = useState<any>(null);
    const [editingEvent, setEditingEvent] = useState<any>(null);
    const [editingPlan, setEditingPlan] = useState<any>(null);
    const [editingAnnouncement, setEditingAnnouncement] = useState<any>(null);

    // --- Intelligence Analytics ---
    const totalBalance = syncData?.account?.balance || 0;
    const pendingApprovals = syncData?.transactions?.filter((tx: any) => tx.status !== 'APPROVED' && tx.type === 'WITHDRAWAL').length || 0;

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
        if (type === 'ANNOUNCEMENT' || type === 'ALERT') { setEditingAnnouncement(item); setAnnouncementModalOpen(true); }
    };

    const handleDelete = (item: any) => {
        const type = item.type || (item.priority ? 'ANNOUNCEMENT' : 'PROJECT');
        deleteMutation.mutate({ id: item.id, type });
    };

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
                            PALACE <span style={{ color: 'rgba(255,255,255,0.3)' }}>CONTROL PORTAL</span>
                        </Typography>
                    </Box>
                    <Box sx={{ textAlign: 'right' }}>
                        <Typography variant="subtitle2" fontWeight="900" sx={{ opacity: 0.5 }}>OPERATIONAL STATUS</Typography>
                        <Box display="flex" alignItems="center" gap={1} justifyContent="flex-end">
                            <span className={syncData?.isOffline ? "status-glow-warn" : "status-glow"} />
                            <Typography variant="h6" fontWeight="1000" sx={{ color: syncData?.isOffline ? 'orange' : '#00ff00' }}>
                                {syncData?.isOffline ? 'LOCAL TACTICAL MODE' : 'ACTIVE OVERWATCH'}
                            </Typography>
                        </Box>
                    </Box>
                </Box>

                {/* TACTICAL STATUS BAR */}
                {syncData?.isOffline && (
                    <Box sx={{ mb: 4 }}>
                        <Alert 
                            severity="warning" 
                            variant="filled"
                            icon={<ShieldCheck size={20} />}
                            sx={{ 
                                bgcolor: 'rgba(255, 152, 0, 0.2)', 
                                border: '1px solid orange',
                                color: 'orange',
                                fontWeight: 800,
                                borderRadius: 0
                            }}
                        >
                            DASHBOARD OPERATING IN OFFLINE MISSION MODE — DISPATCHING DATA FROM TACTICAL LOCAL CACHE
                        </Alert>
                    </Box>
                )}

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
                </Grid>

                {/* ── Executive Governance Tracks ── */}
                <Box sx={{ mt: 4, display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <Box>
                        <Typography variant="caption" fontWeight="1000" sx={{ letterSpacing: 2, color: 'var(--cyan)', mb: 2, display: 'block' }}>
                            EXECUTIVE APPOINTMENTS & SESSIONS
                        </Typography>
                        <ExecutiveTaskTrack 
                            appointments={syncData?.appointments || []} 
                            onAction={() => setAppointmentManagerOpen(true)} 
                        />
                    </Box>
                    
                    <Box>
                        <Typography variant="caption" fontWeight="1000" sx={{ letterSpacing: 2, color: 'var(--primary)', mb: 2, display: 'block' }}>
                            CONGREGATIONAL MISSION ACHIEVEMENTS
                        </Typography>
                        <MissionAchievementTrack 
                            baptisms={syncData?.baptisms || []} 
                            childRecords={syncData?.children || []} 
                        />
                    </Box>
                </Box>

                {/* MISSION COMMAND HUB - Creation Center */}
                <Box sx={{ mt: 4, mb: 4 }}>
                    <Typography variant="caption" fontWeight="1000" sx={{ letterSpacing: 3, color: 'var(--primary)', mb: 2, display: 'block' }}>MISSION COMMAND HUB</Typography>
                    <Grid container spacing={2}>
                        {[
                            { label: 'NEW PROJECT', icon: Briefcase, color: 'var(--cyan)', onClick: () => setProjectModalOpen(true) },
                            { label: 'HOST EVENT', icon: Calendar, color: 'var(--primary)', onClick: () => setEventModalOpen(true) },
                            { label: 'STRATEGIC PLAN', icon: Target, color: 'pink', onClick: () => setPlanModalOpen(true) },
                            { label: 'SUBMIT REPORT', icon: FileText, color: 'var(--cyan)', onClick: () => setReportModalOpen(true) },
                            { label: 'GLOBAL ALERT', icon: Bell, color: 'orange', onClick: () => setAnnouncementModalOpen(true) },
                            { label: 'GLOBAL THEMES', icon: Globe, color: '#ffcc00', onClick: () => setThemeModalOpen(true) },
                            { label: 'PASTORS HUB', icon: Shield, color: '#22c55e', onClick: () => setPastorManagementOpen(true) },
                        ].map((action, i) => (
                            <Grid item xs={6} sm={4} md={2} key={i}>
                                <Button
                                    fullWidth
                                    onClick={action.onClick}
                                    sx={{
                                        py: 3, display: 'flex', flexDirection: 'column', gap: 1.5,
                                        bgcolor: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)',
                                        borderRadius: 0, color: 'white',
                                        '&:hover': {
                                            bgcolor: 'rgba(255,255,255,0.05)',
                                            borderColor: action.color,
                                            transform: 'translateY(-4px)',
                                            boxShadow: `0 10px 20px -10px ${action.color}`
                                        }
                                    }}
                                >
                                    <action.icon size={22} color={action.color} />
                                    <Typography variant="caption" fontWeight="1000" sx={{ fontSize: '0.65rem', letterSpacing: 1 }}>{action.label}</Typography>
                                </Button>
                            </Grid>
                        ))}
                    </Grid>
                </Box>

                <Grid container spacing={4}>
                    {/* MAIN COMMAND AREA */}
                    <Grid item xs={12} lg={8}>
                        <Stack spacing={4}>
                            {/* GLOBAL FINANCIAL COMMAND */}
                            <FinancialLedger 
                                account={syncData?.account} 
                                transactions={syncData?.transactions || []} 
                            />

                            {/* TECHNICAL REPAIR AUTHORIZATIONS */}
                            <Card className="mission-intel-card" sx={{ borderLeft: '4px solid #ff4d4d' }}>
                                <CardContent sx={{ p: 4 }}>
                                    <Box display="flex" alignItems="center" gap={2} mb={3}>
                                        <Wrench size={24} color="#ff4d4d" />
                                        <Typography variant="h5" fontWeight="950" sx={{ letterSpacing: -1 }}>REPAIR AUTHORIZATIONS</Typography>
                                    </Box>
                                    <RepairApprovalManager />
                                </CardContent>
                            </Card>

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
                                                            {dept?.name?.toUpperCase() || 'UNNAMED DEPARTMENT'}
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
                                                    <Typography variant="subtitle2" fontWeight="1000">{p.user?.name || 'N/A'}</Typography>
                                                    <Typography variant="caption" sx={{ opacity: 0.5 }}>{p.user?.membershipNumber || 'N/A'}</Typography>
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
                                            ...(syncData?.baptisms?.map((b: any) => ({ ...b, title: `Baptism Request: ${b.user?.name || 'Unknown'}`, type: 'BAPTISM' })) || []),
                                            ...(syncData?.children?.map((c: any) => ({ ...c, title: `Child Dedication: ${c.name || 'Unknown'}`, type: 'DEDICATION' })) || [])
                                        ].sort((a, b) => new Date(b.createdAt || b.date).getTime() - new Date(a.createdAt || a.date).getTime()).slice(0, 10).map((item: any, idx: number) => (
                                            <Box key={idx} sx={{ p: 2, bgcolor: 'rgba(255,255,255,0.02)', borderLeft: `2px solid ${item.type === 'ALERT' ? '#ff4f4f' : 'var(--cyan)'}` }}>
                                                <Typography variant="caption" fontWeight="900" color="var(--cyan)" sx={{ fontSize: '0.6rem' }}>{item.type} — {item.createdAt || item.date ? new Date(item.createdAt || item.date).toLocaleDateString() : "N/A"}</Typography>
                                                <Typography variant="subtitle2" fontWeight="900" sx={{ mt: 0.5 }}>{item.title?.toUpperCase()}</Typography>
                                            </Box>
                                        ))}
                                    </Stack>
                                </CardContent>
                            </Card>

                            {/* MISSION REPORTS OVERWATCH */}
                            <Card className="mission-intel-card" sx={{ border: '1px solid rgba(0, 255, 255, 0.2) !important', mb: 3 }}>
                                <CardContent sx={{ p: 3 }}>
                                    <Box display="flex" alignItems="center" gap={1.5} mb={3}>
                                        <FileText size={20} color="var(--cyan)" />
                                        <Typography variant="caption" fontWeight="950" sx={{ letterSpacing: 2 }}>MISSION COMMAND REPORTS (PDF)</Typography>
                                    </Box>
                                    <MissionReportsViewer limit={10} />
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
                                                    {log.createdAt ? new Date(log.createdAt).toLocaleString() : "N/A"}
                                                </Typography>
                                                <Typography variant="caption" fontWeight="900" sx={{ color: 'var(--cyan)' }}>[{log.actor?.name || 'System'}]</Typography>
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

            <EventFormModal open={eventModalOpen} onClose={() => { setEventModalOpen(false); setEditingEvent(null); }} event={editingEvent} onSuccess={() => queryClient.invalidateQueries(['dashboard-sync'])} />
            <ProjectFormModal open={projectModalOpen} onClose={() => { setProjectModalOpen(false); setEditingProject(null); }} project={editingProject} onSuccess={() => queryClient.invalidateQueries(['dashboard-sync'])} />
            <PlanFormModal open={planModalOpen} onClose={() => { setPlanModalOpen(false); setEditingPlan(null); }} plan={editingPlan} onSuccess={() => queryClient.invalidateQueries(['dashboard-sync'])} />
            <AnnouncementFormModal open={announcementModalOpen} onClose={() => { setAnnouncementModalOpen(false); setEditingAnnouncement(null); }} announcement={editingAnnouncement} onSuccess={() => queryClient.invalidateQueries(['dashboard-sync'])} />
            <DepartmentReportModal open={reportModalOpen} onClose={() => setReportModalOpen(false)} onSuccess={() => queryClient.invalidateQueries(['dashboard-sync'])} />
            <ThemeFormModal 
                open={themeModalOpen} 
                onClose={() => setThemeModalOpen(false)} 
                onSuccess={(msg) => setToast({ open: true, message: msg, severity: 'success' })}
                onError={(msg) => setToast({ open: true, message: msg, severity: 'error' })}
            />

            <BaptismManager open={baptismsOpen} onClose={() => setBaptismsOpen(false)} />
            <DedicationManager open={dedicationManagerOpen} onClose={() => setDedicationManagerOpen(false)} />
            <AppointmentManager open={appointmentManagerOpen} onClose={() => setAppointmentManagerOpen(false)} />
            <PartnershipManager open={partnershipManagerOpen} onClose={() => setPartnershipManagerOpen(false)} />
            
            <Snackbar open={toast.open} autoHideDuration={4000} onClose={() => setToast({ ...toast, open: false })} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
                <Alert onClose={() => setToast({ ...toast, open: false })} severity={toast.severity} variant="filled" sx={{ width: '100%', borderRadius: 2 }}>{toast.message}</Alert>
            </Snackbar>

            {/* Pastor Management Dialog */}
            <Dialog open={pastorManagementOpen} onClose={() => setPastorManagementOpen(false)} maxWidth="sm" fullWidth PaperProps={{ sx: { bgcolor: '#0a0b10', color: '#f8fafc', border: '1px solid rgba(34, 197, 94, 0.2)' } }}>
                <DialogTitle sx={{ fontWeight: 900, borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <Box display="flex" alignItems="center" gap={1}>
                        <Shield size={20} color="#22c55e" />
                        PASTORAL COMMAND CENTER
                    </Box>
                </DialogTitle>
                <DialogContent>
                    <Typography variant="caption" sx={{ opacity: 0.5, mb: 2, display: 'block', mt: 2 }}>
                        LIST OF ENROLLED PASTORS AND ASSOCIATE PASTORS IN THE SYSTEM.
                    </Typography>
                    {isPastorsLoading ? <LinearProgress sx={{ my: 2 }} /> : (
                        <Stack spacing={1}>
                            {pastorsData?.map((pastor: any) => (
                                <Box key={pastor.id} sx={{ p: 2, bgcolor: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', '&:hover': { bgcolor: 'rgba(34, 197, 94, 0.05)', borderColor: '#22c55e' } }}>
                                    <Box>
                                        <Typography variant="subtitle2" fontWeight="950">{pastor?.name?.toUpperCase() || 'UNKNOWN PASTOR'}</Typography>
                                        <Typography variant="caption" sx={{ opacity: 0.5 }}>{pastor?.role || 'PASTOR'} — {pastor?.membershipNumber || 'N/A'}</Typography>
                                    </Box>
                                    <Button size="small" onClick={() => { setModuleDialog({ open: true, userId: pastor.id, name: pastor.name || 'Unknown' }); fetchPastorModules(pastor.id); }} sx={{ color: 'var(--cyan)', fontWeight: 900 }}>
                                        MANAGE MODULES
                                    </Button>
                                </Box>
                            ))}
                        </Stack>
                    )}
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setPastorManagementOpen(false)} sx={{ color: 'white', fontWeight: 900 }}>DISMISS</Button>
                </DialogActions>
            </Dialog>

            {/* Pastor Module Permissions Dialog */}
            <Dialog open={moduleDialog.open} onClose={() => setModuleDialog({ ...moduleDialog, open: false })} maxWidth="xs" fullWidth PaperProps={{ sx: { bgcolor: '#0a0b10', color: '#f8fafc', border: '1px solid var(--cyan)' } }}>
                <DialogTitle sx={{ fontWeight: 900, borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <Box display="flex" alignItems="center" gap={1}>
                        <Zap size={20} color="var(--cyan)" />
                        ACCESS TOKENS: {(moduleDialog.name || '').toUpperCase()}
                    </Box>
                </DialogTitle>
                <DialogContent sx={{ pt: 2 }}>
                    <Typography variant="caption" sx={{ opacity: 0.6, mb: 2, display: 'block' }}>
                        ENABLE OR DISABLE DYNAMIC CAPABILITIES FOR THIS ENTITY.
                    </Typography>
                    {moduleLoading ? <CircularProgress size={24} sx={{ m: 'auto', display: 'block' }} /> : (
                        <Stack spacing={2}>
                            {[
                                'DevotionPublishing',
                                'EventOversight',
                                'IntelligencePublishing',
                                'PartnershipManagement',
                                'ChildDedicationRegistry'
                            ].map((moduleKey) => {
                                const isActive = pastorModules.some(m => m.moduleKey === moduleKey);
                                return (
                                    <Box key={moduleKey} display="flex" justifyContent="space-between" alignItems="center" p={1.5} sx={{ bgcolor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}>
                                        <Typography variant="body2" fontWeight="700">{moduleKey}</Typography>
                                        <Switch 
                                            size="small" 
                                            checked={isActive} 
                                            onChange={(e) => handleToggleModule(moduleDialog.userId, moduleKey, e.target.checked)} 
                                        />
                                    </Box>
                                );
                            })}
                        </Stack>
                    )}
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setModuleDialog({ ...moduleDialog, open: false })} sx={{ color: 'white', fontWeight: 900 }}>BACK</Button>
                </DialogActions>
            </Dialog>
        </DashboardLayout>
    );
}
