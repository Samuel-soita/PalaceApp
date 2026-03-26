import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../lib/api-client';
import { 
    Box, Typography, Grid, Card, CardContent, Button, TextField, 
    Dialog, DialogTitle, DialogContent, DialogActions, FormControl, 
    InputLabel, Select, MenuItem, Chip, Paper, Table, TableBody, 
    TableCell, TableContainer, TableHead, TableRow, IconButton, Alert, useMediaQuery, useTheme
} from '@mui/material';
import { ArrowRightLeft, CheckCircle2, Clock, Plus, TrendingDown, TrendingUp, XCircle } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { isUserManagingDepartment } from '../../utils/auth-options';

interface Transaction {
    id: string;
    type: 'INCOME' | 'EXPENDITURE';
    amount: number;
    description: string;
    status: 'PENDING' | 'APPROVED' | 'REJECTED';
    createdAt: string;
}

export const DepartmentAccounts = ({ departmentId }: { departmentId: string }) => {
    const { user } = useAuth();
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
    const queryClient = useQueryClient();
    const [openModal, setOpenModal] = useState(false);
    const [formData, setFormData] = useState({ type: 'EXPENDITURE', amount: '', description: '' });

    const isGlobalAdmin = ['SUPER_ADMIN', 'SYSTEM_ADMIN', 'SECRETARY', 'WATUA'].includes(user?.role || '');
    const isHighLevel = isGlobalAdmin || (user?.role === 'PASTOR' && isUserManagingDepartment(user, departmentId));

    const { data: account, isLoading: accountLoading } = useQuery(['account', departmentId], async () => {
        const res = await api.get(`/budgets/accounts/summary/${departmentId}`);
        return res.data;
    });

    const { data: transactions, isLoading: txLoading } = useQuery(['transactions', departmentId], async () => {
        const res = await api.get(`/budgets/accounts/transactions/${departmentId}`);
        return res.data;
    });

    const createTxMutation = useMutation((payload: any) => api.post('/budgets/accounts/transactions', payload), {
        onSuccess: () => {
            queryClient.invalidateQueries(['transactions', departmentId]);
            setOpenModal(false);
            setFormData({ type: 'EXPENDITURE', amount: '', description: '' });
        }
    });

    const approveTxMutation = useMutation(({ id, status }: { id: string, status: string }) => 
        api.patch(`/budgets/accounts/transactions/${id}/approve`, { status }), {
        onSuccess: () => {
            queryClient.invalidateQueries(['account', departmentId]);
            queryClient.invalidateQueries(['transactions', departmentId]);
        }
    });

    if (accountLoading || txLoading) return <Typography>Loading financial ledger...</Typography>;

    const stats = [
        { label: 'Available Balance', value: account?.balance || 0, icon: ArrowRightLeft, color: 'primary' },
        { label: 'Total Income', value: account?.totalIncome || 0, icon: TrendingUp, color: 'success' },
        { label: 'Total Expenditure', value: account?.totalExpenditure || 0, icon: TrendingDown, color: 'error' },
        { label: 'Pending Requests', value: transactions?.filter((t: any) => t.status === 'PENDING').length || 0, icon: Clock, color: 'warning' },
    ];

    return (
        <Box>
            <Box display="flex" flexDirection={isMobile ? 'column' : 'row'} justifyContent="space-between" alignItems={isMobile ? 'start' : 'center'} gap={2} mb={3}>
                <Typography variant={isMobile ? "h6" : "h5"} fontWeight="900">Departmental Treasury</Typography>
                <Button 
                    variant="contained" 
                    fullWidth={isMobile}
                    startIcon={<Plus size={18}/>} 
                    onClick={() => setOpenModal(true)}
                    sx={{ borderRadius: 2, py: isMobile ? 1.5 : 1 }}
                >
                    Record Transaction
                </Button>
            </Box>

            <Grid container spacing={isMobile ? 2 : 3} mb={4}>
                {stats.map((stat, i) => (
                    <Grid item xs={12} sm={6} md={3} key={i}>
                        <Card sx={{ bgcolor: 'rgba(255,255,255,0.02)', border: '1px solid var(--glass-border)', borderRadius: isMobile ? 2 : 3 }}>
                            <CardContent sx={{ p: isMobile ? 2 : 3 }}>
                                <Box display="flex" justifyContent="space-between" mb={isMobile ? 1 : 2}>
                                    <stat.icon size={isMobile ? 18 : 20} className={`text-${stat.color}-500`} />
                                </Box>
                                <Typography variant={isMobile ? "h5" : "h4"} fontWeight="900">{stat.value.toLocaleString()} KES</Typography>
                                <Typography variant="caption" fontWeight="bold" sx={{ opacity: 0.5, fontSize: isMobile ? '0.65rem' : '0.75rem' }}>{stat.label}</Typography>
                            </CardContent>
                        </Card>
                    </Grid>
                ))}
            </Grid>

            <TableContainer component={Paper} sx={{ display: { xs: 'none', md: 'block' }, bgcolor: 'transparent', border: '1px solid var(--glass-border)', borderRadius: 3 }}>
                <Table>
                    <TableHead>
                        <TableRow>
                            <TableCell sx={{ fontWeight: 'bold' }}>Date</TableCell>
                            <TableCell sx={{ fontWeight: 'bold' }}>Description</TableCell>
                            <TableCell sx={{ fontWeight: 'bold' }}>Type</TableCell>
                            <TableCell sx={{ fontWeight: 'bold' }}>Amount</TableCell>
                            <TableCell sx={{ fontWeight: 'bold' }}>Status</TableCell>
                            {isHighLevel && <TableCell sx={{ fontWeight: 'bold' }}>Actions</TableCell>}
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {transactions?.map((tx: Transaction) => (
                            <TableRow key={tx.id}>
                                <TableCell>{new Date(tx.createdAt).toLocaleDateString()}</TableCell>
                                <TableCell sx={{ fontWeight: 'bold' }}>{tx.description}</TableCell>
                                <TableCell>
                                    <Chip 
                                        label={tx.type} 
                                        size="small" 
                                        color={tx.type === 'INCOME' ? 'success' : 'error'} 
                                        variant="outlined"
                                        sx={{ fontWeight: 'bold' }}
                                    />
                                </TableCell>
                                <TableCell sx={{ fontWeight: 900 }}>
                                    <Typography fontWeight="900" color={tx.type === 'INCOME' ? 'success.main' : 'error.main'}>
                                        {tx.type === 'INCOME' ? '+' : '-'}{tx.amount.toLocaleString()} KES
                                    </Typography>
                                </TableCell>
                                <TableCell>
                                    <Chip 
                                        label={tx.status} 
                                        size="small" 
                                        sx={{ 
                                            fontWeight: 'bold',
                                            bgcolor: tx.status === 'APPROVED' ? 'success.main/10' : tx.status === 'REJECTED' ? 'error.main/10' : 'warning.main/10',
                                            color: tx.status === 'APPROVED' ? 'success.main' : tx.status === 'REJECTED' ? 'error.main' : 'warning.main',
                                        }}
                                    />
                                </TableCell>
                                {isHighLevel && (
                                    <TableCell>
                                        {tx.status === 'PENDING' && (
                                            <Box display="flex" gap={1}>
                                                <IconButton size="small" color="success" onClick={() => approveTxMutation.mutate({ id: tx.id, status: 'APPROVED' })}>
                                                    <CheckCircle2 size={18} />
                                                </IconButton>
                                                <IconButton size="small" color="error" onClick={() => approveTxMutation.mutate({ id: tx.id, status: 'REJECTED' })}>
                                                    <XCircle size={18} />
                                                </IconButton>
                                            </Box>
                                        )}
                                    </TableCell>
                                )}
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </TableContainer>

            {/* Mobile Transaction Cards */}
            <Box sx={{ display: { xs: 'flex', md: 'none' }, flexDirection: 'column', gap: 2 }}>
                {transactions?.map((tx: Transaction) => (
                    <Card key={tx.id} sx={{ bgcolor: 'rgba(255,255,255,0.02)', border: '1px solid var(--glass-border)', borderRadius: 2 }}>
                        <CardContent sx={{ p: 2 }}>
                            <Box display="flex" justifyContent="space-between" mb={1}>
                                <Typography variant="caption" sx={{ opacity: 0.6 }}>{new Date(tx.createdAt).toLocaleDateString()}</Typography>
                                <Chip label={tx.status} size="small" variant="outlined" sx={{ height: 18, fontSize: '0.6rem' }} />
                            </Box>
                            <Box display="flex" justifyContent="space-between" alignItems="center" mb={1.5}>
                                <Typography variant="subtitle2" fontWeight="900" noWrap sx={{ maxWidth: '70%' }}>{tx.description}</Typography>
                                <Typography variant="subtitle2" fontWeight="900" color={tx.type === 'INCOME' ? 'success.main' : 'error.main'}>
                                    {tx.type === 'INCOME' ? '+' : '-'}{tx.amount.toLocaleString()} KES
                                </Typography>
                            </Box>
                            {isHighLevel && tx.status === 'PENDING' && (
                                <Box display="flex" gap={1}>
                                    <Button size="small" variant="contained" color="success" fullWidth onClick={() => approveTxMutation.mutate({ id: tx.id, status: 'APPROVED' })}>Approve</Button>
                                    <Button size="small" variant="outlined" color="error" fullWidth onClick={() => approveTxMutation.mutate({ id: tx.id, status: 'REJECTED' })}>Reject</Button>
                                </Box>
                            )}
                        </CardContent>
                    </Card>
                ))}
            </Box>

            <Dialog 
                open={openModal} 
                onClose={() => setOpenModal(false)} 
                PaperProps={{ sx: { bgcolor: 'background.paper', borderRadius: 3, width: '95%', m: 1 } }}
            >
                <DialogTitle fontWeight="900">Record New Transaction</DialogTitle>
                <DialogContent>
                    <Box display="flex" flexDirection="column" gap={3} mt={2}>
                        <FormControl fullWidth>
                            <InputLabel>Type</InputLabel>
                            <Select
                                value={formData.type}
                                label="Type"
                                onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                            >
                                <MenuItem value="INCOME">Income / Donation</MenuItem>
                                <MenuItem value="EXPENDITURE">Expenditure / Bill</MenuItem>
                            </Select>
                        </FormControl>
                        <TextField 
                            label="Amount" 
                            type="number" 
                            fullWidth 
                            value={formData.amount}
                            onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                        />
                        <TextField 
                            label="Description" 
                            multiline 
                            rows={3} 
                            fullWidth 
                            value={formData.description}
                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        />
                        <Alert severity="info" sx={{ borderRadius: 2 }}>
                            Transaction will be recorded as PENDING and requires Pastor/Bishop approval.
                        </Alert>
                    </Box>
                </DialogContent>
                <DialogActions sx={{ p: 3 }}>
                    <Button onClick={() => setOpenModal(false)}>Cancel</Button>
                    <Button 
                        variant="contained" 
                        onClick={() => createTxMutation.mutate({ ...formData, amount: Number(formData.amount), departmentId })}
                        disabled={!formData.amount || !formData.description}
                    >
                        Submit Request
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
};
