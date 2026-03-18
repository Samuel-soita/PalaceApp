import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
    Box, Typography, Grid, Card, CardContent, Button, Chip,
    Dialog, DialogTitle, DialogContent, DialogActions, TextField,
    MenuItem, IconButton, Alert, CircularProgress,
    Select, Checkbox, ListItemText, FormControl, InputLabel
} from '@mui/material';
import { Plus, Edit, Trash2, Calendar, ClipboardList } from 'lucide-react';
import DashboardLayout from '../components/layout/DashboardLayout';
import api from '../lib/api-client';
import { useAuth } from '../contexts/AuthContext';
import { isUserManagingDepartment } from '../utils/auth-options';

interface Plan {
    id: string;
    title: string;
    type: 'MONTHLY' | 'YEARLY';
    description: string;
    departmentId: string;
    department: { name: string };
    createdAt: string;
}

export default function Plans() {
    const { user } = useAuth();
    const queryClient = useQueryClient();
    const [modalOpen, setModalOpen] = useState(false);
    const [editingPlan, setEditingPlan] = useState<Plan | null>(null);
    const [formData, setFormData] = useState({
        title: '',
        type: 'MONTHLY',
        description: '',
        departmentId: user?.departmentId || '',
        pastorIds: [] as string[]
    });

    const isGlobalAdmin = ['SUPER_ADMIN', 'SYSTEM_ADMIN', 'SECRETARY', 'WATUA'].includes(user?.role || '');
    const isLeader = isGlobalAdmin || ['DEPARTMENT_LEADER', 'PASTOR'].includes(user?.role || '');

    const [page, setPage] = useState(1);
    const limit = 12;

    const { data: plansData, isLoading } = useQuery(['plans', page], async () => {
        const res = await api.get('/plans', { params: { page, limit } });
        return res.data;
    });

    const plans = plansData?.data || [];
    const meta = plansData?.meta || { total: 0, totalPages: 1 };

    const filteredPlans = plans.filter((p: any) => {
        if (isGlobalAdmin) return true;
        return p.approvalStatus === 'APPROVED' || isUserManagingDepartment(user, p.departmentId);
    });

    const { data: pastors } = useQuery(['pastors'], async () => {
        const res = await api.get('/users?role=PASTOR');
        return Array.isArray(res.data) 
            ? res.data.filter((u: any) => u.role === 'PASTOR') 
            : [];
    });

    const { data: departments } = useQuery(['departments'], async () => {
        const res = await api.get('/departments');
        return Array.isArray(res.data) ? res.data : [];
    });

    const userDepartments = departments?.filter((d: any) => isUserManagingDepartment(user, d.id)) || [];
    const showDepartmentSelect = isGlobalAdmin || userDepartments.length > 1;

    const createMutation = useMutation(
        (data: any) => api.post('/plans', data),
        { onSuccess: () => {
            queryClient.invalidateQueries(['plans']);
            handleClose();
        }}
    );

    const updateMutation = useMutation(
        (data: any) => api.patch(`/plans/${data.id}`, data),
        { onSuccess: () => {
            queryClient.invalidateQueries(['plans']);
            handleClose();
        }}
    );

    const deleteMutation = useMutation(
        (id: string) => api.delete(`/plans/${id}`),
        { onSuccess: () => queryClient.invalidateQueries(['plans']) }
    );

    const handleOpen = (plan?: Plan) => {
        if (plan) {
            setEditingPlan(plan);
            setFormData({
                title: plan.title,
                type: plan.type,
                description: plan.description,
                departmentId: plan.departmentId,
                pastorIds: []
            });
        } else {
            setEditingPlan(null);
            setFormData({
                title: '',
                type: 'MONTHLY',
                description: '',
                departmentId: user?.departmentId || '',
                pastorIds: []
            });
            if (!isGlobalAdmin && userDepartments.length === 1) {
                setFormData(prev => ({ ...prev, departmentId: userDepartments[0].id }));
            }
        }
        setModalOpen(true);
    };

    const handleClose = () => {
        setModalOpen(false);
        setEditingPlan(null);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingPlan && formData.pastorIds.length !== 2) {
            alert("You must select exactly 2 Pastors to authorize this Plan before it takes effect.");
            return;
        }

        if (editingPlan) {
            updateMutation.mutate({ ...formData, id: editingPlan.id });
        } else {
            createMutation.mutate(formData);
        }
    };

    const handleDelete = (id: string) => {
        if (window.confirm('Are you sure you want to delete this plan? This action cannot be undone.')) {
            deleteMutation.mutate(id);
        }
    };

    if (isLoading) return <Box display="flex" justifyContent="center" mt={10}><CircularProgress /></Box>;

    return (
        <DashboardLayout>
            <Box mb={6} sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, justifyContent: 'space-between', alignItems: { xs: 'flex-start', sm: 'center' }, gap: 2 }}>
                <Box>
                    <Typography variant="h3" fontWeight="950" sx={{ letterSpacing: -2, fontSize: { xs: '2rem', sm: '3rem' } }}>DEPARTMENT <span className="text-primary">PLANS</span></Typography>
                    <Typography color="textSecondary" sx={{ opacity: 0.6, fontSize: { xs: '0.8rem', sm: '1rem' } }}>Strategic monthly and yearly operational roadmaps.</Typography>
                </Box>
                {isLeader && (
                    <Button
                        variant="contained"
                        startIcon={<Plus size={18} />}
                        onClick={() => handleOpen()}
                        sx={{ width: { xs: '100%', sm: 'auto' }, borderRadius: 3, py: 1.5, px: 4, fontWeight: '900', boxShadow: '0 0 20px var(--primary-glow)' }}
                    >
                        NEW PLAN
                    </Button>
                )}
            </Box>

            <Grid container spacing={3}>
                {filteredPlans?.map((plan: Plan) => (
                    <Grid item xs={12} md={6} key={plan.id}>
                        <Card className="holographic-card" sx={{ height: '100%' }}>
                            <CardContent sx={{ p: 4 }}>
                                <Box display="flex" justifyContent="space-between" alignItems="start" mb={2}>
                                    <div>
                                        <Chip
                                            label={plan.type}
                                            size="small"
                                            sx={{
                                                bgcolor: plan.type === 'YEARLY' ? 'secondary.main' : 'primary.main',
                                                color: 'white',
                                                fontWeight: '900',
                                                mb: 1
                                            }}
                                        />
                                        <Typography variant="h5" fontWeight="900" sx={{ letterSpacing: -0.5 }}>{plan.title}</Typography>
                                    </div>
                                    {(isGlobalAdmin || isUserManagingDepartment(user, plan.departmentId)) && (
                                        <Box>
                                            <IconButton size="small" onClick={() => handleOpen(plan)} sx={{ color: 'primary.main' }}>
                                                <Edit size={16} />
                                            </IconButton>
                                            <IconButton size="small" onClick={() => handleDelete(plan.id)} sx={{ color: 'error.main' }}>
                                                <Trash2 size={16} />
                                            </IconButton>
                                        </Box>
                                    )}
                                </Box>
                                <Typography variant="body2" sx={{ opacity: 0.7, mb: 3, lineBreak: 'anywhere' }}>
                                    {plan.description}
                                </Typography>
                                <Box display="flex" justifyContent="space-between" alignItems="center" mt="auto">
                                    <Box display="flex" alignItems="center" gap={1}>
                                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xs">
                                            {plan.department.name.charAt(0)}
                                        </div>
                                        <Typography variant="caption" fontWeight="bold">{plan.department.name}</Typography>
                                    </Box>
                                    <Typography variant="caption" sx={{ opacity: 0.5 }}>
                                        Added {new Date(plan.createdAt).toLocaleDateString()}
                                    </Typography>
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
                        PREV
                    </Button>
                    <Box display="flex" alignItems="center" px={4} sx={{ bgcolor: 'rgba(255,255,255,0.03)', borderRadius: 3, border: '1px solid var(--glass-border)' }}>
                        <Typography variant="body2" fontWeight="900" sx={{ opacity: 0.7 }}>PHASE: {page} / {meta.totalPages}</Typography>
                    </Box>
                    <Button 
                        disabled={page >= meta.totalPages}
                        onClick={() => setPage(p => p + 1)}
                        variant="contained"
                        sx={{ borderRadius: 3, fontWeight: 900, px: 4 }}
                    >
                        NEXT
                    </Button>
                </Box>
            )}

            {/* CRUD Modal */}
            <Dialog 
                open={modalOpen} 
                onClose={handleClose} 
                maxWidth="sm" 
                fullWidth 
                PaperProps={{ sx: { borderRadius: 4, bgcolor: 'background.paper', width: '95%', m: 1 } }}
            >
                <form onSubmit={handleSubmit}>
                    <DialogTitle sx={{ fontWeight: '900', fontSize: '1.5rem', letterSpacing: -1 }}>
                        {editingPlan ? 'EDIT' : 'CREATE'} PLAN
                    </DialogTitle>
                    <DialogContent>
                        <Box display="flex" flexDirection="column" gap={3} mt={1}>
                            <TextField
                                fullWidth
                                label="Plan Title"
                                required
                                value={formData.title}
                                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                            />
                            <TextField
                                fullWidth
                                select
                                label="Plan Type"
                                value={formData.type}
                                onChange={(e) => setFormData({ ...formData, type: e.target.value as any })}
                            >
                                <MenuItem value="MONTHLY">Monthly Plan</MenuItem>
                                <MenuItem value="YEARLY">Yearly Plan</MenuItem>
                            </TextField>
                            <TextField
                                fullWidth
                                multiline
                                rows={4}
                                label="Plan Description"
                                placeholder="Detail the objectives, events, and targets for this period..."
                                required
                                value={formData.description}
                                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                            />
                            {showDepartmentSelect && (
                                <TextField
                                    select
                                    fullWidth
                                    label="Assigned Department"
                                    required
                                    value={formData.departmentId}
                                    onChange={(e) => setFormData({ ...formData, departmentId: e.target.value })}
                                >
                                    {(isGlobalAdmin ? departments : userDepartments)?.map((dept: any) => (
                                        <MenuItem key={dept.id} value={dept.id}>{dept.name}</MenuItem>
                                    ))}
                                </TextField>
                            )}
                            
                            {!editingPlan && (
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
                                                <ListItemText primary={pastor.name} secondary="Pastor" />
                                            </MenuItem>
                                        ))}
                                    </Select>
                                </FormControl>
                            )}
                        </Box>
                    </DialogContent>
                    <DialogActions sx={{ p: 4 }}>
                        <Button onClick={handleClose} sx={{ fontWeight: '800' }}>CANCEL</Button>
                        <Button
                            type="submit"
                            variant="contained"
                            disabled={createMutation.isLoading || updateMutation.isLoading}
                            sx={{ borderRadius: 2, fontWeight: '900', px: 4 }}
                        >
                            {editingPlan ? 'UPDATE' : 'SAVE'} PLAN
                        </Button>
                    </DialogActions>
                </form>
            </Dialog>
        </DashboardLayout>
    );
}
