import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../lib/api-client';
import {
    Typography, Grid, Card, CardContent, Box, Button, TextField, Dialog, DialogTitle,
    DialogContent, DialogActions, MenuItem, LinearProgress, Chip, IconButton, Tooltip,
    Paper, Avatar, Divider
} from '@mui/material';
import {
    Brain, Target, Lightbulb, CheckSquare, Plus, Edit, Trash2,
    ChevronRight, ArrowUpRight, MessageSquare, User, Calendar,
    ShieldCheck, Zap, Layers
} from 'lucide-react';
import DashboardLayout from '../components/layout/DashboardLayout';
import { useAuth } from '../contexts/AuthContext';

export default function StrategyBoard() {
    const { user } = useAuth();
    const queryClient = useQueryClient();
    const [open, setOpen] = useState(false);
    const [editStrategy, setEditStrategy] = useState<any>(null);
    const [formData, setFormData] = useState({
        title: '',
        actionItems: '',
        assignedPerson: '',
        deadline: '',
        status: 'PENDING',
        departmentId: user?.departmentId || ''
    });

    const isSuperAdmin = user?.role === 'SUPER_ADMIN';

    const { data: strategies, isLoading } = useQuery(['strategies'], async () => {
        const res = await api.get(isSuperAdmin ? '/strategy' : `/strategy/department/${user?.departmentId}`);
        return res.data;
    });

    const { data: departments } = useQuery(['departments'], async () => {
        const res = await api.get('/departments');
        return res.data;
    });

    const createMutation = useMutation(
        (newStrategy: any) => api.post('/strategy', newStrategy),
        { onSuccess: () => { queryClient.invalidateQueries(['strategies']); handleClose(); } }
    );

    const updateMutation = useMutation(
        (updatedStrategy: any) => api.put(`/strategy/${updatedStrategy.id}`, updatedStrategy),
        { onSuccess: () => { queryClient.invalidateQueries(['strategies']); handleClose(); } }
    );

    const deleteMutation = useMutation(
        (id: string) => api.delete(`/strategy/${id}`),
        { onSuccess: () => queryClient.invalidateQueries(['strategies']) }
    );

    const handleOpen = (strategy: any = null) => {
        if (strategy) {
            setEditStrategy(strategy);
            setFormData({
                ...strategy,
                deadline: strategy.deadline ? new Date(strategy.deadline).toISOString().split('T')[0] : '',
                departmentId: strategy.departmentId
            });
        } else {
            setEditStrategy(null);
            setFormData({
                title: '',
                actionItems: '',
                assignedPerson: '',
                deadline: '',
                status: 'PENDING',
                departmentId: user?.departmentId || ''
            });
        }
        setOpen(true);
    };

    const handleClose = () => {
        setOpen(false);
        setEditStrategy(null);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (editStrategy) {
            updateMutation.mutate({ ...formData, id: editStrategy.id });
        } else {
            createMutation.mutate(formData);
        }
    };

    if (isLoading) return (
        <DashboardLayout>
            <Box sx={{ height: '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <LinearProgress sx={{ width: 200, borderRadius: 1 }} />
            </Box>
        </DashboardLayout>
    );

    return (
        <DashboardLayout>
            <Box sx={{ mb: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'end' }}>
                <div>
                    <Typography variant="h4" fontWeight="900" sx={{ mb: 1, letterSpacing: -1, display: 'flex', alignItems: 'center', gap: 2 }}>
                        <Brain size={36} className="text-primary" /> Strategy Workspace
                    </Typography>
                    <Typography color="textSecondary" fontWeight="medium">
                        Internal intelligence, action protocols, and mission objectives.
                    </Typography>
                </div>
                <Button
                    variant="contained"
                    startIcon={<Zap size={18} />}
                    onClick={() => handleOpen()}
                    sx={{ borderRadius: 2, px: 3, py: 1.5, fontWeight: '900', textTransform: 'none', boxShadow: 4 }}
                >
                    Deploy Protocol
                </Button>
            </Box>

            <Grid container spacing={3}>
                {strategies?.map((strategy: any) => (
                    <Grid item xs={12} md={6} lg={6} key={strategy.id} className="scanline">
                        <Card className="holographic-card" sx={{
                            borderRadius: 4,
                            border: '1px solid',
                            borderColor: 'divider',
                            bgcolor: 'transparent',
                            overflow: 'hidden'
                        }}>
                            <Box sx={{ p: 0.5, bgcolor: strategy.status === 'COMPLETED' ? 'success.main' : 'primary.main' }} />
                            <CardContent sx={{ p: 4 }}>
                                <Box display="flex" justifyContent="space-between" mb={3}>
                                    <div>
                                        <Typography variant="h6" fontWeight="900">{strategy.title}</Typography>
                                        <Typography variant="caption" fontWeight="900" color="primary" sx={{ textTransform: 'uppercase' }}>
                                            {strategy.department?.name} Tactical Node
                                        </Typography>
                                    </div>
                                    <Box display="flex" gap={1}>
                                        <IconButton size="small" onClick={() => handleOpen(strategy)}><Edit size={16} /></IconButton>
                                        <IconButton size="small" color="error" onClick={() => deleteMutation.mutate(strategy.id)}><Trash2 size={16} /></IconButton>
                                    </Box>
                                </Box>

                                <Paper sx={{ p: 2, bgcolor: 'action.hover', borderRadius: 3, mb: 3 }}>
                                    <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', color: 'text.secondary', fontWeight: '500' }}>
                                        {strategy.actionItems}
                                    </Typography>
                                </Paper>

                                <Grid container spacing={2}>
                                    <Grid item xs={12} sm={6}>
                                        <Box display="flex" alignItems="center" gap={1.5}>
                                            <Avatar sx={{ width: 32, height: 32, bgcolor: 'primary.light', fontSize: 14 }}>
                                                {strategy.assignedPerson?.charAt(0) || <User size={16} />}
                                            </Avatar>
                                            <div>
                                                <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 'bold', display: 'block' }}>Responsible Unit</Typography>
                                                <Typography variant="body2" fontWeight="800">{strategy.assignedPerson || 'Unassigned'}</Typography>
                                            </div>
                                        </Box>
                                    </Grid>
                                    <Grid item xs={12} sm={6}>
                                        <Box display="flex" alignItems="center" gap={1.5}>
                                            <Calendar size={18} className="text-muted-foreground" />
                                            <div>
                                                <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 'bold', display: 'block' }}>Deadline</Typography>
                                                <Typography variant="body2" fontWeight="800">{strategy.deadline ? new Date(strategy.deadline).toDateString() : 'Continuous'}</Typography>
                                            </div>
                                        </Box>
                                    </Grid>
                                </Grid>

                                <Box sx={{ mt: 4, pt: 3, borderTop: '1px solid', borderColor: 'divider', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <Chip
                                        label={strategy.status}
                                        size="small"
                                        variant="outlined"
                                        color={strategy.status === 'COMPLETED' ? 'success' : 'primary'}
                                        sx={{ fontWeight: 'bold', borderRadius: 1.5 }}
                                    />
                                    <Button size="small" sx={{ fontWeight: 'bold', textTransform: 'none' }} endIcon={<ChevronRight size={16} />}>
                                        View Intelligence
                                    </Button>
                                </Box>
                            </CardContent>
                        </Card>
                    </Grid>
                ))}
            </Grid>

            <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 4 } }}>
                <form onSubmit={handleSubmit}>
                    <DialogTitle sx={{ fontWeight: '900', pt: 4, px: 4 }}>
                        {editStrategy ? 'Revise Strategic Protocol' : 'New Intelligence Deployment'}
                    </DialogTitle>
                    <DialogContent sx={{ px: 4 }}>
                        <Box display="flex" flexDirection="column" gap={3} sx={{ pt: 2 }}>
                            <TextField
                                label="Protocol Title"
                                fullWidth
                                required
                                value={formData.title}
                                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                            />
                            <TextField
                                label="Action Items / Intelligence Notes"
                                multiline
                                rows={6}
                                fullWidth
                                required
                                value={formData.actionItems}
                                onChange={(e) => setFormData({ ...formData, actionItems: e.target.value })}
                                placeholder="Describe fundraising plans, ideas, or meeting notes..."
                            />
                            <TextField
                                label="Assigned Responsibility"
                                fullWidth
                                value={formData.assignedPerson}
                                onChange={(e) => setFormData({ ...formData, assignedPerson: e.target.value })}
                            />
                            <TextField
                                label="Objective Deadline"
                                type="date"
                                fullWidth
                                InputLabelProps={{ shrink: true }}
                                value={formData.deadline}
                                onChange={(e) => setFormData({ ...formData, deadline: e.target.value })}
                            />
                            {isSuperAdmin && (
                                <TextField
                                    label="Target Tactical Node (Department)"
                                    select
                                    fullWidth
                                    required
                                    value={formData.departmentId}
                                    onChange={(e) => setFormData({ ...formData, departmentId: e.target.value })}
                                    SelectProps={{ inputProps: { tabIndex: -1 } }}
                                >
                                    {departments?.map((dept: any) => (
                                        <MenuItem key={dept.id} value={dept.id}>{dept.name}</MenuItem>
                                    ))}
                                </TextField>
                            )}
                            <TextField
                                label="Status"
                                select
                                fullWidth
                                value={formData.status}
                                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                                SelectProps={{ inputProps: { tabIndex: -1 } }}
                            >
                                <MenuItem value="PENDING">Pending Evaluation</MenuItem>
                                <MenuItem value="IN_PROGRESS">Operational</MenuItem>
                                <MenuItem value="COMPLETED">Objective Met</MenuItem>
                            </TextField>
                        </Box>
                    </DialogContent>
                    <DialogActions sx={{ p: 4 }}>
                        <Button onClick={handleClose} sx={{ fontWeight: 'bold' }}>Abort</Button>
                        <Button
                            type="submit"
                            variant="contained"
                            color="primary"
                            sx={{ borderRadius: 2, px: 4, fontWeight: 'bold' }}
                        >
                            Sync Protocol
                        </Button>
                    </DialogActions>
                </form>
            </Dialog>
        </DashboardLayout>
    );
}
