import React, { useState, useEffect } from 'react';
import {
    Dialog, DialogTitle, DialogContent, DialogActions, Box, TextField,
    MenuItem, Button, FormControl, InputLabel,
    Select, Checkbox, ListItemText, Typography, Chip
} from '@mui/material';
import { useQuery, useMutation } from '@tanstack/react-query';
import api from '../../lib/api-client';
import { useAuth } from '../../contexts/AuthContext';

interface PlanFormModalProps {
    open: boolean;
    onClose: () => void;
    plan?: any;
    onSuccess: () => void;
    defaultDepartmentId?: string;
}

export default function PlanFormModal({ open, onClose, plan, onSuccess, defaultDepartmentId }: PlanFormModalProps) {
    const { user } = useAuth();
    const [formData, setFormData] = useState({
        title: '',
        type: 'MONTHLY',
        description: '',
        isMajor: false,
        departmentId: defaultDepartmentId || user?.departmentId || '',
        pastorIds: [] as string[]
    });

    useEffect(() => {
        if (plan) {
            setFormData({
                title: plan.title,
                type: plan.type,
                description: plan.description,
                isMajor: plan.isMajor || false,
                departmentId: plan.departmentId,
                pastorIds: []
            });
        } else {
            setFormData({
                title: '',
                type: 'MONTHLY',
                description: '',
                isMajor: false,
                departmentId: defaultDepartmentId || user?.departmentId || '',
                pastorIds: []
            });
        }
    }, [plan, open, user, defaultDepartmentId]);

    const { data: pastors } = useQuery(['pastors'], async () => {
        const res = await api.get('/users?role=PASTOR');
        const userData = Array.isArray(res.data) ? res.data : (res.data?.data || []);
        return userData.filter((u: any) => u.role === 'PASTOR');
    }, { enabled: open && !plan });

    const mutation = useMutation(
        (data: any) => plan 
            ? api.patch(`/plans/${plan.id}`, data) 
            : api.post('/plans', data),
        {
            onSuccess: () => {
                onSuccess();
                onClose();
            }
        }
    );

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!plan && formData.pastorIds.length !== 2) {
            alert("Exactly 2 Pastors must authorize this Strategic Plan.");
            return;
        }
        mutation.mutate(formData);
    };

    return (
        <Dialog 
            open={open} 
            onClose={onClose} 
            maxWidth="sm" 
            fullWidth 
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
                <DialogTitle sx={{ fontWeight: '950', fontSize: '1.5rem', letterSpacing: -1 }}>
                    {plan ? 'EDIT STRATEGIC PLAN' : 'INITIATE STRATEGIC PLAN'}
                </DialogTitle>
                <DialogContent>
                    <Box display="flex" flexDirection="column" gap={3} mt={1}>
                        <TextField
                            label="Plan Title"
                            fullWidth
                            required
                            value={formData.title}
                            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                        />
                        <TextField
                            label="Plan Type"
                            select
                            fullWidth
                            value={formData.type}
                            onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                        >
                            <MenuItem value="MONTHLY">Monthly</MenuItem>
                            <MenuItem value="YEARLY">Yearly</MenuItem>
                        </TextField>
                        <TextField
                            label="Strategic Description"
                            multiline
                            rows={4}
                            fullWidth
                            required
                            value={formData.description}
                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        />
                        
                        <Box display="flex" alignItems="center" bgcolor="rgba(255,255,255,0.05)" p={2} borderRadius={2} border="1px dashed rgba(255,255,255,0.1)">
                            <Box flex={1}>
                                <Typography variant="subtitle2" fontWeight="bold">CHURCH-WIDE STRATEGY</Typography>
                                <Typography variant="caption" color="textSecondary">Mark this plan as a global objective for the "Prayer Palace" mission. Requires 3-sig authorization.</Typography>
                            </Box>
                            <Checkbox 
                                checked={formData.isMajor} 
                                onChange={(e) => setFormData({ ...formData, isMajor: e.target.checked })}
                                sx={{ color: 'primary.main' }}
                            />
                        </Box>
                        
                        {!plan && (
                            <FormControl fullWidth required>
                                <InputLabel id="plan-pastors-label" sx={{ fontWeight: 700 }}>CHOOSE 2 AUTHORIZING PASTORS</InputLabel>
                                <Select
                                    labelId="plan-pastors-label"
                                    id="plan-pastors-select"
                                    multiple
                                    label="CHOOSE 2 AUTHORIZING PASTORS"
                                    value={formData.pastorIds}
                                    sx={{ borderRadius: 0 }}
                                    onChange={(e) => {
                                        const val = e.target.value as string[];
                                        if (val.length <= 2) setFormData({ ...formData, pastorIds: val });
                                    }}
                                    renderValue={(sel) => (
                                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                                            {pastors?.filter((p: any) => sel.includes(p.id)).map((p: any) => (
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
                <DialogActions sx={{ p: 4, gap: 2 }}>
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
                        {plan ? 'SAVE CHANGES' : 'DEPLOY STRATEGY'}
                    </Button>
                </DialogActions>
            </form>
        </Dialog>
    );
}
