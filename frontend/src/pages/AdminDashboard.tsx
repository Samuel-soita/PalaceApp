import { useQuery } from '@tanstack/react-query';
import api from '../lib/api-client';
import { Typography, Grid, Card, CardContent, Box, Avatar, Chip, Button } from '@mui/material';
import {
    Users, Calendar, TrendingUp, AlertCircle, Globe, Zap, Clock, Briefcase
} from 'lucide-react';
import DashboardLayout from '../components/layout/DashboardLayout';
import { ProjectOverview } from '../components/dashboard/ProjectOverview';
import { MasterCalendar } from '../components/dashboard/MasterCalendar';

export default function AdminDashboard() {
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

    const stats: any[] = [
        { title: 'Active Projects', value: projects?.length || '0', change: '+2', trend: 'up', icon: Briefcase, color: 'blue' },
        { title: 'Upcoming Events', value: events?.length || '0', change: '+4', trend: 'up', icon: Calendar, color: 'green' },
        { title: 'Fundraising quota', value: '74%', change: '-2%', trend: 'down', icon: TrendingUp, color: 'purple' },
        { title: 'Critical Follow-ups', value: '7', icon: AlertCircle, color: 'red' },
    ];

    return (
        <DashboardLayout>
            <Box sx={{ mb: { xs: 6, md: 10 }, display: 'flex', flexDirection: { xs: 'column', md: 'row' }, justifyContent: 'space-between', alignItems: { xs: 'start', md: 'end' }, gap: 4 }}>
                <div>
                    <Typography variant="h2" fontWeight="950" className="glow-text" sx={{ letterSpacing: -4, mb: 1, fontSize: { xs: '2.5rem', md: '4rem' }, lineHeight: 1 }}>
                        EXECUTIVE <span className="text-primary/70">COMMAND</span>
                    </Typography>
                    <Typography color="textSecondary" variant="h6" sx={{ fontWeight: 500, opacity: 0.6, maxWidth: 600 }}>
                        Unified surveillance and tactical performance analytics across all global sectors.
                    </Typography>
                </div>
                <Box display="flex" gap={2} sx={{ width: { xs: '100%', md: 'auto' } }}>
                    <Button fullWidth variant="outlined" sx={{ borderRadius: 3, py: 1.5, px: 4, fontWeight: '900', border: '1px solid var(--glass-border)' }} startIcon={<Globe size={20} />}>
                        GLOBAL VIEW
                    </Button>
                    <Button fullWidth variant="contained" sx={{ borderRadius: 3, py: 1.5, px: 4, fontWeight: '900', boxShadow: '0 0 20px var(--primary-glow)' }} startIcon={<Zap size={20} />}>
                        SYNC GRID
                    </Button>
                </Box>
            </Box>

            <Grid container spacing={3} mb={10}>
                {stats.map((stat) => (
                    <Grid item xs={12} sm={6} md={3} key={stat.title}>
                        <Card className="holographic-card" sx={{ p: 3 }}>
                            <Box display="flex" justifyContent="space-between" alignItems="start" mb={2}>
                                <div className={`p-2 rounded-xl bg-${stat.color}-500/10 text-${stat.color}-600`}>
                                    <stat.icon size={20} />
                                </div>
                            </Box>
                            <Typography variant="h4" fontWeight="800" sx={{ mb: 0.5 }}>{stat.value}</Typography>
                            <Typography variant="caption" fontWeight="bold" sx={{ color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                                {stat.title}
                            </Typography>
                        </Card>
                    </Grid>
                ))}
            </Grid>

            <Grid container spacing={4}>
                <Grid item xs={12} lg={8}>
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

                    </Box>
                </Grid>

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

                        <Card className="holographic-card" sx={{ height: 'fit-content' }}>
                            <CardContent sx={{ p: { xs: 4, md: 5 } }}>
                                <Box display="flex" justifyContent="space-between" alignItems="center" mb={5}>
                                    <Typography variant="h5" fontWeight="950" sx={{ letterSpacing: -1 }}>Tactical Feed</Typography>
                                    <Clock size={18} className="text-primary opacity-50" />
                                </Box>
                                <Box display="flex" flexDirection="column" gap={4}>
                                    {[
                                        { user: 'Commander Soita', action: 'authorized deployment', time: '2m ago', color: 'blue' },
                                        { user: 'Sector Alpha', action: 'synced intelligence', time: '14m ago', color: 'green' },
                                        { user: 'Logistics Hub', action: 'flagged variance', time: '1h ago', color: 'red' },
                                        { user: 'Personnel Dept', action: 'enlisted units', time: '3h ago', color: 'purple' },
                                    ].map((activity, i) => (
                                        <Box key={i} sx={{ display: 'flex', gap: 2.5 }}>
                                            <Avatar className="tactical-border" sx={{ width: 40, height: 40, bgcolor: 'primary/10', color: 'primary.main', fontWeight: '900', fontSize: '0.9rem' }}>
                                                {activity.user.charAt(0)}
                                            </Avatar>
                                            <div>
                                                <Typography variant="body1" sx={{ fontWeight: 800, lineHeight: 1.1 }}>
                                                    {activity.user}
                                                </Typography>
                                                <Typography variant="body2" sx={{ opacity: 0.6, mb: 0.5 }}>{activity.action}</Typography>
                                                <Typography className="neon-label" sx={{ fontSize: '0.55rem !important', opacity: 0.5 }}>T-{activity.time}</Typography>
                                            </div>
                                        </Box>
                                    ))}
                                </Box>
                            </CardContent>
                        </Card>
                    </Box>
                </Grid>
            </Grid>
        </DashboardLayout>
    );
}
