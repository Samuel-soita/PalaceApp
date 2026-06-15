import React, { useState, useEffect } from 'react';
import { 
    Modal, Fade, Box, Typography, Card, CardContent, Grid, 
    Avatar, Chip, IconButton, Button, Stack, Divider, 
    TextField, InputAdornment, LinearProgress, MenuItem, Alert
} from '@mui/material';
import { XCircle, Star, TrendingUp, DollarSign, Search, CheckCircle, RefreshCcw, Pencil, Edit3 } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useLiveQuery } from 'dexie-react-hooks';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../lib/api-client';
import { db } from '../../lib/db';
import { requestSyncSoon } from '../../lib/pwa-sync';

interface PartnershipManagerProps {
    open: boolean;
    onClose: () => void;
}

export default function PartnershipManager({ open, onClose }: PartnershipManagerProps) {
    const queryClient = useQueryClient();
    const { user } = useAuth();
    const canReconcileLedger = ['SUPER_ADMIN', 'SYSTEM_ADMIN', 'SECRETARY', 'WATUA'].includes(user?.role || '')
        || ((user?.role === 'PASTOR' || user?.role === 'ASSOCIATE_PASTOR') && user?.canManagePartnerships);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedPartner, setSelectedPartner] = useState<any>(null);
    const [paymentAmount, setPaymentAmount] = useState<string>('');
    const [paymentMethod, setPaymentMethod] = useState<string>('MPESA');
    const [referenceCode, setReferenceCode] = useState<string>('');
    const [errorMsg, setErrorMsg] = useState<string>('');
    const [editingPartner, setEditingPartner] = useState<any>(null);
    const [newCommitmentAmount, setNewCommitmentAmount] = useState<string>('');

    // --- MISSION: OFFLINE-FIRST PARTNERSHIP DATA ---
    const partnerships = useLiveQuery(() => db.partnerships.toArray(), []) || [];
    const isLoading = false;

    useEffect(() => {
        if (!open || !navigator.onLine) return;
        api.get('/partnerships/all')
            .then((res) => {
                const rows = Array.isArray(res.data) ? res.data : [];
                if (rows.length) {
                    db.partnerships.bulkPut(rows.map((p: any) => ({ ...p, syncStatus: 'SYNCED' })));
                }
            })
            .catch(() => undefined);
    }, [open]);

    const refreshPartnerships = async () => {
        if (!navigator.onLine) return;
        try {
            const res = await api.get('/partnerships/all');
            const rows = Array.isArray(res.data) ? res.data : [];
            if (rows.length) {
                await db.partnerships.bulkPut(rows.map((p: any) => ({ ...p, syncStatus: 'SYNCED' })));
            }
            queryClient.invalidateQueries(['dashboard-sync']);
            requestSyncSoon();
        } catch {
            setErrorMsg('Failed to refresh partnership records.');
        }
    };

    const upsertPartnership = async (partnership: any) => {
        if (!partnership?.id) return;
        await db.partnerships.put({ ...partnership, syncStatus: 'SYNCED' });
    };

    const addLedgerMutation = useMutation(
        async ({ id, amount, paymentMethod, referenceCode }: any) => {
            if (!canReconcileLedger) {
                throw new Error('You are not authorized to reconcile partnership ledgers.');
            }

            if (navigator.onLine) {
                const res = await api.post(`/partnerships/${id}/ledger`, {
                    amount,
                    paymentMethod,
                    referenceCode,
                });
                if (res.data.partnership) await upsertPartnership(res.data.partnership);
                if (res.data.ledger) {
                    await db.partnershipLedgers.put({ ...res.data.ledger, syncStatus: 'SYNCED' });
                }
                requestSyncSoon();
                return res;
            }

            // Offline fallback only
            const localId = crypto.randomUUID();
            const timestamp = Date.now();

            // 🚀 Tactical Financial Save
            await db.partnershipLedgers.put({
                id: localId,
                transactionType: 'RECONCILIATION',
                partnershipId: id,
                amount,
                paymentMethod,
                referenceCode,
                status: 'PENDING',
                date: new Date().toISOString(),
                syncStatus: 'PENDING',
                deviceId: localStorage.getItem('device_id') || 'UNKNOWN',
                lastModifiedBy: 'ME',
                version: 0,
                createdAt: new Date().toISOString()
            });

            // 💰 Optimistic Parent Update
            const p = await db.partnerships.get(id);
            if (p) {
                const newPaid = (p.paidAmount || 0) + Number(amount);
                const newBalance = Math.max(0, (p.amount || 0) - newPaid);
                await db.partnerships.update(id, {
                    paidAmount: newPaid,
                    balance: newBalance,
                    status: newBalance === 0 ? 'COMPLETED' : 'ACTIVE',
                    lastPaymentDate: new Date().toISOString()
                });
            }

            // 📡 Queue for Global Reconciliation
            await db.syncQueue.put({
                id: crypto.randomUUID(),
                timestamp,
                entity: 'PARTNERSHIP_LEDGER',
                method: 'POST',
                url: `/partnerships/${id}/ledger`,
                payload: { amount, paymentMethod, referenceCode, localId },
                status: 'PENDING',
                retryCount: 0,
                errorLog: []
            });

            return { data: { _queued: true } };
        },
        {
            onSuccess: () => {
                queryClient.invalidateQueries(['dashboard-sync']);
                setSelectedPartner(null);
                setPaymentAmount('');
                setReferenceCode('');
                setErrorMsg('');
            },
            onError: (err: any) => {
                setErrorMsg(err.message || 'Failed to reconcile ledger locally.');
            }
        }
    );

    const updatePartnershipMutation = useMutation(
        async ({ id, amount }: { id: string, amount: number }) => {
            if (navigator.onLine) {
                const res = await api.patch(`/partnerships/${id}`, { amount: Number(amount) });
                if (res.data.partnership) await upsertPartnership(res.data.partnership);
                requestSyncSoon();
                return res;
            }

            // Offline fallback only
            const timestamp = Date.now();

            // 🚀 Tactical Offline Update
            const p = await db.partnerships.get(id);
            if (p) {
                const newBalance = Math.max(0, Number(amount) - (p.paidAmount || 0));
                await db.partnerships.update(id, {
                    amount: Number(amount),
                    balance: newBalance,
                    status: newBalance === 0 ? 'COMPLETED' : 'ACTIVE'
                });
            }

            // 📡 Queue for Global Update
            await db.syncQueue.put({
                id: crypto.randomUUID(),
                timestamp,
                entity: 'PARTNERSHIP',
                method: 'PATCH',
                url: `/partnerships/${id}`,
                payload: { amount: Number(amount) },
                status: 'PENDING',
                retryCount: 0,
                errorLog: []
            });

            return { data: { _queued: true } };
        },
        {
            onSuccess: () => {
                queryClient.invalidateQueries(['dashboard-sync']);
                setEditingPartner(null);
                setNewCommitmentAmount('');
                setErrorMsg('');
            },
            onError: (err: any) => {
                setErrorMsg(err.message || 'Failed to update commitment offline.');
            }
        }
    );

    const filteredPartners = partnerships.filter((p: any) => 
        (p.user?.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (p.user?.membershipNumber || '').includes(searchTerm)
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
                            <Grid item xs={6} sm={4} md={2}>
                                <Card sx={{ bgcolor: 'rgba(255,255,255,0.02)', border: '1px solid var(--glass-border)', textAlign: 'center', py: 1 }}>
                                    <Typography variant="caption" sx={{ opacity: 0.5 }}>TOTAL</Typography>
                                    <Typography variant="subtitle2" fontWeight={1000}>{partnerships.length}</Typography>
                                </Card>
                            </Grid>
                            <Grid item xs={6} sm={4} md={2}>
                                <Box display="flex" justifyContent={{ xs: 'flex-end', md: 'center' }} alignItems="center" height="100%">
                                    <IconButton sx={{ bgcolor: 'rgba(255,255,255,0.05)', minWidth: 44, minHeight: 44 }} onClick={refreshPartnerships}>
                                        <RefreshCcw size={18} />
                                    </IconButton>
                                </Box>
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
                                                        <Avatar sx={{ bgcolor: 'orange' }}>{(p.user?.name || 'P').charAt(0)}</Avatar>
                                                        <Box>
                                                            <Typography variant="subtitle2" fontWeight={950}>{p.user?.name || 'Unknown Partner'}</Typography>
                                                            <Typography variant="caption" sx={{ opacity: 0.5, fontWeight: 700 }}>{p.user?.membershipNumber || 'N/A'}</Typography>
                                                        </Box>
                                                    </Box>
                                                </Grid>
                                                <Grid item xs={6} sm={2}>
                                                    <Box display="flex" alignItems="center" gap={1}>
                                                        <Box>
                                                            <Typography variant="caption" sx={{ opacity: 0.5 }}>COMMITMENT</Typography>
                                                            <Typography variant="subtitle2" fontWeight={1000}>{p.amount} KES</Typography>
                                                        </Box>
                                                        <IconButton 
                                                            size="small" 
                                                            onClick={() => {
                                                                setEditingPartner(p);
                                                                setNewCommitmentAmount(p.amount.toString());
                                                                setErrorMsg('');
                                                            }}
                                                            sx={{ color: 'orange', opacity: 0.6, minWidth: 44, minHeight: 44, '&:hover': { opacity: 1 } }}
                                                        >
                                                            <Pencil size={14} />
                                                        </IconButton>
                                                    </Box>
                                                </Grid>
                                                <Grid item xs={6} sm={2}>
                                                    <Typography variant="caption" sx={{ opacity: 0.5 }}>PAID</Typography>
                                                    <Typography variant="subtitle2" fontWeight={1000} color="success.main">{p.paidAmount} KES</Typography>
                                                </Grid>
                                                <Grid item xs={6} sm={2}>
                                                    <Typography variant="caption" sx={{ opacity: 0.5 }}>BALANCE</Typography>
                                                    <Typography variant="subtitle2" fontWeight={1000} color="error.main">{p.balance} KES</Typography>
                                                </Grid>
                                                <Grid item xs={12} sm={2} textAlign="right">
                                                    {canReconcileLedger ? (
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
                                                    ) : (
                                                        <Chip label="VIEW ONLY" size="small" sx={{ opacity: 0.6 }} />
                                                    )}
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
                                    <Typography variant="body2" sx={{ mb: 2, opacity: 0.7 }}>
                                        Updating manual ledger for <b>{selectedPartner.user?.name || 'Unknown Partner'}</b>. <br/>
                                        Outstanding Balance: <b>{selectedPartner.balance} KES</b> <br/>
                                        Payment to: <b>0741502198</b>
                                    </Typography>

                                    <Typography variant="caption" sx={{ display: 'block', mb: 3, p: 1.5, bgcolor: 'rgba(76, 175, 80, 0.1)', borderLeft: '3px solid #4caf50', color: '#4caf50', fontWeight: 900, borderRadius: 1 }}>
                                        &quot;Your seed is a tactical investment in the Kingdom. Thank you for your unwavering faithfulness!&quot;
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
                                            <MenuItem value="BANK_TRANSFER">BANK TRANSFER</MenuItem>
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

                    {/* Edit Commitment Dialog */}
                    {editingPartner && (
                        <Box sx={{ 
                            position: 'absolute', inset: 0, bgcolor: 'rgba(0,0,0,0.95)', 
                            zIndex: 11, display: 'flex', alignItems: 'center', justifyContent: 'center', p: 4 
                        }}>
                            <Card sx={{ maxWidth: 400, width: '100%', bgcolor: '#111', border: '1px solid orange' }}>
                                <CardContent sx={{ p: 4 }}>
                                    <Box display="flex" justifyContent="space-between" mb={3}>
                                        <Typography variant="h6" fontWeight={1000}>EDIT COMMITMENT</Typography>
                                        <IconButton onClick={() => setEditingPartner(null)} sx={{ color: 'text.secondary' }}><XCircle /></IconButton>
                                    </Box>
                                    <Typography variant="body2" sx={{ mb: 4, opacity: 0.7 }}>
                                        Adjusting partnership commitment for <b>{editingPartner.user?.name || 'Unknown Partner'}</b>. <br/>
                                        Current Paid: <b>{editingPartner.paidAmount} KES</b>
                                    </Typography>

                                    <Stack spacing={2.5}>
                                        {errorMsg && <Alert severity="error">{errorMsg}</Alert>}
                                        <TextField
                                            fullWidth 
                                            label="NEW MONTHLY AMOUNT (KES)" 
                                            type="number"
                                            value={newCommitmentAmount} 
                                            onChange={(e) => setNewCommitmentAmount(e.target.value)}
                                            InputProps={{ sx: { fontWeight: 900 } }}
                                            helperText="Commitment should be at least 700 KES as per ministry standards."
                                        />
                                        <Button 
                                            fullWidth variant="contained"
                                            disabled={!newCommitmentAmount || Number(newCommitmentAmount) < 700 || updatePartnershipMutation.isLoading}
                                            onClick={() => updatePartnershipMutation.mutate({ id: editingPartner.id, amount: Number(newCommitmentAmount) })}
                                            sx={{ bgcolor: 'orange', color: '#000', fontWeight: 1000, py: 1.5, '&:hover': { bgcolor: '#ffb347' } }}
                                        >
                                            {updatePartnershipMutation.isLoading ? 'UPDATING...' : 'UPDATE COMMITMENT'}
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
