import React, { useState, useEffect } from 'react';
import {
    Dialog, DialogTitle, DialogContent, DialogActions, Box, TextField,
    MenuItem, Typography, Button, LinearProgress, FormControl, InputLabel,
    Select, Checkbox, ListItemText, Chip
} from '@mui/material';
import { useMutation } from '@tanstack/react-query';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../lib/db';
import { CheckCircle, Briefcase, Zap } from 'lucide-react';
import api from '../../lib/api-client';
import { useAuth } from '../../contexts/AuthContext';

interface ProjectFormModalProps {
    open: boolean;
    onClose: () => void;
    project?: any;
    onSuccess: () => void;
    defaultDepartmentId?: string;
}

export default function ProjectFormModal({ open, onClose, project, onSuccess, defaultDepartmentId }: ProjectFormModalProps) {
    const { user } = useAuth();
    const [isSuccess, setIsSuccess] = useState(false);
    const [formData, setFormData] = useState({
        title: '',
        description: '',
        status: 'PLANNED',
        progress: 0,
        budget: 0,
        isMajor: false,
        departmentId: defaultDepartmentId || user?.departmentId || '',
        category: 'GENERAL' as 'INFRASTRUCTURE' | 'OUTREACH' | 'TECH' | 'YOUTH' | 'GENERAL',
        deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        budgetSource: 'DEPARTMENT'
    });

    useEffect(() => {
        if (project) {
            setFormData({
                title: project.title,
                description: project.description,
                status: project.status,
                progress: project.progress,
                budget: project.budget,
                isMajor: project.isMajor || false,
                departmentId: project.departmentId,
                category: project.category || 'GENERAL',
                deadline: project.deadline || new Date().toISOString(),
                budgetSource: project.budgetSource || 'DEPARTMENT'
            });
        } else {
            setFormData({
                title: '',
                description: '',
                status: 'PLANNED',
                progress: 0,
                budget: 0,
                isMajor: false,
                departmentId: defaultDepartmentId || user?.departmentId || '',
                category: 'GENERAL',
                deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
                budgetSource: 'DEPARTMENT'
            });
        }
        setIsSuccess(false);
    }, [project, open, user, defaultDepartmentId]);

    const departments = useLiveQuery(() => db.departments.toArray(), []) || [];

    const mutation = useMutation(
        (data: any) => project 
            ? api.patch(`/projects/${project.id}`, data) 
            : api.post('/projects', data),
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
            alert("Please select a Department for this Project.");
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
                        PROJECT DEPLOYED
                    </Typography>
                    <Typography variant="body2" sx={{ opacity: 0.8, maxWidth: 300, mx: 'auto' }}>
                        The strategic project has been initiated and is now visible to all authorized personnel.
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
                    <Briefcase size={24} color="var(--cyan)" />
                    {project ? 'UPDATE PROJECT' : 'INITIATE PROJECT'}
                </DialogTitle>
                <DialogContent>
                    <Box display="flex" flexDirection="column" gap={3} mt={1}>
                        <TextField
                            label="Project Title"
                            fullWidth
                            required
                            value={formData.title}
                            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                        />
                        <TextField
                            label="Description"
                            multiline
                            rows={3}
                            fullWidth
                            required
                            value={formData.description}
                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        />
                        
                        <Box display="flex" gap={2}>
                            <TextField
                                label="Budget (KES)"
                                type="number"
                                fullWidth
                                required
                                value={formData.budget}
                                onChange={(e) => setFormData({ ...formData, budget: Number(e.target.value) })}
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

                        <Box display="flex" gap={2}>
                            <TextField
                                label="Strategic Category"
                                select
                                fullWidth
                                value={formData.category}
                                onChange={(e) => setFormData({ ...formData, category: e.target.value as any })}
                            >
                                <MenuItem value="INFRASTRUCTURE">Infrastructure</MenuItem>
                                <MenuItem value="OUTREACH">Outreach</MenuItem>
                                <MenuItem value="TECH">Technical</MenuItem>
                                <MenuItem value="YOUTH">Youth Development</MenuItem>
                                <MenuItem value="GENERAL">General Project</MenuItem>
                            </TextField>
                            <TextField
                                label="Status"
                                select
                                fullWidth
                                value={formData.status}
                                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                            >
                                <MenuItem value="PLANNED">Planned</MenuItem>
                                <MenuItem value="ACTIVE">Active</MenuItem>
                                <MenuItem value="COMPLETED">Completed</MenuItem>
                            </TextField>
                            <TextField
                                label="Target Deadline"
                                type="date"
                                fullWidth
                                InputLabelProps={{ shrink: true }}
                                value={formData.deadline.split('T')[0]}
                                onChange={(e) => setFormData({ ...formData, deadline: new Date(e.target.value).toISOString() })}
                            />
                        </Box>
                        
                        <Box>
                            <Typography variant="caption" fontWeight="900" sx={{ letterSpacing: 1, color: 'text.secondary' }}>
                                PROGRESS: {formData.progress}%
                            </Typography>
                            <LinearProgress
                                variant="determinate"
                                value={formData.progress}
                                sx={{ 
                                    height: 10, 
                                    borderRadius: 0, 
                                    mt: 1, 
                                    cursor: 'pointer',
                                    bgcolor: 'rgba(255,255,255,0.05)',
                                    '& .MuiLinearProgress-bar': {
                                        boxShadow: '0 0 10px var(--primary-glow)'
                                    }
                                }}
                                onClick={(e) => {
                                    const rect = e.currentTarget.getBoundingClientRect();
                                    const percentage = Math.round(((e.clientX - rect.left) / rect.width) * 100);
                                    setFormData({ ...formData, progress: Math.max(0, Math.min(100, percentage)) });
                                }}
                            />
                        </Box>

                        <Box display="flex" alignItems="center" bgcolor="rgba(255,255,255,0.05)" p={2} borderRadius={2} border="1px dashed rgba(255,255,255,0.1)">
                            <Box flex={1}>
                                <Typography variant="subtitle2" fontWeight="bold">CHURCH-WIDE INITIATIVE</Typography>
                                <Typography variant="caption" color="textSecondary">If enabled, this project will appear on the Main Dashboard immediately.</Typography>
                            </Box>
                            <Checkbox 
                                checked={formData.isMajor} 
                                onChange={(e) => setFormData({ ...formData, isMajor: e.target.checked })}
                                sx={{ color: 'primary.main' }}
                            />
                        </Box>

                        {user?.role === 'SUPER_ADMIN' && (
                            <TextField
                                label="Department"
                                select
                                fullWidth
                                required
                                value={formData.departmentId}
                                onChange={(e) => setFormData({ ...formData, departmentId: e.target.value })}
                            >
                                {departments?.map((dept: any) => (
                                    <MenuItem key={dept.id} value={dept.id}>{dept.name}</MenuItem>
                                ))}
                            </TextField>
                        )}
                    </Box>
                </DialogContent>
                <DialogActions sx={{ p: 4, gap: 2, flexWrap: 'wrap' }}>
                    <Button onClick={onClose} sx={{ fontWeight: 900, color: 'text.secondary' }}>ABORT</Button>
                    <Box sx={{ flexGrow: 1 }} />
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
                        {project ? 'SAVE CHANGES' : 'DEPLOY PROJECT'}
                    </Button>
                </DialogActions>
            </form>
        </Dialog>
    );
}
