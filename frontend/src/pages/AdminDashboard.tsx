import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import api from '../lib/api-client';
import { Typography, Grid, Card, CardContent, Box, Avatar, Chip, Button, Skeleton, Snackbar, Alert } from '@mui/material';
import {
    Users, Calendar, TrendingUp, AlertCircle, Globe, Zap, Clock, Briefcase,
    PlusCircle, MessageSquare, Heart, Coins, FileText, ChevronRight, UserCheck, XCircle, CheckCircle, Trash2, BookOpen
} from 'lucide-react';
import DashboardLayout from '../components/layout/DashboardLayout';
import { ProjectOverview } from '../components/dashboard/ProjectOverview';
import { MasterCalendar } from '../components/dashboard/MasterCalendar';
import { Modal, Backdrop, Fade, IconButton, Divider, Tooltip } from '@mui/material';
import { useQueryClient, useMutation } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';

export default function AdminDashboard() {
    const { user: authUser } = useAuth();
    const isMember = authUser?.role === 'MEMBER';
    const isBishop = authUser?.role === 'SUPER_ADMIN';
    const isAdmin = authUser?.role === 'SYSTEM_ADMIN';
    const isSecretary = authUser?.role === 'SECRETARY';
    const isWatua = authUser?.role === 'WATUA';
    const queryClient = useQueryClient();

    const [verificationModalOpen, setVerificationModalOpen] = useState(false);
    const [toast, setToast] = useState<{ open: boolean, message: string, severity: 'success' | 'error' }>({ open: false, message: '', severity: 'success' });
    const handleCloseToast = () => setToast({ ...toast, open: false });

    const { data: departments } = useQuery(['departments'], async () => {
        const res = await api.get('/departments');
        return res.data;
    });

    const { data: projects } = useQuery(['projects'], async () => {
        const res = await api.get('/projects');
        return Array.isArray(res.data) ? res.data.filter((p: any) => p.approvalStatus === 'APPROVED') : [];
    });

    const { data: events } = useQuery(['events'], async () => {
        const res = await api.get('/events');
        return Array.isArray(res.data) ? res.data.filter((e: any) => e.approvalStatus === 'APPROVED') : [];
    });

    const { data: budgets } = useQuery(['budgets'], async () => {
        const res = await api.get('/budgets');
        return res.data;
    });

    const { data: announcements } = useQuery(['announcements'], async () => {
        const res = await api.get('/announcements');
        return Array.isArray(res.data) ? res.data.filter((a: any) => a.status === 'PUBLISHED') : [];
    });

    const { data: auditLogs } = useQuery(['audit-logs'], async () => {
        const res = await api.get('/search/audit');
        return res.data;
    }, { 
        enabled: !!authUser && authUser.role !== 'MEMBER',
        refetchInterval: 30000 
    });

    const { data: pendingUsers } = useQuery(['pending-users'], async () => {
        const res = await api.get('/users/pending');
        return res.data;
    }, {
        enabled: !!authUser && authUser.role !== 'MEMBER'
    });

    const verifyMutation = useMutation(async ({ id, status, name }: { id: string, status: string, name: string }) => {
        return api.patch(`/users/${id}/status`, { status });
    }, {
        onSuccess: (data, variables) => {
            queryClient.invalidateQueries(['pending-users']);
            queryClient.invalidateQueries(['audit-logs']);
            setToast({
                open: true,
                message: `${variables.name} has been ${variables.status === 'ACTIVE' ? 'activated' : 'rejected'} successfully.`,
                severity: variables.status === 'ACTIVE' ? 'success' : 'error'
            });
        },
        onError: () => {
            setToast({ open: true, message: 'Failed to update user status.', severity: 'error' });
        }
    });

    const totalBudgetTarget = budgets?.reduce((acc: number, b: any) => acc + (b.targetAmount || 0), 0) || 0;
    const totalBudgetRaised = budgets?.reduce((acc: number, b: any) => acc + (b.amountRaised || 0), 0) || 0;
    const budgetProgressStr = totalBudgetTarget > 0 ? `${Math.round((totalBudgetRaised / totalBudgetTarget) * 100)}%` : '0%';

    const isLoading = !departments && !projects && !events && !budgets && !announcements;

    const stats: any[] = [
        { title: 'Upcoming Events', value: events?.filter((e: any) => new Date(e.date) >= new Date()).length || 0, icon: Calendar, color: 'blue' },
        { title: 'Active Projects', value: projects?.filter((p: any) => p.status === 'IN_PROGRESS').length || 0, icon: Briefcase, color: 'purple' },
        { title: 'Budget Status', value: budgetProgressStr, icon: TrendingUp, color: 'green' },
        { title: 'Recent Announcements', value: announcements?.filter((a: any) => new Date(a.createdAt) >= new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)).length || 0, icon: AlertCircle, color: 'orange' },
    ];


    if (isLoading) {
        return (
            <DashboardLayout>
                <Grid container spacing={3} mb={10}>
                    {[1, 2, 3, 4].map(i => (
                        <Grid item xs={12} sm={6} md={3} key={`skeleton-stat-${i}`}>
                            <Skeleton variant="rectangular" height={140} sx={{ borderRadius: 4 }} />
                        </Grid>
                    ))}
                </Grid>
                <Grid container spacing={4}>
                    <Grid item xs={12} lg={8}>
                        <Skeleton variant="rectangular" height={500} sx={{ borderRadius: 4 }} />
                    </Grid>
                    <Grid item xs={12} lg={4}>
                        <Box display="flex" flexDirection="column" gap={4}>
                            <Skeleton variant="rectangular" height={250} sx={{ borderRadius: 4 }} />
                            <Skeleton variant="rectangular" height={250} sx={{ borderRadius: 4 }} />
                        </Box>
                    </Grid>
                </Grid>
            </DashboardLayout>
        );
    }

    return (
        <DashboardLayout>
            <Box sx={{ mb: { xs: 6, md: 10 }, display: 'flex', flexDirection: { xs: 'column', md: 'row' }, justifyContent: 'space-between', alignItems: { xs: 'start', md: 'end' }, gap: 4 }}>
                <div>
                    <Typography variant="h2" fontWeight="950" className="glow-text" sx={{ letterSpacing: -4, mb: 1, fontSize: { xs: '2.5rem', md: '4rem' }, lineHeight: 1 }}>
                        {isMember ? 'MISSION' : isAdmin ? 'REGISTRY' : isSecretary ? 'EXECUTIVE' : 'EXECUTIVE'} <span className="text-primary/70">{isMember ? 'HUB' : isAdmin ? 'TERMINAL' : isSecretary ? 'HUB' : 'COMMAND'}</span>
                    </Typography>
                    <Typography color="textSecondary" variant="h6" sx={{ fontWeight: 500, opacity: 0.6, maxWidth: 600 }}>
                        {isMember 
                            ? "Stay connected with your ministry's progress, upcoming milestones, and the Word of God."
                            : isAdmin
                            ? "Operational registry and church program management terminal."
                            : "Strategic oversight and executive command center."}
                    </Typography>
                </div>
            </Box>

            {/* QUICK ACTION TERMINAL - Only for Admins/Leaders */}
            {!isMember && (
                <>
                    <Typography variant="caption" fontWeight="900" sx={{ letterSpacing: 2, color: 'primary.main', mb: 2, display: 'block' }}>QUICK ACTION TERMINAL</Typography>
                    <Grid container spacing={2} mb={8}>
                        {[
                            { label: 'Member Verification', icon: UserCheck, color: 'green', onClick: () => setVerificationModalOpen(true), badge: pendingUsers?.length, hide: isSecretary },
                            { label: 'New Announcement', icon: AlertCircle, color: 'orange', href: '/announcements' },
                            { label: 'Create Project', icon: Briefcase, color: 'purple', href: '/projects' },
                            { label: 'Schedule Event', icon: Calendar, color: 'blue', href: '/calendar' },
                            ...(isBishop || isAdmin ? [
                                { label: 'Record Budget', icon: Coins, color: 'green', href: '/support' },
                            ] : []),
                            { label: 'Messenger', icon: MessageSquare, color: 'cyan', href: '/messages' },
                        ].filter(a => !a.hide).map((action, i) => (
                            <Grid item xs={6} sm={4} md={2} key={i}>
                                <Button
                                    fullWidth
                                    component={action.href ? Link : 'button'}
                                    to={action.href}
                                    onClick={action.onClick}
                                    sx={{
                                        height: 100,
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: 1.5,
                                        bgcolor: 'rgba(255,255,255,0.03)',
                                        border: '1px solid var(--glass-border)',
                                        borderRadius: 3,
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
                                    <Box sx={{ position: 'relative' }}>
                                        <action.icon size={24} color={`var(--${action.color})`} />
                                        {action.badge > 0 && (
                                            <Box sx={{ position: 'absolute', top: -10, right: -10, bgcolor: 'error.main', color: 'white', borderRadius: '50%', width: 18, height: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.6rem', fontWeight: 'bold' }}>
                                                {action.badge}
                                            </Box>
                                        )}
                                    </Box>
                                    <Typography variant="caption" fontWeight="bold">{action.label}</Typography>
                                </Button>
                            </Grid>
                        ))}
                    </Grid>
                </>
            )}

            {!isAdmin && (
                <Grid container spacing={3} mb={10}>
                    {stats.map((stat) => (
                        <Grid item xs={12} sm={6} md={3} key={stat.title}>
                            <Card className="holographic-card" sx={{ p: 3, position: 'relative', overflow: 'hidden' }}>
                                {stat.title === 'Active Projects' && (
                                    <Box sx={{ position: 'absolute', top: 0, left: 0, width: 4, height: '100%', bgcolor: 'primary.main', opacity: 0.5 }} />
                                )}
                                <Box display="flex" justifyContent="space-between" alignItems="start" mb={2}>
                                    <div className={`p-2 rounded-xl bg-${stat.color}-500/10 text-${stat.color}-600`}>
                                        <stat.icon size={20} />
                                    </div>
                                    {stat.title === 'Active Projects' && <Chip label="CERTIFIED" size="small" variant="outlined" sx={{ height: 16, fontSize: '0.5rem', opacity: 0.5 }} />}
                                </Box>
                                <Typography variant="h4" fontWeight="800" sx={{ mb: 0.5 }}>{stat.value}</Typography>
                                <Typography variant="caption" fontWeight="bold" sx={{ color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                                    {stat.title}
                                </Typography>
                            </Card>
                        </Grid>
                    ))}
                </Grid>
            )}

            <Grid container spacing={4}>
                <Grid item xs={12} lg={isAdmin ? 12 : 8}>
                    <Box display="flex" flexDirection="column" gap={4}>
                        <Card className="holographic-card" sx={{ height: 'fit-content' }}>
                            <CardContent sx={{ p: { xs: 4, md: 6 } }}>
                                <Box display="flex" justifyContent="space-between" alignItems="center" mb={6}>
                                    <div>
                                        <Typography variant="h4" fontWeight="950" sx={{ letterSpacing: -2 }}>Operational Timeline</Typography>
                                        <Typography className="neon-label" sx={{ mt: 1 }}>CHRONOLOGICAL MISSION LOG</Typography>
                                    </div>
                                    <Calendar size={24} className="text-secondary opacity-50" />
                                </Box>
                                <MasterCalendar events={events || []} />
                            </CardContent>
                        </Card>

                        {/* DAILY DEVOTION CARD */}
                        <Card sx={{ 
                            background: 'linear-gradient(135deg, rgba(79, 139, 255, 0.1) 0%, rgba(193, 117, 255, 0.05) 100%)',
                            border: '1px solid rgba(79, 139, 255, 0.2)',
                            borderRadius: 4,
                            position: 'relative',
                            overflow: 'hidden'
                        }}>
                            <Box sx={{ position: 'absolute', top: 0, right: 0, width: 200, height: 200, background: 'radial-gradient(circle, rgba(79, 139, 255, 0.15) 0%, transparent 70%)', transform: 'translate(30%, -30%)' }} />
                            <CardContent sx={{ p: { xs: 4, md: 5 } }}>
                                <Box display="flex" alignItems="center" gap={2} mb={3}>
                                    <div className="p-2 rounded-xl bg-blue-500/20 text-blue-400">
                                        <BookOpen size={24} />
                                    </div>
                                    <div>
                                        <Typography variant="h5" fontWeight="950">Daily Devotion</Typography>
                                        <Typography variant="caption" color="textSecondary" fontWeight="bold">WORD FOR THE DAY</Typography>
                                    </div>
                                </Box>
                                <Typography variant="h6" fontWeight="800" sx={{ mb: 2, color: 'var(--cyan)' }}>
                                    "Walking in the Light of His Glory"
                                </Typography>
                                <Typography variant="body1" sx={{ opacity: 0.8, lineHeight: 1.8, mb: 3 }}>
                                    As we step into this new season, remember that the foundation of our strength lies not in our own understanding, but in His eternal promise. Let every challenge be met with faith, and every victory be humbled with praise. The architectural blueprint of your life is already drawn by the Master Builder.
                                </Typography>
                                <Typography variant="subtitle2" sx={{ fontStyle: 'italic', fontWeight: 'bold', color: 'text.secondary' }}>
                                    — Proverbs 3:5-6
                                </Typography>
                            </CardContent>
                        </Card>

                    </Box>
                </Grid>

                {!isAdmin && (
                    <Grid item xs={12} lg={4}>
                        <Box display="flex" flexDirection="column" gap={4}>
                            <Card className="holographic-card" sx={{ height: 'fit-content' }}>
                                <CardContent sx={{ p: { xs: 4, md: 5 } }}>
                                    <Box display="flex" justifyContent="space-between" alignItems="center" mb={5}>
                                        <Typography variant="h5" fontWeight="950" sx={{ letterSpacing: -1 }}>Strategic Deadlines</Typography>
                                        <TrendingUp size={18} className="text-primary opacity-50" />
                                    </Box>
                                    <ProjectOverview projects={projects || []} />
                                    <Button fullWidth variant="outlined" sx={{ mt: 4, py: 1, borderRadius: 2, fontWeight: '800', border: '1px solid var(--glass-border)' }}>
                                        VIEW ALL PROJECTS
                                    </Button>
                                </CardContent>
                            </Card>

                            {/* TACTICAL FEED - Only for Admins/Leaders */}
                            {!isMember && (
                                <Card className="holographic-card" sx={{ height: 'fit-content' }}>
                                    <CardContent sx={{ p: { xs: 4, md: 5 } }}>
                                        <Box display="flex" justifyContent="space-between" alignItems="center" mb={5}>
                                            <Typography variant="h5" fontWeight="950" sx={{ letterSpacing: -1 }}>Tactical Feed</Typography>
                                            <Clock size={18} className="text-primary opacity-50" />
                                        </Box>
                                        <Box display="flex" flexDirection="column" gap={3}>
                                            {(auditLogs || []).map((log: any, i: number) => (
                                                <Box key={i} sx={{ display: 'flex', gap: 2 }}>
                                                    <Avatar 
                                                        src={log.user?.avatarUrl}
                                                        className="tactical-border" 
                                                        sx={{ width: 32, height: 32, bgcolor: 'rgba(255,255,255,0.05)', color: 'primary.main', fontWeight: '900', fontSize: '0.7rem' }}
                                                    >
                                                        {!log.user?.avatarUrl && log.user?.name?.charAt(0)}
                                                    </Avatar>
                                                    <Box sx={{ flex: 1, minWidth: 0 }}>
                                                        <Typography variant="caption" sx={{ fontWeight: 800, display: 'block', mb: 0.2 }}>
                                                            {log.user?.name}
                                                        </Typography>
                                                        <Typography variant="caption" sx={{ opacity: 0.6, display: 'block', lineHeight: 1.2, mb: 0.5 }}>
                                                            <span style={{ color: 'var(--cyan)', fontWeight: 'bold' }}>{log.action}</span> {log.entityType}
                                                        </Typography>
                                                        <Typography className="neon-label" sx={{ fontSize: '0.5rem !important', opacity: 0.4 }}>
                                                            {new Date(log.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                        </Typography>
                                                    </Box>
                                                </Box>
                                            ))}
                                            {(!auditLogs || auditLogs.length === 0) && (
                                                <Typography variant="caption" color="textSecondary" textAlign="center">No recent activity detected.</Typography>
                                            )}
                                        </Box>
                                    </CardContent>
                                </Card>
                            )}
                        </Box>
                    </Grid>
                )}
            </Grid>
            {/* VERIFICATION MODAL */}
            <Modal
                open={verificationModalOpen}
                onClose={() => setVerificationModalOpen(false)}
                closeAfterTransition
                BackdropComponent={Backdrop}
                BackdropProps={{ timeout: 500, sx: { backdropFilter: 'blur(8px)' } }}
            >
                <Fade in={verificationModalOpen}>
                    <Box sx={{
                        position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
                        width: { xs: '90%', md: 600 }, bgcolor: 'background.paper', borderRadius: 4, boxShadow: 24, p: 4,
                        border: '1px solid var(--glass-border)'
                    }}>
                        <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
                            <Typography variant="h5" fontWeight="900">Member Verification</Typography>
                            <IconButton onClick={() => setVerificationModalOpen(false)}><XCircle /></IconButton>
                        </Box>
                        <Divider sx={{ mb: 3 }} />
                        
                        <Box sx={{ maxHeight: 400, overflowY: 'auto', pr: 1 }}>
                            {(!pendingUsers || pendingUsers.length === 0) ? (
                                <Box textAlign="center" py={6}>
                                    <UserCheck size={48} className="text-primary opacity-20 mb-2" />
                                    <Typography color="textSecondary">All membership cards are verified.</Typography>
                                </Box>
                            ) : (
                                pendingUsers.map((u: any) => (
                                    <Card key={u.id} sx={{ mb: 2, borderRadius: 3, border: '1px solid var(--glass-border)', bgcolor: 'rgba(255,255,255,0.02)' }}>
                                        <CardContent sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', p: 2 }}>
                                            <Box display="flex" alignItems="center" gap={2}>
                                                <Avatar src={u.avatarUrl}>{u.name.charAt(0)}</Avatar>
                                                <div>
                                                    <Typography variant="subtitle1" fontWeight="bold">{u.name}</Typography>
                                                    <Typography variant="caption" color="textSecondary" display="block">Card: {u.membershipNumber}</Typography>
                                                    <Typography variant="caption" className="neon-label" sx={{ fontSize: '0.6rem !important' }}>{u.role}</Typography>
                                                </div>
                                            </Box>
                                            <Box display="flex" gap={1}>
                                                <Tooltip title="Approve">
                                                    <IconButton color="success" onClick={() => verifyMutation.mutate({ id: u.id, status: 'ACTIVE', name: u.name })}>
                                                        <CheckCircle size={20} />
                                                    </IconButton>
                                                </Tooltip>
                                                <Tooltip title="Reject/Remove">
                                                    <IconButton color="error" onClick={() => verifyMutation.mutate({ id: u.id, status: 'REJECTED', name: u.name })}>
                                                        <Trash2 size={20} />
                                                    </IconButton>
                                                </Tooltip>
                                            </Box>
                                        </CardContent>
                                    </Card>
                                ))
                            )}
                        </Box>
                    </Box>
                </Fade>
            </Modal>

            <Snackbar open={toast.open} autoHideDuration={4000} onClose={handleCloseToast} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
                <Alert onClose={handleCloseToast} severity={toast.severity} variant="filled" sx={{ width: '100%', borderRadius: 3 }}>
                    {toast.message}
                </Alert>
            </Snackbar>
        </DashboardLayout>
    );
}
