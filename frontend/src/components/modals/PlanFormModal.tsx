import React, { useState, useEffect } from 'react';
import {
    Dialog, DialogTitle, DialogContent, DialogActions, Box, TextField,
    MenuItem, Button, FormControl, InputLabel,
    Select, Checkbox, ListItemText, Typography, Chip
} from '@mui/material';
import { useMutation } from '@tanstack/react-query';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../lib/db';
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
        content: '',
        isMajor: false,
        departmentId: defaultDepartmentId || user?.departmentId || '',
        pastorIds: [] as string[],
        budgetNeeded: 0,
        budgetSource: 'DEPARTMENT',
        status: 'PLANNED'
    });

    useEffect(() => {
        if (plan) {
            setFormData({
                title: plan.title,
                type: plan.type,
                content: plan.content || plan.description || '',
                isMajor: plan.isMajor || false,
                departmentId: plan.departmentId,
                pastorIds: [],
                budgetNeeded: plan.budgetNeeded || 0,
                budgetSource: plan.budgetSource || 'DEPARTMENT',
                status: plan.status || 'PLANNED'
            });
        } else {
            setFormData({
                title: '',
                type: 'MONTHLY',
                content: '',
                isMajor: false,
                departmentId: defaultDepartmentId || user?.departmentId || '',
                pastorIds: [],
                budgetNeeded: 0,
                budgetSource: 'DEPARTMENT',
                status: 'PLANNED'
            });
        }
    }, [plan, open, user, defaultDepartmentId]);

    const pastors = useLiveQuery(() => db.users.filter(u => ['PASTOR', 'ASSOCIATE_PASTOR', 'BISHOP', 'SUPER_ADMIN'].includes(u.role) && u.status === 'ACTIVE').toArray(), []) || [];

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

    const approveMutation = useMutation(
        async (status: 'APPROVED' | 'REJECTED') => {
            if (status === 'APPROVED') {
                return await api.post(`/plans/${plan.id}/approve`);
            } else {
                return await api.patch(`/plans/${plan.id}/status`, { approvalStatus: 'REJECTED' });
            }
        },
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
        if (!formData.departmentId) {
            alert("Please select a Department for this Plan.");
            return;
        }
        const { pastorIds, ...restFormData } = formData;
        const submitPayload = plan ? restFormData : formData;
        mutation.mutate(submitPayload);
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
                    {plan ? (plan.status === 'APPROVED' ? 'VIEW STRATEGY (LOCKED)' : 'EDIT STRATEGIC PLAN') : 'INITIATE STRATEGIC PLAN'}
                </DialogTitle>
                <DialogContent>
                    {/* 👨‍⚖️ COMMAND APPROVAL OVERRIDE */}
                    {plan && plan.approvalStatus !== 'APPROVED' && (plan.targetPastorId === user?.id || ['WATUA', 'BISHOP'].includes(user?.role || '')) && (
                        <Box sx={{ mb: 4, p: 3, bgcolor: 'rgba(255,165,0,0.1)', border: '1px solid orange', borderRadius: 0, textAlign: 'center' }}>
                            <Typography variant="subtitle2" fontWeight="950" color="orange" mb={1}>
                                ACTION REQUIRED: PLAN CLEARANCE
                            </Typography>
                            <Typography variant="caption" sx={{ display: 'block', mb: 2, opacity: 0.8 }}>
                                Review the strategic parameters and grant authorization to proceed.
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
                                    APPROVE PLAN
                                </Button>
                                <Button 
                                    variant="outlined" 
                                    color="error" 
                                    size="small" 
                                    onClick={() => { if(window.confirm('Reject plan?')) approveMutation.mutate('REJECTED'); }}
                                    disabled={approveMutation.isLoading}
                                    sx={{ fontWeight: 950, borderRadius: 0, px: 3 }}
                                >
                                    REJECT
                                </Button>
                            </Box>
                        </Box>
                    )}

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
                            label="Strategic Content"
                            multiline
                            rows={4}
                            fullWidth
                            required
                            value={formData.content}
                            onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                        />
                        
                        <Box display="flex" gap={2}>
                            <TextField
                                label="Budget (KES)"
                                type="number"
                                fullWidth
                                value={formData.budgetNeeded}
                                onChange={(e) => setFormData({ ...formData, budgetNeeded: Number(e.target.value) })}
                            />
                            <TextField
                                label="Budget Source"
                                select
                                fullWidth
                                value={formData.budgetSource}
                                onChange={(e) => setFormData({ ...formData, budgetSource: e.target.value })}
                            >
                                <MenuItem value="DEPARTMENT">Department Funds</MenuItem>
                                <MenuItem value="CHURCH">Church Central Funds</MenuItem>
                            </TextField>
                        </Box>

                        {formData.budgetSource === 'DEPARTMENT' && (
                            <Box sx={{ p: 1.5, bgcolor: 'rgba(255,152,0,0.05)', border: '1px solid rgba(255,152,0,0.2)', borderRadius: 1 }}>
                                <Typography variant="caption" fontWeight="800" color="warning.main">
                                    NOTE: Department funded operations require a minimum balance of 1,500 KES.
                                </Typography>
                            </Box>
                        )}

                        <Box display="flex" alignItems="center" bgcolor="rgba(255,255,255,0.05)" p={2} borderRadius={2} border="1px dashed rgba(255,255,255,0.1)">
                            <Box flex={1}>
                                <Typography variant="subtitle2" fontWeight="bold">CHURCH-WIDE STRATEGY</Typography>
                                <Typography variant="caption" color="textSecondary">Mark this plan as a global objective for the &quot;Prayer Palace&quot; mission. Requires 3-sig authorization.</Typography>
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
                        disabled={mutation.isLoading || (plan?.status === 'APPROVED' && user?.role === 'DEPARTMENT_LEADER')} 
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
                    {plan?.status === 'APPROVED' && user?.role === 'DEPARTMENT_LEADER' && (
                        <Typography variant="caption" color="error" fontWeight="950" sx={{ mt: 1, display: 'block', textAlign: 'center', width: '100%' }}>
                            MISSION CLEARED BY COMMAND. EDITING RESTRICTED.
                        </Typography>
                    )}
                </DialogActions>
            </form>
        </Dialog>
    );
}
