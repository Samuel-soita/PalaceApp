import React, { useState, useEffect } from 'react';
import {
    Dialog, DialogTitle, DialogContent, DialogActions, Box, TextField,
    MenuItem, Typography, Button, FormControl, InputLabel,
    Select, Checkbox, ListItemText, Chip
} from '@mui/material';
import { useMutation } from '@tanstack/react-query';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../lib/db';
import api from '../../lib/api-client';
import { useAuth } from '../../contexts/AuthContext';
import { useOfflineMutation } from '../../hooks/useOfflineMutation';
import { CheckCircle, Calendar, MapPin, Zap } from 'lucide-react';

interface EventFormModalProps {
    open: boolean;
    onClose: () => void;
    event?: any;
    onSuccess: () => void;
    defaultDepartmentId?: string;
}

export default function EventFormModal({ open, onClose, event, onSuccess, defaultDepartmentId }: EventFormModalProps) {
    const { user } = useAuth();
    const [isSuccess, setIsSuccess] = useState(false);
    const [formData, setFormData] = useState({
        title: '',
        date: '',
        time: '',
        location: '',
        description: '',
        departmentId: defaultDepartmentId || user?.departmentId || '',
        budgetNeeded: 0,
        volunteersNeeded: 0,
        status: 'PLANNED',
        eventType: 'DEPARTMENT_EVENT',
        isMajor: false,
        budgetSource: 'DEPARTMENT'
    });

    useEffect(() => {
        if (event) {
            setFormData({
                title: event.title,
                date: new Date(event.date).toISOString().split('T')[0],
                time: event.time,
                location: event.location,
                description: event.description || '',
                departmentId: event.departmentId,
                budgetNeeded: event.budgetNeeded,
                volunteersNeeded: event.volunteersNeeded,
                status: event.status,
                eventType: event.eventType,
                isMajor: event.isMajor || false,
                budgetSource: event.budgetSource || 'DEPARTMENT'
            });
        } else {
            setFormData({
                title: '',
                date: '',
                time: '',
                location: '',
                description: '',
                departmentId: defaultDepartmentId || user?.departmentId || '',
                budgetNeeded: 0,
                volunteersNeeded: 0,
                status: 'PLANNED',
                eventType: 'DEPARTMENT_EVENT',
                isMajor: false,
                budgetSource: 'DEPARTMENT'
            });
        }
        setIsSuccess(false);
    }, [event, open, user, defaultDepartmentId]);

    const departments = useLiveQuery(() => db.departments.toArray(), []) || [];

    const mutation = useOfflineMutation({
        entity: 'EVENT',
        table: 'events',
        url: '/events',
        onSuccess: () => {
            setIsSuccess(true);
            setTimeout(() => {
                onSuccess();
                onClose();
            }, 2000);
        }
    });

    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [uploading, setUploading] = useState(false);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setSelectedFile(e.target.files[0]);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.departmentId) {
            alert("Please select a Department for this Event.");
            return;
        }

        let attachmentUrl = event?.attachmentUrl;

        if (selectedFile) {
            setUploading(true);
            try {
                const uploadData = new FormData();
                uploadData.append('file', selectedFile);
                const uploadRes = await api.post('/upload', uploadData, {
                    headers: { 'Content-Type': 'multipart/form-data' }
                });
                attachmentUrl = uploadRes.data.url;
            } catch (err) {
                console.error("Failed to upload file", err);
                alert("Failed to upload attachment. Please try again.");
                setUploading(false);
                return;
            }
        }

        const isoDate = new Date(`${formData.date}T${formData.time || '00:00'}:00`).toISOString();
        const cleanPayload = { 
            ...formData, 
            date: isoDate, 
            attachmentUrl 
        };

        mutation.mutate(cleanPayload);
        setUploading(false);
        setSelectedFile(null);
    };

    if (isSuccess) {
        return (
            <Dialog open={open} onClose={onClose} PaperProps={{ className: "holographic-card", sx: { borderRadius: 0, border: '1px solid var(--cyan)', bgcolor: 'background.paper', p: 4 } }}>
                <Box sx={{ textAlign: 'center', py: 4 }}>
                    <Box sx={{ display: 'inline-flex', p: 2, borderRadius: '50%', bgcolor: 'rgba(0, 255, 255, 0.1)', mb: 2 }}>
                        <CheckCircle size={48} color="var(--cyan)" />
                    </Box>
                    <Typography variant="h5" fontWeight="950" sx={{ letterSpacing: -1, mb: 1 }}>
                        EVENT DEPLOYED
                    </Typography>
                    <Typography variant="body2" sx={{ opacity: 0.8, maxWidth: 300, mx: 'auto' }}>
                        The event mission has been successfully synchronized and is now live across the ministry nodes.
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
                <DialogTitle sx={{ fontWeight: 950, fontSize: '1.5rem', letterSpacing: -1, display: 'flex', alignItems: 'center', gap: 1.5 }}>
                    <Calendar size={24} color="var(--cyan)" />
                    {event ? 'UPDATE MISSION PARAMETERS' : 'INITIATE EVENT MISSION'}
                </DialogTitle>
                <DialogContent>
                    <Box display="flex" flexDirection="column" gap={3} mt={1}>
                        <TextField
                            label="Event Title"
                            fullWidth
                            required
                            value={formData.title}
                            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                        />
                        <TextField
                            label="Category"
                            select
                            fullWidth
                            required
                            value={formData.eventType}
                            onChange={(e) => setFormData({ ...formData, eventType: e.target.value })}
                        >
                            <MenuItem value="SERVICE">Regular Service</MenuItem>
                            <MenuItem value="CONFERENCE">Conference</MenuItem>
                            <MenuItem value="DEPARTMENT_EVENT">Department Event</MenuItem>
                            <MenuItem value="MEETING">Strategic Meeting</MenuItem>
                        </TextField>
                        <Box display="flex" gap={2}>
                            <TextField
                                label="Date"
                                type="date"
                                fullWidth
                                required
                                InputLabelProps={{ shrink: true }}
                                value={formData.date}
                                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                            />
                            <TextField
                                label="Time"
                                type="time"
                                fullWidth
                                required
                                InputLabelProps={{ shrink: true }}
                                value={formData.time}
                                onChange={(e) => setFormData({ ...formData, time: e.target.value })}
                            />
                        </Box>
                        <TextField
                            label="Venue / Location Node"
                            fullWidth
                            required
                            value={formData.location}
                            onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                        />
                        <TextField
                            label="Mission Intelligence / Description"
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

                        <Box display="flex" gap={2}>
                            <TextField
                                label="Operational Status"
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

                        <Box display="flex" alignItems="center" bgcolor="rgba(255,255,255,0.05)" p={2} borderRadius={0} border="1px dashed var(--cyan)">
                            <Box flex={1}>
                                <Typography variant="subtitle2" fontWeight="bold">CHURCH-WIDE DEPLOYMENT</Typography>
                                <Typography variant="caption" color="textSecondary">Mark this as a major event to broadcast it church-wide immediately.</Typography>
                            </Box>
                            <Checkbox 
                                checked={formData.isMajor} 
                                onChange={(e) => setFormData({ ...formData, isMajor: e.target.checked })}
                                sx={{ color: 'var(--cyan)' }}
                            />
                        </Box>
                        
                        <Box display="flex" flexDirection="column" gap={1}>
                            <Typography variant="caption" fontWeight="900" color="textSecondary" sx={{ letterSpacing: 1 }}>
                                MISSION ATTACHMENTS (PDF/IMG)
                            </Typography>
                            <Box display="flex" alignItems="center" gap={2}>
                                <Button variant="outlined" component="label" size="small" sx={{ borderRadius: 0, fontWeight: 800 }}>
                                    SELECT FILE
                                    <input type="file" hidden onChange={handleFileChange} />
                                </Button>
                                {selectedFile && <Typography variant="caption" fontWeight={700}>{selectedFile.name}</Typography>}
                            </Box>
                        </Box>

                        {user?.role === 'SUPER_ADMIN' && (
                            <TextField
                                label="Assign to Sector"
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
                <DialogActions sx={{ p: 4, gap: 2 }}>
                    <Button onClick={onClose} sx={{ fontWeight: 900, color: 'text.secondary' }}>ABORT</Button>
                    <Button 
                        type="submit" 
                        variant="contained" 
                        disabled={mutation.isLoading || uploading} 
                        sx={{ 
                            borderRadius: 0, 
                            fontWeight: 900, 
                            px: 4, 
                            py: 1.5,
                            boxShadow: '0 0 20px var(--primary-glow)' 
                        }}
                    >
                        {uploading ? 'SYNCHRONIZING...' : (event ? 'UPDATE MISSION' : 'DEPLOY EVENT')}
                    </Button>
                </DialogActions>
            </form>
        </Dialog>
    );
}
