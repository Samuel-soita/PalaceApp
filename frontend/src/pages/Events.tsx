import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../lib/db';
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
import { isUserManagingDepartment } from '../utils/auth-options';

interface ChurchEvent {
    id: string;
    title: string;
    date: string | Date;
    time: string;
    location: string;
    description: string;
    departmentId: string;
    department?: { name: string };
    budgetNeeded?: number;
    volunteersNeeded?: number;
    status: string;
    eventType: string;
}

export default function Events() {
    const { user } = useAuth();
    const [open, setOpen] = useState(false);
    const [editEvent, setEditEvent] = useState<ChurchEvent | null>(null);
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

    const isGlobalAdmin = ['SUPER_ADMIN', 'SYSTEM_ADMIN', 'SECRETARY', 'WATUA'].includes(user?.role || '');
    const isAuthorized = isGlobalAdmin || ['DEPARTMENT_LEADER', 'PASTOR'].includes(user?.role || '');

    const [page, setPage] = useState(1);
    const limit = 12;

    const events = useLiveQuery(() => db.events.orderBy('date').toArray(), []) || [];
    const meta = { total: events.length, totalPages: Math.ceil((events.length || 1) / limit) };

    const filteredEvents = events.filter((e: any) => {
        if (isGlobalAdmin) return true;
        return e.approvalStatus === 'APPROVED' || isUserManagingDepartment(user, e.departmentId);
    });

    const departments = useLiveQuery(() => db.departments.toArray(), []) || [];
    const userDepartments = departments?.filter((d: any) => isUserManagingDepartment(user, d.id)) || [];
    const showDepartmentSelect = isGlobalAdmin || userDepartments.length > 1;

    const pastors = useLiveQuery(() => db.users.where('role').equals('PASTOR').toArray(), []) || [];

    const handleAction = async (payload: any, method: 'POST' | 'PATCH' | 'DELETE', id?: string) => {
        const actionId = id || crypto.randomUUID();
        const timestamp = Date.now();

        if (method !== 'DELETE') {
            await db.events.put({ 
                ...payload, 
                id: actionId, 
                syncStatus: 'PENDING',
                version: (payload.version || 0) + 1,
                department: departments.find(d => d.id === payload.departmentId) || { name: 'Unknown' } // local join
            });
        } else {
            if (id) await db.events.delete(id);
        }

        await db.syncQueue.put({
            id: crypto.randomUUID(),
            timestamp,
            entity: 'EVENT',
            method,
            url: method === 'POST' ? '/events' : `/events/${actionId}`,
            payload: { ...payload, isOfflineSync: true, localVersion: payload.version },
            status: 'PENDING',
            retryCount: 0,
            errorLog: []
        });

        handleClose();
    };

    const handleOpen = (event: any = null) => {
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
            // If they only manage one department and they're not global admin, default it to that department
            if (!isGlobalAdmin && userDepartments.length === 1) {
                setFormData(prev => ({ ...prev, departmentId: userDepartments[0].id }));
            }
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
            handleAction({ ...formData, id: editEvent.id, version: (editEvent as any).version || 0 }, 'PATCH', editEvent.id);
        } else {
            handleAction(formData, 'POST');
        }
    };

    const handleDelete = (id: string) => {
        if (window.confirm('Are you sure you want to delete this event? This action cannot be undone.')) {
            handleAction({ id, version: 0 }, 'DELETE', id);
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

    // Removed isLoading as Dexie resolves instantly or returns undefined on first tick
    if (events === undefined) return (
        <DashboardLayout>
            <Box sx={{ height: '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <LinearProgress sx={{ width: 200, borderRadius: 1 }} />
            </Box>
        </DashboardLayout>
    );

    return (
        <DashboardLayout>
            <Box sx={{ mb: 6, display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, justifyContent: 'space-between', alignItems: { xs: 'flex-start', sm: 'flex-end' }, gap: 2 }}>
                <div>
                    <Typography variant="h3" fontWeight="950" sx={{ mb: 1, letterSpacing: -2, fontSize: { xs: '2rem', sm: '3rem' } }}>
                        CHURCH <span className="text-primary">CALENDAR</span>
                    </Typography>
                    <Typography color="textSecondary" fontWeight="medium" sx={{ opacity: 0.7, fontSize: { xs: '0.8rem', sm: '1rem' } }}>
                        Centralized schedule for services, conferences, and department coordination.
                    </Typography>
                </div>
                {isAuthorized && (
                    <Button
                        variant="contained"
                        startIcon={<Plus size={18} />}
                        onClick={() => handleOpen()}
                        sx={{ width: { xs: '100%', sm: 'auto' }, borderRadius: 3, px: 4, py: 1.5, fontWeight: '900', boxShadow: '0 0 20px var(--primary-glow)' }}
                    >
                        NEW EVENT
                    </Button>
                )}
            </Box>

            <Grid container spacing={3}>
                {filteredEvents?.map((event: ChurchEvent) => (
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
                                    {(isGlobalAdmin || isUserManagingDepartment(user, event.departmentId)) && (
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
                                    {event.department?.name} Department
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
                                    {(event.budgetNeeded || 0) > 0 && (
                                        <Typography variant="caption" fontWeight="900" color="success.main">
                                            ${event.budgetNeeded?.toLocaleString()} Requested
                                        </Typography>
                                    )}
                                </Box>
                            </CardContent>
                        </Card>
                    </Grid>
                ))}
            </Grid>

            {meta.totalPages > 1 && (
                <Box display="flex" justifyContent="center" mt={6} gap={2}>
                    <Button 
                        disabled={page === 1} 
                        onClick={() => setPage(p => p - 1)}
                        variant="outlined"
                        sx={{ borderRadius: 3, fontWeight: 900 }}
                    >
                        PREV
                    </Button>
                    <Box display="flex" alignItems="center" px={4} sx={{ bgcolor: 'rgba(255,255,255,0.03)', borderRadius: 3, border: '1px solid var(--glass-border)' }}>
                        <Typography variant="body2" fontWeight="900" sx={{ opacity: 0.7 }}>CHRONO INDEX: {page} / {meta.totalPages}</Typography>
                    </Box>
                    <Button 
                        disabled={page >= meta.totalPages}
                        onClick={() => setPage(p => p + 1)}
                        variant="contained"
                        sx={{ borderRadius: 3, fontWeight: 900, px: 4 }}
                    >
                        NEXT
                    </Button>
                </Box>
            )}

            {/* Event CRUD Modal */}
            <Dialog 
                open={open} 
                onClose={handleClose} 
                maxWidth="sm" 
                fullWidth 
                PaperProps={{ sx: { borderRadius: 4, bgcolor: 'background.paper', width: '95%', m: 1 } }}
            >
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
                            {showDepartmentSelect && (
                                <TextField
                                    label="Department"
                                    select
                                    fullWidth
                                    required
                                    value={formData.departmentId}
                                    onChange={(e) => setFormData({ ...formData, departmentId: e.target.value })}
                                >
                                    {(isGlobalAdmin ? departments : userDepartments)?.map((dept: any) => (
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
                                    <MenuItem value="IN_PROGRESS">In Progress</MenuItem>
                                    <MenuItem value="ACTIVE">Active</MenuItem>
                                    <MenuItem value="ON_HOLD">On Hold</MenuItem>
                                    <MenuItem value="COMPLETED">Completed</MenuItem>
                                    <MenuItem value="CANCELLED">Cancelled</MenuItem>
                                </TextField>
                            </Box>
                            
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
                        </Box>
                    </DialogContent>
                    <DialogActions sx={{ p: 4 }}>
                        <Button onClick={handleClose} sx={{ fontWeight: '800' }}>CANCEL</Button>
                        <Button
                            type="submit"
                            variant="contained"
                            disabled={false}
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
