import React, { useState, useEffect } from 'react';
import {
    Dialog, DialogTitle, DialogContent, DialogActions, Box, TextField,
    MenuItem, Typography, Button, LinearProgress, FormControl, InputLabel,
    Select, Checkbox, ListItemText, Chip
} from '@mui/material';
import { useMutation } from '@tanstack/react-query';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../lib/db';
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
    const [formData, setFormData] = useState({
        title: '',
        description: '',
        status: 'PLANNED',
        progress: 0,
        budget: 0,
        isMajor: false,
        departmentId: defaultDepartmentId || user?.departmentId || '',
        pastorIds: [] as string[],
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
                pastorIds: [],
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
                pastorIds: [],
                category: 'GENERAL',
                deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
                budgetSource: 'DEPARTMENT'
            });
        }
    }, [project, open, user, defaultDepartmentId]);

    const departments = useLiveQuery(() => db.departments.toArray(), []) || [];

    const pastors = useLiveQuery(() => db.users.filter(u => ['PASTOR', 'ASSOCIATE_PASTOR', 'BISHOP', 'SUPER_ADMIN'].includes(u.role) && u.status === 'ACTIVE').toArray(), []) || [];

    const mutation = useMutation(
        (data: any) => project 
            ? api.patch(`/projects/${project.id}`, data) 
            : api.post('/projects', data),
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
                return await api.post(`/projects/${project.id}/approve`);
            } else {
                return await api.patch(`/projects/${project.id}/status`, { approvalStatus: 'REJECTED' });
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
        
        if (!formData.departmentId) {
            alert("Please select a Department for this Project.");
            return;
        }

        const { pastorIds, ...cleanPayload } = formData;
        const finalPayload = project ? cleanPayload : { ...cleanPayload, pastorIds };
        
        mutation.mutate(finalPayload);
    };

    const isLocked = project?.status === 'APPROVED' && user?.role === 'DEPARTMENT_LEADER';

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
                    {project ? (project.status === 'APPROVED' ? 'VIEW PROJECT (LOCKED)' : 'EDIT PROJECT') : 'INITIATE PROJECT'}
                </DialogTitle>
                <DialogContent>
                    {/* 👨‍⚖️ COMMAND APPROVAL OVERRIDE */}
                    {project && project.approvalStatus !== 'APPROVED' && 
                        ((project.approvals || []).some((a: any) => a.userId === user?.id && !a.approved) || 
                         ['WATUA', 'BISHOP', 'SUPER_ADMIN'].includes(user?.role || '')) && (
                        <Box sx={{ mb: 4, p: 3, bgcolor: 'rgba(255,165,0,0.1)', border: '1px solid orange', borderRadius: 0, textAlign: 'center' }}>
                            <Typography variant="subtitle2" fontWeight="950" color="orange" mb={1}>
                                ACTION REQUIRED: PROJECT CLEARANCE
                            </Typography>
                            <Typography variant="caption" sx={{ display: 'block', mb: 2, opacity: 0.8 }}>
                                As the assigned authorizing officer, you are required to review this mission deployment.
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
                                    APPROVE MISSION
                                </Button>
                                <Button 
                                    variant="outlined" 
                                    color="error" 
                                    size="small" 
                                    onClick={() => { if(window.confirm('Reject mission?')) approveMutation.mutate('REJECTED'); }}
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
                                <Typography variant="caption" color="textSecondary">If enabled, this project will appear on the Main Dashboard once approved by the Bishop + 2 Pastors.</Typography>
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
                        
                        {!project && (
                            <FormControl fullWidth required>
                                <InputLabel id="pastors-label" sx={{ fontWeight: 700 }}>CHOOSE 2 AUTHORIZING PASTORS</InputLabel>
                                <Select
                                    labelId="pastors-label"
                                    id="pastors-select"
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
                <DialogActions sx={{ p: 4, gap: 2, flexWrap: 'wrap' }}>
                    <Button onClick={onClose} sx={{ fontWeight: 900, color: 'text.secondary' }}>ABORT</Button>
                    <Box sx={{ flexGrow: 1 }} />
                    <Button 
                        type="submit" 
                        variant="contained" 
                        disabled={mutation.isLoading || isLocked} 
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
                {project?.status === 'APPROVED' && (
                    <Box sx={{ pb: 3, px: 4, textAlign: 'center' }}>
                        <Typography variant="caption" color="error" fontWeight="950">
                            MISSION CLEARED BY COMMAND. EDITING RESTRICTED.
                        </Typography>
                    </Box>
                )}
            </form>
        </Dialog>
    );
}
