import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import api from '../lib/api-client';
import {
    Typography, Grid, Card, CardContent, Box, Button, Chip, Divider, LinearProgress,
    Avatar, Tooltip, Paper, Tabs, Tab, IconButton, Skeleton, useMediaQuery, useTheme
} from '@mui/material';
import {
    Calendar, Users, Briefcase, ChevronRight, CheckCircle2,
    Package, TrendingUp, AlertCircle, ArrowUpRight, ShieldCheck, Plus, MapPin,
    Heart, FileText, Download, Share2, Edit, Trash2, MessageSquare, Coins, Clock, Zap, Shield
} from 'lucide-react';
import DashboardLayout from '../components/layout/DashboardLayout';
import { useAuth } from '../contexts/AuthContext';
import { useQueryClient, useMutation } from '@tanstack/react-query';

// Modal Imports
import ProjectFormModal from '../components/modals/ProjectFormModal';
import EventFormModal from '../components/modals/EventFormModal';
import PlanFormModal from '../components/modals/PlanFormModal';
import AnnouncementFormModal from '../components/modals/AnnouncementFormModal';
import { DepartmentAccounts } from '../components/dashboard/DepartmentAccounts';

interface TabPanelProps {
    children?: React.ReactNode;
    index: number;
    value: number;
}

function TabPanel(props: TabPanelProps) {
    const { children, value, index, ...other } = props;
    return (
        <div role="tabpanel" hidden={value !== index} {...other}>
            {value === index && <Box sx={{ py: 3 }}>{children}</Box>}
        </div>
    );
}

export default function DepartmentDashboard() {
    const { id } = useParams();
    const { user } = useAuth();
    const queryClient = useQueryClient();
    const [tabValue, setTabValue] = useState(0);
    const navigate = useNavigate();

    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
    const isTablet = useMediaQuery(theme.breakpoints.down('md'));

    // Front-end access validation
    useEffect(() => {
        if (user?.role === 'DEPARTMENT_LEADER' && id && id !== user.departmentId) {
            navigate(`/department/${user.departmentId}`, { replace: true });
        }
    }, [id, user, navigate]);

    const isAuthorized = user?.role === 'SUPER_ADMIN' || user?.role === 'DEPARTMENT_LEADER';

    // Modal State
    const [projectModal, setProjectModal] = useState({ open: false, data: null });
    const [eventModal, setEventModal] = useState({ open: false, data: null });
    const [planModal, setPlanModal] = useState({ open: false, data: null });
    const [announcementModal, setAnnouncementModal] = useState({ open: false, data: null });

    // Delete Mutations
    const deleteProjectMutation = useMutation((id: string) => api.delete(`/projects/${id}`), { onSuccess: () => queryClient.invalidateQueries(['dept-projects', effectiveId]) });
    const deleteEventMutation = useMutation((id: string) => api.delete(`/events/${id}`), { onSuccess: () => queryClient.invalidateQueries(['dept-events', effectiveId]) });
    const deletePlanMutation = useMutation((id: string) => api.delete(`/plans/${id}`), { onSuccess: () => queryClient.invalidateQueries(['dept-plans', effectiveId]) });
    const deleteAnnMutation = useMutation((id: string) => api.delete(`/announcements/${id}`), { onSuccess: () => queryClient.invalidateQueries(['dept-announcements', effectiveId]) });

    const handleDelete = (type: string, itemId: string) => {
        if (!window.confirm(`Are you sure you want to terminate this ${type}?`)) return;
        if (type === 'project') deleteProjectMutation.mutate(itemId);
        if (type === 'event') deleteEventMutation.mutate(itemId);
        if (type === 'plan') deletePlanMutation.mutate(itemId);
        if (type === 'announcement') deleteAnnMutation.mutate(itemId);
    };

    const effectiveId = (id && id !== 'undefined') ? id : user?.departmentId;
    const isReady = !!effectiveId && effectiveId !== 'undefined';

    const { data: department, isLoading } = useQuery(['department', effectiveId], async () => {
        const res = await api.get(`/departments/${effectiveId}`);
        return res.data;
    }, { enabled: isReady });

    const { data: assets } = useQuery(['dept-assets', effectiveId], async () => {
        const res = await api.get(`/assets/department/${effectiveId}`);
        return res.data;
    }, { enabled: isReady });

    const { data: budgets } = useQuery(['dept-budgets', effectiveId], async () => {
        const res = await api.get(`/budgets?departmentId=${effectiveId}`);
        return res.data;
    }, { enabled: isReady });

    const { data: announcements } = useQuery(['dept-announcements', effectiveId], async () => {
        const res = await api.get(`/announcements?departmentId=${effectiveId}`);
        return res.data;
    }, { enabled: isReady });

    const { data: projects } = useQuery(['dept-projects', effectiveId], async () => {
        const res = await api.get('/projects');
        return Array.isArray(res.data) ? res.data.filter((p: any) => p.departmentId === effectiveId) : [];
    }, { enabled: isReady });

    const { data: events } = useQuery(['dept-events', effectiveId], async () => {
        const res = await api.get('/events');
        return Array.isArray(res.data) ? res.data.filter((e: any) => e.departmentId === effectiveId) : [];
    }, { enabled: isReady });

    const { data: plans } = useQuery(['dept-plans', effectiveId], async () => {
        const res = await api.get('/plans');
        return Array.isArray(res.data) ? res.data.filter((p: any) => p.departmentId === effectiveId) : [];
    }, { enabled: isReady });

    if (isLoading) return (
        <DashboardLayout>
            <Box sx={{ mb: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'end' }}>
                <Box display="flex" gap={2}>
                    <Skeleton variant="circular" width={60} height={60} />
                    <Box>
                        <Skeleton variant="text" width={200} height={40} />
                        <Skeleton variant="text" width={100} height={20} />
                    </Box>
                </Box>
                <Skeleton variant="rectangular" width={200} height={40} sx={{ borderRadius: 2 }} />
            </Box>
            
            <Grid container spacing={3} mb={4}>
                {[1, 2, 3, 4].map(i => (
                    <Grid item xs={12} sm={6} md={3} key={`skeleton-stat-${i}`}>
                        <Skeleton variant="rectangular" height={120} sx={{ borderRadius: 4 }} />
                    </Grid>
                ))}
            </Grid>
            
            <Skeleton variant="rectangular" width="100%" height={400} sx={{ borderRadius: 4 }} />
        </DashboardLayout>
    );

    const activeProjectsCount = projects?.filter((p: any) => p.status === 'IN_PROGRESS' || p.approvalStatus === 'APPROVED').length || 0;
    const upcomingEventsCount = events?.filter((e: any) => new Date(e.date) >= new Date() && (e.status === 'SCHEDULED' || e.approvalStatus === 'APPROVED')).length || 0;
    
    // Calculate total budget progression
    const totalBudgetTarget = budgets?.reduce((acc: number, b: any) => acc + (b.targetAmount || 0), 0) || 0;
    const totalBudgetRaised = budgets?.reduce((acc: number, b: any) => acc + (b.amountRaised || 0), 0) || 0;
    const budgetProgressStr = totalBudgetTarget > 0 ? `${Math.round((totalBudgetRaised / totalBudgetTarget) * 100)}%` : '0%';

    // Mock volunteers (since there is no volunteer model yet, we show personnel count from users endpoint ideally, but we use a placeholder for now to match the user request)
    const volunteersCount = 12;

    const stats = [
        { title: 'Projects Active', value: activeProjectsCount, icon: Briefcase, color: 'blue' },
        { title: 'Upcoming Events', value: upcomingEventsCount, icon: Calendar, color: 'purple' },
        { title: 'Budget Progress', value: budgetProgressStr, icon: TrendingUp, color: 'green' },
        { title: 'Volunteers', value: volunteersCount, icon: Users, color: 'orange' },
    ];

    return (
        <DashboardLayout>
            <Box sx={{ mb: 6, display: 'flex', flexDirection: { xs: 'column', md: 'row' }, justifyContent: 'space-between', alignItems: { xs: 'start', md: 'end' }, gap: 3 }}>
                <div>
                    <Box display="flex" alignItems="center" gap={2} mb={1}>
                        <div className="p-2 sm:p-3 bg-primary/10 rounded-2xl text-primary shadow-[0_0_20px_rgba(var(--primary-h),var(--primary-s),var(--primary-l),0.2)]">
                            <ShieldCheck size={isMobile ? 28 : 36} />
                        </div>
                        <div>
                            <Typography variant={isMobile ? "h5" : "h3"} fontWeight="900" className="glow-text" sx={{ letterSpacing: isMobile ? -1 : -2 }}>
                                {department?.name} <span className="text-primary/70">Sector</span>
                            </Typography>
                            <Box display="flex" alignItems="center" gap={1.5}>
                                <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-500/10 border border-green-500/20">
                                    <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                                    <Typography className="neon-label" sx={{ color: 'success.main', fontSize: '0.6rem !important' }}>Operational</Typography>
                                </div>
                                <Typography variant="caption" color="textSecondary" sx={{ fontWeight: 800, opacity: 0.5, letterSpacing: 1 }}>HUB_CMD_v2.4</Typography>
                            </Box>
                        </div>
                    </Box>
                </div>
            </Box>

            {/* POS QUICK ACTION GRID */}
            <Typography variant="caption" fontWeight="900" sx={{ letterSpacing: 2, color: 'primary.main', mb: 2, display: 'block' }}>MISSION CONTROL TERMINAL</Typography>
            <Grid container spacing={isMobile ? 1 : 2} mb={isMobile ? 4 : 8}>
                {[
                    { label: 'New Project', icon: Briefcase, color: 'purple', onClick: () => setProjectModal({ open: true, data: null }) },
                    { label: 'Host Event', icon: Calendar, color: 'blue', onClick: () => setEventModal({ open: true, data: null }) },
                    { label: 'Strategic Plan', icon: FileText, color: 'cyan', onClick: () => setPlanModal({ open: true, data: null }) },
                    { label: 'Broadcast', icon: AlertCircle, color: 'orange', onClick: () => setAnnouncementModal({ open: true, data: null }) },
                    { label: 'Strategic Alignment', icon: FileText, color: 'blue', href: '/plans' },
                    { label: 'Asset Register', icon: Shield, color: 'amber', href: '#assets' },
                ].map((action, i) => (
                    <Grid item xs={6} sm={4} md={2} key={i}>
                        <Button
                            fullWidth
                            component={action.href ? Link : 'button'}
                            to={action.href}
                            onClick={action.onClick}
                            sx={{
                                height: isMobile ? 80 : 100,
                                display: 'flex',
                                flexDirection: 'column',
                                gap: isMobile ? 1 : 1.5,
                                bgcolor: 'rgba(255,255,255,0.03)',
                                border: '1px solid var(--glass-border)',
                                borderRadius: isMobile ? 2 : 3,
                                color: 'white',
                                textTransform: 'none',
                                transition: 'all 0.3s',
                                '&:hover': {
                                    bgcolor: `rgba(var(--${action.color}-rgb), 0.1)`,
                                    borderColor: `var(--${action.color})`,
                                    transform: 'translateY(-4px)',
                                    boxShadow: `0 8px 24px rgba(var(--${action.color}-rgb), 0.2)`
                                }
                            }}
                        >
                            <action.icon size={isMobile ? 20 : 24} color={`var(--${action.color})`} />
                            <Typography variant="caption" fontWeight="bold" sx={{ fontSize: isMobile ? '0.65rem' : '0.75rem' }}>{action.label}</Typography>
                        </Button>
                    </Grid>
                ))}
            </Grid>

            <Grid container spacing={isMobile ? 2 : 3} mb={4}>
                {stats.map((stat) => (
                    <Grid item xs={12} sm={6} md={3} key={stat.title}>
                        <Card sx={{
                            borderRadius: isMobile ? 3 : 4,
                            border: '1px solid',
                            borderColor: 'divider',
                            bgcolor: 'background.paper'
                        }}>
                            <CardContent sx={{ p: isMobile ? 2 : 3 }}>
                                <Box display="flex" justifyContent="space-between" alignItems="start" mb={isMobile ? 1 : 2}>
                                    <div className={`p-1.5 sm:p-2 rounded-xl bg-${stat.color}-500/10 text-${stat.color}-600`}>
                                        <stat.icon size={isMobile ? 18 : 20} />
                                    </div>
                                    <ArrowUpRight size={14} className="text-muted-foreground opacity-50" />
                                </Box>
                                <Typography variant={isMobile ? "h5" : "h4"} fontWeight="800" sx={{ mb: 0.5 }}>{stat.value}</Typography>
                                <Typography variant="caption" fontWeight="bold" sx={{ color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.5, fontSize: isMobile ? '0.6rem' : '0.75rem' }}>
                                    {stat.title}
                                </Typography>
                            </CardContent>
                        </Card>
                    </Grid>
                ))}
            </Grid>

            <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2, overflowX: 'auto' }}>
                <Tabs 
                    value={tabValue} 
                    onChange={(_, v) => setTabValue(v)} 
                    variant={isMobile ? "scrollable" : "standard"}
                    scrollButtons={isMobile ? "auto" : false}
                    sx={{
                        '& .MuiTab-root': { fontWeight: 'bold', textTransform: 'none', minWidth: isMobile ? 100 : 120, fontSize: isMobile ? '0.8rem' : '0.875rem' },
                        '& .Mui-selected': { color: 'primary.main' }
                    }}
                >
                    <Tab label="Strategic Briefing" />
                    <Tab label="Financial Tactics" />
                    <Tab label="Intelligence Reports" />
                    <Tab label="Initiatives" />
                </Tabs>
            </Box>

            <TabPanel value={tabValue} index={0}>
                <Grid container spacing={4}>
                    <Grid item xs={12} lg={8}>
                        <Typography variant="h6" fontWeight="900" sx={{ mb: 3, display: 'flex', alignItems: 'center', gap: 1.5 }}>
                            <Calendar size={20} /> Upcoming Syncs
                        </Typography>
                        <div className="space-y-4">
                            {department?.meetings?.length > 0 ? department.meetings.map((meeting: any) => (
                                <Card key={meeting.id} sx={{
                                    borderRadius: 4,
                                    border: '1px solid',
                                    borderColor: 'divider',
                                    '&:hover': { borderColor: 'primary.main' }
                                }} elevation={0}>
                                    <CardContent sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', p: 3 }}>
                                        <Box display="flex" alignItems="center" gap={3}>
                                            <div className="w-14 h-14 rounded-2xl bg-primary/5 flex flex-col items-center justify-center text-primary border border-primary/10">
                                                <Typography variant="caption" fontWeight="900">{new Date(meeting.date).toLocaleString('default', { month: 'short' }).toUpperCase()}</Typography>
                                                <Typography variant="h6" fontWeight="900" sx={{ mt: -0.5 }}>{new Date(meeting.date).getDate()}</Typography>
                                            </div>
                                            <div>
                                                <Typography variant="subtitle1" fontWeight="800">{meeting.title}</Typography>
                                                <Typography variant="body2" color="textSecondary" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                    <MapPin size={14} /> {meeting.venue} • {meeting.time}
                                                </Typography>
                                            </div>
                                        </Box>
                                        <Button variant="text" color="primary" sx={{ fontWeight: 'bold' }} endIcon={<ChevronRight size={16} />}>
                                            Details
                                        </Button>
                                    </CardContent>
                                </Card>
                            )) : (
                                <Paper sx={{ p: 6, textAlign: 'center', borderRadius: 4, border: '1px dashed', borderColor: 'divider', bgcolor: 'transparent' }}>
                                    <Typography color="textSecondary" fontWeight="medium">No briefings scheduled.</Typography>
                                </Paper>
                            )}
                        </div>

                        <Box display="flex" justifyContent="space-between" alignItems="center" mt={6} mb={3}>
                            <Typography variant="h6" fontWeight="900" sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                                <AlertCircle size={20} className="text-primary" /> Department Announcements
                            </Typography>
                            {isAuthorized && (
                                <IconButton size="small" onClick={() => setAnnouncementModal({ open: true, data: null })}><Plus size={20} /></IconButton>
                            )}
                        </Box>
                        <div className="space-y-4">
                            {announcements?.length > 0 ? announcements.map((ann: any) => (
                                <Card key={ann.id} sx={{
                                    borderRadius: 4,
                                    border: '1px solid',
                                    borderColor: 'divider',
                                    bgcolor: ann.priority === 'HIGH' ? 'error.main/5' : 'transparent',
                                    '&:hover': { borderColor: 'primary.main' }
                                }} elevation={0}>
                                    <CardContent sx={{ p: 3 }}>
                                        <Box display="flex" justifyContent="space-between" alignItems="start" mb={1}>
                                            <Typography variant="subtitle1" fontWeight="900">{ann.title}</Typography>
                                            <Box display="flex" gap={1} alignItems="center">
                                                {ann.priority === 'HIGH' && (
                                                    <Chip label="CRITICAL" color="error" size="small" sx={{ fontWeight: 'bold', fontSize: '0.6rem', height: 18 }} />
                                                )}
                                                {(user?.role === 'SUPER_ADMIN' || ann.status === 'PENDING') && (
                                                    <>
                                                        <IconButton size="small" onClick={() => setAnnouncementModal({ open: true, data: ann })}><Edit size={14} /></IconButton>
                                                        <IconButton size="small" color="error" onClick={() => handleDelete('announcement', ann.id)}><Trash2 size={14} /></IconButton>
                                                    </>
                                                )}
                                            </Box>
                                        </Box>
                                        <Typography variant="body2" color="textSecondary" sx={{ mb: 2, opacity: 0.8 }}>{ann.content}</Typography>
                                        <Box display="flex" justifyContent="space-between" alignItems="center">
                                            <Box display="flex" alignItems="center" gap={1}>
                                                <Avatar sx={{ width: 20, height: 20, fontSize: '0.6rem' }}>{ann.author?.name?.charAt(0)}</Avatar>
                                                <Typography variant="caption" fontWeight="bold">{ann.author?.name}</Typography>
                                            </Box>
                                            <Typography variant="caption" color="textSecondary">{new Date(ann.createdAt).toLocaleDateString()}</Typography>
                                        </Box>
                                    </CardContent>
                                </Card>
                            )) : (
                                <Paper sx={{ p: 4, textAlign: 'center', borderRadius: 4, border: '1px dashed', borderColor: 'divider', bgcolor: 'transparent' }}>
                                    <Typography color="textSecondary" variant="body2">No tactical alerts at this time.</Typography>
                                </Paper>
                            )}
                        </div>
                    </Grid>
                    <Grid item xs={12} lg={4}>
                        <Typography variant="h6" fontWeight="900" sx={{ mb: 3 }}>Command Insight</Typography>
                        <Card sx={{
                            borderRadius: 4,
                            bgcolor: 'primary.dark',
                            backgroundImage: 'linear-gradient(135deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0) 100%)',
                            color: 'white',
                            p: 3
                        }}>
                            <Box display="flex" alignItems="center" gap={2} mb={4}>
                                <Avatar 
                                    src={department?.leaders?.[0]?.avatarUrl || user?.avatarUrl}
                                    sx={{ width: 50, height: 50, bgcolor: 'white/10' }}
                                >
                                    {!(department?.leaders?.[0]?.avatarUrl || user?.avatarUrl) && (department?.leaders?.[0]?.name?.charAt(0) || user?.name?.charAt(0))}
                                </Avatar>
                                <div>
                                    <Typography variant="h6" fontWeight="900">{department?.leaders?.[0]?.name || user?.name}</Typography>
                                    <Typography variant="caption" sx={{ opacity: 0.6, fontWeight: 'bold' }}>Department Commander</Typography>
                                </div>
                            </Box>
                            <Box display="flex" flexDirection="column" gap={2}>
                                <div className="flex justify-between items-center text-sm p-2 rounded-lg bg-white/5 border border-white/10">
                                    <span className="opacity-70">Deployment Level</span>
                                    <span className="font-bold">Active</span>
                                </div>
                                <div className="flex justify-between items-center text-sm p-2 rounded-lg bg-white/5 border border-white/10">
                                    <span className="opacity-70">Tech Index</span>
                                    <span className="font-bold text-green-400">Stable</span>
                                </div>
                            </Box>
                        </Card>
                    </Grid>
                </Grid>
            </TabPanel>

            <TabPanel value={tabValue} index={1}>
                <DepartmentAccounts departmentId={effectiveId as string} />
            </TabPanel>

            <TabPanel value={tabValue} index={2}>
                <Typography variant="h6" fontWeight="900" sx={{ mb: 3 }}>Command Intelligence</Typography>
                <div className="space-y-4">
                    {[
                        { title: 'Monthly Strategic Report', date: 'Feb 2026', size: '2.4 MB' },
                        { title: 'Personnel Readiness Audit', date: 'Jan 2026', size: '1.2 MB' },
                        { title: 'Quarterly Financial Prospectus', date: 'Q1 2026', size: '3.8 MB' },
                    ].map((report, i) => (
                        <Card key={i} sx={{ borderRadius: 4, border: '1px solid', borderColor: 'divider' }}>
                            <CardContent sx={{ p: 3, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <Box display="flex" alignItems="center" gap={3}>
                                    <div className="p-2 bg-action-hover rounded-lg">
                                        <FileText size={24} className="text-primary" />
                                    </div>
                                    <div>
                                        <Typography fontWeight="800">{report.title}</Typography>
                                        <Typography variant="caption" color="textSecondary">{report.date} • {report.size}</Typography>
                                    </div>
                                </Box>
                                <Box display="flex" gap={1}>
                                    <IconButton size="small"><Download size={18} /></IconButton>
                                    <IconButton size="small"><Share2 size={18} /></IconButton>
                                </Box>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            </TabPanel>

            <TabPanel value={tabValue} index={3}>
                <Box display="flex" justifyContent="space-between" alignItems="center" mb={4}>
                    <Typography variant="h6" fontWeight="900">Initiative Tactical Board</Typography>
                    <Box display="flex" gap={1}>
                        <Button size="small" variant="contained" startIcon={<Plus size={16}/>} onClick={() => setProjectModal({ open: true, data: null })}>PROJECT</Button>
                        <Button size="small" variant="contained" startIcon={<Plus size={16}/>} onClick={() => setEventModal({ open: true, data: null })}>EVENT</Button>
                    </Box>
                </Box>

                <Grid container spacing={4}>
                    {/* PENDING APPROVALS */}
                    <Grid item xs={12}>
                        <Typography variant="subtitle2" fontWeight="900" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1, color: 'warning.main', letterSpacing: 1 }}>
                            <Clock size={16} /> PENDING AUTHORIZATION
                        </Typography>
                        <Grid container spacing={2}>
                            {[
                                ...(projects?.filter((p: any) => p.approvalStatus === 'PENDING_APPROVAL') || []),
                                ...(events?.filter((e: any) => e.approvalStatus === 'PENDING_APPROVAL') || []),
                                ...(plans?.filter((pl: any) => pl.approvalStatus === 'PENDING_APPROVAL') || []),
                                ...(announcements?.filter((a: any) => a.status === 'PENDING') || [])
                            ].map((item: any, i: number) => (
                                <Grid item xs={12} sm={6} md={4} lg={3} key={`pending-${i}`}>
                                    <Card sx={{ borderRadius: 3, border: '1px solid var(--glass-border)', bgcolor: 'rgba(255,152,0,0.03)' }}>
                                        <CardContent sx={{ p: 2 }}>
                                            <Box display="flex" justifyContent="space-between" alignItems="start">
                                                <Typography variant="body2" fontWeight="800" noWrap sx={{ maxWidth: '70%' }}>{item.title}</Typography>
                                                <Chip label={item.isMajor ? "MAJOR" : "LOCAL"} size="small" variant="outlined" sx={{ height: 16, fontSize: '0.6rem', fontWeight: 'bold' }} />
                                            </Box>
                                            <Typography variant="caption" color="textSecondary" display="block" sx={{ mt: 0.5 }}>{item.isMajor ? "Requires Bishop + 2 Pastors" : "Requires 2 Pastors"}</Typography>
                                            <Box display="flex" justifyContent="space-between" mt={2} alignItems="center">
                                                <Chip label="Awaiting Signatures" size="small" sx={{ height: 18, fontSize: '0.6rem' }} />
                                                <Box>
                                                    <IconButton size="small" onClick={() => {
                                                        if (item.budget !== undefined) setProjectModal({ open: true, data: item });
                                                        else if (item.date) setEventModal({ open: true, data: item });
                                                        else if (item.type) setPlanModal({ open: true, data: item });
                                                        else setAnnouncementModal({ open: true, data: item });
                                                    }}><Edit size={12}/></IconButton>
                                                </Box>
                                            </Box>
                                        </CardContent>
                                    </Card>
                                </Grid>
                            ))}
                            {[
                                ...(projects?.filter((p: any) => p.approvalStatus === 'PENDING_APPROVAL') || []),
                                ...(events?.filter((e: any) => e.approvalStatus === 'PENDING_APPROVAL') || []),
                                ...(plans?.filter((pl: any) => pl.approvalStatus === 'PENDING_APPROVAL') || []),
                                ...(announcements?.filter((a: any) => a.status === 'PENDING') || [])
                            ].length === 0 && (
                                <Grid item xs={12}>
                                    <Typography variant="caption" sx={{ opacity: 0.5 }}>No items pending authorization.</Typography>
                                </Grid>
                            )}
                        </Grid>
                        <Divider sx={{ my: 4 }} />
                    </Grid>

                    {/* ACTIVE INITIATIVES */}
                    <Grid item xs={12}>
                        <Typography variant="subtitle2" fontWeight="900" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1, color: 'success.main', letterSpacing: 1 }}>
                            <Zap size={16} /> ACTIVE MISSIONS
                        </Typography>
                        <Grid container spacing={2}>
                            {[
                                ...(projects?.filter((p: any) => p.approvalStatus === 'APPROVED' && p.status !== 'COMPLETED') || []),
                                ...(events?.filter((e: any) => e.approvalStatus === 'APPROVED' && e.status !== 'COMPLETED' && new Date(e.date) >= new Date()) || []),
                                ...(plans?.filter((pl: any) => pl.approvalStatus === 'APPROVED') || [])
                            ].map((item: any, i: number) => (
                                <Grid item xs={12} sm={6} md={4} lg={3} key={`active-${i}`}>
                                    <Card sx={{ borderRadius: 3, border: '1px solid var(--glass-border)', bgcolor: 'rgba(76,175,80,0.03)' }}>
                                        <CardContent sx={{ p: 2 }}>
                                            <Box display="flex" justifyContent="space-between" alignItems="start">
                                                <Typography variant="body2" fontWeight="800" noWrap sx={{ maxWidth: '70%' }}>{item.title}</Typography>
                                                {item.isMajor && <Chip label="MAJOR" color="primary" size="small" sx={{ height: 16, fontSize: '0.6rem', fontWeight: 'bold' }} />}
                                            </Box>
                                            <Box display="flex" justifyContent="space-between" mt={2} alignItems="center">
                                                <Chip label={item.status || "ACTIVE"} size="small" color="success" sx={{ height: 18, fontSize: '0.6rem' }} />
                                                <Typography variant="caption" color="textSecondary">{item.date ? new Date(item.date).toLocaleDateString() : (item.progress !== undefined ? `${item.progress}%` : '')}</Typography>
                                            </Box>
                                        </CardContent>
                                    </Card>
                                </Grid>
                            ))}
                        </Grid>
                        <Divider sx={{ my: 4 }} />
                    </Grid>

                    {/* COMPLETED INITIATIVES */}
                    <Grid item xs={12}>
                        <Typography variant="subtitle2" fontWeight="900" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1, opacity: 0.6, letterSpacing: 1 }}>
                            <CheckCircle2 size={16} /> ARCHIVED / COMPLETED
                        </Typography>
                        <Grid container spacing={2}>
                            {[
                                ...(projects?.filter((p: any) => p.status === 'COMPLETED') || []),
                                ...(events?.filter((e: any) => e.status === 'COMPLETED' || new Date(e.date) < new Date()) || []),
                                ...(announcements?.filter((a: any) => a.status === 'PUBLISHED') || [])
                            ].slice(0, 8).map((item: any, i: number) => (
                                <Grid item xs={12} sm={6} md={3} key={`completed-${i}`}>
                                    <Card sx={{ borderRadius: 2, border: '1px solid var(--glass-border)', opacity: 0.6 }}>
                                        <CardContent sx={{ p: 2 }}>
                                            <Typography variant="caption" fontWeight="bold" noWrap display="block">{item.title}</Typography>
                                            <Typography variant="caption" color="textSecondary">{item.date ? new Date(item.date).toLocaleDateString() : 'ARCHIVED'}</Typography>
                                        </CardContent>
                                    </Card>
                                </Grid>
                            ))}
                        </Grid>
                    </Grid>
                </Grid>
            </TabPanel>

            {/* Inline CRUD Modals */}
            <ProjectFormModal
                open={projectModal.open}
                onClose={() => setProjectModal({ open: false, data: null })}
                project={projectModal.data}
                onSuccess={() => queryClient.invalidateQueries(['dept-projects', effectiveId])}
            />
            <EventFormModal
                open={eventModal.open}
                onClose={() => setEventModal({ open: false, data: null })}
                event={eventModal.data}
                onSuccess={() => queryClient.invalidateQueries(['dept-events', effectiveId])}
            />
            <PlanFormModal
                open={planModal.open}
                onClose={() => setPlanModal({ open: false, data: null })}
                plan={planModal.data}
                onSuccess={() => queryClient.invalidateQueries(['dept-plans', effectiveId])}
            />
            <AnnouncementFormModal
                open={announcementModal.open}
                onClose={() => setAnnouncementModal({ open: false, data: null })}
                announcement={announcementModal.data}
                onSuccess={() => queryClient.invalidateQueries(['dept-announcements', effectiveId])}
            />
        </DashboardLayout>
    );
}
