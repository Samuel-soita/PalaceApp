import React, { useState, useEffect } from 'react';
import {
    Dialog, DialogTitle, DialogContent, DialogActions, Box, TextField,
    MenuItem, Button, Typography, Checkbox, RadioGroup, FormControlLabel, Radio, FormControl, FormLabel,
    InputLabel, Select, Chip, ListItemText
} from '@mui/material';
import { useMutation } from '@tanstack/react-query';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../lib/db';
import api from '../../lib/api-client';
import { useAuth } from '../../contexts/AuthContext';
import { canBypassPastorAuthorization, canOverrideApproval, canSignApproval, isAwaitingApproval, pastorAuthorizationBlocked } from '../../utils/approval-rules';

interface AnnouncementFormModalProps {
    open: boolean;
    onClose: () => void;
    announcement?: any;
    onSuccess: () => void;
    defaultDepartmentId?: string;
}

export default function AnnouncementFormModal({ open, onClose, announcement, onSuccess, defaultDepartmentId }: AnnouncementFormModalProps) {
    const { user } = useAuth();
    const canPickDepartment = ['SUPER_ADMIN', 'SYSTEM_ADMIN', 'WATUA'].includes(user?.role || '');
    const ownDepartmentId = defaultDepartmentId || user?.departmentId || '';
    const departmentalAvailable = canPickDepartment || !!ownDepartmentId;
    const defaultAudience = departmentalAvailable ? 'DEPARTMENTAL' : 'CHURCH_WIDE';
    const needsPastors = !canBypassPastorAuthorization(user?.role);
    const [formData, setFormData] = useState({
        title: '',
        content: '',
        priority: 'NORMAL',
        isMajor: defaultAudience === 'CHURCH_WIDE',
        audience: defaultAudience, // 'DEPARTMENTAL' or 'CHURCH_WIDE'
        departmentId: ownDepartmentId,
        pastorIds: [] as string[]
    });

    const pastors = useLiveQuery(() => db.users.filter(u => ['PASTOR', 'ASSOCIATE_PASTOR'].includes(u.role) && u.status === 'ACTIVE').toArray(), []) || [];

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
                isMajor: defaultAudience === 'CHURCH_WIDE',
                audience: defaultAudience,
                departmentId: ownDepartmentId,
                pastorIds: []
            });
        }
    }, [announcement, open, user, defaultDepartmentId, defaultAudience, ownDepartmentId]);

    const departments = useLiveQuery(() => db.departments.toArray(), []) || [];

    const mutation = useMutation(
        (data: any) => announcement 
            ? api.put(`/announcements/${announcement.id}`, data) 
            : api.post('/announcements', data),
        {
            onSuccess: () => {
                onSuccess();
                onClose();
            },
            onError: (err: any) => alert(err.response?.data?.error || err.message || 'Failed to save broadcast.')
        }
    );

    const canSign = !!announcement && canSignApproval(announcement, user);
    const showApprovalActions = !!announcement && isAwaitingApproval(announcement.status) && (canSign || canOverrideApproval(user?.role));

    const approveMutation = useMutation(
        async (status: 'APPROVED' | 'REJECTED') => {
            if (status === 'APPROVED') {
                return canSign
                    ? await api.post(`/announcements/${announcement.id}/approve`)
                    : await api.put(`/announcements/${announcement.id}`, { status: 'PUBLISHED' });
            } else {
                return await api.put(`/announcements/${announcement.id}`, { status: 'REJECTED' });
            }
        },
        {
            onSuccess: () => {
                onSuccess();
                onClose();
            },
            onError: (err: any) => alert(err.response?.data?.error || err.message || 'Action failed.')
        }
    );

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!announcement && pastorAuthorizationBlocked(user?.role, formData.pastorIds)) {
            alert("You must select exactly 2 Pastors to authorize this Broadcast.");
            return;
        }
        if (formData.audience === 'DEPARTMENTAL' && !formData.departmentId) {
            alert('Please choose the department for this broadcast.');
            return;
        }
        if (formData.content.trim().length < 10) {
            alert('Broadcast content must be at least 10 characters.');
            return;
        }
        const { audience, pastorIds, departmentId, ...rest } = formData;
        mutation.mutate({
            ...rest,
            departmentId: departmentId || null,
            ...(announcement ? {} : { pastorIds }),
        });
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
                    {/* 👨‍⚖️ COMMAND APPROVAL OVERRIDE */}
                    {showApprovalActions && (
                        <Box sx={{ mb: 4, mt: 2, p: 3, bgcolor: 'rgba(255,165,0,0.1)', border: '1px solid orange', borderRadius: 0, textAlign: 'center' }}>
                            <Typography variant="subtitle2" fontWeight="950" color="orange" mb={1}>
                                ACTION REQUIRED: BROADCAST CLEARANCE
                            </Typography>
                            <Typography variant="caption" sx={{ display: 'block', mb: 2, opacity: 0.8 }}>
                                Review the intelligence parameters and grant authorization to broadcast.
                            </Typography>
                            <Box display="flex" gap={2} justifyContent="center">
                                <Button 
                                    variant="contained" 
                                    color="success" 
                                    size="small" 
                                    onClick={() => approveMutation.mutate('APPROVED')}
                                    disabled={approveMutation.isLoading}
                                    sx={{ fontWeight: 950, borderRadius: 0, px: 3 }}
                                >
                                    APPROVE BROADCAST
                                </Button>
                                <Button 
                                    variant="outlined" 
                                    color="error" 
                                    size="small" 
                                    onClick={() => { if(window.confirm('Reject broadcast?')) approveMutation.mutate('REJECTED'); }}
                                    disabled={approveMutation.isLoading}
                                    sx={{ fontWeight: 950, borderRadius: 0, px: 3 }}
                                >
                                    REJECT
                                </Button>
                            </Box>
                        </Box>
                    )}

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
                                        departmentId: aud === 'CHURCH_WIDE' ? '' : ownDepartmentId
                                    });
                                }}
                            >
                                <FormControlLabel disabled={!departmentalAvailable} value="DEPARTMENTAL" control={<Radio sx={{ color: 'var(--cyan)' }} />} label={<Typography variant="body2" fontWeight={700}>Internal (Department members)</Typography>} />
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

                        {canPickDepartment && formData.audience === 'DEPARTMENTAL' && (
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
                            <FormControl fullWidth required={needsPastors}>
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
