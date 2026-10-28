import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../lib/db';
import api from '../lib/api-client';
import {
    Card, CardContent, Typography, Grid, Button, Chip,
    Box, LinearProgress, Dialog, DialogTitle, DialogContent, DialogActions, TextField
} from '@mui/material';
import { Plus, Users } from 'lucide-react';
import DashboardLayout from '../components/layout/DashboardLayout';

export default function Departments() {
    const departments = useLiveQuery(() => db.departments.orderBy('name').toArray(), []);
    const users = useLiveQuery(() => db.users.toArray(), []) || [];
    const projects = useLiveQuery(() => db.projects.toArray(), []) || [];
    const events = useLiveQuery(() => db.events.toArray(), []) || [];
    const plans = useLiveQuery(() => db.plans.toArray(), []) || [];
    const meetings = useLiveQuery(() => db.meetings.toArray(), []) || [];

    const [createOpen, setCreateOpen] = useState(false);
    const [form, setForm] = useState({ name: '', description: '' });
    const [saving, setSaving] = useState(false);
    const [details, setDetails] = useState<any>(null);

    const leaderOf = (dept: any) =>
        users.find((u: any) => u.id === dept.leaderId)
        || users.find((u: any) => u.role === 'DEPARTMENT_LEADER' && u.departmentId === dept.id);

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!navigator.onLine) {
            alert('You must be online to create a department.');
            return;
        }
        setSaving(true);
        try {
            const { data } = await api.post('/departments', {
                name: form.name.trim(),
                ...(form.description.trim() ? { description: form.description.trim() } : {}),
            });
            await db.departments.put({ ...data, syncStatus: 'SYNCED' });
            setCreateOpen(false);
            setForm({ name: '', description: '' });
        } catch (err: any) {
            alert(err.response?.data?.error || err.message || 'Failed to create department.');
        } finally {
            setSaving(false);
        }
    };

    const stats = (deptId: string) => ({
        members: users.filter((u: any) => u.departmentId === deptId && u.role === 'MEMBER').length,
        projects: projects.filter((p: any) => p.departmentId === deptId).length,
        events: events.filter((ev: any) => ev.departmentId === deptId).length,
        plans: plans.filter((p: any) => p.departmentId === deptId).length,
        meetings: meetings.filter((m: any) => m.departmentId === deptId).length,
    });

    const detailLeader = details ? leaderOf(details) : null;
    const detailStats = details ? stats(details.id) : null;

    return (
        <DashboardLayout>
            <Box sx={{ mb: 6, display: 'flex', flexDirection: { xs: 'column', md: 'row' }, justifyContent: 'space-between', alignItems: { xs: 'start', md: 'end' }, gap: 3 }}>
                <div>
                    <Typography variant="h3" fontWeight="900" className="glow-text" sx={{ letterSpacing: -2 }}>Strategic <span className="text-primary/70">Sectors</span></Typography>
                    <Typography color="textSecondary" sx={{ fontWeight: 500, opacity: 0.7 }}>Global oversight of departmental readiness and tactical leadership.</Typography>
                </div>
                <Button variant="contained" startIcon={<Plus size={18} />} onClick={() => setCreateOpen(true)} sx={{ borderRadius: 3, px: 3, py: 1.2, fontWeight: 'bold' }}>
                    New Sector
                </Button>
            </Box>

            {departments === undefined && <LinearProgress sx={{ mb: 4, borderRadius: 1 }} />}

            <Grid container spacing={3}>
                {departments?.map((dept: any) => {
                    const leader = leaderOf(dept);
                    return (
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
                                                {leader?.name?.charAt(0) || '?'}
                                            </div>
                                            <div>
                                                <Typography variant="caption" display="block" fontWeight="bold">{leader?.name || 'Unassigned'}</Typography>
                                                <Typography className="neon-label" sx={{ fontSize: '0.55rem !important' }}>Sector Commander</Typography>
                                            </div>
                                        </Box>
                                        <Button size="small" onClick={() => setDetails(dept)} sx={{ fontWeight: 'bold', textTransform: 'none' }}>Details</Button>
                                    </Box>
                                </CardContent>
                            </Card>
                        </Grid>
                    );
                })}
            </Grid>

            <Dialog open={createOpen} onClose={() => !saving && setCreateOpen(false)} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 4 } }}>
                <form onSubmit={handleCreate}>
                    <DialogTitle sx={{ fontWeight: 900 }}>New Sector</DialogTitle>
                    <DialogContent>
                        <Box display="flex" flexDirection="column" gap={3} sx={{ pt: 1 }}>
                            <TextField
                                label="Department Name"
                                required
                                fullWidth
                                inputProps={{ minLength: 2, maxLength: 50 }}
                                value={form.name}
                                onChange={(e) => setForm({ ...form, name: e.target.value })}
                            />
                            <TextField
                                label="Description"
                                multiline
                                rows={3}
                                fullWidth
                                value={form.description}
                                onChange={(e) => setForm({ ...form, description: e.target.value })}
                            />
                        </Box>
                    </DialogContent>
                    <DialogActions sx={{ p: 3 }}>
                        <Button onClick={() => setCreateOpen(false)} disabled={saving}>Cancel</Button>
                        <Button type="submit" variant="contained" disabled={saving} sx={{ fontWeight: 'bold' }}>
                            {saving ? 'Creating...' : 'Create Sector'}
                        </Button>
                    </DialogActions>
                </form>
            </Dialog>

            <Dialog open={!!details} onClose={() => setDetails(null)} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 4 } }}>
                <DialogTitle sx={{ fontWeight: 900 }}>{details?.name}</DialogTitle>
                <DialogContent>
                    <Typography variant="body2" color="textSecondary" sx={{ mb: 3 }}>
                        {details?.description || 'No sectoral description provided.'}
                    </Typography>
                    <Typography variant="overline" color="textSecondary">Sector Commander</Typography>
                    <Typography fontWeight="bold" sx={{ mb: 3 }}>
                        {detailLeader ? `${detailLeader.name}${(detailLeader as any).phoneNumber ? ` \u00b7 ${(detailLeader as any).phoneNumber}` : ''}` : 'Unassigned'}
                    </Typography>
                    {detailStats && (
                        <Grid container spacing={2}>
                            {[
                                ['Members', detailStats.members],
                                ['Projects', detailStats.projects],
                                ['Events', detailStats.events],
                                ['Plans', detailStats.plans],
                                ['Meetings', detailStats.meetings],
                            ].map(([label, value]) => (
                                <Grid item xs={6} sm={4} key={label as string}>
                                    <Box sx={{ p: 2, borderRadius: 3, border: '1px solid', borderColor: 'divider', textAlign: 'center' }}>
                                        <Typography variant="h5" fontWeight="900">{value}</Typography>
                                        <Typography variant="caption" color="textSecondary">{label}</Typography>
                                    </Box>
                                </Grid>
                            ))}
                        </Grid>
                    )}
                </DialogContent>
                <DialogActions sx={{ p: 3 }}>
                    <Button onClick={() => setDetails(null)}>Close</Button>
                </DialogActions>
            </Dialog>
        </DashboardLayout>
    );
}
