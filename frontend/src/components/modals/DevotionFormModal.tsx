import React, { useState } from 'react';
import {
    Dialog, DialogTitle, DialogContent, DialogActions, Box, TextField,
    Button, Typography
} from '@mui/material';
import { useMutation } from '@tanstack/react-query';
import { Sparkles } from 'lucide-react';
import api from '../../lib/api-client';
import { db } from '../../lib/db';

interface DevotionFormModalProps {
    open: boolean;
    onClose: () => void;
    onSuccess: () => void;
    defaultThemeOfMonth?: string;
    defaultThemeOfYear?: string;
}

export default function DevotionFormModal({ open, onClose, onSuccess, defaultThemeOfMonth, defaultThemeOfYear }: DevotionFormModalProps) {
    const [formData, setFormData] = useState({
        title: '',
        content: '',
        themeOfMonth: defaultThemeOfMonth || '',
        themeOfYear: defaultThemeOfYear || ''
    });

    const mutation = useMutation(
        (data: any) => api.post('/devotions', data),
        {
            onSuccess: () => {
                onSuccess();
                onClose();
                setFormData({
                    title: '',
                    content: '',
                    themeOfMonth: defaultThemeOfMonth || '',
                    themeOfYear: defaultThemeOfYear || ''
                });
            }
        }
    );

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        const localId = crypto.randomUUID();
        const timestamp = Date.now();

        try {
            // 🚀 Tactical Offline Broadcast
            await db.devotions.put({
                id: localId,
                title: formData.title,
                content: formData.content,
                themeOfMonth: formData.themeOfMonth,
                themeOfYear: formData.themeOfYear,
                date: new Date().toISOString(),
                authorId: 'ME', // Sync engine handles actual ID
                syncStatus: 'PENDING',
                deviceId: localStorage.getItem('device_id') || 'UNKNOWN',
                lastModifiedBy: 'ME',
                version: 0,
                createdAt: new Date().toISOString()
            });

            // 📡 Queue for Global Deployment
            await db.syncQueue.put({
                id: crypto.randomUUID(),
                timestamp,
                entity: 'DEVOTION',
                method: 'POST',
                url: '/devotions',
                payload: {
                    ...formData,
                    date: new Date().toISOString(),
                    localId
                },
                status: 'PENDING',
                retryCount: 0,
                errorLog: []
            });

            onSuccess();
            onClose();
            setFormData({
                title: '',
                content: '',
                themeOfMonth: defaultThemeOfMonth || '',
                themeOfYear: defaultThemeOfYear || ''
            });

        } catch (err) {
            console.error('[Offline Devotion Error]', err);
            alert('Failed to queue devotion locally.');
        }
    };

    return (
        <Dialog 
            open={open} 
            onClose={onClose} 
            fullWidth 
            maxWidth="sm" 
            PaperProps={{ 
                className: "holographic-card",
                sx: { 
                    borderRadius: 0,
                    border: '1px solid var(--cyan)',
                    bgcolor: 'background.paper',
                    boxShadow: '0 0 40px rgba(0, 255, 255, 0.2)'
                } 
            }}
        >
            <form onSubmit={handleSubmit}>
                <DialogTitle sx={{ fontWeight: 950, px: 4, pt: 4, letterSpacing: -1, display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Sparkles size={24} color="var(--cyan)" />
                    PUBLISH DAILY DEVOTION
                </DialogTitle>
                <DialogContent sx={{ px: 4 }}>
                    <Box display="flex" flexDirection="column" gap={3} sx={{ mt: 2 }}>
                        <Typography variant="caption" sx={{ opacity: 0.7, lineHeight: 1.5, display: 'block' }}>
                            The content you share here will be broadcasted to all member portals and pastoral dashboards. An affirmation will be automatically extracted from your message.
                        </Typography>

                        <TextField
                            label="Devotion Title"
                            fullWidth
                            required
                            value={formData.title}
                            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                            sx={{ '& .MuiOutlinedInput-root': { borderRadius: 0 } }}
                        />
                        <TextField
                            label="Spiritual Message"
                            fullWidth
                            required
                            multiline
                            rows={6}
                            value={formData.content}
                            onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                            sx={{ '& .MuiOutlinedInput-root': { borderRadius: 0 } }}
                        />
                        
                        <Box display="flex" gap={2}>
                            <TextField
                                label="Theme of the Month"
                                fullWidth
                                value={formData.themeOfMonth}
                                onChange={(e) => setFormData({ ...formData, themeOfMonth: e.target.value })}
                                sx={{ '& .MuiOutlinedInput-root': { borderRadius: 0 } }}
                            />
                            <TextField
                                label="Theme of the Year"
                                fullWidth
                                value={formData.themeOfYear}
                                onChange={(e) => setFormData({ ...formData, themeOfYear: e.target.value })}
                                sx={{ '& .MuiOutlinedInput-root': { borderRadius: 0 } }}
                            />
                        </Box>
                    </Box>
                </DialogContent>
                <DialogActions sx={{ px: 4, pb: 4, gap: 2 }}>
                    <Button onClick={onClose} sx={{ fontWeight: 900, color: 'text.secondary' }}>ABORT</Button>
                    <Button 
                        type="submit" 
                        variant="contained" 
                        disabled={mutation.isLoading} 
                        sx={{ 
                            borderRadius: 0, 
                            fontWeight: 900, 
                            px: 4, 
                            py: 1.5,
                            bgcolor: 'var(--cyan)',
                            color: '#000',
                            boxShadow: '0 0 20px rgba(0, 255, 255, 0.4)',
                            '&:hover': { bgcolor: '#00e5e5' }
                        }}
                    >
                        {mutation.isLoading ? 'PUBLISHING...' : 'PUBLISH GLOBALLY'}
                    </Button>
                </DialogActions>
            </form>
        </Dialog>
    );
}
