import React, { useState } from 'react';
import {
    Dialog, DialogTitle, DialogContent, DialogActions, Box, TextField,
    Button, Typography
} from '@mui/material';
import { Sparkles } from 'lucide-react';
import { extractAffirmationFromContent } from '../../utils/affirmation-extract';
import { executeApiFirstMutation } from '../../lib/api-first-mutation';
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
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);

        const devotionDate = new Date();
        devotionDate.setHours(0, 0, 0, 0);
        const affirmationText = extractAffirmationFromContent(formData.content);
        const payload = {
            ...formData,
            date: devotionDate.toISOString(),
        };

        try {
            await executeApiFirstMutation({
                entity: 'DEVOTION',
                method: 'POST',
                url: '/devotions',
                payload,
                table: 'devotions',
                offlineOptimistic: async (localId) => {
                    await db.devotions.put({
                        id: localId,
                        title: formData.title,
                        content: formData.content,
                        themeOfMonth: formData.themeOfMonth,
                        themeOfYear: formData.themeOfYear,
                        date: devotionDate.toISOString(),
                        authorId: 'ME',
                        syncStatus: 'PENDING',
                        deviceId: localStorage.getItem('device_id') || 'UNKNOWN',
                        lastModifiedBy: 'ME',
                        version: 0,
                        createdAt: new Date().toISOString(),
                    });
                    await db.affirmations.put({
                        id: 'DAILY',
                        content: affirmationText,
                        date: devotionDate.toISOString(),
                        devotionId: localId,
                        syncStatus: 'PENDING',
                        createdAt: new Date().toISOString(),
                    });
                },
            });

            onSuccess();
            onClose();
            setFormData({
                title: '',
                content: '',
                themeOfMonth: defaultThemeOfMonth || '',
                themeOfYear: defaultThemeOfYear || '',
            });
        } catch (err: any) {
            console.error('[Devotion Publish Error]', err);
            alert(err.response?.data?.error || err.message || 'Failed to publish devotion.');
        } finally {
            setIsSubmitting(false);
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
                        disabled={isSubmitting} 
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
                        {isSubmitting ? 'PUBLISHING...' : 'PUBLISH GLOBALLY'}
                    </Button>
                </DialogActions>
            </form>
        </Dialog>
    );
}
