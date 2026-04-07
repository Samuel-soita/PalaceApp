import React, { useState, useEffect } from 'react';
import { 
    Dialog, DialogTitle, DialogContent, DialogActions, 
    Button, TextField, Box, Typography, IconButton, CircularProgress
} from '@mui/material';
import { X, Globe } from 'lucide-react';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import api from '../../lib/api-client';

interface ThemeFormModalProps {
    open: boolean;
    onClose: () => void;
    onSuccess: (msg: string) => void;
    onError: (msg: string) => void;
}

export default function ThemeFormModal({ open, onClose, onSuccess, onError }: ThemeFormModalProps) {
    const queryClient = useQueryClient();
    const [themeOfYear, setThemeOfYear] = useState('');
    const [themeOfMonth, setThemeOfMonth] = useState('');

    const { data: settings } = useQuery(['ministrySettings'], async () => {
        const res = await api.get('/settings');
        return res.data;
    }, { enabled: open });

    useEffect(() => {
        if (settings) {
            setThemeOfYear(settings.themeOfYear || '');
            setThemeOfMonth(settings.themeOfMonth || '');
        }
    }, [settings]);

    const mutation = useMutation(async () => {
        return api.patch('/settings', { themeOfYear, themeOfMonth });
    }, {
        onSuccess: () => {
            queryClient.invalidateQueries(['ministrySettings']);
            onSuccess('Global Ministry Themes broadcasted successfully!');
            onClose();
        },
        onError: (err: any) => {
            onError(err.response?.data?.error || 'Failed to update themes.');
        }
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        mutation.mutate();
    };

    return (
        <Dialog 
            open={open} 
            onClose={onClose}
            maxWidth="sm"
            fullWidth
            PaperProps={{
                sx: {
                    background: 'var(--glass-base)',
                    backdropFilter: 'blur(30px)',
                    border: '1px solid var(--glass-border)',
                    boxShadow: '0 24px 48px rgba(0,0,0,0.5), 0 0 0 1px inset rgba(255,255,255,0.1)',
                    borderRadius: 0
                }
            }}
        >
            <Box sx={{ borderBottom: '1px solid var(--glass-border)', p: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Box display="flex" alignItems="center" gap={2}>
                    <Globe size={24} color="#ffcc00" />
                    <Box>
                        <Typography variant="h6" fontWeight="1000" sx={{ letterSpacing: -0.5, color: '#ffcc00' }}>
                            GLOBAL MINISTRY THEMES
                        </Typography>
                        <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600 }}>
                            Broadcast to all dashboards
                        </Typography>
                    </Box>
                </Box>
                <IconButton onClick={onClose} sx={{ color: 'text.secondary' }}>
                    <X size={20} />
                </IconButton>
            </Box>

            <form onSubmit={handleSubmit}>
                <DialogContent sx={{ p: 4 }}>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                        <TextField
                            label="Theme of the Year"
                            fullWidth
                            variant="filled"
                            value={themeOfYear}
                            onChange={(e) => setThemeOfYear(e.target.value)}
                            placeholder="e.g. YEAR OF DIVINE ESTABLISHMENT"
                            InputProps={{ sx: { borderRadius: 0 } }}
                        />
                        <TextField
                            label="Theme of the Month"
                            fullWidth
                            variant="filled"
                            value={themeOfMonth}
                            onChange={(e) => setThemeOfMonth(e.target.value)}
                            placeholder="e.g. MONTH OF NEW BEGINNINGS"
                            InputProps={{ sx: { borderRadius: 0 } }}
                        />
                        <Typography variant="caption" color="text.secondary">
                            These themes will be immediately displayed on the top action bar of every dashboard in the portal.
                        </Typography>
                    </Box>
                </DialogContent>
                <DialogActions sx={{ p: 3, borderTop: '1px solid var(--glass-border)' }}>
                    <Button onClick={onClose} color="inherit" sx={{ fontWeight: 800 }}>CANCEL</Button>
                    <Button 
                        type="submit" 
                        variant="contained" 
                        disabled={mutation.isLoading}
                        sx={{ bgcolor: '#ffcc00', color: 'black', fontWeight: 900, '&:hover': { bgcolor: '#e6b800' } }}
                    >
                        {mutation.isLoading ? <CircularProgress size={24} color="inherit" /> : 'BROADCAST THEMES'}
                    </Button>
                </DialogActions>
            </form>
        </Dialog>
    );
}
