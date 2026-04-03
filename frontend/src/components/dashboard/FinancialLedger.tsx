import React, { useState } from 'react';
import { 
    Box, Typography, Grid, Card, CardContent, Button, TextField, 
    Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
    Dialog, DialogTitle, DialogContent, DialogActions, Stack, Chip,
    LinearProgress, Divider, Avatar, Badge
} from '@mui/material';
import { 
    Coins, ArrowUpRight, ArrowDownRight, Clock, CheckCircle2, 
    AlertCircle, Shield, Plus, Send, Landmark, History
} from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../lib/api-client';
import { useAuth } from '../../contexts/AuthContext';

interface FinancialLedgerProps {
    account: any;
    transactions: any[];
    departmentId?: string;
}

export default function FinancialLedger({ account, transactions, departmentId }: FinancialLedgerProps) {
    const { user } = useAuth();
    const queryClient = useQueryClient();
    const [incomeOpen, setIncomeOpen] = useState(false);
    const [withdrawOpen, setWithdrawOpen] = useState(false);
    const [amount, setAmount] = useState('');
    const [description, setDescription] = useState('');

    const isBishop = user?.role === 'SUPER_ADMIN';
    const isWatua = user?.role === 'WATUA';
    const isLeader = user?.role === 'DEPARTMENT_LEADER';

    const incomeMutation = useMutation(
        async (data: any) => api.post('/finance/income', data),
        {
            onSuccess: () => {
                queryClient.invalidateQueries(['dashboard-sync']);
                setIncomeOpen(false);
                setAmount('');
                setDescription('');
            }
        }
    );

    const withdrawMutation = useMutation(
        async (data: any) => api.post('/finance/withdraw', data),
        {
            onSuccess: () => {
                queryClient.invalidateQueries(['dashboard-sync']);
                setWithdrawOpen(false);
                setAmount('');
                setDescription('');
            }
        }
    );

    const approveMutation = useMutation(
        async (transactionId: string) => api.post(`/finance/${transactionId}/approve`),
        {
            onSuccess: () => queryClient.invalidateQueries(['dashboard-sync'])
        }
    );

    const getStatusChip = (status: string, approvals: any[]) => {
        const hasLeader = approvals.some(a => a.role === 'DEPARTMENT_LEADER');
        const hasBishop = approvals.some(a => a.role === 'SUPER_ADMIN');
        const hasWatua = approvals.some(a => a.role === 'WATUA');

        if (status === 'APPROVED') return <Chip label="FULLY APPROVED" size="small" sx={{ bgcolor: 'rgba(0,255,0,0.1)', color: '#00ff00', fontWeight: 900, borderRadius: 0 }} />;
        
        return (
            <Stack direction="row" spacing={0.5}>
                <Chip 
                    label="LDR" 
                    size="small" 
                    sx={{ 
                        bgcolor: hasLeader ? 'rgba(0,255,150,0.2)' : 'rgba(255,255,255,0.05)', 
                        color: hasLeader ? '#00ffaa' : 'rgba(255,255,255,0.3)',
                        fontWeight: 900, fontSize: '0.6rem', height: 18, borderRadius: 0
                    }} 
                />
                <Chip 
                    label="BSH" 
                    size="small" 
                    sx={{ 
                        bgcolor: hasBishop ? 'rgba(0,180,216,0.2)' : 'rgba(255,255,255,0.05)', 
                        color: hasBishop ? '#00b4d8' : 'rgba(255,255,255,0.3)',
                        fontWeight: 900, fontSize: '0.6rem', height: 18, borderRadius: 0
                    }} 
                />
                <Chip 
                    label="WTU" 
                    size="small" 
                    sx={{ 
                        bgcolor: hasWatua ? 'rgba(255,0,0,0.2)' : 'rgba(255,255,255,0.05)', 
                        color: hasWatua ? '#ff0000' : 'rgba(255,255,255,0.3)',
                        fontWeight: 900, fontSize: '0.6rem', height: 18, borderRadius: 0
                    }} 
                />
            </Stack>
        );
    };

    return (
        <Card className="holographic-card" sx={{ borderRadius: 0, border: '1px solid var(--glass-border)', background: 'linear-gradient(135deg, rgba(0,0,0,0.8), rgba(0,255,255,0.02))' }}>
            <CardContent sx={{ p: 2 }}>
                <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                    <Box display="flex" alignItems="center" gap={2}>
                        <Box sx={{ p: 1, bgcolor: 'rgba(0,255,255,0.1)', border: '1px solid var(--cyan)' }}>
                            <Landmark size={24} color="var(--cyan)" />
                        </Box>
                        <Box>
                            <Typography variant="h5" fontWeight="950" sx={{ letterSpacing: -1 }}>FINANCIAL COMMAND</Typography>
                            <Typography variant="caption" sx={{ color: 'var(--cyan)', fontWeight: 900, letterSpacing: 1 }}>TRIPARTITE SECURED LEDGER</Typography>
                        </Box>
                    </Box>
                    {(isLeader || isBishop || isWatua) && (
                        <Stack direction="row" spacing={1}>
                            <Button 
                                variant="outlined" 
                                size="small"
                                startIcon={<Plus size={14} />} 
                                onClick={() => setIncomeOpen(true)}
                                sx={{ borderColor: 'var(--cyan)', color: 'var(--cyan)', fontWeight: 900, borderRadius: 0, fontSize: '0.65rem' }}
                            > RECORD </Button>
                            <Button 
                                variant="contained" 
                                size="small"
                                startIcon={<Send size={14} />} 
                                onClick={() => setWithdrawOpen(true)}
                                sx={{ bgcolor: 'var(--cyan)', color: '#000', fontWeight: 950, borderRadius: 0, fontSize: '0.65rem', '&:hover': { bgcolor: '#fff' } }}
                            > REQUEST </Button>
                        </Stack>
                    )}
                </Box>

                <Grid container spacing={2} mb={3}>
                    <Grid item xs={12} md={4}>
                        <Box sx={{ p: 2, bgcolor: 'rgba(255,255,255,0.02)', borderLeft: '3px solid var(--cyan)' }}>
                            <Typography variant="caption" sx={{ opacity: 0.5, fontWeight: 800, fontSize: '0.65rem' }}>AVAILABLE MISSION FUNDS</Typography>
                            <Typography variant="h5" fontWeight="1000" sx={{ color: 'var(--cyan)', letterSpacing: -1 }}>
                                KES {account?.balance?.toLocaleString() || '0'}
                            </Typography>
                        </Box>
                    </Grid>
                    <Grid item xs={12} md={4}>
                        <Box sx={{ p: 2, bgcolor: 'rgba(255,255,255,0.02)', borderLeft: '3px solid #00ff00' }}>
                            <Typography variant="caption" sx={{ opacity: 0.5, fontWeight: 800, fontSize: '0.65rem' }}>TOTAL SECTOR INCOME</Typography>
                            <Typography variant="h6" fontWeight="950" sx={{ opacity: 0.8 }}>
                                KES {account?.totalIncome?.toLocaleString() || '0'}
                            </Typography>
                        </Box>
                    </Grid>
                    <Grid item xs={12} md={4}>
                        <Box sx={{ p: 2, bgcolor: 'rgba(255,255,255,0.02)', borderLeft: '3px solid #ff4f4f' }}>
                            <Typography variant="caption" sx={{ opacity: 0.5, fontWeight: 800, fontSize: '0.65rem' }}>TOTAL EXPENDITURE</Typography>
                            <Typography variant="h6" fontWeight="950" sx={{ opacity: 0.8 }}>
                                KES {account?.totalExpenditure?.toLocaleString() || '0'}
                            </Typography>
                        </Box>
                    </Grid>
                </Grid>

                <Box>
                    <Typography variant="caption" fontWeight="1000" sx={{ mb: 1, display: 'flex', alignItems: 'center', gap: 1, letterSpacing: 1, fontSize: '0.65rem' }}>
                        <History size={14} /> RECENT TRANSACTIONS (LAST 5)
                    </Typography>
                    <TableContainer sx={{ bgcolor: 'transparent' }}>
                        <Table size="small">
                            <TableHead>
                                <TableRow>
                                    <TableCell sx={{ borderBottom: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.5)', fontWeight: 900 }}>DATE</TableCell>
                                    <TableCell sx={{ borderBottom: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.5)', fontWeight: 900 }}>DESCRIPTION</TableCell>
                                    <TableCell sx={{ borderBottom: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.5)', fontWeight: 900 }}>AMOUNT</TableCell>
                                    <TableCell sx={{ borderBottom: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.5)', fontWeight: 900 }}>STATUS</TableCell>
                                    <TableCell align="right" sx={{ borderBottom: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.5)', fontWeight: 900 }}>ACTION</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {transactions?.slice(0, 5).map((tx) => {
                                    const canSign = (
                                        (isLeader && !tx.approvals.some((a: any) => a.role === 'DEPARTMENT_LEADER')) ||
                                        (isBishop && !tx.approvals.some((a: any) => a.role === 'SUPER_ADMIN')) ||
                                        (isWatua && !tx.approvals.some((a: any) => a.role === 'WATUA'))
                                    ) && tx.status !== 'APPROVED' && tx.type === 'WITHDRAWAL';

                                    return (
                                        <TableRow key={tx.id}>
                                            <TableCell sx={{ border: 'none', fontWeight: 700, opacity: 0.7 }}>
                                                {new Date(tx.createdAt).toLocaleDateString()}
                                            </TableCell>
                                            <TableCell sx={{ border: 'none', fontWeight: 900 }}>
                                                {tx.description?.toUpperCase()}
                                            </TableCell>
                                            <TableCell sx={{ border: 'none', fontWeight: 1000, color: tx.type === 'INCOME' ? '#00ff00' : '#ff4f4f' }}>
                                                {tx.type === 'INCOME' ? '+' : '-'} {tx.amount.toLocaleString()}
                                            </TableCell>
                                            <TableCell sx={{ border: 'none' }}>
                                                {getStatusChip(tx.status, tx.approvals)}
                                            </TableCell>
                                            <TableCell align="right" sx={{ border: 'none' }}>
                                                {canSign ? (
                                                    <Button 
                                                        size="small" 
                                                        variant="contained" 
                                                        onClick={() => {
                                                            if (!navigator.onLine) {
                                                                alert("NETWORK CRITICAL: Approvals cannot be cached locally. Please reconnect to sign missions.");
                                                                return;
                                                            }
                                                            approveMutation.mutate(tx.id);
                                                        }}
                                                        sx={{ bgcolor: 'var(--cyan)', color: '#000', fontWeight: 950, borderRadius: 0, fontSize: '0.6rem' }}
                                                    > SIGN MISSION </Button>
                                                ) : (
                                                    <CheckCircle2 size={16} color={tx.status === 'APPROVED' ? '#00ff00' : 'rgba(255,255,255,0.2)'} />
                                                )}
                                            </TableCell>
                                        </TableRow>
                                    );
                                })}
                            </TableBody>
                        </Table>
                    </TableContainer>
                </Box>
            </CardContent>

            {/* Income Dialog */}
            <Dialog open={incomeOpen} onClose={() => setIncomeOpen(false)} PaperProps={{ sx: { bgcolor: '#050505', border: '1px solid var(--cyan)', borderRadius: 0 } }}>
                <DialogTitle sx={{ fontWeight: 1000, letterSpacing: -1 }}>RECORD SECTOR INCOME</DialogTitle>
                <DialogContent>
                    <Stack spacing={3} sx={{ mt: 2 }}>
                        <TextField fullWidth label="AMOUNT (KES)" type="number" value={amount} onChange={e => setAmount(e.target.value)} InputProps={{ sx: { fontWeight: 900 } }} />
                        <TextField fullWidth label="SOURCE / DESCRIPTION" value={description} onChange={e => setDescription(e.target.value)} multiline rows={2} />
                    </Stack>
                </DialogContent>
                <DialogActions sx={{ p: 3 }}>
                    <Button onClick={() => setIncomeOpen(false)} sx={{ color: 'rgba(255,255,255,0.4)', fontWeight: 800 }}>CANCEL</Button>
                    <Button 
                        variant="contained" 
                        onClick={() => {
                            if (!navigator.onLine) {
                                alert("NETWORK CRITICAL: Financial mutations cannot be cached locally. Please reconnect to record income.");
                                return;
                            }
                            incomeMutation.mutate({ amount, description, departmentId: departmentId || user?.departmentId });
                        }}
                        sx={{ bgcolor: 'var(--cyan)', color: '#000', fontWeight: 950, borderRadius: 0 }}
                    > COMMUNE INCOME </Button>
                </DialogActions>
            </Dialog>

            {/* Withdraw Dialog */}
            <Dialog open={withdrawOpen} onClose={() => setWithdrawOpen(false)} PaperProps={{ sx: { bgcolor: '#050505', border: '1px solid #ff4f4f', borderRadius: 0 } }}>
                <DialogTitle sx={{ fontWeight: 1000, letterSpacing: -1, color: '#ff4f4f' }}>REQUEST FUND WITHDRAWAL</DialogTitle>
                <DialogContent>
                    <Stack spacing={3} sx={{ mt: 2 }}>
                        <TextField fullWidth label="AMOUNT REQUESTED (KES)" type="number" value={amount} onChange={e => setAmount(e.target.value)} />
                        <TextField fullWidth label="MISSION PURPOSE" value={description} onChange={e => setDescription(e.target.value)} multiline rows={2} />
                        <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.4)', fontStyle: 'italic' }}>
                            * This request will require signatures from Leader, Bishop, and Watua.
                        </Typography>
                    </Stack>
                </DialogContent>
                <DialogActions sx={{ p: 3 }}>
                    <Button onClick={() => setWithdrawOpen(false)} sx={{ color: 'rgba(255,255,255,0.4)', fontWeight: 800 }}>CANCEL</Button>
                    <Button 
                        variant="contained" 
                        onClick={() => {
                            if (!navigator.onLine) {
                                alert("NETWORK CRITICAL: Fund withdrawals cannot be cached locally. Please reconnect to request funds.");
                                return;
                            }
                            withdrawMutation.mutate({ amount, description, departmentId: departmentId || user?.departmentId });
                        }}
                        sx={{ bgcolor: '#ff4f4f', color: '#fff', fontWeight: 950, borderRadius: 0 }}
                    > SUBMIT REQUEST </Button>
                </DialogActions>
            </Dialog>
        </Card>
    );
}
