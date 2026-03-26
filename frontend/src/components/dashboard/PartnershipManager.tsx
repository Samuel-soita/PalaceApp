import React, { useState } from 'react';
import { 
    Modal, Fade, Box, Typography, Card, CardContent, Grid, 
    Avatar, Chip, IconButton, Button, Stack, Divider, 
    TextField, InputAdornment, LinearProgress, MenuItem, Alert
} from '@mui/material';
import { XCircle, Star, TrendingUp, DollarSign, Search, CheckCircle, RefreshCcw } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../lib/api-client';

interface PartnershipManagerProps {
    open: boolean;
    onClose: () => void;
}

export default function PartnershipManager({ open, onClose }: PartnershipManagerProps) {
    const queryClient = useQueryClient();
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedPartner, setSelectedPartner] = useState<any>(null);
    const [paymentAmount, setPaymentAmount] = useState<string>('');
    const [paymentMethod, setPaymentMethod] = useState<string>('MPESA');
    const [referenceCode, setReferenceCode] = useState<string>('');
    const [errorMsg, setErrorMsg] = useState<string>('');

    const { data: partnerships = [], isLoading } = useQuery(['all-partnerships'], async () => {
        const res = await api.get('/partnerships/all');
        return res.data;
    }, { enabled: open });

    const addLedgerMutation = useMutation(
        async ({ id, amount, paymentMethod, referenceCode }: any) => 
            api.post(`/partnerships/${id}/ledger`, { amount, paymentMethod, referenceCode }),
        {
            onSuccess: () => {
                queryClient.invalidateQueries(['all-partnerships']);
                queryClient.invalidateQueries(['dashboard-sync']);
                setSelectedPartner(null);
                setPaymentAmount('');
                setReferenceCode('');
                setErrorMsg('');
            },
            onError: (err: any) => {
                setErrorMsg(err.response?.data?.error || 'Failed to reconcile ledger.');
            }
        }
    );

    const filteredPartners = partnerships.filter((p: any) => 
        p.user?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.user?.membershipNumber.includes(searchTerm)
    );

    return (
        <Modal
            open={open}
            onClose={onClose}
            BackdropProps={{ sx: { backdropFilter: 'blur(10px)', bgcolor: 'rgba(0,0,0,0.85)' } }}
        >
            <Fade in={open}>
                <Box sx={{
                    position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
                    width: { xs: '95%', md: 800 },
                    maxHeight: '90vh',
                    bgcolor: '#0a0a0a', border: '1px solid orange',
                    p: 0, outline: 'none', boxShadow: '0 0 80px rgba(255, 165, 0, 0.2)',
                    display: 'flex', flexDirection: 'column', overflow: 'hidden'
                }}>
                    {/* Header */}
                    <Box sx={{ p: 3, borderBottom: '1px solid rgba(255,165,0,0.2)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Box display="flex" alignItems="center" gap={2}>
                            <Star size={24} color="orange" />
                            <Box>
                                <Typography variant="h5" fontWeight="1000" sx={{ letterSpacing: -1 }}>PARTNERSHIP COMMAND</Typography>
                                <Typography variant="caption" sx={{ color: 'orange', fontWeight: 900 }}>COVENANT SEED TABULATION & TRACKING</Typography>
                            </Box>
                        </Box>
                        <IconButton onClick={onClose} sx={{ color: 'rgba(255,255,255,0.5)' }}><XCircle /></IconButton>
                    </Box>

                    {/* Search & Stats */}
                    <Box sx={{ p: 3, bgcolor: 'rgba(255,165,0,0.03)' }}>
                        <Grid container spacing={2}>
                            <Grid item xs={12} md={8}>
                                <TextField
                                    fullWidth
                                    size="small"
                                    placeholder="Search by mission name or number..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    InputProps={{
                                        startAdornment: (
                                            <InputAdornment position="start">
                                                <Search size={18} color="orange" />
                                            </InputAdornment>
                                        ),
                                        sx: { bgcolor: 'rgba(255,255,255,0.02)', borderRadius: 2, fontWeight: 700 }
                                    }}
                                />
                            </Grid>
                            <Grid item xs={4} md={2}>
                                <Card sx={{ bgcolor: 'rgba(255,255,255,0.02)', border: '1px solid var(--glass-border)', textAlign: 'center', py: 1 }}>
                                    <Typography variant="caption" sx={{ opacity: 0.5 }}>TOTAL</Typography>
                                    <Typography variant="subtitle2" fontWeight={1000}>{partnerships.length}</Typography>
                                </Card>
                            </Grid>
                            <Grid item xs={4} md={2}>
                                <IconButton sx={{ bgcolor: 'rgba(255,255,255,0.05)' }} onClick={() => queryClient.invalidateQueries(['all-partnerships'])}>
                                    <RefreshCcw size={18} />
                                </IconButton>
                            </Grid>
                        </Grid>
                    </Box>

                    {/* Partner List */}
                    <Box sx={{ p: 3, flexGrow: 1, overflowY: 'auto' }}>
                        {isLoading ? <LinearProgress color="warning" /> : (
                            <Stack spacing={2}>
                                {filteredPartners.map((p: any) => (
                                    <Card key={p.id} sx={{ 
                                        bgcolor: 'rgba(255,255,255,0.02)', 
                                        border: '1px solid var(--glass-border)',
                                        borderLeft: p.balance <= 0 ? '4px solid #4caf50' : '4px solid orange'
                                    }}>
                                        <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                                            <Grid container spacing={2} alignItems="center">
                                                <Grid item xs={12} sm={4}>
                                                    <Box display="flex" alignItems="center" gap={1.5}>
                                                        <Avatar sx={{ bgcolor: 'orange' }}>{p.user?.name.charAt(0)}</Avatar>
                                                        <Box>
                                                            <Typography variant="subtitle2" fontWeight={950}>{p.user?.name}</Typography>
                                                            <Typography variant="caption" sx={{ opacity: 0.5, fontWeight: 700 }}>{p.user?.membershipNumber}</Typography>
                                                        </Box>
                                                    </Box>
                                                </Grid>
                                                <Grid item xs={4} sm={2}>
                                                    <Typography variant="caption" sx={{ opacity: 0.5 }}>COMMITMENT</Typography>
                                                    <Typography variant="subtitle2" fontWeight={1000}>{p.amount} KES</Typography>
                                                </Grid>
                                                <Grid item xs={4} sm={2}>
                                                    <Typography variant="caption" sx={{ opacity: 0.5 }}>PAID</Typography>
                                                    <Typography variant="subtitle2" fontWeight={1000} color="success.main">{p.paidAmount} KES</Typography>
                                                </Grid>
                                                <Grid item xs={4} sm={2}>
                                                    <Typography variant="caption" sx={{ opacity: 0.5 }}>BALANCE</Typography>
                                                    <Typography variant="subtitle2" fontWeight={1000} color="error.main">{p.balance} KES</Typography>
                                                </Grid>
                                                <Grid item xs={12} sm={2} textAlign="right">
                                                    <Button 
                                                        size="small" 
                                                        variant="contained" 
                                                        onClick={() => {
                                                            setSelectedPartner(p);
                                                            setPaymentAmount('');
                                                            setErrorMsg('');
                                                        }}
                                                        sx={{ bgcolor: 'orange', color: '#000', fontWeight: 1000, '&:hover': { bgcolor: '#ffb347' } }}
                                                    >
                                                        RECONCILE
                                                    </Button>
                                                </Grid>
                                            </Grid>
                                        </CardContent>
                                    </Card>
                                ))}
                            </Stack>
                        )}
                    </Box>

                    {/* Reconcile Dialog */}
                    {selectedPartner && (
                        <Box sx={{ 
                            position: 'absolute', inset: 0, bgcolor: 'rgba(0,0,0,0.95)', 
                            zIndex: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', p: 4 
                        }}>
                            <Card sx={{ maxWidth: 450, width: '100%', bgcolor: '#111', border: '1px solid orange' }}>
                                <CardContent sx={{ p: 4 }}>
                                    <Box display="flex" justifyContent="space-between" mb={3}>
                                        <Typography variant="h6" fontWeight={1000}>RECONCILE SEED</Typography>
                                        <IconButton onClick={() => setSelectedPartner(null)} sx={{ color: 'text.secondary' }}><XCircle /></IconButton>
                                    </Box>
                                    <Typography variant="body2" sx={{ mb: 4, opacity: 0.7 }}>
                                        Updating manual ledger for <b>{selectedPartner.user?.name}</b>. <br/>
                                        Outstanding Balance: <b>{selectedPartner.balance} KES</b> <br/>
                                        Payment to: <b>0741502198</b>
                                    </Typography>

                                    <Stack spacing={2.5}>
                                        {errorMsg && <Alert severity="error">{errorMsg}</Alert>}
                                        <TextField
                                            fullWidth label="AMOUNT RECEIVED (KES)" type="number"
                                            value={paymentAmount} onChange={(e) => setPaymentAmount(e.target.value)}
                                            InputProps={{ sx: { fontWeight: 900 } }}
                                        />
                                        <TextField
                                            select fullWidth label="PAYMENT METHOD"
                                            value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}
                                        >
                                            <MenuItem value="MPESA">MPESA (MANUAL)</MenuItem>
                                            <MenuItem value="CASH">CASH</MenuItem>
                                            <MenuItem value="BANK">BANK TRANSFER</MenuItem>
                                        </TextField>
                                        <TextField
                                            fullWidth label="REFERENCE / RECEIPT NUMBER"
                                            value={referenceCode} onChange={(e) => setReferenceCode(e.target.value)}
                                            InputProps={{ sx: { fontWeight: 900, textTransform: 'uppercase' } }}
                                        />
                                        <Button 
                                            fullWidth variant="contained"
                                            disabled={!paymentAmount || !referenceCode || addLedgerMutation.isLoading}
                                            onClick={() => addLedgerMutation.mutate({ id: selectedPartner.id, amount: Number(paymentAmount), paymentMethod, referenceCode: referenceCode.toUpperCase() })}
                                            sx={{ bgcolor: 'orange', color: '#000', fontWeight: 1000, py: 1.5, '&:hover': { bgcolor: '#ffb347' } }}
                                        >
                                            {addLedgerMutation.isLoading ? 'PROCESSING...' : 'CONFIRM RECONCILIATION'}
                                        </Button>
                                    </Stack>
                                </CardContent>
                            </Card>
                        </Box>
                    )}
                </Box>
            </Fade>
        </Modal>
    );
}
