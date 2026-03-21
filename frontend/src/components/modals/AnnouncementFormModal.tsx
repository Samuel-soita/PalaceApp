import React, { useState, useEffect } from 'react';
import {
    Dialog, DialogTitle, DialogContent, DialogActions, Box, TextField,
    MenuItem, Button, Typography, Checkbox, RadioGroup, FormControlLabel, Radio, FormControl, FormLabel,
    InputLabel, Select, Chip, ListItemText
} from '@mui/material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Shield, Users, CheckCircle } from 'lucide-react';
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
        audience: 'DEPARTMENTAL', // 'DEPARTMENTAL' or 'CHURCH_WIDE'
        departmentId: user?.departmentId || '',
        pastorIds: [] as string[]
    });

    const { data: pastors } = useQuery(['pastors'], async () => {
        const res = await api.get('/users?role=PASTOR');
        const userData = Array.isArray(res.data) ? res.data : (res.data?.data || []);
        return userData.filter((u: any) => u.role === 'PASTOR');
    }, { enabled: open && !announcement });

    useEffect(() => {
        if (announcement) {
            setFormData({
                title: announcement.title,
                content: announcement.content,
                priority: announcement.priority,
                isMajor: announcement.isMajor || false,
                audience: announcement.isMajor ? 'CHURCH_WIDE' : 'DEPARTMENTAL',
                departmentId: announcement.departmentId || '',
                pastorIds: []
            });
        } else {
            setFormData({
                title: '',
                content: '',
                priority: 'NORMAL',
                isMajor: false,
                audience: 'DEPARTMENTAL',
                departmentId: user?.departmentId || '',
                pastorIds: []
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
        if (!announcement && formData.pastorIds.length !== 2) {
            alert("You must select exactly 2 Pastors to authorize this Broadcast.");
            return;
        }
        mutation.mutate(formData);
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
                    border: '1px solid var(--glass-border)',
                    bgcolor: 'background.paper'
                } 
            }}
        >
            <form onSubmit={handleSubmit}>
                <DialogTitle sx={{ fontWeight: 950, px: 4, pt: 4, letterSpacing: -1 }}>
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
                        <FormControl component="fieldset">
                            <FormLabel component="legend" sx={{ fontWeight: 700, mb: 1, fontSize: '0.75rem', letterSpacing: 1, color: 'primary.main' }}>
                                TARGET AUDIENCE
                            </FormLabel>
                            <RadioGroup
                                row
                                value={formData.audience}
                                onChange={(e) => {
                                    const aud = e.target.value;
                                    setFormData({ 
                                        ...formData, 
                                        audience: aud,
                                        isMajor: aud === 'CHURCH_WIDE',
                                        departmentId: aud === 'CHURCH_WIDE' ? '' : (user?.departmentId || '')
                                    });
                                }}
                            >
                                <FormControlLabel value="DEPARTMENTAL" control={<Radio sx={{ color: 'var(--cyan)' }} />} label={<Typography variant="body2" fontWeight={700}>Internal (Department members)</Typography>} />
                                <FormControlLabel value="CHURCH_WIDE" control={<Radio sx={{ color: 'var(--cyan)' }} />} label={<Typography variant="body2" fontWeight={700}>Church-Wide</Typography>} />
                            </RadioGroup>
                        </FormControl>

                        <TextField
                            select
                            label="Priority Level"
                            fullWidth
                            value={formData.priority}
                            onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                            sx={{ '& .MuiOutlinedInput-root': { borderRadius: 0 } }}
                        >
                            <MenuItem value="NORMAL">NORMAL</MenuItem>
                            <MenuItem value="HIGH">CRITICAL</MenuItem>
                        </TextField>

                        {formData.audience === 'CHURCH_WIDE' && (
                            <Box display="flex" alignItems="center" bgcolor="rgba(79,139,255,0.05)" p={2} borderRadius={0} border="1px dashed var(--primary-glow)">
                                <Box flex={1}>
                                    <Typography variant="subtitle2" fontWeight="bold">GLOBAL COMMAND CLEARANCE</Typography>
                                    <Typography variant="caption" color="textSecondary">This broadcast will be routed to all sectors. Requires Executive approval.</Typography>
                                </Box>
                                <Checkbox 
                                    checked={formData.isMajor} 
                                    inputProps={{ readOnly: true }}
                                    sx={{ color: 'primary.main' }}
                                />
                            </Box>
                        )}

                        {user?.role === 'SUPER_ADMIN' && formData.audience === 'DEPARTMENTAL' && (
                            <TextField
                                select
                                label="Target Sector"
                                fullWidth
                                value={formData.departmentId}
                                sx={{ '& .MuiOutlinedInput-root': { borderRadius: 0 } }}
                                onChange={(e) => setFormData({ ...formData, departmentId: e.target.value })}
                            >
                                {departments?.map((dept: any) => (
                                    <MenuItem key={dept.id} value={dept.id}>{dept.name}</MenuItem>
                                ))}
                            </TextField>
                        )}

                        {!announcement && (
                            <FormControl fullWidth required>
                                <InputLabel id="ann-pastors-label" sx={{ fontWeight: 700 }}>CHOOSE 2 AUTHORIZING PASTORS</InputLabel>
                                <Select
                                    labelId="ann-pastors-label"
                                    id="ann-pastors-select"
                                    multiple
                                    label="CHOOSE 2 AUTHORIZING PASTORS"
                                    value={formData.pastorIds}
                                    sx={{ borderRadius: 0 }}
                                    onChange={(e) => {
                                        const values = e.target.value as string[];
                                        if (values.length <= 2) setFormData({ ...formData, pastorIds: values });
                                    }}
                                    renderValue={(sel: any) => (
                                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                                            {pastors?.filter((p: any) => (sel as string[]).includes(p.id)).map((p: any) => (
                                                <Chip 
                                                    key={p.id} 
                                                    label={p.name} 
                                                    size="small" 
                                                    sx={{ borderRadius: 0, fontWeight: 900, bgcolor: 'rgba(79, 139, 255, 0.2)', border: '1px solid var(--primary-glow)' }} 
                                                />
                                            ))}
                                        </Box>
                                    )}
                                >
                                    {pastors?.length === 0 && <MenuItem disabled>No Pastors found</MenuItem>}
                                    {pastors?.map((p: any) => (
                                        <MenuItem key={p.id} value={p.id} sx={{ py: 1.5 }}>
                                            <Checkbox checked={formData.pastorIds.includes(p.id)} sx={{ color: 'var(--cyan)' }} />
                                            <ListItemText primary={p.name} primaryTypographyProps={{ fontWeight: 700 }} />
                                        </MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                        )}
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
                            boxShadow: '0 0 20px var(--primary-glow)' 
                        }}
                    >
                        {announcement ? 'UPDATE BROADCAST' : 'DEPLOY BROADCAST'}
                    </Button>
                </DialogActions>
            </form>
        </Dialog>
    );
}
