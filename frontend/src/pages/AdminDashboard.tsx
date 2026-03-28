import { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import api from '../lib/api-client';
import {
    Typography, Grid, Card, CardContent, Box, Avatar, Chip, Button,
    Skeleton, Snackbar, Alert, Modal, Backdrop, Fade, IconButton,
    Divider, Tooltip, Select, MenuItem, FormControl, InputLabel, Paper
} from '@mui/material';
import {
    Calendar, TrendingUp, AlertCircle, Briefcase,
    MessageSquare, Coins, UserCheck, XCircle, CheckCircle, Trash2,
    Eye, Shield, Target, Bell, Filter, ChevronRight, Users, Droplet, Baby, Star
} from 'lucide-react';
import DashboardLayout from '../components/layout/DashboardLayout';
import { BroadcastTrack } from '../components/dashboard/BroadcastTrack';
import { InitiativesTrack } from '../components/dashboard/InitiativesTrack';
import { OperationalTimeline } from '../components/dashboard/OperationalTimeline';
import AppointmentManager from '../components/dashboard/AppointmentManager';
import BaptismManager from '../components/dashboard/BaptismManager';
import DedicationManager from '../components/dashboard/DedicationManager';
import PartnershipManager from '../components/dashboard/PartnershipManager';
import { usePermission } from '../hooks/usePermission';
import { PERMISSIONS } from '../utils/permissions';


// ─── Component ─────────────────────────────────────────────────────────────

export default function AdminDashboard() {
    const { user: authUser } = useAuth();
    const { hasPermission } = usePermission();
    
    // Permission-based flags
    const canViewStats = hasPermission(PERMISSIONS.VIEW_GLOBAL_STATS);
    const canManageUsers = hasPermission(PERMISSIONS.MANAGE_USERS);
    const canApproveSpiritual = hasPermission(PERMISSIONS.APPROVE_BAPTISM);
    const canViewPersonnel = hasPermission(PERMISSIONS.VIEW_PERSONNEL);
    
    const role = authUser?.role ?? '';
    const queryClient = useQueryClient();

    const [verificationModalOpen, setVerificationModalOpen] = useState(false);
    const [baptismsOpen, setBaptismsOpen] = useState(false);
    const [dedicationManagerOpen, setDedicationManagerOpen] = useState(false);
    const [appointmentManagerOpen, setAppointmentManagerOpen] = useState(false);
    const [partnershipManagerOpen, setPartnershipManagerOpen] = useState(false);
    const [deptFilter, setDeptFilter] = useState<string>('ALL');
    const navigate = useNavigate();

    const isRestrictedRole = role === 'PASTOR' || role === 'ASSOCIATE_PASTOR' || role === 'DEPARTMENT_LEADER';

    // ─── Direct Redirects for Unauthorized Users ─────────────────────────────
    useEffect(() => {
        if (!canViewStats && !isRestrictedRole) {
            navigate('/', { replace: true });
        }
    }, [canViewStats, isRestrictedRole, navigate]);
    const [toast, setToast] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
        open: false, message: '', severity: 'success'
    });
    const handleCloseToast = () => setToast(t => ({ ...t, open: false }));

    // ─── Data Queries ────────────────────────────────────────────────────────
    const { data: syncData, isLoading: isSyncLoading } = useQuery(['dashboard-sync'], async () => {
        const res = await api.get('/dashboard/sync');
        return res.data;
    }, { enabled: !!authUser });

    const projects = syncData?.projects || [];
    const events = syncData?.events || [];
    const plans = syncData?.plans || [];
    const meetings = syncData?.meetings || [];
    const budgets = syncData?.budgets || [];
    const announcements = syncData?.announcements || [];
    const departments = syncData?.departments || [];
    const pendingUsers = syncData?.pendingUsers || [];
    const baptisms = syncData?.baptisms || [];
    const children = syncData?.children || [];

    const pendingBaptisms = baptisms.filter((b: any) => b.status !== 'COMPLETED').length;
    const pendingDedications = children.filter((c: any) => c.workflowStatus !== 'DEDICATED').length;
    
    // Fetch appointments for badge
    const { data: appointments = [] } = useQuery(['appointments-badge'], async () => {
        const res = await api.get('/appointments/all');
        return res.data;
    }, { enabled: !!authUser && (canViewPersonnel || role === 'PASTOR') });

    const pendingAppointments = appointments.filter((a: any) => a.status === 'PENDING').length;

    // ─── Department filter logic ─────────────────────────────────────────────
    const filterByDept = (arr: any[]) =>
        deptFilter === 'ALL' ? arr : arr.filter((x: any) => x.departmentId === deptFilter || x.department?.id === deptFilter);

    const timelineItems = useMemo(() => {
        const base = [
            ...filterByDept(projects).map(p => ({ ...p, type: 'PROJECT', date: p.deadline || p.createdAt })),
            ...filterByDept(events).map(e => ({ ...e, type: 'EVENT' })),
            ...filterByDept(plans).map(p => ({ ...p, type: 'PLAN', date: p.createdAt })),
            ...filterByDept(meetings).map(m => ({ ...m, type: 'MEETING' })),
        ];
        return base.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    }, [projects, events, plans, meetings, deptFilter]);

    // ─── Member Verification ─────────────────────────────────────────────────
    const verifyMutation = useMutation(
        async ({ id, status }: { id: string; status: string; name: string }) => api.patch(`/users/${id}/status`, { status }),
        {
            onSuccess: (_, { name, status }) => {
                queryClient.invalidateQueries(['dashboard-sync']);
                setToast({
                    open: true,
                    message: `${name} has been ${status === 'ACTIVE' ? 'activated' : 'rejected'}.`,
                    severity: status === 'ACTIVE' ? 'success' : 'error'
                });
            },
            onError: () => setToast({ open: true, message: 'Failed to update user status.', severity: 'error' })
        }
    );

    const markPaidMutation = useMutation(
        async ({ id, isPaid }: { id: string; isPaid: boolean }) => api.patch(`/users/${id}/mark-paid`, { isPaid }),
        {
            onSuccess: () => {
                queryClient.invalidateQueries(['dashboard-sync']);
            },
            onError: () => setToast({ open: true, message: 'Failed to update payment status.', severity: 'error' })
        }
    );

    const approveRenewalMutation = useMutation(
        async ({ id, newMembershipNumber }: { id: string; newMembershipNumber: string }) => 
            api.post(`/users/${id}/card-renewal/approve`, { newMembershipNumber }),
        {
            onSuccess: () => {
                queryClient.invalidateQueries(['dashboard-sync']);
                setToast({ open: true, message: 'Membership card renewed successfully.', severity: 'success' });
            },
            onError: (err: any) => setToast({ open: true, message: err.response?.data?.error || 'Renewal failed.', severity: 'error' })
        }
    );

    const partnershipMutation = useMutation(
        async ({ id, currentStatus }: { id: string; currentStatus: boolean }) => api.post(`/users/technical/intervention/${id}`, { action: 'TOGGLE_PARTNER', currentStatus }),
        {
            onSuccess: () => {
                queryClient.invalidateQueries(['dashboard-sync']);
                setToast({ open: true, message: 'Partnership status updated successfully.', severity: 'success' });
            },
            onError: () => setToast({ open: true, message: 'Failed to update partnership status.', severity: 'error' })
        }
    );

    // ─── Stats ───────────────────────────────────────────────────────────────

    const isOperationsExec = role === 'SUPER_ADMIN' || role === 'SYSTEM_ADMIN' || isRestrictedRole;

    const stats = isRestrictedRole ? [] : [
        ...(isOperationsExec ? [
            { title: 'Upcoming Events', value: filterByDept(events).filter((e: any) => new Date(e.date) >= new Date()).length, icon: Calendar, color: 'blue' },
            { title: 'Active Projects', value: filterByDept(projects).filter((p: any) => p.status === 'IN_PROGRESS').length, icon: Briefcase, color: 'purple' },
            { title: 'Strategic Plans', value: filterByDept(plans).length, icon: Target, color: 'pink' },
            { title: 'Meetings', value: filterByDept(meetings).length, icon: MessageSquare, color: 'cyan' },
            { title: 'Announcements', value: announcements.filter((a: any) => new Date(a.createdAt) >= new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)).length, icon: Bell, color: 'orange' }
        ] : [
            { title: 'Pending Baptisms', value: pendingBaptisms, icon: Droplet, color: 'cyan' },
            { title: 'Pending Dedications', value: pendingDedications, icon: Baby, color: 'orange' },
            { title: 'Appointments', value: pendingAppointments, icon: MessageSquare, color: 'purple' }
        ]),
        ...(canManageUsers ? [{ title: 'Pending Approval', value: pendingUsers.length, icon: UserCheck, color: 'green' }] : []),
    ];

    // ─── DOM ─────────────────────────────────────────────────────────────────
    if (isSyncLoading) {
        return (
            <DashboardLayout>
                <Box sx={{ mb: 6 }}>
                    <Skeleton variant="text" width={300} height={60} />
                    <Skeleton variant="text" width={200} height={30} />
                </Box>
                <Grid container spacing={2} mb={5}>
                    {[1, 2, 3, 4, 5, 6].map((i) => (
                        <Grid item xs={6} sm={4} md={2} key={i}>
                            <Skeleton variant="rectangular" height={100} sx={{ borderRadius: 3 }} />
                        </Grid>
                    ))}
                </Grid>
                <Skeleton variant="rectangular" height={400} sx={{ borderRadius: 4 }} />
            </DashboardLayout>
        );
    }

    return (
        <DashboardLayout>

            {/* ── Header ── */}
            <Box sx={{ mb: { xs: 4, md: 6 }, display: 'flex', flexDirection: 'column', gap: 1 }}>
                <Box display="flex" alignItems="center" gap={2} mb={1}>
                    <Shield size={28} color="var(--primary)" />
                    <Typography variant="h2" fontWeight="950" className="glow-text"
                        sx={{ letterSpacing: -2, fontSize: { xs: '1.8rem', md: '3rem' }, lineHeight: 1.1 }}>
                        EXECUTIVE <span className="text-primary/70">PALACE PORTAL</span>
                    </Typography>
                </Box>
                <Box display="flex" alignItems="center" gap={1.5}>
                    <Chip
                        icon={canViewStats ? <Shield size={12} /> : <Eye size={12} />}
                        label={canViewStats ? `${role.replace('_', ' ')} — HIGH OVERSEER` : `${role.replace('_', ' ')} — SYNC VIEW`}
                        size="small"
                        sx={{ fontWeight: 900, fontSize: '0.65rem', letterSpacing: 1, bgcolor: canViewStats ? 'rgba(124,58,237,0.15)' : 'rgba(0,200,255,0.1)', border: '1px solid', borderColor: canViewStats ? 'var(--purple)' : 'var(--cyan)', color: canViewStats ? 'var(--purple)' : 'var(--cyan)' }}
                    />
                </Box>
                <Typography color="textSecondary" variant="subtitle2" sx={{ fontWeight: 600, opacity: 0.55 }}>
                    {canViewStats
                        ? 'Strategic oversight, spiritual workflow governance, and global mission control.'
                        : 'Church-wide intelligence feed — stay in sync with every plan, project, meeting and event.'}
                </Typography>
            </Box>

            {/* ── Admin Quick-Action Terminal ── */}
            {canViewStats && !isRestrictedRole && (
                <>
                    <Typography variant="caption" fontWeight="900" sx={{ letterSpacing: 2, color: 'primary.main', mb: 2, display: 'block' }}>
                        MISSION ACTION TERMINAL
                    </Typography>
                    <Grid container spacing={1.5} mb={5}>
                        {[
                            ...(canManageUsers ? [{ label: 'Verify Members', icon: UserCheck, color: 'green', onClick: () => setVerificationModalOpen(true), badge: pendingUsers.length }] : []),
                            ...(isOperationsExec ? [
                                { label: 'Broadcast', icon: AlertCircle, color: 'orange', href: '/announcements' },
                                { label: 'Initiative', icon: Briefcase, color: 'purple', href: '/projects' },
                                { label: 'Plans', icon: Target, color: 'pink', href: '/plans' },
                                { label: 'Briefings', icon: MessageSquare, color: 'cyan', href: '/meetings' },
                                { label: 'Schedule', icon: Calendar, color: 'blue', href: '/calendar' },
                            ] : []),
                            { label: 'Baptism', icon: Droplet, color: 'cyan', onClick: () => setBaptismsOpen(true), badge: pendingBaptisms },
                            { label: 'Dedication', icon: Baby, color: 'orange', onClick: () => setDedicationManagerOpen(true), badge: pendingDedications },
                            { label: 'Partners', icon: Star, color: 'orange', onClick: () => setPartnershipManagerOpen(true) },
                            { label: 'Appoints', icon: MessageSquare, color: 'cyan', onClick: () => setAppointmentManagerOpen(true), badge: pendingAppointments },
                            { label: 'Health Ops', icon: RefreshCw, color: 'green', href: '/health' },
                            ...(canViewPersonnel && isOperationsExec ? [{ label: 'Departments', icon: Users, color: 'purple', href: '/departments' }] : []),
                        ].map((action, i) => (
                            <Grid item xs={6} sm={4} md={2} key={i}>
                                <Button
                                    fullWidth
                                    component={action.href ? Link : 'button'}
                                    to={action.href}
                                    onClick={action.onClick}
                                    sx={{
                                        py: 2.5, display: 'flex', flexDirection: 'column', gap: 0.8,
                                        bgcolor: 'rgba(255,255,255,0.02)', border: '1px solid var(--glass-border)',
                                        borderRadius: 3, color: 'white', textTransform: 'none',
                                        '&:hover': {
                                            bgcolor: `rgba(var(--${action.color}-rgb), 0.1)`,
                                            borderColor: `var(--${action.color})`,
                                            transform: 'translateY(-2px)'
                                        }
                                    }}
                                >
                                    <Box sx={{ position: 'relative' }}>
                                        <action.icon size={20} color={`var(--${action.color})`} />
                                        {(action.badge ?? 0) > 0 && (
                                            <Box sx={{ position: 'absolute', top: -8, right: -8, bgcolor: 'error.main', color: 'white', borderRadius: '50%', minWidth: 16, height: 16, px: 0.5, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.6rem', fontWeight: 'bold' }}>
                                                {action.badge}
                                            </Box>
                                        )}
                                    </Box>
                                    <Typography variant="caption" fontWeight="bold" sx={{ fontSize: '0.68rem' }}>{action.label}</Typography>
                                </Button>
                            </Grid>
                        ))}
                    </Grid>
                </>
            )}


            {/* ── Leader Sync Mode Banner ── */}
            {canViewStats && role !== 'SUPER_ADMIN' && (
                <Paper elevation={0} sx={{ mb: 4, p: 2.5, borderRadius: 3, bgcolor: 'rgba(0,200,255,0.04)', border: '1px solid rgba(0,200,255,0.15)', display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Eye size={22} color="var(--cyan)" />
                    <Box>
                        <Typography variant="body2" fontWeight="950" sx={{ color: 'var(--cyan)', letterSpacing: 1 }}>SYNC MODE ACTIVE</Typography>
                        <Typography variant="caption" color="textSecondary" fontWeight="700">
                            You have read access to all church-wide operational intelligence. Tap any card for details.
                        </Typography>
                    </Box>
                </Paper>
            )}

            {/* ── Stats Grid (Executive Only) ── */}
            {!isRestrictedRole && stats.length > 0 && (
                <Grid container spacing={2} mb={5}>
                    {stats.map((stat) => (
                        <Grid item xs={6} sm={4} md={2} key={stat.title}>
                            <Card className="holographic-card" sx={{ p: 2 }}>
                                <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
                                    <stat.icon size={16} color={`var(--${stat.color})`} />
                                </Box>
                                <Typography variant="h5" fontWeight="900">{stat.value}</Typography>
                                <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 700, textTransform: 'uppercase', fontSize: '0.6rem', letterSpacing: 0.5 }}>
                                    {stat.title}
                                </Typography>
                            </Card>
                        </Grid>
                    ))}
                </Grid>
            )}

            {/* ── Announcement Ticker (compact, top highlight) ── */}
            {announcements.length > 0 && (
                <Box sx={{ mb: 3, p: 1.5, borderRadius: 2, bgcolor: 'rgba(255,152,0,0.05)', border: '1px solid rgba(255,152,0,0.15)', display: 'flex', alignItems: 'center', gap: 1.5, overflow: 'hidden' }}>
                    <Bell size={14} color="var(--orange)" style={{ flexShrink: 0 }} />
                    <Typography variant="caption" fontWeight="950" sx={{ color: 'var(--orange)', letterSpacing: 1.5, flexShrink: 0, fontSize: '0.62rem' }}>LIVE:</Typography>
                    <Typography variant="caption" fontWeight="700" noWrap sx={{ opacity: 0.8, fontSize: '0.7rem' }}>
                        {announcements[0]?.title}
                    </Typography>
                </Box>
            )}

            {/* ── Department Filter ── */}
            {!isRestrictedRole && (
                <Box display="flex" alignItems="center" gap={2} mb={3}>
                <Filter size={14} color="var(--primary)" />
                <Typography variant="caption" fontWeight="950" sx={{ letterSpacing: 1.5, color: 'primary.main' }}>FILTER BY SECTOR</Typography>
                <FormControl size="small" sx={{ minWidth: 180 }}>
                    <Select
                        value={deptFilter}
                        onChange={(e) => setDeptFilter(e.target.value)}
                        displayEmpty
                        sx={{ fontSize: '0.75rem', fontWeight: 800, bgcolor: 'rgba(255,255,255,0.03)', border: '1px solid var(--glass-border)', borderRadius: 2, '.MuiOutlinedInput-notchedOutline': { border: 'none' } }}
                    >
                        <MenuItem value="ALL"><em>All Sectors</em></MenuItem>
                        {departments.map((d: any) => (
                            <MenuItem key={d.id} value={d.id} sx={{ fontSize: '0.75rem', fontWeight: 700 }}>{d.name}</MenuItem>
                        ))}
                    </Select>
                </FormControl>
            </Box>
            )}

            {/* ── Operational Timeline ── */}
            {isOperationsExec && (
                <Card className="holographic-card" sx={{ mb: 4 }}>
                    <CardContent sx={{ p: { xs: 2, md: 3 } }}>
                        <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
                            <Box>
                                <Typography variant="h6" fontWeight="1000" sx={{ letterSpacing: 1.5, mb: 0.5 }}>
                                    MASTER OPERATIONS TRACK
                                </Typography>
                                <Typography variant="caption" color="textSecondary" fontWeight="800" sx={{ letterSpacing: 1 }}>
                                    PROJECTS · EVENTS · PLANS · MEETINGS — SORTED BY DATE
                                </Typography>
                            </Box>
                            <Calendar size={18} className="text-secondary opacity-50" />
                        </Box>
                        <OperationalTimeline items={timelineItems} />
                    </CardContent>
                </Card>
            )}

            {/* ── Broadcasts Track ── */}
            {isOperationsExec && (
                <Card className="holographic-card" sx={{ mb: 4 }}>
                    <CardContent sx={{ p: { xs: 2, md: 3 } }}>
                        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                            <Box>
                                <Typography variant="h6" fontWeight="1000" sx={{ letterSpacing: 1.5, mb: 0.3 }}>ALL BROADCASTS</Typography>
                                <Typography variant="caption" color="textSecondary" fontWeight="800" sx={{ letterSpacing: 1 }}>URGENT · HIGH · NORMAL — COLOR CODED BY PRIORITY</Typography>
                            </Box>
                            {canManageUsers && !isRestrictedRole && (
                                <Button component={Link} to="/announcements" size="small" variant="outlined"
                                    sx={{ fontSize: '0.65rem', fontWeight: 900, borderColor: 'var(--orange)', color: 'var(--orange)', '&:hover': { bgcolor: 'rgba(255,152,0,0.1)' } }}>
                                    MANAGE
                                </Button>
                            )}
                        </Box>
                        <BroadcastTrack announcements={announcements} />
                    </CardContent>
                </Card>
            )}

            {/* ── Initiatives Track ── */}
            {isOperationsExec && (
                <Card className="holographic-card">
                    <CardContent sx={{ p: { xs: 2, md: 3 } }}>
                        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                            <Box>
                                <Typography variant="h6" fontWeight="1000" sx={{ letterSpacing: 1.5, mb: 0.3 }}>STRATEGIC INITIATIVES</Typography>
                                <Typography variant="caption" color="textSecondary" fontWeight="800" sx={{ letterSpacing: 1 }}>PROJECTS — COLOR CODED BY STATUS</Typography>
                            </Box>
                            {canManageUsers && !isRestrictedRole && (
                                <Button component={Link} to="/projects" size="small" variant="outlined"
                                    sx={{ fontSize: '0.65rem', fontWeight: 900, borderColor: 'var(--purple)', color: 'var(--purple)', '&:hover': { bgcolor: 'rgba(124,58,237,0.1)' } }}>
                                    MANAGE
                                </Button>
                            )}
                        </Box>
                        <InitiativesTrack projects={filterByDept(projects)} />
                    </CardContent>
                </Card>
            )}

            {/* ── Member Verification Modal (Admin Only) ── */}
            {canManageUsers && (
                <Modal
                    open={verificationModalOpen}
                    onClose={() => setVerificationModalOpen(false)}
                    BackdropProps={{ sx: { backdropFilter: 'blur(10px)', bgcolor: 'rgba(0,0,0,0.8)' } }}
                >
                    <Fade in={verificationModalOpen}>
                        <Box sx={{
                            position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
                            width: { xs: '92%', sm: '85%', md: 560 },
                            maxHeight: '85vh',
                            bgcolor: 'background.paper',
                            border: '1px solid var(--glass-border)',
                            borderRadius: 3,
                            display: 'flex', flexDirection: 'column',
                            overflow: 'hidden',
                            outline: 'none'
                        }}>
                            <Box sx={{ p: 2.5, display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                                <Box>
                                    <Typography variant="h6" fontWeight="950">MEMBER REGISTRY</Typography>
                                    <Typography variant="caption" color="textSecondary" fontWeight="700">{pendingUsers.length} MEMBERS IN VIEW</Typography>
                                </Box>
                                <IconButton onClick={() => setVerificationModalOpen(false)} sx={{ color: 'text.secondary' }}>
                                    <XCircle size={22} />
                                </IconButton>
                            </Box>
                            <Box sx={{ p: 2, flexGrow: 1, overflowY: 'auto' }}>
                                {pendingUsers.length === 0 ? (
                                    <Box textAlign="center" py={8}>
                                        <Typography color="textSecondary" variant="body2">Registry fully verified. No pending clearances.</Typography>
                                    </Box>
                                ) : (
                                    pendingUsers.map((u: any) => (
                                        <Card key={u.id} sx={{ mb: 1.5, bgcolor: 'rgba(255,255,255,0.02)', border: '1px solid var(--glass-border)' }}>
                                            <CardContent sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', p: '12px !important' }}>
                                                <Box display="flex" alignItems="center" gap={1.5}>
                                                    <Avatar sx={{ width: 34, height: 34, fontSize: '0.9rem', bgcolor: u.deletionRequested ? 'error.main' : 'primary.main' }}>{u.name.charAt(0)}</Avatar>
                                                    <Box>
                                                        <Typography variant="body2" fontWeight="900" noWrap sx={{ maxWidth: { xs: 130, sm: 220 } }}>{u.name}</Typography>
                                                        <Box display="flex" gap={1} alignItems="center">
                                                            <Typography variant="caption" color="textSecondary" sx={{ fontSize: '0.62rem' }}>
                                                                {u.membershipNumber} · {u.idNumber}
                                                            </Typography>
                                                            {u.deletionRequested && (
                                                                <Chip label="DELETION REQ" size="small" color="error" sx={{ height: 16, fontSize: '0.55rem', fontWeight: 900 }} />
                                                            )}
                                                            {u.isCardReplacementRequested && (
                                                                <Chip label="RENEWAL REQ" size="small" color="warning" sx={{ height: 16, fontSize: '0.55rem', fontWeight: 900 }} />
                                                            )}
                                                        </Box>
                                                    </Box>
                                                </Box>
                                                
                                                <Box display="flex" alignItems="center" gap={1}>
                                                    {/* Partnership Toggle */}
                                                    <Tooltip title={u.isPartner ? "Partner Status: Active" : "Promote to Partner"}>
                                                        <IconButton 
                                                            size="small" 
                                                            onClick={() => partnershipMutation.mutate({ id: u.id, currentStatus: u.isPartner })}
                                                            sx={{ 
                                                                color: u.isPartner ? 'orange' : 'rgba(255,255,255,0.1)',
                                                                border: '1px solid',
                                                                borderColor: u.isPartner ? 'orange' : 'rgba(255,255,255,0.05)',
                                                                bgcolor: u.isPartner ? 'rgba(255, 165, 0, 0.05)' : 'transparent',
                                                                '&:hover': { bgcolor: 'rgba(255, 165, 0, 0.1)' }
                                                            }}
                                                        >
                                                            <Star size={17} fill={u.isPartner ? "orange" : "none"} />
                                                        </IconButton>
                                                    </Tooltip>

                                                    {/* Status Badge */}
                                                    <Chip 
                                                        label={u.status} 
                                                        size="small" 
                                                        sx={{ 
                                                            height: 20, 
                                                            fontSize: '0.6rem', 
                                                            fontWeight: 900,
                                                            bgcolor: u.status === 'ACTIVE' ? 'rgba(76,175,80,0.1)' : 'rgba(255,152,0,0.1)',
                                                            color: u.status === 'ACTIVE' ? 'success.main' : 'warning.main',
                                                            border: '1px solid',
                                                            borderColor: u.status === 'ACTIVE' ? 'success.main' : 'warning.main'
                                                        }} 
                                                    />

                                                    {/* Payment Checkbox (Custom toggle for small space) */}
                                                    {!u.deletionRequested && (
                                                        <Tooltip title={u.isCardPaid ? "Payment Verified" : "Verify Payment First"}>
                                                            <Box 
                                                                onClick={() => markPaidMutation.mutate({ id: u.id, isPaid: !u.isCardPaid })}
                                                                sx={{ 
                                                                    cursor: 'pointer',
                                                                    display: 'flex', 
                                                                    alignItems: 'center', 
                                                                    gap: 0.5, 
                                                                    px: 1, py: 0.3,
                                                                    borderRadius: 1,
                                                                    bgcolor: u.isCardPaid ? 'rgba(76,175,80,0.1)' : 'rgba(255,255,255,0.05)',
                                                                    border: '1px solid',
                                                                    borderColor: u.isCardPaid ? 'success.main' : 'rgba(255,255,255,0.1)',
                                                                    opacity: markPaidMutation.isLoading ? 0.5 : 1
                                                                }}
                                                            >
                                                                <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: u.isCardPaid ? 'success.main' : 'text.disabled' }} />
                                                                <Typography sx={{ fontSize: '0.55rem', fontWeight: 900, color: u.isCardPaid ? 'success.main' : 'text.disabled' }}>
                                                                    {u.isCardPaid ? 'PAID' : 'UNPAID'}
                                                                </Typography>
                                                            </Box>
                                                        </Tooltip>
                                                    )}

                                                    <Box display="flex" gap={0.5}>
                                                        {u.isCardReplacementRequested ? (
                                                            <Tooltip title="Approve Renewal">
                                                                <IconButton 
                                                                    size="small" 
                                                                    color="warning" 
                                                                    onClick={() => {
                                                                        const newNo = prompt('Enter New Membership Number:', u.membershipNumber);
                                                                        if (newNo) approveRenewalMutation.mutate({ id: u.id, newMembershipNumber: newNo });
                                                                    }}
                                                                    sx={{ border: '1px solid rgba(255,152,0,0.25)' }}
                                                                >
                                                                    <CheckCircle size={17} />
                                                                </IconButton>
                                                            </Tooltip>
                                                        ) : (
                                                            <>
                                                                <Tooltip title={u.deletionRequested ? "Confirm Deletion" : (u.status === 'ACTIVE' ? "Already Verified" : (u.isCardPaid ? "Activate" : "Payment Required"))}>
                                                                    <span>
                                                                        <IconButton 
                                                                            size="small" 
                                                                            color={u.deletionRequested ? "error" : "success"} 
                                                                            disabled={verifyMutation.isLoading || (!u.deletionRequested && (u.status === 'ACTIVE' || !u.isCardPaid))} 
                                                                            onClick={() => verifyMutation.mutate({ id: u.id, status: 'ACTIVE', name: u.name })} 
                                                                            sx={{ border: `1px solid ${u.deletionRequested ? 'rgba(244,67,54,0.25)' : 'rgba(76,175,80,0.25)'}` }}
                                                                        >
                                                                            {u.deletionRequested ? <Trash2 size={17} /> : <CheckCircle size={17} />}
                                                                        </IconButton>
                                                                    </span>
                                                                </Tooltip>
                                                                <Tooltip title={u.deletionRequested ? "Reject Deletion Request" : "Reject Registration"}>
                                                                    <IconButton size="small" color="info" disabled={verifyMutation.isLoading} onClick={() => verifyMutation.mutate({ id: u.id, status: 'REJECTED', name: u.name })} sx={{ border: '1px solid rgba(0,188,212,0.25)' }}>
                                                                        <XCircle size={17} />
                                                                    </IconButton>
                                                                </Tooltip>
                                                            </>
                                                        )}
                                                    </Box>
                                                </Box>
                                            </CardContent>
                                        </Card>
                                    ))
                                )}
                            </Box>
                        </Box>
                    </Fade>
                </Modal>
            )}

            <Snackbar open={toast.open} autoHideDuration={4000} onClose={handleCloseToast} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
                <Alert onClose={handleCloseToast} severity={toast.severity} variant="filled" sx={{ width: '100%', borderRadius: 2 }}>{toast.message}</Alert>
            </Snackbar>

            <BaptismManager open={baptismsOpen} onClose={() => setBaptismsOpen(false)} />
            <DedicationManager open={dedicationManagerOpen} onClose={() => setDedicationManagerOpen(false)} />
            <AppointmentManager open={appointmentManagerOpen} onClose={() => setAppointmentManagerOpen(false)} />
            <PartnershipManager open={partnershipManagerOpen} onClose={() => setPartnershipManagerOpen(false)} />
        </DashboardLayout>
    );
}
