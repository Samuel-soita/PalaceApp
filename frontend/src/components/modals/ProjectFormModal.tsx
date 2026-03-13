import React, { useState, useEffect } from 'react';
import {
    Dialog, DialogTitle, DialogContent, DialogActions, Box, TextField,
    MenuItem, Typography, Button, LinearProgress, FormControl, InputLabel,
    Select, Checkbox, ListItemText
} from '@mui/material';
import { useQuery, useMutation } from '@tanstack/react-query';
import api from '../../lib/api-client';
import { useAuth } from '../../contexts/AuthContext';

interface ProjectFormModalProps {
    open: boolean;
    onClose: () => void;
    project?: any;
    onSuccess: () => void;
}

export default function ProjectFormModal({ open, onClose, project, onSuccess }: ProjectFormModalProps) {
    const { user } = useAuth();
    const [formData, setFormData] = useState({
        title: '',
        description: '',
        status: 'PLANNED',
        progress: 0,
        budget: 0,
        departmentId: user?.departmentId || '',
        pastorIds: [] as string[]
    });

    useEffect(() => {
        if (project) {
            setFormData({
                title: project.title,
                description: project.description,
                status: project.status,
                progress: project.progress,
                budget: project.budget,
                departmentId: project.departmentId,
                pastorIds: []
            });
        } else {
            setFormData({
                title: '',
                description: '',
                status: 'PLANNED',
                progress: 0,
                budget: 0,
                departmentId: user?.departmentId || '',
                pastorIds: []
            });
        }
    }, [project, open, user]);

    const { data: departments } = useQuery(['departments'], async () => {
        const res = await api.get('/departments');
        return res.data;
    }, { enabled: open && user?.role === 'SUPER_ADMIN' });

    const { data: pastors } = useQuery(['pastors'], async () => {
        const res = await api.get('/users?role=PASTOR');
        return Array.isArray(res.data) 
            ? res.data.filter((u: any) => u.role === 'PASTOR') 
            : [];
    }, { enabled: open && !project });

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

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!project && formData.pastorIds.length !== 2) {
            alert("You must select exactly 2 Pastors to authorize this Project.");
            return;
        }
        mutation.mutate(formData);
    };

    return (
        <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 4 } }}>
            <form onSubmit={handleSubmit}>
                <DialogTitle sx={{ fontWeight: '950', fontSize: '1.5rem' }}>
                    {project ? 'EDIT PROJECT' : 'INITIALIZE PROJECT'}
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
                                label="Budget ($)"
                                type="number"
                                fullWidth
                                required
                                value={formData.budget}
                                onChange={(e) => setFormData({ ...formData, budget: Number(e.target.value) })}
                            />
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
                        </Box>
                        
                        <Box>
                            <Typography variant="caption" fontWeight="bold">PROGRESS: {formData.progress}%</Typography>
                            <LinearProgress
                                variant="determinate"
                                value={formData.progress}
                                sx={{ height: 8, borderRadius: 4, mt: 1, cursor: 'pointer' }}
                                onClick={(e) => {
                                    const rect = e.currentTarget.getBoundingClientRect();
                                    const percentage = Math.round(((e.clientX - rect.left) / rect.width) * 100);
                                    setFormData({ ...formData, progress: Math.max(0, Math.min(100, percentage)) });
                                }}
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
                                <InputLabel>Select 2 Pastors</InputLabel>
                                <Select
                                    multiple
                                    value={formData.pastorIds}
                                    onChange={(e) => {
                                        const val = e.target.value as string[];
                                        if (val.length <= 2) setFormData({ ...formData, pastorIds: val });
                                    }}
                                    renderValue={(sel) => pastors?.filter((p: any) => sel.includes(p.id)).map((p: any) => p.name).join(', ')}
                                >
                                    {pastors?.map((p: any) => (
                                        <MenuItem key={p.id} value={p.id}>
                                            <Checkbox checked={formData.pastorIds.includes(p.id)} />
                                            <ListItemText primary={p.name} />
                                        </MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                        )}
                    </Box>
                </DialogContent>
                <DialogActions sx={{ p: 4 }}>
                    <Button onClick={onClose}>CANCEL</Button>
                    <Button type="submit" variant="contained" disabled={mutation.isLoading} sx={{ borderRadius: 2 }}>
                        {project ? 'UPDATE' : 'CREATE'}
                    </Button>
                </DialogActions>
            </form>
        </Dialog>
    );
}
