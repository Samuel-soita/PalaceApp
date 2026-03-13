import { useQuery } from '@tanstack/react-query';
import api from '../lib/api-client';
import {
    Card, CardContent, Typography, Grid, Button,
    Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, Chip,
    Box, LinearProgress
} from '@mui/material';
import { Plus, Users } from 'lucide-react';
import DashboardLayout from '../components/layout/DashboardLayout';

export default function Departments() {
    const { data: departments, isLoading } = useQuery(['departments'], async () => {
        const res = await api.get('/departments');
        return res.data;
    });

    return (
        <DashboardLayout>
            <Box sx={{ mb: 6, display: 'flex', flexDirection: { xs: 'column', md: 'row' }, justifyContent: 'space-between', alignItems: { xs: 'start', md: 'end' }, gap: 3 }}>
                <div>
                    <Typography variant="h3" fontWeight="900" className="glow-text" sx={{ letterSpacing: -2 }}>Strategic <span className="text-primary/70">Sectors</span></Typography>
                    <Typography color="textSecondary" sx={{ fontWeight: 500, opacity: 0.7 }}>Global oversight of departmental readiness and tactical leadership.</Typography>
                </div>
                <Button variant="contained" startIcon={<Plus size={18} />} sx={{ borderRadius: 3, px: 3, py: 1.2, fontWeight: 'bold' }}>
                    New Sector
                </Button>
            </Box>

            {isLoading && <LinearProgress sx={{ mb: 4, borderRadius: 1 }} />}

            <Grid container spacing={3}>
                {departments?.map((dept: any) => (
                    <Grid item xs={12} md={6} lg={4} key={dept.id}>
                        <Card className="holographic-card smooth-tilt" sx={{ height: '100%', borderRadius: 'var(--radius-lg)' }}>
                            <CardContent sx={{ p: 4 }}>
                                <Box display="flex" justifyContent="space-between" alignItems="start" mb={3}>
                                    <div className="p-3 bg-primary/10 rounded-2xl text-primary shadow-[0_0_20px_rgba(var(--primary-h),var(--primary-s),var(--primary-l),0.2)]">
                                        <Users size={24} />
                                    </div>
                                    <Chip label="ACTIVE" size="small" sx={{ fontWeight: '900', fontSize: '0.6rem', bgcolor: 'success.main/10', color: 'success.main', border: '1px solid', borderColor: 'success.main/20' }} />
                                </Box>
                                <Typography variant="h5" fontWeight="900" gutterBottom>{dept.name}</Typography>
                                <Typography variant="body2" color="textSecondary" sx={{ mb: 4, minHeight: 40, opacity: 0.8 }}>
                                    {dept.description || 'No sectoral description provided.'}
                                </Typography>
                                <Box sx={{ pt: 3, borderTop: '1px solid', borderColor: 'divider', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <Box display="flex" alignItems="center" gap={1.5}>
                                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xs">
                                            {dept.leaders?.[0]?.name?.charAt(0) || '?'}
                                        </div>
                                        <div>
                                            <Typography variant="caption" display="block" fontWeight="bold">{dept.leaders?.[0]?.name || 'Unassigned'}</Typography>
                                            <Typography className="neon-label" sx={{ fontSize: '0.55rem !important' }}>Sector Commander</Typography>
                                        </div>
                                    </Box>
                                    <Button size="small" sx={{ fontWeight: 'bold', textTransform: 'none' }}>Details</Button>
                                </Box>
                            </CardContent>
                        </Card>
                    </Grid>
                ))}
            </Grid>
        </DashboardLayout>
    );
}
