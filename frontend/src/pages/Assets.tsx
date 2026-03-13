import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../lib/api-client';
import {
    Card, CardContent, Typography, Grid, Button,
    Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, Chip,
    Dialog, DialogTitle, DialogContent, DialogActions, TextField, MenuItem,
    IconButton, Box, Tooltip
} from '@mui/material';
import { Plus, Package, Edit, Trash2, Shield, Activity, RefreshCw } from 'lucide-react';
import DashboardLayout from '../components/layout/DashboardLayout';
import { useAuth } from '../contexts/AuthContext';

export default function Assets() {
    const { user } = useAuth();
    const queryClient = useQueryClient();
    const [open, setOpen] = useState(false);
    const [editAsset, setEditAsset] = useState<any>(null);
    const [formData, setFormData] = useState({
        name: '',
        condition: 'NEW',
        assignedTo: '',
        maintenanceSchedule: '',
        departmentId: ''
    });

    const isSuperAdmin = user?.role === 'SUPER_ADMIN';

    const { data: assets, isLoading } = useQuery(['assets'], async () => {
        const url = isSuperAdmin ? '/assets' : `/assets/department/${user?.departmentId}`;
        const res = await api.get(url);
        return res.data;
    });

    const { data: departments } = useQuery(['departments'], async () => {
        const res = await api.get('/departments');
        return res.data;
    }, { enabled: isSuperAdmin });

    const createMutation = useMutation((data: any) => api.post('/assets', data), {
        onSuccess: () => {
            queryClient.invalidateQueries(['assets']);
            handleClose();
        }
    });

    const updateMutation = useMutation((data: any) => api.put(`/assets/${editAsset.id}`, data), {
        onSuccess: () => {
            queryClient.invalidateQueries(['assets']);
            handleClose();
        }
    });

    const deleteMutation = useMutation((id: string) => api.delete(`/assets/${id}`), {
        onSuccess: () => queryClient.invalidateQueries(['assets'])
    });

    const handleOpen = (asset: any = null) => {
        if (asset) {
            setEditAsset(asset);
            setFormData({
                name: asset.name,
                condition: asset.condition,
                assignedTo: asset.assignedTo || '',
                maintenanceSchedule: asset.maintenanceSchedule || '',
                departmentId: asset.departmentId
            });
        } else {
            setEditAsset(null);
            setFormData({
                name: '',
                condition: 'NEW',
                assignedTo: '',
                maintenanceSchedule: '',
                departmentId: isSuperAdmin ? '' : user?.departmentId || ''
            });
        }
        setOpen(true);
    };

    const handleClose = () => {
        setOpen(false);
        setEditAsset(null);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (editAsset) {
            updateMutation.mutate(formData);
        } else {
            createMutation.mutate(formData);
        }
    };

    const getConditionColor = (condition: string) => {
        switch (condition) {
            case 'NEW': return 'success';
            case 'GOOD': return 'primary';
            case 'FAIR': return 'warning';
            case 'POOR': return 'error';
            default: return 'default';
        }
    };

    return (
        <DashboardLayout>
            <Box sx={{ mb: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <Typography variant="h4" fontWeight="900" sx={{ letterSpacing: -1, mb: 1 }}>
                        Asset Command
                    </Typography>
                    <Typography color="textSecondary" variant="body1">
                        Monitoring and managing physical infrastructure assets.
                    </Typography>
                </div>
                <Button
                    variant="contained"
                    startIcon={<Plus size={20} />}
                    onClick={() => handleOpen()}
                    sx={{
                        borderRadius: 2,
                        px: 3,
                        py: 1.5,
                        textTransform: 'none',
                        fontWeight: 'bold',
                        boxShadow: '0 8px 16px -4px rgba(0,0,0,0.1)'
                    }}
                >
                    Register Asset
                </Button>
            </Box>

            <Grid container spacing={3} mb={6}>
                <Grid item xs={12} md={4}>
                    <Card sx={{ borderRadius: 4, bgcolor: 'primary.main', color: 'white' }}>
                        <CardContent sx={{ p: 4 }}>
                            <Box display="flex" justifyContent="space-between" mb={2}>
                                <Package size={28} />
                                <Chip label="Operational" sx={{ bgcolor: 'white/20', color: 'white', fontWeight: 'bold' }} />
                            </Box>
                            <Typography variant="h3" fontWeight="bold">{assets?.length || 0}</Typography>
                            <Typography variant="body2" sx={{ opacity: 0.8 }}>Total Managed Assets</Typography>
                        </CardContent>
                    </Card>
                </Grid>
                <Grid item xs={12} md={4}>
                    <Card sx={{ borderRadius: 4, border: '1px solid', borderColor: 'divider' }}>
                        <CardContent sx={{ p: 4 }}>
                            <Box display="flex" justifyContent="space-between" mb={2}>
                                <Shield size={28} className="text-secondary" />
                                <Activity size={20} className="text-success" />
                            </Box>
                            <Typography variant="h3" fontWeight="bold">
                                {assets?.filter((a: any) => a.condition === 'NEW' || a.condition === 'GOOD').length || 0}
                            </Typography>
                            <Typography variant="body2" color="textSecondary">Healthy Conditions</Typography>
                        </CardContent>
                    </Card>
                </Grid>
                <Grid item xs={12} md={4}>
                    <Card sx={{ borderRadius: 4, border: '1px solid', borderColor: 'divider' }}>
                        <CardContent sx={{ p: 4 }}>
                            <Box display="flex" justifyContent="space-between" mb={2}>
                                <RefreshCw size={28} className="text-warning" />
                            </Box>
                            <Typography variant="h3" fontWeight="bold">
                                {assets?.filter((a: any) => a.maintenanceSchedule).length || 0}
                            </Typography>
                            <Typography variant="body2" color="textSecondary">Scheduled Maintenance</Typography>
                        </CardContent>
                    </Card>
                </Grid>
            </Grid>

            <TableContainer component={Paper} elevation={0} sx={{ borderRadius: 4, border: '1px solid', borderColor: 'divider', overflow: 'hidden' }}>
                <Table>
                    <TableHead sx={{ bgcolor: 'action.hover' }}>
                        <TableRow>
                            <TableCell sx={{ fontWeight: '800' }}>Asset Details</TableCell>
                            <TableCell sx={{ fontWeight: '800' }}>Condition</TableCell>
                            <TableCell sx={{ fontWeight: '800' }}>Assigned To</TableCell>
                            {isSuperAdmin && <TableCell sx={{ fontWeight: '800' }}>Department</TableCell>}
                            <TableCell sx={{ fontWeight: '800' }} align="right">Command</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {isLoading ? (
                            <TableRow><TableCell colSpan={5} align="center" sx={{ py: 8 }}>Scanning infrastructure...</TableCell></TableRow>
                        ) : assets?.map((asset: any) => (
                            <TableRow key={asset.id} hover sx={{ '&:last-child td, &:last-child th': { border: 0 } }}>
                                <TableCell>
                                    <Typography fontWeight="700">{asset.name}</Typography>
                                    <Typography variant="caption" color="textSecondary">ID: {asset.id.split('-')[0]}</Typography>
                                </TableCell>
                                <TableCell>
                                    <Chip
                                        label={asset.condition}
                                        color={getConditionColor(asset.condition) as any}
                                        variant="outlined"
                                        size="small"
                                        sx={{ fontWeight: 'bold' }}
                                    />
                                </TableCell>
                                <TableCell>
                                    <Typography variant="body2">{asset.assignedTo || 'Unassigned'}</Typography>
                                    <Typography variant="caption" color="textSecondary">{asset.maintenanceSchedule || 'No schedule'}</Typography>
                                </TableCell>
                                {isSuperAdmin && <TableCell>{asset.department?.name}</TableCell>}
                                <TableCell align="right">
                                    <Tooltip title="Edit Asset">
                                        <IconButton onClick={() => handleOpen(asset)} size="small" color="primary">
                                            <Edit size={18} />
                                        </IconButton>
                                    </Tooltip>
                                    <Tooltip title="Decommission">
                                        <IconButton onClick={() => deleteMutation.mutate(asset.id)} size="small" color="error">
                                            <Trash2 size={18} />
                                        </IconButton>
                                    </Tooltip>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </TableContainer>

            <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
                <form onSubmit={handleSubmit}>
                    <DialogTitle sx={{ fontWeight: 'bold' }}>
                        {editAsset ? 'Adjust Asset Profile' : 'Register New Asset'}
                    </DialogTitle>
                    <DialogContent>
                        <Box display="flex" flexDirection="column" gap={2.5} sx={{ pt: 1 }}>
                            <TextField
                                label="Asset Name"
                                fullWidth
                                required
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            />
                            <TextField
                                label="Condition"
                                select
                                fullWidth
                                required
                                value={formData.condition}
                                onChange={(e) => setFormData({ ...formData, condition: e.target.value })}
                            >
                                <MenuItem value="NEW">New</MenuItem>
                                <MenuItem value="GOOD">Good</MenuItem>
                                <MenuItem value="FAIR">Fair</MenuItem>
                                <MenuItem value="POOR">Poor</MenuItem>
                            </TextField>
                            <TextField
                                label="Assigned To (Leader/Staff)"
                                fullWidth
                                value={formData.assignedTo}
                                onChange={(e) => setFormData({ ...formData, assignedTo: e.target.value })}
                            />
                            <TextField
                                label="Maintenance Schedule"
                                fullWidth
                                placeholder="e.g. Every 6 months"
                                value={formData.maintenanceSchedule}
                                onChange={(e) => setFormData({ ...formData, maintenanceSchedule: e.target.value })}
                            />
                            {isSuperAdmin && (
                                <TextField
                                    label="Department"
                                    select
                                    fullWidth
                                    required
                                    value={formData.departmentId}
                                    onChange={(e) => setFormData({ ...formData, departmentId: e.target.value })}
                                >
                                    {departments?.map((dept: any) => (
                                        <MenuItem key={dept.id} value={dept.id}>{dept.name}</MenuItem>
                                    ))}
                                </TextField>
                            )}
                        </Box>
                    </DialogContent>
                    <DialogActions sx={{ p: 3 }}>
                        <Button onClick={handleClose} sx={{ textTransform: 'none' }}>Cancel</Button>
                        <Button
                            type="submit"
                            variant="contained"
                            disabled={createMutation.isLoading || updateMutation.isLoading}
                            sx={{ borderRadius: 2, px: 4, textTransform: 'none', fontWeight: 'bold' }}
                        >
                            {editAsset ? 'Apply Changes' : 'Register Asset'}
                        </Button>
                    </DialogActions>
                </form>
            </Dialog>
        </DashboardLayout>
    );
}
