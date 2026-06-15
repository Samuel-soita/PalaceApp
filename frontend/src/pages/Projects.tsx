import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../lib/db';
import api from '../lib/api-client';
import {
    Typography, Grid, Card, CardContent, Box, Button, TextField, Dialog, DialogTitle,
    DialogContent, DialogActions, MenuItem, LinearProgress, Chip, IconButton,
    LinearProgress as Progress, Divider, Select, Checkbox, ListItemText, FormControl, InputLabel
} from '@mui/material';
import { Plus, Edit, Trash2, Briefcase, TrendingUp, Clock } from 'lucide-react';
import DashboardLayout from '../components/layout/DashboardLayout';
import { useAuth } from '../contexts/AuthContext';
import { pastorAuthorizationBlocked } from '../utils/approval-rules';
import { isUserManagingDepartment } from '../utils/auth-options';
import { executeApiFirstMutation } from '../lib/api-first-mutation';

interface ChurchProject {
    id: string;
    title: string;
    description: string;
    status: string;
    progress: number;
    budget: number;
    departmentId: string;
    department: { name: string };
    createdAt: string;
}

export default function Projects() {
    const { user } = useAuth();

    const [open, setOpen] = useState(false);
    const [editProject, setEditProject] = useState<ChurchProject | null>(null);
    const [formData, setFormData] = useState({
        title: '',
        description: '',
        status: 'PLANNED',
        progress: 0,
        budget: 0,
        departmentId: user?.departmentId || '',
        pastorIds: [] as string[]
    });

    const isGlobalAdmin = ['SUPER_ADMIN', 'SYSTEM_ADMIN', 'SECRETARY', 'WATUA'].includes(user?.role || '');
    const isAuthorized = isGlobalAdmin || ['DEPARTMENT_LEADER', 'PASTOR'].includes(user?.role || '');

    const [page, setPage] = useState(1);
    const limit = 12;

    const projects = useLiveQuery(() => db.projects.orderBy('createdAt').reverse().toArray(), []) || [];
    const meta = { total: projects.length, totalPages: Math.ceil((projects.length || 1) / limit) };

    const filteredProjects = projects.filter((p: any) => {
        if (isGlobalAdmin) return true;
        return p.approvalStatus === 'APPROVED' || isUserManagingDepartment(user, p.departmentId);
    });

    const departments = useLiveQuery(() => db.departments.toArray(), []) || [];
    const userDepartments = departments?.filter((d: any) => isUserManagingDepartment(user, d.id)) || [];
    const showDepartmentSelect = isGlobalAdmin || userDepartments.length > 1;

    const pastors = useLiveQuery(() => db.users.filter(u => ['PASTOR', 'ASSOCIATE_PASTOR'].includes(u.role) && u.status === 'ACTIVE').toArray(), []) || [];

    const handleAction = async (payload: any, method: 'POST' | 'PATCH' | 'DELETE', id?: string) => {
        const actionId = id || payload.id;
        const { department, syncStatus, version, ...apiPayload } = payload;

        try {
            await executeApiFirstMutation({
                entity: 'PROJECT',
                method,
                url: method === 'POST' ? '/projects' : `/projects/${actionId}`,
                payload: apiPayload,
                recordId: actionId,
                table: 'projects',
                offlineOptimistic: async (offlineId) => {
                    if (method === 'DELETE') {
                        await db.projects.delete(offlineId);
                        return;
                    }
                    await db.projects.put({
                        ...payload,
                        id: offlineId,
                        syncStatus: 'PENDING',
                        version: (payload.version || 0) + 1,
                        department: departments.find(d => d.id === payload.departmentId) || { name: 'Unknown' },
                        createdAt: new Date().toISOString(),
                    });
                },
            });
            handleClose();
        } catch (err: any) {
            alert(err.response?.data?.error || err.message || 'Failed to save project.');
        }
    };

    const handleOpen = (project: ChurchProject | null = null) => {
        if (project) {
            setEditProject(project);
            setFormData({
                title: project.title,
                description: project.description,
                status: project.status,
                progress: project.progress,
                budget: project.budget,
                departmentId: project.departmentId,
                pastorIds: []
            });
        } else {
            setEditProject(null);
            setFormData({
                title: '',
                description: '',
                status: 'PLANNED',
                progress: 0,
                budget: 0,
                departmentId: user?.departmentId || '',
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
        setEditProject(null);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!editProject && pastorAuthorizationBlocked(user?.role, formData.pastorIds)) {
            alert('You must select exactly 2 Pastors to authorize this ChurchProject before deployment.');
            return;
        }

        if (editProject) {
            handleAction({ ...formData, id: editProject.id, version: (editProject as any).version || 0 }, 'PATCH', editProject.id);
        } else {
            handleAction(formData, 'POST');
        }
    };

    const handleDelete = (id: string) => {
        if (window.confirm('Terminate this project deployment? This action is irreversible.')) {
            handleAction({ id, version: 0 }, 'DELETE', id);
        }
    };

    if (projects === undefined) return (
        <DashboardLayout>
            <Box sx={{ height: '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <LinearProgress sx={{ width: 200, borderRadius: 1 }} />
            </Box>
        </DashboardLayout>
    );

    return (
        <DashboardLayout>
            <Box sx={{ mb: 6, display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, justifyContent: 'space-between', alignItems: { xs: 'flex-start', sm: 'flex-end' }, gap: 2 }}>
                <div>
                    <Typography variant="h3" fontWeight="950" sx={{ mb: 1, letterSpacing: -2, fontSize: { xs: '2rem', sm: '3rem' } }}>
                        PROJECT <span className="text-primary">REGISTRY</span>
                    </Typography>
                    <Typography color="textSecondary" fontWeight="medium" sx={{ opacity: 0.7, fontSize: { xs: '0.8rem', sm: '1rem' } }}>
                        Tactical oversight of departmental initiatives and infrastructure deployments.
                    </Typography>
                </div>
                {isAuthorized && (
                    <Button
                        variant="contained"
                        startIcon={<Plus size={18} />}
                        onClick={() => handleOpen()}
                        sx={{ width: { xs: '100%', sm: 'auto' }, borderRadius: 3, px: 4, py: 1.5, fontWeight: '900', boxShadow: '0 0 20px var(--primary-glow)' }}
                    >
                        NEW PROJECT
                    </Button>
                )}
            </Box>

            <Grid container spacing={4}>
                {filteredProjects?.map((project: any) => (
                    <Grid item xs={12} md={6} key={project.id}>
                        <Card className="holographic-card" sx={{ borderRadius: 4 }}>
                            <CardContent sx={{ p: 4 }}>
                                <Box display="flex" justifyContent="space-between" alignItems="start" mb={3}>
                                    <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary border border-primary/20">
                                        <Briefcase size={24} />
                                    </div>
                                    {(isGlobalAdmin || isUserManagingDepartment(user, project.departmentId)) && (
                                        <Box display="flex" gap={1}>
                                            <IconButton size="small" onClick={() => handleOpen(project)} sx={{ color: 'primary.main' }}>
                                                <Edit size={16} />
                                            </IconButton>
                                            <IconButton size="small" color="error" onClick={() => handleDelete(project.id)}>
                                                <Trash2 size={16} />
                                            </IconButton>
                                        </Box>
                                    )}
                                </Box>

                                <Typography variant="h5" fontWeight="900" sx={{ mb: 1 }}>{project.title}</Typography>
                                <Typography variant="body2" sx={{ opacity: 0.7, mb: 3, minHeight: 40 }}>{project.description}</Typography>

                                <Box sx={{ mb: 3 }}>
                                    <Box display="flex" justifyContent="space-between" mb={1}>
                                        <Typography variant="caption" fontWeight="900" sx={{ letterSpacing: 1 }}>DEPLOYMENT PROGRESS</Typography>
                                        <Typography variant="caption" fontWeight="900">{project.progress}%</Typography>
                                    </Box>
                                    <Progress variant="determinate" value={project.progress} sx={{ height: 6, borderRadius: 3 }} />
                                </Box>

                                <Grid container spacing={2} sx={{ mb: 3 }}>
                                    <Grid item xs={6}>
                                        <Box sx={{ p: 2, borderRadius: 3, bgcolor: 'action.hover', border: '1px solid rgba(255,255,255,0.05)' }}>
                                            <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 'bold', display: 'block', mb: 0.5 }}>BUDGET</Typography>
                                            <Typography variant="subtitle1" fontWeight="900">{project.budget.toLocaleString()} KES</Typography>
                                        </Box>
                                    </Grid>
                                    <Grid item xs={6}>
                                        <Box sx={{ p: 2, borderRadius: 3, bgcolor: 'action.hover', border: '1px solid rgba(255,255,255,0.05)' }}>
                                            <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 'bold', display: 'block', mb: 0.5 }}>SECTOR</Typography>
                                            <Typography variant="subtitle1" fontWeight="900" noWrap>{project.department.name}</Typography>
                                        </Box>
                                    </Grid>
                                </Grid>

                                <Box display="flex" justifyContent="space-between" alignItems="center">
                                    <Chip label={project.status} size="small" variant="outlined" sx={{ fontWeight: '900', fontSize: '0.65rem' }} />
                                    <Box display="flex" alignItems="center" gap={1} sx={{ opacity: 0.5 }}>
                                        <Clock size={14} />
                                        <Typography variant="caption" fontWeight="bold">{new Date(project.createdAt).toLocaleDateString()}</Typography>
                                    </Box>
                                </Box>
                            </CardContent>
                        </Card>
                    </Grid>
                ))}
            </Grid>

            {meta.totalPages > 1 && (
                <Box display="flex" justifyContent="center" mt={6} gap={2}>
                    <Button 
                        disabled={page === 1} 
                        onClick={() => setPage(p => p - 1)}
                        variant="outlined"
                        sx={{ borderRadius: 3, fontWeight: 900 }}
                    >
                        PREVIOUS
                    </Button>
                    <Box display="flex" alignItems="center" px={4} sx={{ bgcolor: 'rgba(255,255,255,0.02)', borderRadius: 3, border: '1px solid var(--glass-border)' }}>
                        <Typography variant="caption" fontWeight="900" sx={{ opacity: 0.6, letterSpacing: 2 }}>MODULE_{page}/{meta.totalPages}</Typography>
                    </Box>
                    <Button 
                        disabled={page >= meta.totalPages}
                        onClick={() => setPage(p => p + 1)}
                        variant="contained"
                        sx={{ borderRadius: 3, fontWeight: 900, px: 4, boxShadow: '0 0 15px rgba(var(--primary-rgb),0.2)' }}
                    >
                        NEXT
                    </Button>
                </Box>
            )}

            {/* ChurchProject CRUD Modal */}
            <Dialog 
                open={open} 
                onClose={handleClose} 
                maxWidth="sm" 
                fullWidth 
                PaperProps={{ sx: { borderRadius: 4, width: '95%', m: 1 } }}
            >
                <form onSubmit={handleSubmit}>
                    <DialogTitle sx={{ fontWeight: '950', fontSize: '1.5rem', letterSpacing: -1 }}>
                        {editProject ? 'RECALIBRATE PROJECT' : 'INITIALIZE PROJECT'}
                    </DialogTitle>
                    <DialogContent>
                        <Box display="flex" flexDirection="column" gap={3} mt={1}>
                            <TextField
                                label="ChurchProject Title"
                                fullWidth
                                required
                                value={formData.title}
                                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                            />
                            <TextField
                                label="Tactical Description"
                                multiline
                                rows={3}
                                fullWidth
                                required
                                value={formData.description}
                                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                            />
                            <Box display="flex" gap={2}>
                                    <TextField
                                        label="Budget Allocation (KES)"
                                        type="number"
                                        fullWidth
                                        required
                                        value={formData.budget}
                                        onChange={(e) => setFormData({ ...formData, budget: Number(e.target.value) })}
                                    />
                                <TextField
                                    label="Deployment Status"
                                    select
                                    fullWidth
                                    value={formData.status}
                                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                                >
                                    <MenuItem value="PLANNED">Planned</MenuItem>
                                    <MenuItem value="IN_PROGRESS">In Progress</MenuItem>
                                    <MenuItem value="ACTIVE">Active</MenuItem>
                                    <MenuItem value="ON_HOLD">On Hold</MenuItem>
                                    <MenuItem value="COMPLETED">Completed</MenuItem>
                                </TextField>
                            </Box>
                            <Box sx={{ px: 1 }}>
                                <Typography variant="caption" fontWeight="bold" gutterBottom>PROGRESS: {formData.progress}%</Typography>
                                <Progress
                                    variant="determinate"
                                    value={formData.progress}
                                    sx={{ height: 8, borderRadius: 4, mt: 1, cursor: 'pointer' }}
                                    onClick={(e) => {
                                        const rect = e.currentTarget.getBoundingClientRect();
                                        const x = e.clientX - rect.left;
                                        const percentage = Math.round((x / rect.width) * 100);
                                        setFormData({ ...formData, progress: Math.max(0, Math.min(100, percentage)) });
                                    }}
                                />
                            </Box>
                            {showDepartmentSelect && (
                                <TextField
                                    label="Assigned Department"
                                    select
                                    fullWidth
                                    required
                                    value={formData.departmentId}
                                    onChange={(e) => setFormData({ ...formData, departmentId: e.target.value })}
                                >
                                    {(isGlobalAdmin ? departments : userDepartments)?.map((dept: any) => (
                                        <MenuItem key={dept.id} value={dept.id}>{dept.name}</MenuItem>
                                    ))}
                                </TextField>
                            )}
                            
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
                                            pastors?.filter((p: any) => selected.includes(p.id)).map((p: any) => p.name).join(', ')
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
                        </Box>
                    </DialogContent>
                    <DialogActions sx={{ p: 4 }}>
                        <Button onClick={handleClose} sx={{ fontWeight: '800' }}>ABORT</Button>
                        <Button
                            type="submit"
                            variant="contained"
                            disabled={false}
                            sx={{ borderRadius: 2, px: 4, fontWeight: '900' }}
                        >
                            {editProject ? 'UPDATE REGISTRY' : 'EXECUTE LAUNCH'}
                        </Button>
                    </DialogActions>
                </form>
            </Dialog>
        </DashboardLayout>
    );
}
