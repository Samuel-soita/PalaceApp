import React, { useState } from 'react';
import {
    Dialog, DialogTitle, DialogContent, DialogActions,
    Button, Box, Typography, CircularProgress, Alert,
    IconButton
} from '@mui/material';
import { Droplet, X, CheckCircle2 } from 'lucide-react';
import api from '../../lib/api-client';

export default function RequestBaptismModal({ open, onClose, onSuccess }: { open: boolean, onClose: () => void, onSuccess: () => void }) {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    const handleSubmit = async () => {
        setLoading(true);
        setError('');
        try {
            const res = await api.post('/workflows/baptism');
            setSuccess(res.data.message || 'Baptism request submitted successfully.');
            setTimeout(() => {
                onSuccess();
                onClose();
            }, 2000);
        } catch (err: any) {
            setError(err.response?.data?.error || 'Failed to submit baptism request.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog 
            open={open} 
            onClose={loading ? undefined : onClose}
            maxWidth="sm"
            fullWidth
            PaperProps={{
                sx: { 
                    bgcolor: 'rgba(16, 20, 32, 0.95)', 
                    backdropFilter: 'blur(20px)',
                    border: '1px solid var(--glass-border)'
                }
            }}
        >
            <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <Box display="flex" alignItems="center" gap={1.5}>
                    <Droplet size={24} color="var(--cyan)" />
                    <Typography variant="h6" fontWeight="800">Request Baptism</Typography>
                </Box>
                <IconButton onClick={onClose} disabled={loading} size="small" sx={{ color: 'text.secondary' }}>
                    <X size={20} />
                </IconButton>
            </DialogTitle>

            <DialogContent sx={{ p: 3, pt: 4 }}>
                {success ? (
                    <Box textAlign="center" py={4}>
                        <CheckCircle2 size={64} color="var(--success)" style={{ margin: '0 auto', marginBottom: 16 }} />
                        <Typography variant="h6" fontWeight="bold">Request Submitted</Typography>
                        <Typography color="textSecondary" variant="body2" mt={1}>
                            {success}
                        </Typography>
                    </Box>
                ) : (
                    <>
                        <Alert severity="info" sx={{ mb: 3 }}>
                            Submitting this request will notify your Department Pastor and begin the Baptism tracking workflow. 
                            You will be contacted regarding orientation and dates.
                        </Alert>
                        {error && <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError('')}>{error}</Alert>}
                        
                        <Typography variant="body2" color="textSecondary" align="center" mt={2}>
                            By proceeding, you verify your commitment to undergo the baptismal teachings and process.
                        </Typography>
                    </>
                )}
            </DialogContent>

            {!success && (
                <DialogActions sx={{ p: 2, borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                    <Button onClick={onClose} disabled={loading} color="inherit">Cancel</Button>
                    <Button 
                        onClick={handleSubmit} 
                        disabled={loading} 
                        variant="contained"
                        sx={{ bgcolor: 'var(--cyan)', '&:hover': { bgcolor: 'var(--cyan-hover)' }, color: 'black', fontWeight: 'bold' }}
                    >
                        {loading ? <CircularProgress size={24} color="inherit" /> : 'Confirm Request'}
                    </Button>
                </DialogActions>
            )}
        </Dialog>
    );
}
