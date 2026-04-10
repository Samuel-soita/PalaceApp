import React, { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../lib/api-client';
import { db } from '../lib/db';
import {
    Box, Typography, Card, CardContent, Grid, Button, Chip, Dialog, DialogTitle,
    DialogContent, DialogActions, TextField, Select, MenuItem, FormControl, InputLabel,
    Avatar, LinearProgress, IconButton, Tooltip
} from '@mui/material';
import { Coins, Upload, Image as ImageIcon, CheckCircle, Clock, AlertTriangle, X } from 'lucide-react';
import DashboardLayout from '../components/layout/DashboardLayout';
import { useAuth } from '../contexts/AuthContext';

interface SupportRequest {
    id: string;
    title: string;
    description: string;
    amountRequired: number;
    proofImageUrl: string;
    status: string;
    createdAt: string;
    event: { id: string; title: string; department: { name: string } };
    requester: { id: string; name: string };
}

export default function Support() {
    const { user } = useAuth();
    const queryClient = useQueryClient();
    const [createOpen, setCreateOpen] = useState(false);
    const [selectedImage, setSelectedImage] = useState<string | null>(null);
    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [form, setForm] = useState({ eventId: '', title: '', description: '' });

    const { data: requests } = useQuery(['support-requests'], async () => {
        const res = await api.get('/support');
        // Handle both raw arrays and paginated objects
        return Array.isArray(res.data) ? res.data : (res.data?.data || []);
    });

    const { data: events } = useQuery(['my-events'], async () => {
        const res = await api.get(user?.departmentId ? `/events/department/${user.departmentId}` : '/events');
        // Handle both raw arrays and paginated objects
        return Array.isArray(res.data) ? res.data : (res.data?.data || []);
    });

    const createMutation = useMutation(
        async (data: any) => {
            const localId = crypto.randomUUID();
            const timestamp = Date.now();

            // 🚀 Tactical Support Entry
            await db.supportRequests.put({
                id: localId,
                title: data.title,
                description: data.description,
                eventId: data.eventId,
                amountRequired: 1500, // Policy mandatory
                proofImageUrl: data.proofImageUrl,
                status: 'OPEN',
                syncStatus: 'PENDING',
                deviceId: localStorage.getItem('device_id') || 'UNKNOWN',
                lastModifiedBy: 'ME',
                version: 0,
                createdAt: new Date().toISOString()
            });

            // 📡 Queue for Global Backing
            await db.syncQueue.put({
                id: crypto.randomUUID(),
                timestamp,
                entity: 'SUPPORT_REQUEST',
                method: 'POST',
                url: '/support',
                payload: { ...data, localId },
                status: 'PENDING',
                retryCount: 0,
                errorLog: []
            });

            return { data: { _queued: true } };
        },
        {
            onSuccess: () => {
                queryClient.invalidateQueries(['support-requests']);
                setCreateOpen(false);
                setForm({ eventId: '', title: '', description: '' });
                setSelectedImage(null);
                setImagePreview(null);
            }
        }
    );

    const fundMutation = useMutation(
        async (id: string) => {
            const timestamp = Date.now();
            
            // 🚀 Tactical Funding Mark
            await db.supportRequests.update(id, { 
                status: 'FUNDED',
                syncStatus: 'PENDING'
            });

            // 📡 Queue for Global Sync
            await db.syncQueue.put({
                id: crypto.randomUUID(),
                timestamp,
                entity: 'SUPPORT_REQUEST',
                method: 'PATCH',
                url: `/support/${id}/fund`,
                payload: {},
                status: 'PENDING',
                retryCount: 0,
                errorLog: []
            });

            return { data: { _queued: true } };
        },
        { onSuccess: () => queryClient.invalidateQueries(['support-requests']) }
    );

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onloadend = () => {
            const base64 = reader.result as string;
            setSelectedImage(base64);
            setImagePreview(base64);
        };
        reader.readAsDataURL(file);
    };

    const handleSubmit = () => {
        if (!selectedImage) return alert('You must upload proof of support (screenshot).');
        createMutation.mutate({ ...form, proofImageUrl: selectedImage });
    };

    const statusColor = (s: string) => s === 'FUNDED' ? 'success' : s === 'CLOSED' ? 'default' : 'warning';
    const statusIcon = (s: string) => s === 'FUNDED' ? <CheckCircle size={14} /> : s === 'CLOSED' ? <X size={14} /> : <Clock size={14} />;

    return (
        <DashboardLayout>
            <Box sx={{ mb: 8 }}>
                <Box display="flex" justifyContent="space-between" alignItems="flex-end" mb={8}>
                    <div>
                        <Typography variant="h2" fontWeight="950" className="glow-text" sx={{ letterSpacing: -4, mb: 1, fontSize: { xs: '2.5rem', md: '4rem' }, lineHeight: 1 }}>
                            SUPPORT <span className="text-primary/70">HUB</span>
                        </Typography>
                        <Typography color="textSecondary" variant="h6" sx={{ fontWeight: 500, opacity: 0.6 }}>
                            Every event requires 1,500/- mandatory support with verified proof.
                        </Typography>
                    </div>
                    {(user?.role === 'DEPARTMENT_LEADER' || user?.role === 'SUPER_ADMIN') && (
                        <Button
                            variant="contained"
                            sx={{ borderRadius: 0, fontWeight: 900, py: 2, px: 4, boxShadow: '0 0 20px var(--primary-glow)' }}
                            startIcon={<Coins size={18} />}
                            onClick={() => setCreateOpen(true)}
                        >
                            REQUEST SUPPORT
                        </Button>
                    )}
                </Box>

                {/* Request Cards */}
                <Grid container spacing={3}>
                    {(Array.isArray(requests) ? requests : []).map((req: SupportRequest) => (
                        <Grid item xs={12} md={6} lg={4} key={req.id}>
                            <Card className="holographic-card" sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                                <CardContent sx={{ p: 3, flex: 1 }}>
                                    <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={2}>
                                        <Box>
                                            <Typography variant="h6" fontWeight={900} sx={{ lineHeight: 1.2, mb: 0.5 }}>{req.title}</Typography>
                                            <Typography variant="caption" sx={{ opacity: 0.6 }}>{req.event?.department?.name} › {req.event?.title}</Typography>
                                        </Box>
                                        <Chip
                                            icon={statusIcon(req.status)}
                                            label={req.status}
                                            size="small"
                                            color={statusColor(req.status) as any}
                                            sx={{ borderRadius: 0, fontWeight: 'bold', fontSize: '0.6rem' }}
                                        />
                                    </Box>
                                    <Typography variant="body2" sx={{ opacity: 0.7, mb: 3, minHeight: 48 }}>{req.description}</Typography>

                                    {/* Proof Image */}
                                    {req.proofImageUrl && (
                                        <Box sx={{ mb: 2, border: '1px solid var(--glass-border)', borderRadius: 0, overflow: 'hidden', maxHeight: 160 }}>
                                            <img src={req.proofImageUrl} alt="Proof" style={{ width: '100%', objectFit: 'cover', maxHeight: 160 }} />
                                        </Box>
                                    )}

                                    <Box display="flex" alignItems="center" justifyContent="space-between" mt="auto">
                                        <Box>
                                            <Typography variant="caption" sx={{ opacity: 0.5, display: 'block' }}>Required</Typography>
                                            <Typography variant="h6" fontWeight={900} color="primary">KES {req.amountRequired.toLocaleString()}/-</Typography>
                                        </Box>
                                        <Box display="flex" alignItems="center" gap={1}>
                                            <Avatar sx={{ width: 28, height: 28, bgcolor: 'primary.dark', fontSize: '0.7rem', fontWeight: 'bold' }}>
                                                {req.requester?.name?.charAt(0)}
                                            </Avatar>
                                            <Typography variant="caption" sx={{ opacity: 0.7 }}>{req.requester?.name}</Typography>
                                        </Box>
                                    </Box>
                                </CardContent>

                                {req.status === 'OPEN' && user?.role === 'DEPARTMENT_LEADER' && user.id !== req.requester?.id && (
                                    <Box sx={{ p: 2, borderTop: '1px solid var(--glass-border)' }}>
                                        <Button
                                            fullWidth
                                            variant="outlined"
                                            color="success"
                                            size="small"
                                            sx={{ borderRadius: 0, fontWeight: 'bold' }}
                                            startIcon={<CheckCircle size={14} />}
                                            onClick={() => fundMutation.mutate(req.id)}
                                            disabled={fundMutation.isLoading}
                                        >
                                            SUPPORT THIS EVENT
                                        </Button>
                                    </Box>
                                )}
                            </Card>
                        </Grid>
                    ))}
                    {!requests?.length && (
                        <Grid item xs={12}>
                            <Box sx={{ p: 8, textAlign: 'center', border: '1px dashed var(--glass-border)', opacity: 0.5 }}>
                                <Coins size={48} style={{ margin: '0 auto 16px', opacity: 0.3 }} />
                                <Typography>No support requests filed. Events needing backing will appear here.</Typography>
                            </Box>
                        </Grid>
                    )}
                </Grid>
            </Box>

            {/* Create Support Request Dialog */}
            <Dialog open={createOpen} onClose={() => setCreateOpen(false)} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 0, bgcolor: 'background.paper', border: '1px solid var(--glass-border)' } }}>
                <DialogTitle sx={{ fontWeight: 900, letterSpacing: 1 }}>
                    <Box display="flex" alignItems="center" gap={2}>
                        <Coins size={20} />
                        REQUEST EVENT SUPPORT
                    </Box>
                </DialogTitle>
                <DialogContent sx={{ pt: 2 }}>
                    <Box display="flex" flexDirection="column" gap={3} mt={1}>
                        <Box sx={{ p: 2, bgcolor: 'rgba(255, 152, 0, 0.05)', border: '1px solid rgba(255,152,0,0.3)' }}>
                            <Typography variant="caption" sx={{ display: 'flex', alignItems: 'center', gap: 1, color: 'warning.main', fontWeight: 'bold' }}>
                                <AlertTriangle size={14} />
                                MANDATORY: 1,500/- minimum. Screenshot proof REQUIRED.
                            </Typography>
                        </Box>

                        <FormControl fullWidth>
                            <InputLabel>Select Event</InputLabel>
                            <Select value={form.eventId} onChange={e => setForm({ ...form, eventId: e.target.value })} label="Select Event" sx={{ borderRadius: 0 }}>
                                {(Array.isArray(events) ? events : []).map((ev: any) => (
                                    <MenuItem key={ev.id} value={ev.id}>{ev.title}</MenuItem>
                                ))}
                            </Select>
                        </FormControl>

                        <TextField label="Request Title" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} fullWidth sx={{ '& .MuiOutlinedInput-root': { borderRadius: 0 } }} />
                        <TextField label="Description" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} multiline rows={3} fullWidth sx={{ '& .MuiOutlinedInput-root': { borderRadius: 0 } }} />

                        {/* Image Upload */}
                        <Box>
                            <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageUpload} style={{ display: 'none' }} />
                            <Button
                                variant="outlined"
                                fullWidth
                                startIcon={<Upload size={16} />}
                                onClick={() => fileInputRef.current?.click()}
                                sx={{ borderRadius: 0, py: 2, fontWeight: 'bold', borderColor: selectedImage ? 'success.main' : 'var(--glass-border)', color: selectedImage ? 'success.main' : 'inherit' }}
                            >
                                {selectedImage ? '✓ PROOF UPLOADED' : 'UPLOAD SCREENSHOT PROOF *'}
                            </Button>
                            {imagePreview && (
                                <Box sx={{ mt: 2, border: '1px solid var(--glass-border)', overflow: 'hidden' }}>
                                    <img src={imagePreview} alt="Preview" style={{ width: '100%', maxHeight: 200, objectFit: 'cover' }} />
                                </Box>
                            )}
                        </Box>
                    </Box>
                </DialogContent>
                <DialogActions sx={{ gap: 2, p: 3 }}>
                    <Button onClick={() => setCreateOpen(false)} sx={{ borderRadius: 0 }}>Cancel</Button>
                    <Button
                        variant="contained"
                        onClick={handleSubmit}
                        disabled={createMutation.isLoading || !form.eventId || !form.title}
                        sx={{ borderRadius: 0, fontWeight: 'bold' }}
                    >
                        {createMutation.isLoading ? 'Submitting...' : 'SUBMIT REQUEST'}
                    </Button>
                </DialogActions>
            </Dialog>
        </DashboardLayout>
    );
}
