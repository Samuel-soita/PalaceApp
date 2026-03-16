import React, { useState, useEffect } from 'react';
import {
    Dialog, DialogTitle, DialogContent, DialogActions, Box, TextField,
    MenuItem, Button, Typography, Checkbox
} from '@mui/material';
import { useQuery, useMutation } from '@tanstack/react-query';
import api from '../../lib/api-client';
import { useAuth } from '../../contexts/AuthContext';

interface AnnouncementFormModalProps {
    open: boolean;
    onClose: () => void;
    announcement?: any;
    onSuccess: () => void;
}

export default function AnnouncementFormModal({ open, onClose, announcement, onSuccess }: AnnouncementFormModalProps) {
    const { user } = useAuth();
    const [formData, setFormData] = useState({
        title: '',
        content: '',
        priority: 'NORMAL',
        isMajor: false,
        departmentId: user?.role === 'SUPER_ADMIN' ? '' : user?.departmentId || ''
    });

    useEffect(() => {
        if (announcement) {
            setFormData({
                title: announcement.title,
                content: announcement.content,
                priority: announcement.priority,
                isMajor: announcement.isMajor || false,
                departmentId: announcement.departmentId || ''
            });
        } else {
            setFormData({
                title: '',
                content: '',
                priority: 'NORMAL',
                isMajor: false,
                departmentId: user?.role === 'SUPER_ADMIN' ? '' : user?.departmentId || ''
            });
        }
    }, [announcement, open, user]);

    const { data: departments } = useQuery(['departments'], async () => {
        const res = await api.get('/departments');
        return res.data;
    }, { enabled: open && user?.role === 'SUPER_ADMIN' });

    const mutation = useMutation(
        (data: any) => announcement 
            ? api.put(`/announcements/${announcement.id}`, data) 
            : api.post('/announcements', data),
        {
            onSuccess: () => {
                onSuccess();
                onClose();
            }
        }
    );

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        mutation.mutate(formData);
    };

    return (
        <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm" PaperProps={{ sx: { borderRadius: 4 } }}>
            <form onSubmit={handleSubmit}>
                <DialogTitle sx={{ fontWeight: 900, px: 4, pt: 4 }}>
                    {announcement ? 'EDIT BROADCAST' : 'DEPLOY NEW BROADCAST'}
                </DialogTitle>
                <DialogContent sx={{ px: 4 }}>
                    <Box display="flex" flexDirection="column" gap={3} sx={{ mt: 2 }}>
                        <TextField
                            label="Broadcast Title"
                            fullWidth
                            required
                            value={formData.title}
                            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                        />
                        <TextField
                            label="Intelligence Content"
                            fullWidth
                            required
                            multiline
                            rows={4}
                            value={formData.content}
                            onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                        />
                        <TextField
                            select
                            label="Priority Level"
                            fullWidth
                            value={formData.priority}
                            onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                        >
                            <MenuItem value="NORMAL">NORMAL</MenuItem>
                            <MenuItem value="HIGH">CRITICAL</MenuItem>
                        </TextField>

                        <Box display="flex" alignItems="center" bgcolor="rgba(255,255,255,0.05)" p={2} borderRadius={2} border="1px dashed rgba(255,255,255,0.1)">
                            <Box flex={1}>
                                <Typography variant="subtitle2" fontWeight="bold">CHURCH-WIDE BROADCAST</Typography>
                                <Typography variant="caption" color="textSecondary">Broadcast this intelligence update to all sectors. Requires command approval.</Typography>
                            </Box>
                            <Checkbox 
                                checked={formData.isMajor} 
                                onChange={(e) => setFormData({ ...formData, isMajor: e.target.checked })}
                                sx={{ color: 'primary.main' }}
                            />
                        </Box>
                        {user?.role === 'SUPER_ADMIN' && (
                            <TextField
                                select
                                label="Target Sector"
                                fullWidth
                                value={formData.departmentId}
                                onChange={(e) => setFormData({ ...formData, departmentId: e.target.value })}
                            >
                                <MenuItem value="">GLOBAL COMMAND</MenuItem>
                                {departments?.map((dept: any) => (
                                    <MenuItem key={dept.id} value={dept.id}>{dept.name}</MenuItem>
                                ))}
                            </TextField>
                        )}
                    </Box>
                </DialogContent>
                <DialogActions sx={{ px: 4, pb: 4 }}>
                    <Button onClick={onClose} sx={{ fontWeight: 'bold' }}>ABORT</Button>
                    <Button type="submit" variant="contained" disabled={mutation.isLoading} sx={{ borderRadius: 2, fontWeight: 'bold' }}>
                        {announcement ? 'UPDATE' : 'BROADCAST'}
                    </Button>
                </DialogActions>
            </form>
        </Dialog>
    );
}
