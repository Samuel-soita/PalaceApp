import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../lib/api-client';
import {
    Typography, Grid, Card, CardContent, Box, Button, TextField, Dialog, DialogTitle,
    DialogContent, DialogActions, MenuItem, LinearProgress, Chip, IconButton, Tooltip,
    Divider, Select, Checkbox, ListItemText, FormControl, InputLabel
} from '@mui/material';
import {
    Calendar as CalendarIcon, MapPin, Plus, Edit, Trash2,
    Clock, Tag, AlertCircle
} from 'lucide-react';
import DashboardLayout from '../components/layout/DashboardLayout';
import { useAuth } from '../contexts/AuthContext';

interface Event {
    id: string;
    title: string;
    date: string;
    time: string;
    location: string;
    description: string;
    departmentId: string;
    department: { name: string };
    budgetNeeded: number;
    volunteersNeeded: number;
    status: string;
    eventType: 'SERVICE' | 'CONFERENCE' | 'DEPARTMENT_EVENT' | 'MEETING';
}

export default function Events() {
    const { user } = useAuth();
    const queryClient = useQueryClient();
    const [open, setOpen] = useState(false);
    const [editEvent, setEditEvent] = useState<Event | null>(null);
    const [formData, setFormData] = useState({
        title: '',
        date: '',
        time: '',
        location: '',
        description: '',
        departmentId: user?.departmentId || '',
        budgetNeeded: 0,
        volunteersNeeded: 0,
        status: 'PLANNED',
        eventType: 'DEPARTMENT_EVENT' as 'SERVICE' | 'CONFERENCE' | 'DEPARTMENT_EVENT' | 'MEETING',
        pastorIds: [] as string[]
    });

    const isAuthorized = user?.role === 'SUPER_ADMIN';

    const { data: events, isLoading } = useQuery(['events'], async () => {
        const res = await api.get('/events');
        const all = Array.isArray(res.data) ? res.data : [];
        if (user?.role === 'SUPER_ADMIN') return all;
        // Show all approved events plus user's own pending ones
        return all.filter((e: any) => e.approvalStatus === 'APPROVED' || e.departmentId === user?.departmentId);
    });

    const { data: departments } = useQuery(['departments'], async () => {
        const res = await api.get('/departments');
        return res.data;
    });

    const { data: pastors } = useQuery(['pastors'], async () => {
        const res = await api.get('/users?role=PASTOR');
        return Array.isArray(res.data) 
            ? res.data.filter((u: any) => u.role === 'PASTOR') 
            : [];
    });

    const createMutation = useMutation(
        (newEvent: any) => api.post('/events', newEvent),
        { onSuccess: () => { queryClient.invalidateQueries(['events']); handleClose(); } }
    );

    const updateMutation = useMutation(
        (updatedEvent: any) => api.patch(`/events/${updatedEvent.id}`, updatedEvent),
        { onSuccess: () => { queryClient.invalidateQueries(['events']); handleClose(); } }
    );

    const deleteMutation = useMutation(
        (id: string) => api.delete(`/events/${id}`),
        { onSuccess: () => queryClient.invalidateQueries(['events']) }
    );

    const handleOpen = (event: Event | null = null) => {
        if (event) {
            setEditEvent(event);
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
                pastorIds: []
            });
        } else {
            setEditEvent(null);
            setFormData({
                title: '',
                date: '',
                time: '',
                location: '',
                description: '',
                departmentId: user?.departmentId || '',
                budgetNeeded: 0,
                volunteersNeeded: 0,
                status: 'PLANNED',
                eventType: 'DEPARTMENT_EVENT',
                pastorIds: []
            });
        }
        setOpen(true);
    };

    const handleClose = () => {
        setOpen(false);
        setEditEvent(null);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!editEvent && formData.pastorIds.length !== 2) {
            alert("You must select exactly 2 Pastors to authorize this Event before it is deployed.");
            return;
        }

        if (editEvent) {
            updateMutation.mutate({ ...formData, id: editEvent.id });
        } else {
            createMutation.mutate(formData);
        }
    };

    const handleDelete = (id: string) => {
        if (window.confirm('Are you sure you want to delete this event? This action cannot be undone.')) {
            deleteMutation.mutate(id);
        }
    };

    const getEventTypeColor = (type: string) => {
        switch (type) {
            case 'SERVICE': return 'secondary';
            case 'CONFERENCE': return 'warning';
            case 'MEETING': return 'info';
            default: return 'primary';
        }
    };

    if (isLoading) return (
        <DashboardLayout>
            <Box sx={{ height: '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <LinearProgress sx={{ width: 200, borderRadius: 1 }} />
            </Box>
        </DashboardLayout>
    );

    return (
        <DashboardLayout>
            <Box sx={{ mb: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'end' }}>
                <div>
                    <Typography variant="h3" fontWeight="950" sx={{ mb: 1, letterSpacing: -2 }}>
                        CHURCH <span className="text-primary">CALENDAR</span>
                    </Typography>
                    <Typography color="textSecondary" fontWeight="medium" sx={{ opacity: 0.7 }}>
                        Centralized schedule for services, conferences, and department coordination.
                    </Typography>
                </div>
                {isAuthorized && (
                    <Button
                        variant="contained"
                        startIcon={<Plus size={18} />}
                        onClick={() => handleOpen()}
                        sx={{ borderRadius: 3, px: 4, py: 1.5, fontWeight: '900', boxShadow: '0 0 20px var(--primary-glow)' }}
                    >
                        NEW EVENT
                    </Button>
                )}
            </Box>

            <Grid container spacing={3}>
                {events?.map((event: Event) => (
                    <Grid item xs={12} md={6} lg={4} key={event.id}>
                        <Card className="holographic-card" sx={{ borderRadius: 4, height: '100%' }}>
                            <CardContent sx={{ p: 4 }}>
                                <Box display="flex" justifyContent="space-between" alignItems="start" mb={3}>
                                    <Chip
                                        label={event.eventType}
                                        size="small"
                                        color={getEventTypeColor(event.eventType) as any}
                                        sx={{ fontWeight: '900', px: 1 }}
                                    />
                                    {isAuthorized && (
                                        <Box display="flex" gap={1}>
                                            <IconButton size="small" onClick={() => handleOpen(event)} sx={{ color: 'primary.main' }}>
                                                <Edit size={16} />
                                            </IconButton>
                                            <IconButton size="small" color="error" onClick={() => handleDelete(event.id)}>
                                                <Trash2 size={16} />
                                            </IconButton>
                                        </Box>
                                    )}
                                </Box>

                                <Typography variant="h5" fontWeight="900" sx={{ mb: 1, letterSpacing: -0.5 }}>{event.title}</Typography>
                                <Typography variant="caption" fontWeight="900" sx={{ color: 'text.secondary', opacity: 0.6, textTransform: 'uppercase', mb: 2, display: 'block' }}>
                                    {event.department.name} Department
                                </Typography>

                                <div className="space-y-3 pt-2">
                                    <div className="flex items-center gap-3 text-sm">
                                        <Clock size={16} className="text-primary" />
                                        <span className="font-bold opacity-80">{new Date(event.date).toLocaleDateString()} • {event.time}</span>
                                    </div>
                                    <div className="flex items-center gap-3 text-sm">
                                        <MapPin size={16} className="text-primary" />
                                        <span className="font-bold opacity-80">{event.location}</span>
                                    </div>
                                </div>

                                <Divider sx={{ my: 3, opacity: 0.1 }} />

                                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <Chip
                                        label={event.status}
                                        size="small"
                                        variant="outlined"
                                        sx={{ fontWeight: '800', fontSize: '0.65rem' }}
                                    />
                                    {event.budgetNeeded > 0 && (
                                        <Typography variant="caption" fontWeight="900" color="success.main">
                                            ${event.budgetNeeded.toLocaleString()} Requested
                                        </Typography>
                                    )}
                                </Box>
                            </CardContent>
                        </Card>
                    </Grid>
                ))}
            </Grid>

            {/* Event CRUD Modal */}
            <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 4, bgcolor: 'background.paper' } }}>
                <form onSubmit={handleSubmit}>
                    <DialogTitle sx={{ fontWeight: '900', fontSize: '1.5rem', letterSpacing: -1 }}>
                        {editEvent ? 'EDIT EVENT' : 'CREATE EVENT'}
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
                                label="Event Category"
                                select
                                fullWidth
                                required
                                value={formData.eventType}
                                onChange={(e) => setFormData({ ...formData, eventType: e.target.value as any })}
                            >
                                <MenuItem value="SERVICE">Regular Service</MenuItem>
                                <MenuItem value="CONFERENCE">Conference / Seminar</MenuItem>
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
                                label="Venue / Location"
                                fullWidth
                                required
                                value={formData.location}
                                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                            />
                            <TextField
                                label="Description"
                                fullWidth
                                multiline
                                rows={2}
                                required
                                value={formData.description}
                                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                            />
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
                            <Box display="flex" gap={2}>
                                <TextField
                                    label="Budget Estimate ($)"
                                    type="number"
                                    fullWidth
                                    value={formData.budgetNeeded}
                                    onChange={(e) => setFormData({ ...formData, budgetNeeded: Number(e.target.value) })}
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
                                    <MenuItem value="CANCELLED">Cancelled</MenuItem>
                                </TextField>
                            </Box>
                            
                            {!editEvent && (
                                <FormControl fullWidth required error={formData.pastorIds.length > 0 && formData.pastorIds.length !== 2}>
                                    <InputLabel id="pastors-label">Select 2 Authorizing Pastors</InputLabel>
                                    <Select
                                        labelId="pastors-label"
                                        multiple
                                        value={formData.pastorIds}
                                        onChange={(e) => {
                                            const value = e.target.value as string[];
                                            if (value.length <= 2) {
                                                setFormData({ ...formData, pastorIds: value });
                                            }
                                        }}
                                        renderValue={(selected) => 
                                            pastors?.filter((p: any) => selected.includes(p.id)).map((p: any) => p.name).join(', ')
                                        }
                                        label="Select 2 Authorizing Pastors"
                                    >
                                        {pastors?.map((pastor: any) => (
                                            <MenuItem key={pastor.id} value={pastor.id}>
                                                <Checkbox checked={formData.pastorIds.indexOf(pastor.id) > -1} />
                                                <ListItemText primary={pastor.name} secondary="Pastor" />
                                            </MenuItem>
                                        ))}
                                    </Select>
                                </FormControl>
                            )}
                        </Box>
                    </DialogContent>
                    <DialogActions sx={{ p: 4 }}>
                        <Button onClick={handleClose} sx={{ fontWeight: '800' }}>CANCEL</Button>
                        <Button
                            type="submit"
                            variant="contained"
                            disabled={createMutation.isLoading || updateMutation.isLoading}
                            sx={{ borderRadius: 2, px: 4, fontWeight: '900' }}
                        >
                            {editEvent ? 'UPDATE' : 'INITIATE'} EVENT
                        </Button>
                    </DialogActions>
                </form>
            </Dialog>
        </DashboardLayout>
    );
}
