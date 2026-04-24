import React, { useState, useEffect } from 'react';
import {
    Dialog, DialogTitle, DialogContent, DialogActions, Box, TextField,
    MenuItem, Button, FormControl, InputLabel,
    Select, Checkbox, ListItemText, Typography, Chip
} from '@mui/material';
import { useMutation } from '@tanstack/react-query';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../lib/db';
import { CheckCircle, Target, Zap } from 'lucide-react';
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
    const [isSuccess, setIsSuccess] = useState(false);
    const [formData, setFormData] = useState({
        title: '',
        type: 'MONTHLY',
        content: '',
        isMajor: false,
        departmentId: defaultDepartmentId || user?.departmentId || '',
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
                budgetNeeded: 0,
                budgetSource: 'DEPARTMENT',
                status: 'PLANNED'
            });
        }
        setIsSuccess(false);
    }, [plan, open, user, defaultDepartmentId]);

    const mutation = useMutation(
        (data: any) => plan 
            ? api.patch(`/plans/${plan.id}`, data) 
            : api.post('/plans', data),
        {
            onSuccess: () => {
                setIsSuccess(true);
                setTimeout(() => {
                    onSuccess();
                    onClose();
                }, 2000);
            }
        }
    );

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.departmentId) {
            alert("Please select a Department for this Plan.");
            return;
        }
        mutation.mutate(formData);
    };

    if (isSuccess) {
        return (
            <Dialog open={open} onClose={onClose} PaperProps={{ className: "holographic-card", sx: { borderRadius: 0, border: '1px solid var(--cyan)', bgcolor: 'background.paper', p: 4 } }}>
                <Box sx={{ textAlign: 'center', py: 4 }}>
                    <Box sx={{ display: 'inline-flex', p: 2, borderRadius: '50%', bgcolor: 'rgba(0, 255, 255, 0.1)', mb: 2 }}>
                        <CheckCircle size={48} color="var(--cyan)" />
                    </Box>
                    <Typography variant="h5" fontWeight="950" sx={{ letterSpacing: -1, mb: 1 }}>
                        STRATEGY DEPLOYED
                    </Typography>
                    <Typography variant="body2" sx={{ opacity: 0.8, maxWidth: 300, mx: 'auto' }}>
                        The strategic plan has been successfully synchronized and is now active across the ministry.
                    </Typography>
                </Box>
            </Dialog>
        );
    }

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
                <DialogTitle sx={{ fontWeight: '950', fontSize: '1.5rem', letterSpacing: -1, display: 'flex', alignItems: 'center', gap: 1.5 }}>
                    <Target size={24} color="var(--cyan)" />
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
                                <Typography variant="caption" color="textSecondary">Mark this plan as a global objective. Will be visible church-wide immediately.</Typography>
                            </Box>
                            <Checkbox 
                                checked={formData.isMajor} 
                                onChange={(e) => setFormData({ ...formData, isMajor: e.target.checked })}
                                sx={{ color: 'primary.main' }}
                            />
                        </Box>
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
