import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../lib/api-client';
import {
    Card, CardContent, Typography, Grid, Button, LinearProgress, Box, Chip,
    Dialog, DialogTitle, DialogContent, DialogActions, TextField, MenuItem,
    IconButton, Tooltip, Divider
} from '@mui/material';
import { Plus, Wallet, TrendingUp, Users, Edit, Trash2, Calendar, Target, DollarSign, CreditCard, Banknote } from 'lucide-react';
import DashboardLayout from '../components/layout/DashboardLayout';
import { useAuth } from '../contexts/AuthContext';

export default function Fundraising() {
    const { user } = useAuth();
    const queryClient = useQueryClient();
    const [open, setOpen] = useState(false);
    const [editBudget, setEditBudget] = useState<any>(null);
    const [formData, setFormData] = useState({
        title: '',
        targetAmount: 0,
        deadline: '',
        departmentId: '',
        status: 'OPEN'
    });

    const [contribOpen, setContribOpen] = useState(false);
    const [selectedBudget, setSelectedBudget] = useState<any>(null);
    const [contribData, setContribData] = useState({
        name: '',
        amount: 0,
        paymentMethod: 'CASH',
        notes: ''
    });

    const isSuperAdmin = user?.role === 'SUPER_ADMIN';

    const { data: budgets, isLoading } = useQuery(['budgets'], async () => {
        const url = isSuperAdmin ? '/budgets' : `/budgets?departmentId=${user?.departmentId}`;
        const res = await api.get(url);
        return res.data;
    });

    const { data: departments } = useQuery(['departments'], async () => {
        const res = await api.get('/departments');
        return res.data;
    }, { enabled: isSuperAdmin });

    const createMutation = useMutation((data: any) => api.post('/budgets', data), {
        onSuccess: () => {
            queryClient.invalidateQueries(['budgets']);
            handleClose();
        }
    });

    const updateMutation = useMutation((data: any) => api.put(`/budgets/${editBudget.id}`, data), {
        onSuccess: () => {
            queryClient.invalidateQueries(['budgets']);
            handleClose();
        }
    });

    const deleteMutation = useMutation((id: string) => api.delete(`/budgets/${id}`), {
        onSuccess: () => queryClient.invalidateQueries(['budgets'])
    });

    const contribMutation = useMutation((data: any) => api.post('/contributors', data), {
        onSuccess: () => {
            queryClient.invalidateQueries(['budgets']);
            setContribOpen(false);
            setContribData({ name: '', amount: 0, paymentMethod: 'CASH', notes: '' });
        }
    });

    const handleContribOpen = (budget: any) => {
        setSelectedBudget(budget);
        setContribOpen(true);
    };

    const handleOpen = (budget: any = null) => {
        if (budget) {
            setEditBudget(budget);
            setFormData({
                title: budget.title,
                targetAmount: budget.targetAmount,
                deadline: new Date(budget.deadline).toISOString().split('T')[0],
                departmentId: budget.departmentId,
                status: budget.status
            });
        } else {
            setEditBudget(null);
            setFormData({
                title: '',
                targetAmount: 0,
                deadline: '',
                departmentId: isSuperAdmin ? '' : user?.departmentId || '',
                status: 'OPEN'
            });
        }
        setOpen(true);
    };

    const handleClose = () => {
        setOpen(false);
        setEditBudget(null);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const data = {
            ...formData,
            targetAmount: Number(formData.targetAmount)
        };
        if (editBudget) {
            updateMutation.mutate(data);
        } else {
            createMutation.mutate(data);
        }
    };

    const getProgress = (raised: number, target: number) => {
        return Math.min((raised / target) * 100, 100) || 0;
    };

    return (
        <DashboardLayout>
            <Box sx={{ mb: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <Typography variant="h4" fontWeight="900" sx={{ letterSpacing: -1, mb: 1 }}>
                        Financial Command
                    </Typography>
                    <Typography color="textSecondary" variant="body1">
                        Tracking fundraising targets and departmental budget performance.
                    </Typography>
                </div>
                <Button
                    variant="contained"
                    color="success"
                    startIcon={<Plus size={20} />}
                    onClick={() => handleOpen()}
                    sx={{ borderRadius: 2, px: 3, py: 1.5, fontWeight: 'bold' }}
                >
                    Initiate Budget
                </Button>
            </Box>

            <Grid container spacing={4} mb={8}>
                {isLoading ? (
                    <Grid item xs={12}><Typography>Syncing financial data...</Typography></Grid>
                ) : budgets?.map((budget: any) => (
                    <Grid item xs={12} md={6} lg={4} key={budget.id}>
                        <Card sx={{ borderRadius: 4, position: 'relative', overflow: 'visible', border: '1px solid', borderColor: 'divider' }}>
                            <CardContent sx={{ p: 4 }}>
                                <Box display="flex" justifyContent="space-between" alignItems="start" mb={3}>
                                    <div className="p-3 bg-green-500/10 rounded-2xl text-green-600">
                                        <Wallet size={24} />
                                    </div>
                                    <Box display="flex" gap={1}>
                                        <Tooltip title="Edit">
                                            <IconButton size="small" onClick={() => handleOpen(budget)}><Edit size={16} /></IconButton>
                                        </Tooltip>
                                        <Tooltip title="Delete">
                                            <IconButton size="small" color="error" onClick={() => deleteMutation.mutate(budget.id)}><Trash2 size={16} /></IconButton>
                                        </Tooltip>
                                    </Box>
                                </Box>

                                <Typography variant="h6" fontWeight="800" gutterBottom noWrap>{budget.title}</Typography>
                                <Typography variant="body2" color="textSecondary" sx={{ mb: 3, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 1 }}>
                                    <Target size={14} /> {budget.department?.name}
                                </Typography>

                                <Box mb={1} display="flex" justifyContent="space-between" alignItems="center">
                                    <Typography variant="caption" fontWeight="900" sx={{ color: 'text.secondary', textTransform: 'uppercase' }}>
                                        Deployment Progress
                                    </Typography>
                                    <Typography variant="body2" fontWeight="900" color="success.main">
                                        {getProgress(budget.amountRaised, budget.targetAmount).toFixed(1)}%
                                    </Typography>
                                </Box>
                                <LinearProgress
                                    variant="determinate"
                                    value={getProgress(budget.amountRaised, budget.targetAmount)}
                                    sx={{ height: 12, borderRadius: 6, mb: 4, bgcolor: 'action.hover', '& .MuiLinearProgress-bar': { borderRadius: 6 } }}
                                />

                                <Divider sx={{ mb: 3, borderStyle: 'dashed' }} />

                                <Box sx={{ mt: 3, display: 'flex', gap: 2 }}>
                                    <Button
                                        variant="outlined"
                                        fullWidth
                                        size="small"
                                        startIcon={<DollarSign size={16} />}
                                        onClick={() => handleContribOpen(budget)}
                                        sx={{ fontWeight: '800', borderRadius: 2 }}
                                    >
                                        Enlist Funds
                                    </Button>
                                </Box>
                            </CardContent>
                            <Box sx={{ position: 'absolute', top: -10, right: 20 }}>
                                <Chip
                                    label={budget.status}
                                    size="small"
                                    color={budget.status === 'OPEN' ? 'success' : 'default'}
                                    sx={{ fontWeight: '900', boxShadow: 2 }}
                                />
                            </Box>
                        </Card>
                    </Grid>
                ))}
            </Grid>

            <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 4 } }}>
                <form onSubmit={handleSubmit}>
                    <DialogTitle sx={{ fontWeight: '900', pt: 4, px: 4 }}>
                        {editBudget ? 'Modify Financial Objective' : 'New Strategic Budget'}
                    </DialogTitle>
                    <DialogContent sx={{ px: 4 }}>
                        <Box display="flex" flexDirection="column" gap={3} sx={{ pt: 2 }}>
                            <TextField
                                label="Budget Title"
                                fullWidth
                                required
                                value={formData.title}
                                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                            />
                            <TextField
                                label="Target Amount ($)"
                                type="number"
                                fullWidth
                                required
                                value={formData.targetAmount}
                                onChange={(e) => setFormData({ ...formData, targetAmount: Number(e.target.value) })}
                            />
                            <TextField
                                label="Deadline"
                                type="date"
                                fullWidth
                                required
                                InputLabelProps={{ shrink: true }}
                                value={formData.deadline}
                                onChange={(e) => setFormData({ ...formData, deadline: e.target.value })}
                            />
                            {isSuperAdmin && (
                                <TextField
                                    label="Target Department"
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
                                <MenuItem value="OPEN">Open</MenuItem>
                                <MenuItem value="CLOSED">Closed</MenuItem>
                                <MenuItem value="COMPLETED">Completed</MenuItem>
                            </TextField>
                        </Box>
                    </DialogContent>
                    <DialogActions sx={{ p: 4 }}>
                        <Button onClick={handleClose} sx={{ fontWeight: 'bold' }}>Abort</Button>
                        <Button
                            type="submit"
                            variant="contained"
                            color="success"
                            disabled={createMutation.isLoading || updateMutation.isLoading}
                            sx={{ borderRadius: 2, px: 4, fontWeight: 'bold' }}
                        >
                            {editBudget ? 'Update Objective' : 'Deploy Budget'}
                        </Button>
                    </DialogActions>
                </form>
            </Dialog>

            <Dialog open={contribOpen} onClose={() => setContribOpen(false)} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: 4 } }}>
                <form onSubmit={(e) => { e.preventDefault(); contribMutation.mutate({ ...contribData, budgetId: selectedBudget?.id, departmentId: selectedBudget?.departmentId }); }}>
                    <DialogTitle sx={{ fontWeight: '900', pt: 4, px: 4 }}>Mobilize Resources</DialogTitle>
                    <DialogContent sx={{ px: 4 }}>
                        <Box display="flex" flexDirection="column" gap={3} sx={{ pt: 2 }}>
                            <Typography variant="subtitle2" color="primary" fontWeight="800">TARGET: {selectedBudget?.title}</Typography>
                            <TextField
                                label="Contributor Name"
                                fullWidth
                                required
                                value={contribData.name}
                                onChange={(e) => setContribData({ ...contribData, name: e.target.value })}
                            />
                            <TextField
                                label="Contribution Amount ($)"
                                type="number"
                                fullWidth
                                required
                                value={contribData.amount}
                                onChange={(e) => setContribData({ ...contribData, amount: Number(e.target.value) })}
                            />
                            <TextField
                                label="Payment Protocol"
                                select
                                fullWidth
                                value={contribData.paymentMethod}
                                onChange={(e) => setContribData({ ...contribData, paymentMethod: e.target.value })}
                                SelectProps={{ inputProps: { tabIndex: -1 } }}
                            >
                                <MenuItem value="CASH"><Box display="flex" alignItems="center" gap={1}><Banknote size={16} /> Cash</Box></MenuItem>
                                <MenuItem value="MPESA"><Box display="flex" alignItems="center" gap={1}><Typography fontWeight="900" sx={{ color: 'success.main' }}>M</Typography> M-Pesa</Box></MenuItem>
                                <MenuItem value="BANK"><Box display="flex" alignItems="center" gap={1}><CreditCard size={16} /> Bank Transfer</Box></MenuItem>
                            </TextField>
                            <TextField
                                label="Notes / Reference"
                                multiline
                                rows={2}
                                fullWidth
                                value={contribData.notes}
                                onChange={(e) => setContribData({ ...contribData, notes: e.target.value })}
                            />
                        </Box>
                    </DialogContent>
                    <DialogActions sx={{ p: 4 }}>
                        <Button onClick={() => setContribOpen(false)} sx={{ fontWeight: 'bold' }}>Abort</Button>
                        <Button
                            type="submit"
                            variant="contained"
                            color="success"
                            disabled={contribMutation.isLoading}
                            sx={{ borderRadius: 2, px: 4, fontWeight: 'bold' }}
                        >
                            Confirm Mobilization
                        </Button>
                    </DialogActions>
                </form>
            </Dialog>
        </DashboardLayout>
    );
}
