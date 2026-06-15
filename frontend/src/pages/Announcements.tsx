import { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../lib/db';
import {
    Typography, Grid, Card, CardContent, Box, Button, TextField, Dialog, DialogTitle,
    DialogContent, DialogActions, MenuItem, LinearProgress, Chip, IconButton, Avatar, Paper,
    FormControl, InputLabel, Select, Checkbox, ListItemText
} from '@mui/material';
import { Bell, Plus, Edit, Trash2, Megaphone, ShieldAlert, Clock, User, Filter } from 'lucide-react';
import DashboardLayout from '../components/layout/DashboardLayout';
import { useAuth } from '../contexts/AuthContext';
import { isUserManagingDepartment } from '../utils/auth-options';
import { pastorAuthorizationBlocked } from '../utils/approval-rules';
import { paginate, paginationMeta } from '../utils/pagination';
import { executeApiFirstMutation } from '../lib/api-first-mutation';

export default function Announcements() {
    const { user } = useAuth();
    const [open, setOpen] = useState(false);
    const [editAnn, setEditAnn] = useState<any>(null);
    const [formData, setFormData] = useState({
        title: '',
        content: '',
        priority: 'NORMAL',
        departmentId: user?.role === 'SUPER_ADMIN' ? '' : user?.departmentId || '',
        pastorIds: [] as string[]
    });

    const isGlobalAdmin = ['SUPER_ADMIN', 'SYSTEM_ADMIN', 'SECRETARY', 'WATUA'].includes(user?.role || '');
    const isLeader = isGlobalAdmin || ['DEPARTMENT_LEADER', 'PASTOR'].includes(user?.role || '');

    const [page, setPage] = useState(1);
    const limit = 12;

    const announcements = useLiveQuery(
        () => db.announcements.toArray().then(all =>
            all.sort((a: any, b: any) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
        ),
        []
    ) || [];

    const filteredAnnouncements = announcements.filter((ann: any) => {
        if (isGlobalAdmin) return true;
        return ann.isGlobal || ann.isMajor || (isUserManagingDepartment(user, ann.departmentId) && ann.status === 'PUBLISHED');
    });

    const meta = paginationMeta(filteredAnnouncements.length, page, limit);
    const pagedAnnouncements = paginate(filteredAnnouncements, page, limit);

    const departments = useLiveQuery(() => db.departments.toArray(), []) || [];
    const userDepartments = departments.filter((d: any) => isUserManagingDepartment(user, d.id)) || [];
    const showDepartmentSelect = isGlobalAdmin || userDepartments.length > 1;

    const pastors = useLiveQuery(() => db.users.filter(u => ['PASTOR', 'ASSOCIATE_PASTOR'].includes(u.role) && u.status === 'ACTIVE').toArray(), []) || [];

    const handleAction = async (payload: any, method: 'POST' | 'PUT' | 'DELETE', id?: string) => {
        const actionId = id || payload.id;
        const { author, department, createdAt, syncStatus, ...apiPayload } = payload;

        try {
            await executeApiFirstMutation({
                entity: 'ANNOUNCEMENT',
                method,
                url: method === 'POST' ? '/announcements' : `/announcements/${actionId}`,
                payload: apiPayload,
                recordId: actionId,
                table: 'announcements',
                offlineOptimistic: async (offlineId) => {
                    if (method === 'DELETE') {
                        await db.announcements.delete(offlineId);
                        return;
                    }
                    await db.announcements.put({
                        ...payload,
                        id: offlineId,
                        syncStatus: 'PENDING',
                        author: { name: user?.name || 'Local User' },
                        department: departments.find(d => d.id === payload.departmentId) || null,
                        createdAt: new Date().toISOString(),
                    });
                },
            });
            handleClose();
        } catch (err: any) {
            alert(err.response?.data?.error || err.message || 'Failed to save announcement.');
        }
    };

    const handleOpen = (ann: any = null) => {
        if (ann) {
            setEditAnn(ann);
            setFormData({
                title: ann.title,
                content: ann.content,
                priority: ann.priority,
                departmentId: ann.departmentId || '',
                pastorIds: []
            });
        } else {
            setEditAnn(null);
            setFormData({
                title: '',
                content: '',
                priority: 'NORMAL',
                departmentId: isGlobalAdmin ? '' : user?.departmentId || '',
                pastorIds: []
            });
            if (!isGlobalAdmin && userDepartments.length === 1) {
                setFormData(prev => ({ ...prev, departmentId: userDepartments[0].id }));
            }
        }
        setOpen(true);
    };

    const handleClose = () => {
        setOpen(false);
        setEditAnn(null);
    };

    const handleSubmit = () => {
        if (pastorAuthorizationBlocked(user?.role, formData.pastorIds)) {
            alert('Exactly 2 Pastors must authorize this Broadcast before it is deployed.');
            return;
        }
        const payload = { ...formData };
        if (!payload.departmentId && departments.length > 0) {
            payload.departmentId = departments[0].id;
        }
        if (editAnn) handleAction({ ...payload, id: editAnn.id }, 'PUT', editAnn.id);
        else handleAction(payload, 'POST');
    };

    const [syncError, setSyncError] = useState<string | null>(null);

    useEffect(() => {
        const handleSyncError = (e: Event) => {
            const detail = (e as CustomEvent).detail;
            if (detail?.path?.includes('announcements')) {
                setSyncError(`Sync Interrupted: ${detail.status === 401 ? 'Authentication Required' : 'Server Error'}`);
            }
        };
        const handleSyncHealthy = () => setSyncError(null);
        window.addEventListener('pwa-sync-error', handleSyncError);
        window.addEventListener('pwa-sync-healthy', handleSyncHealthy);
        return () => {
            window.removeEventListener('pwa-sync-error', handleSyncError);
            window.removeEventListener('pwa-sync-healthy', handleSyncHealthy);
        };
    }, []);

    return (
        <DashboardLayout>
            {syncError && (
                <Box sx={{ mb: 3, p: 2, borderRadius: 2, bgcolor: 'error.main', color: 'white', display: 'flex', alignItems: 'center', gap: 2 }}>
                    <ShieldAlert size={20} />
                    <Typography variant="body2" fontWeight="950">{syncError.toUpperCase()}</Typography>
                    <Button size="small" variant="contained" color="inherit" sx={{ ml: 'auto', color: 'error.main', fontWeight: 900 }} onClick={() => window.location.reload()}>RE-AUTH</Button>
                </Box>
            )}
            <Box sx={{ mb: 6, display: 'flex', flexDirection: { xs: 'column', md: 'row' }, justifyContent: 'space-between', alignItems: { xs: 'start', md: 'end' }, gap: 3 }}>
                <div>
                    <Typography variant="h3" fontWeight="950" className="glow-text" sx={{ letterSpacing: -2, fontSize: { xs: '1.75rem', md: '3rem' } }}>STRATEGIC <span className="text-primary/70">ALERTS</span></Typography>
                    <Typography color="textSecondary" sx={{ fontWeight: 500, opacity: 0.6 }}>Mission-critical communications and tactical broadcasts.</Typography>
                </div>
                {isLeader && (
                    <Button variant="contained" startIcon={<Plus size={20} />} onClick={() => handleOpen()} sx={{ borderRadius: 3, px: 4, py: 1.5, fontWeight: '900', boxShadow: '0 0 20px var(--primary-glow)' }}>
                        NEW BROADCAST
                    </Button>
                )}
            </Box>
            {announcements === undefined ? (
                <LinearProgress sx={{ mb: 4, borderRadius: 1 }} />
            ) : (
                <Grid container spacing={3}>
                    {pagedAnnouncements?.map((ann: any) => (
                        <Grid item xs={12} md={6} lg={4} key={ann.id}>
                            <Card className="holographic-card smooth-tilt" sx={{ height: '100%', borderRadius: 'var(--radius-lg)' }}>
                                <CardContent sx={{ p: 4 }}>
                                    <Box display="flex" justifyContent="space-between" mb={3} alignItems="center">
                                        <div className={`px-3 py-1 rounded-full border ${ann.priority === 'HIGH' ? 'bg-error/10 border-error/20 text-error' : 'bg-primary/10 border-primary/20 text-primary'}`}>
                                            <Typography variant="caption" fontWeight="950" sx={{ letterSpacing: 1, fontSize: '0.65rem' }}>{ann.priority === 'HIGH' ? 'CRITICAL_ALERT' : 'STANDARD_INTEL'}</Typography>
                                        </div>
                                        <Box>
                                            {(isGlobalAdmin || (ann.departmentId && isUserManagingDepartment(user, ann.departmentId))) && (
                                                <>
                                                    <IconButton size="small" onClick={() => handleOpen(ann)} className="tactical-border" sx={{ mr: 1 }}><Edit size={14} /></IconButton>
                                                    <IconButton size="small" color="error" onClick={() => handleAction({ id: ann.id }, 'DELETE', ann.id)} className="tactical-border"><Trash2 size={14} /></IconButton>
                                                </>
                                            )}
                                        </Box>
                                    </Box>
                                    <Typography variant="h5" fontWeight="950" sx={{ letterSpacing: -1, mb: 1 }}>{ann.title}</Typography>
                                    <Typography variant="body2" sx={{ mb: 4, minHeight: 60, opacity: 0.7, lineHeight: 1.6, fontWeight: 500 }}>
                                        {ann.content}
                                    </Typography>
                                    <Box sx={{ pt: 3, borderTop: '1px solid', borderColor: 'divider', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <Box display="flex" alignItems="center" gap={1.5}>
                                            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm border border-primary/20">
                                                {ann.author?.name?.charAt(0)}
                                            </div>
                                            <div>
                                                <Typography variant="body2" fontWeight="900">{ann.author?.name}</Typography>
                                                <Typography className="neon-label" sx={{ fontSize: '0.55rem !important' }}>{ann.department?.name || 'GLOBAL_CMD'}</Typography>
                                            </div>
                                        </Box>
                                        <Typography variant="caption" sx={{ fontWeight: 800, opacity: 0.5 }}>{new Date(ann.createdAt).toLocaleDateString()}</Typography>
                                    </Box>
                                </CardContent>
                            </Card>
                        </Grid>
                    ))}
                </Grid>
            )}

            {meta.totalPages > 1 && (
                <Box display="flex" justifyContent="center" mt={6} gap={2}>
                    <Button 
                        disabled={meta.page === 1} 
                        onClick={() => setPage(p => Math.max(1, p - 1))}
                        variant="outlined"
                        sx={{ borderRadius: 2, fontWeight: 900 }}
                    >
                        PREV
                    </Button>
                    <Box display="flex" alignItems="center" px={3} sx={{ bgcolor: 'rgba(255,255,255,0.05)', borderRadius: 2 }}>
                        <Typography variant="caption" fontWeight="900">PAGE {meta.page} OF {meta.totalPages}</Typography>
                    </Box>
                    <button
                        disabled={meta.page >= meta.totalPages}
                        onClick={() => setPage(p => Math.min(meta.totalPages, p + 1))}
                        className={`px-6 py-2 rounded-lg font-black transition-all ${page >= meta.totalPages ? 'opacity-30 cursor-not-allowed bg-white/5' : 'bg-primary text-black hover:scale-105 active:scale-95 shadow-[0_0_20px_rgba(var(--primary-rgb),0.3)]'}`}
                    >
                        NEXT SESSION
                    </button>
                </Box>
            )}

            {announcements?.length === 0 && (
                <Paper sx={{ p: 10, textAlign: 'center', borderRadius: 4, border: '1px dashed', borderColor: 'divider', bgcolor: 'transparent' }}>
                    <Megaphone size={48} className="mx-auto mb-4 opacity-20" />
                    <Typography variant="h5" fontWeight="bold">No Broadcasts Found</Typography>
                    <Typography color="textSecondary">The strategic alert channel is currently silent.</Typography>
                </Paper>
            )}

            <Dialog open={open} onClose={handleClose} fullWidth maxWidth="sm" PaperProps={{ sx: { borderRadius: 4 } }}>
                <DialogTitle sx={{ fontWeight: 900, px: 4, pt: 4 }}>
                    {editAnn ? 'Edit Broadcast' : 'Deploy New Broadcast'}
                </DialogTitle>
                <DialogContent sx={{ px: 4 }}>
                    <Box display="flex" flexDirection="column" gap={3} sx={{ mt: 2 }}>
                        <TextField
                            label="Broadcast Title"
                            fullWidth
                            value={formData.title}
                            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                        />
                        <TextField
                            label="Intelligence Content"
                            fullWidth
                            multiline
                            rows={4}
                            value={formData.content}
                            onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                        />
                        <TextField
                            select
                            label="Priority Level"
                            fullWidth
                            value={formData.priority}
                            onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                        >
                            <MenuItem value="NORMAL">NORMAL</MenuItem>
                            <MenuItem value="HIGH">CRITICAL</MenuItem>
                        </TextField>
                        {showDepartmentSelect && (
                            <TextField
                                select
                                label="Target Sector"
                                fullWidth
                                value={formData.departmentId}
                                onChange={(e) => setFormData({ ...formData, departmentId: e.target.value })}
                            >
                                {isGlobalAdmin && <MenuItem value="">GLOBAL COMMAND</MenuItem>}
                                {(isGlobalAdmin ? departments : userDepartments)?.map((dept: any) => (
                                    <MenuItem key={dept.id} value={dept.id}>{dept.name}</MenuItem>
                                ))}
                            </TextField>
                        )}

                        {!editAnn && (
                            <FormControl fullWidth required error={formData.pastorIds.length > 0 && formData.pastorIds.length !== 2}>
                                <InputLabel id="pastors-label">Select 2 Authorizing Pastors</InputLabel>
                                <Select
                                    labelId="pastors-label"
                                    multiple
                                    value={formData.pastorIds}
                                    onChange={(e) => {
                                        const value = e.target.value as string[];
                                        if (value.length <= 2) {
                                            setFormData({ ...formData, pastorIds: value });
                                        }
                                    }}
                                    renderValue={(selected) => 
                                        pastors?.filter((p: any) => (selected as string[]).includes(p.id)).map((p: any) => p.name).join(', ')
                                    }
                                    label="Select 2 Authorizing Pastors"
                                >
                                    {pastors?.map((pastor: any) => (
                                        <MenuItem key={pastor.id} value={pastor.id}>
                                            <Checkbox checked={formData.pastorIds.indexOf(pastor.id) > -1} />
                                            <ListItemText primary={pastor.name} secondary={pastor.role.replace('_', ' ')} />
                                        </MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                        )}
                    </Box>
                </DialogContent>
                <DialogActions sx={{ px: 4, pb: 4 }}>
                    <Button onClick={handleClose} sx={{ fontWeight: 'bold' }}>Abort</Button>
                    <Button onClick={handleSubmit} variant="contained" disabled={false} sx={{ borderRadius: 2, fontWeight: 'bold' }}>
                        {editAnn ? 'Update' : 'Broadcast'}
                    </Button>
                </DialogActions>
            </Dialog>
        </DashboardLayout>
    );
}
