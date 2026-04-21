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

interface EventFormModalProps {
    open: boolean;
    onClose: () => void;
    event?: any;
    onSuccess: () => void;
    defaultDepartmentId?: string;
}

export default function EventFormModal({ open, onClose, event, onSuccess, defaultDepartmentId }: EventFormModalProps) {
    const { user } = useAuth();
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
        pastorIds: [] as string[],
        budgetSource: 'DEPARTMENT' // Default to department
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
                pastorIds: [],
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
                pastorIds: [],
                budgetSource: 'DEPARTMENT'
            });
        }
    }, [event, open, user, defaultDepartmentId]);

    const departments = useLiveQuery(() => db.departments.toArray(), []) || [];

    const pastors = useLiveQuery(() => db.users.filter(u => ['PASTOR', 'ASSOCIATE_PASTOR', 'BISHOP', 'SUPER_ADMIN'].includes(u.role) && u.status === 'ACTIVE').toArray(), []) || [];

    const mutation = useOfflineMutation({
        entity: 'EVENT',
        table: 'events',
        url: '/events',
        onSuccess: () => {
            onSuccess();
            onClose();
        }
    });

    const approveMutation = useMutation(
        async (status: 'APPROVED' | 'REJECTED') => {
            if (status === 'APPROVED') {
                return await api.post(`/events/${event.id}/approve`);
            } else {
                return await api.patch(`/events/${event.id}/status`, { approvalStatus: 'REJECTED' });
            }
        },
        {
            onSuccess: () => {
                onSuccess();
                onClose();
            }
        }
    );

    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [uploading, setUploading] = useState(false);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setSelectedFile(e.target.files[0]);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!event && formData.pastorIds.length !== 2) {
            alert("Exactly 2 Pastors must authorize this Event.");
            return;
        }
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

        // Convert date to ISO datetime string for backend schema
        const isoDate = new Date(`${formData.date}T${formData.time || '00:00'}:00`).toISOString();
        
        // Construct payload (status and date/time are now correctly handled by schema)
        const { pastorIds, ...restFormData } = formData;
        const cleanPayload = { 
            ...(event ? restFormData : formData), 
            date: isoDate, 
            attachmentUrl 
        };

        mutation.mutate(cleanPayload);
        setUploading(false);
        setSelectedFile(null);
    };

    const isLocked = event?.status === 'APPROVED' && user?.role === 'DEPARTMENT_LEADER';

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
                <DialogTitle sx={{ fontWeight: 950, fontSize: '1.5rem', letterSpacing: -1 }}>
                    {event ? (event.status === 'APPROVED' ? 'VIEW EVENT (LOCKED)' : 'EDIT EVENT') : 'INITIATE EVENT'}
                </DialogTitle>
                <DialogContent>
                    {/* 👨‍⚖️ COMMAND APPROVAL OVERRIDE */}
                    {event && event.approvalStatus !== 'APPROVED' && (event.targetPastorId === user?.id || ['WATUA', 'BISHOP'].includes(user?.role || '')) && (
                        <Box sx={{ mb: 4, p: 3, bgcolor: 'rgba(255,165,0,0.1)', border: '1px solid orange', borderRadius: 0, textAlign: 'center' }}>
                            <Typography variant="subtitle2" fontWeight="950" color="orange" mb={1}>
                                ACTION REQUIRED: EVENT CLEARANCE
                            </Typography>
                            <Typography variant="caption" sx={{ display: 'block', mb: 2, opacity: 0.8 }}>
                                Review the mission parameters and grant authorization to proceed.
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
                                    APPROVE EVENT
                                </Button>
                                <Button 
                                    variant="outlined" 
                                    color="error" 
                                    size="small" 
                                    onClick={() => { if(window.confirm('Reject event?')) approveMutation.mutate('REJECTED'); }}
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
                                inputProps={!event ? { min: new Date().toISOString().split('T')[0] } : {}}
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
                            label="Venue"
                            fullWidth
                            required
                            value={formData.location}
                            onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                        />
                        <TextField
                            label="Description"
                            multiline
                            rows={2}
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

                        {formData.budgetSource === 'DEPARTMENT' && (
                            <Box sx={{ p: 1.5, bgcolor: 'rgba(255,152,0,0.05)', border: '1px solid rgba(255,152,0,0.2)', borderRadius: 1 }}>
                                <Typography variant="caption" fontWeight="800" color="warning.main">
                                    NOTE: Department funded operations require a minimum balance of 1,500 KES.
                                </Typography>
                            </Box>
                        )}

                        <Box display="flex" gap={2}>
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

                        <Box display="flex" alignItems="center" bgcolor="rgba(255,255,255,0.05)" p={2} borderRadius={2} border="1px dashed rgba(255,255,255,0.1)">
                            <Box flex={1}>
                                <Typography variant="subtitle2" fontWeight="bold">CHURCH-WIDE EVENT</Typography>
                                <Typography variant="caption" color="textSecondary">Apply this to events intended for the entire congregation. Requires Bishop + 2 Pastors approval.</Typography>
                            </Box>
                            <Checkbox 
                                checked={formData.isMajor} 
                                onChange={(e) => setFormData({ ...formData, isMajor: e.target.checked })}
                                sx={{ color: 'primary.main' }}
                            />
                        </Box>
                        
                        <Box display="flex" flexDirection="column" gap={1}>
                            <Typography variant="body2" fontWeight="bold" color="textSecondary">
                                Event Attachment (PDF, Image, etc)
                            </Typography>
                            <Box display="flex" alignItems="center" gap={2}>
                                <Button
                                    variant="outlined"
                                    component="label"
                                    size="small"
                                    sx={{ borderRadius: 2 }}
                                >
                                    Choose File
                                    <input
                                        type="file"
                                        hidden
                                        onChange={handleFileChange}
                                    />
                                </Button>
                                {selectedFile && <Typography variant="caption">{selectedFile.name}</Typography>}
                                {!selectedFile && event?.attachmentUrl && (
                                    <Typography variant="caption" color="primary">Current attachment: {event.attachmentUrl.split('/').pop()}</Typography>
                                )}
                            </Box>
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

                        {!event && (
                            <FormControl fullWidth required>
                                <InputLabel id="event-pastors-label" sx={{ fontWeight: 700 }}>CHOOSE 2 AUTHORIZING PASTORS</InputLabel>
                                <Select
                                    labelId="event-pastors-label"
                                    id="event-pastors-select"
                                    multiple
                                    label="CHOOSE 2 AUTHORIZING PASTORS"
                                    value={formData.pastorIds}
                                    sx={{ borderRadius: 0 }}
                                    onChange={(e) => {
                                        const values = e.target.value as string[];
                                        if (values.length <= 2) setFormData({ ...formData, pastorIds: values });
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
                        disabled={mutation.isLoading || uploading || isLocked} 
                        sx={{ 
                            borderRadius: 0, 
                            fontWeight: 900, 
                            px: 4, 
                            py: 1.5,
                            boxShadow: '0 0 20px var(--primary-glow)' 
                        }}
                    >
                        {uploading ? 'UPLOADING...' : (event ? 'SAVE CHANGES' : 'DEPLOY EVENT')}
                    </Button>
                    {event?.status === 'APPROVED' && (
                        <Typography variant="caption" color="error" fontWeight="950" sx={{ mt: 1, display: 'block', textAlign: 'center', width: '100%' }}>
                            MISSION CLEARED BY COMMAND. EDITING RESTRICTED.
                        </Typography>
                    )}
                </DialogActions>
            </form>
        </Dialog>
    );
}
