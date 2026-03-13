import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import api from '../lib/api-client';
import {
    Typography, Grid, Card, CardContent, Box, Button, Chip, Divider, LinearProgress,
    Avatar, Tooltip, Paper, Tabs, Tab, IconButton
} from '@mui/material';
import {
    Calendar, Users, Briefcase, ChevronRight, CheckCircle2,
    Package, TrendingUp, AlertCircle, ArrowUpRight, ShieldCheck, Plus, MapPin,
    Heart, FileText, Download, Share2, Edit, Trash2
} from 'lucide-react';
import DashboardLayout from '../components/layout/DashboardLayout';
import { useAuth } from '../contexts/AuthContext';
import { useQueryClient, useMutation } from '@tanstack/react-query';

// Modal Imports
import ProjectFormModal from '../components/modals/ProjectFormModal';
import EventFormModal from '../components/modals/EventFormModal';
import PlanFormModal from '../components/modals/PlanFormModal';
import AnnouncementFormModal from '../components/modals/AnnouncementFormModal';

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
            <Box sx={{ height: '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 2 }}>
                <LinearProgress sx={{ width: 200, borderRadius: 1 }} />
                <Typography variant="body2" color="textSecondary" sx={{ fontWeight: 'bold', letterSpacing: 2 }}>
                    INITIALIZING SECTOR HUB...
                </Typography>
            </Box>
        </DashboardLayout>
    );

    const stats = [
        { title: 'Assets', value: assets?.length || 0, icon: Package, color: 'purple' },
        { title: 'Objectives', value: budgets?.filter((b: any) => b.status === 'OPEN').length || 0, icon: TrendingUp, color: 'green' },
        { title: 'Syncs', value: department?.meetings?.length || 0, icon: Calendar, color: 'orange' },
    ];

    return (
        <DashboardLayout>
            <Box sx={{ mb: 6, display: 'flex', flexDirection: { xs: 'column', md: 'row' }, justifyContent: 'space-between', alignItems: { xs: 'start', md: 'end' }, gap: 3 }}>
                <div>
                    <Box display="flex" alignItems="center" gap={2} mb={1}>
                        <div className="p-3 bg-primary/10 rounded-2xl text-primary shadow-[0_0_20px_rgba(var(--primary-h),var(--primary-s),var(--primary-l),0.2)]">
                            <ShieldCheck size={36} />
                        </div>
                        <div>
                            <Typography variant="h3" fontWeight="900" className="glow-text" sx={{ letterSpacing: -2 }}>
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
                <Box display="flex" gap={2} width={{ xs: '100%', md: 'auto' }}>
                    <Button variant="outlined" fullWidth startIcon={<Users size={18} />} sx={{ borderRadius: 3, fontWeight: 'bold', textTransform: 'none', px: 3, border: '1px solid var(--glass-border)' }}>
                        Personnel
                    </Button>
                    <Button variant="contained" fullWidth startIcon={<Plus size={18} />} sx={{ borderRadius: 3, fontWeight: 'bold', textTransform: 'none', px: 3 }}>
                        New Mission
                    </Button>
                </Box>
            </Box>

            <Grid container spacing={3} mb={4}>
                {stats.map((stat) => (
                    <Grid item xs={12} sm={6} md={3} key={stat.title}>
                        <Card sx={{
                            borderRadius: 4,
                            border: '1px solid',
                            borderColor: 'divider',
                            bgcolor: 'background.paper'
                        }}>
                            <CardContent sx={{ p: 3 }}>
                                <Box display="flex" justifyContent="space-between" alignItems="start" mb={2}>
                                    <div className={`p-2 rounded-xl bg-${stat.color}-500/10 text-${stat.color}-600`}>
                                        <stat.icon size={20} />
                                    </div>
                                    <ArrowUpRight size={16} className="text-muted-foreground opacity-50" />
                                </Box>
                                <Typography variant="h4" fontWeight="800" sx={{ mb: 0.5 }}>{stat.value}</Typography>
                                <Typography variant="caption" fontWeight="bold" sx={{ color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                                    {stat.title}
                                </Typography>
                            </CardContent>
                        </Card>
                    </Grid>
                ))}
            </Grid>

            <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
                <Tabs value={tabValue} onChange={(_, v) => setTabValue(v)} sx={{
                    '& .MuiTab-root': { fontWeight: 'bold', textTransform: 'none', minWidth: 120 },
                    '& .Mui-selected': { color: 'primary.main' }
                }}>
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
                                <Avatar sx={{ width: 50, height: 50, bgcolor: 'white/10' }}>
                                    {department?.leaders?.[0]?.name?.charAt(0) || user?.name?.charAt(0)}
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
                <Typography variant="h6" fontWeight="900" sx={{ mb: 3 }}>Active Objectives</Typography>
                <Grid container spacing={4}>
                    {budgets?.map((budget: any) => (
                        <Grid item xs={12} md={6} key={budget.id}>
                            <Card sx={{ borderRadius: 4, border: '1px solid', borderColor: 'divider' }}>
                                <CardContent sx={{ p: 3 }}>
                                    <Box display="flex" justifyContent="space-between" mb={2}>
                                        <Typography variant="h6" fontWeight="800">{budget.title}</Typography>
                                        <Chip label={budget.status} size="small" color="primary" sx={{ fontWeight: 'bold' }} />
                                    </Box>
                                    <LinearProgress
                                        variant="determinate"
                                        value={Math.min((budget.amountRaised / budget.targetAmount) * 100, 100)}
                                        sx={{ height: 8, borderRadius: 4, mb: 2 }}
                                    />
                                    <Box display="flex" justifyContent="space-between">
                                        <Typography variant="body2" fontWeight="bold">${budget.amountRaised.toLocaleString()}</Typography>
                                        <Typography variant="caption" color="textSecondary">of ${budget.targetAmount.toLocaleString()}</Typography>
                                    </Box>
                                </CardContent>
                            </Card>
                        </Grid>
                    )) || <Typography color="textSecondary">No financial objectives.</Typography>}
                </Grid>
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
                <Typography variant="h6" fontWeight="900" sx={{ mb: 3 }}>Department Initiatives</Typography>
                <Grid container spacing={4}>
                    <Grid item xs={12} md={4}>
                        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                            <Typography variant="subtitle1" fontWeight="800" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <Briefcase size={18} className="text-primary" /> Projects
                            </Typography>
                            {isAuthorized && (
                                <IconButton size="small" onClick={() => setProjectModal({ open: true, data: null })}><Plus size={18} /></IconButton>
                            )}
                        </Box>
                        <div className="space-y-3">
                            {(projects || []).length > 0 ? (projects || []).map((project: any) => (
                                <Card key={project.id} sx={{ borderRadius: 3, border: '1px solid', borderColor: 'divider' }}>
                                    <CardContent sx={{ p: 2 }}>
                                        <Box display="flex" justifyContent="space-between" alignItems="start">
                                            <Typography variant="body1" fontWeight="800">{project.title}</Typography>
                                            <Box>
                                                {(user?.role === 'SUPER_ADMIN' || project.approvalStatus === 'PENDING_APPROVAL') && (
                                                    <>
                                                        <IconButton size="small" onClick={() => setProjectModal({ open: true, data: project })}><Edit size={14} /></IconButton>
                                                        <IconButton size="small" color="error" onClick={() => handleDelete('project', project.id)}><Trash2 size={14} /></IconButton>
                                                    </>
                                                )}
                                            </Box>
                                        </Box>
                                        <Box display="flex" justifyContent="space-between" mt={1}>
                                            <Chip label={project.approvalStatus || project.status} size="small" color={project.approvalStatus === 'APPROVED' ? 'success' : 'warning'} sx={{ fontSize: '0.65rem', fontWeight: 'bold' }} />
                                            <Typography variant="caption" color="textSecondary">{new Date(project.deadline).toLocaleDateString()}</Typography>
                                        </Box>
                                    </CardContent>
                                </Card>
                            )) : <Typography variant="body2" color="textSecondary">No projects.</Typography>}
                        </div>
                    </Grid>

                    <Grid item xs={12} md={4}>
                        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                            <Typography variant="subtitle1" fontWeight="800" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <Calendar size={18} className="text-primary" /> Events
                            </Typography>
                            {isAuthorized && (
                                <IconButton size="small" onClick={() => setEventModal({ open: true, data: null })}><Plus size={18} /></IconButton>
                            )}
                        </Box>
                        <div className="space-y-3">
                            {(events || []).length > 0 ? (events || []).map((event: any) => (
                                <Card key={event.id} sx={{ borderRadius: 3, border: '1px solid', borderColor: 'divider' }}>
                                    <CardContent sx={{ p: 2 }}>
                                        <Box display="flex" justifyContent="space-between" alignItems="start">
                                            <Typography variant="body1" fontWeight="800">{event.title}</Typography>
                                            <Box>
                                                {(user?.role === 'SUPER_ADMIN' || event.approvalStatus === 'PENDING_APPROVAL') && (
                                                    <>
                                                        <IconButton size="small" onClick={() => setEventModal({ open: true, data: event })}><Edit size={14} /></IconButton>
                                                        <IconButton size="small" color="error" onClick={() => handleDelete('event', event.id)}><Trash2 size={14} /></IconButton>
                                                    </>
                                                )}
                                            </Box>
                                        </Box>
                                        <Box display="flex" justifyContent="space-between" mt={1}>
                                            <Chip label={event.approvalStatus || event.status} size="small" color={event.approvalStatus === 'APPROVED' ? 'success' : 'warning'} sx={{ fontSize: '0.65rem', fontWeight: 'bold' }} />
                                            <Typography variant="caption" color="textSecondary">{new Date(event.date).toLocaleDateString()}</Typography>
                                        </Box>
                                    </CardContent>
                                </Card>
                            )) : <Typography variant="body2" color="textSecondary">No events.</Typography>}
                        </div>
                    </Grid>

                    <Grid item xs={12} md={4}>
                        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                            <Typography variant="subtitle1" fontWeight="800" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <FileText size={18} className="text-primary" /> Plans
                            </Typography>
                            {isAuthorized && (
                                <IconButton size="small" onClick={() => setPlanModal({ open: true, data: null })}><Plus size={18} /></IconButton>
                            )}
                        </Box>
                        <div className="space-y-3">
                            {(plans || []).length > 0 ? (plans || []).map((plan: any) => (
                                <Card key={plan.id} sx={{ borderRadius: 3, border: '1px solid', borderColor: 'divider' }}>
                                    <CardContent sx={{ p: 2 }}>
                                        <Box display="flex" justifyContent="space-between" alignItems="start">
                                            <Typography variant="body1" fontWeight="800">{plan.title}</Typography>
                                            <Box>
                                                {(user?.role === 'SUPER_ADMIN' || plan.approvalStatus === 'PENDING_APPROVAL') && (
                                                    <>
                                                        <IconButton size="small" onClick={() => setPlanModal({ open: true, data: plan })}><Edit size={14} /></IconButton>
                                                        <IconButton size="small" color="error" onClick={() => handleDelete('plan', plan.id)}><Trash2 size={14} /></IconButton>
                                                    </>
                                                )}
                                            </Box>
                                        </Box>
                                        <Box display="flex" justifyContent="space-between" mt={1}>
                                            <Chip label={plan.approvalStatus || plan.status} size="small" color={plan.approvalStatus === 'APPROVED' ? 'success' : 'warning'} sx={{ fontSize: '0.65rem', fontWeight: 'bold' }} />
                                            <Typography variant="caption" color="textSecondary">{plan.type}</Typography>
                                        </Box>
                                    </CardContent>
                                </Card>
                            )) : <Typography variant="body2" color="textSecondary">No plans.</Typography>}
                        </div>
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
