import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../lib/db';
import api from '../lib/api-client';
import {
    Card, CardContent, Typography, Grid, Button, Box, Chip,
    Dialog, DialogTitle, DialogContent, DialogActions, TextField, MenuItem,
    IconButton, Tooltip, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
    FormControl, InputLabel, Select, Checkbox, ListItemText
} from '@mui/material';
import { Plus, Calendar, Clock, MapPin, Edit, Trash2, Users, FileText, ChevronRight } from 'lucide-react';
import DashboardLayout from '../components/layout/DashboardLayout';
import { useAuth } from '../contexts/AuthContext';

export default function Meetings() {
    const { user } = useAuth();
    const [open, setOpen] = useState(false);
    const [editMeeting, setEditMeeting] = useState<any>(null);
    const [formData, setFormData] = useState({
        title: '',
        date: '',
        time: '',
        venue: '',
        meetingType: 'REVIEW',
        agenda: '',
        departmentId: '',
        meetingStatus: 'PENDING_APPROVAL',
        pastorIds: [] as string[]
    });

    const isSuperAdmin = user?.role === 'SUPER_ADMIN';

    const [page, setPage] = useState(1);
    const limit = 10;

    const meetings = useLiveQuery(() => db.meetings.orderBy('createdAt').reverse().toArray(), []) || [];
    const meta = { total: meetings.length, totalPages: Math.ceil((meetings.length || 1) / limit) };

    const departments = useLiveQuery(() => db.departments.toArray(), []) || [];
    const pastors = useLiveQuery(() => db.users.filter(u => ['PASTOR', 'ASSOCIATE_PASTOR', 'BISHOP', 'SUPER_ADMIN'].includes(u.role) && u.status === 'ACTIVE').toArray(), []) || [];

    const handleAction = async (payload: any, method: 'POST' | 'PATCH' | 'DELETE', id?: string) => {
        const actionId = id || crypto.randomUUID();
        const timestamp = Date.now();

        if (method !== 'DELETE') {
            await db.meetings.put({ 
                ...payload, 
                id: actionId, 
                syncStatus: 'PENDING',
                department: departments.find(d => d.id === payload.departmentId) || null,
                createdAt: new Date().toISOString()
            });
        } else {
            if (id) await db.meetings.delete(id);
        }

        await db.syncQueue.put({
            id: crypto.randomUUID(),
            timestamp,
            entity: 'MEETING',
            method,
            url: method === 'POST' ? '/meetings' : `/meetings/${actionId}`,
            payload: { ...payload, isOfflineSync: true },
            status: 'PENDING',
            retryCount: 0,
            errorLog: []
        });

        handleClose();
    };

    const handleOpen = (meeting: any = null) => {
        if (meeting) {
            setEditMeeting(meeting);
            setFormData({
                title: meeting.title,
                date: new Date(meeting.date).toISOString().split('T')[0],
                time: meeting.time,
                venue: meeting.venue,
                meetingType: meeting.meetingType,
                agenda: meeting.agenda,
                departmentId: meeting.departmentId,
                meetingStatus: meeting.meetingStatus,
                pastorIds: []
            });
        } else {
            setEditMeeting(null);
            setFormData({
                title: '',
                date: '',
                time: '',
                venue: '',
                meetingType: 'REVIEW',
                agenda: '',
                departmentId: isSuperAdmin ? '' : user?.departmentId || '',
                meetingStatus: 'PENDING_APPROVAL',
                pastorIds: []
            });
        }
        setOpen(true);
    };

    const handleClose = () => {
        setOpen(false);
        setEditMeeting(null);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (editMeeting) {
            handleAction({ ...formData, id: editMeeting.id }, 'PATCH', editMeeting.id);
        } else {
            if (formData.pastorIds.length !== 2) {
                alert("Exactly 2 Pastors must authorize this Strategic Briefing.");
                return;
            }
            handleAction(formData, 'POST');
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'SCHEDULED': return 'primary';
            case 'ONGOING': return 'warning';
            case 'COMPLETED': return 'success';
            case 'CANCELLED': return 'error';
            default: return 'default';
        }
    };

    return (
        <DashboardLayout>
            <Box sx={{ mb: 6, display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, justifyContent: 'space-between', alignItems: { xs: 'flex-start', sm: 'center' }, gap: 2 }}>
                <div>
                    <Typography variant="h3" fontWeight="950" sx={{ letterSpacing: -2, mb: 1, fontSize: { xs: '2rem', sm: '3rem' } }}>
                        STRATEGIC <span className="text-primary">BRIEFINGS</span>
                    </Typography>
                    <Typography color="textSecondary" variant="body1" sx={{ fontSize: { xs: '0.8rem', sm: '1rem' }, opacity: 0.7 }}>
                        Coordinating departmental syncs and executive reviews.
                    </Typography>
                </div>
                <Button
                    variant="contained"
                    startIcon={<Plus size={20} />}
                    onClick={() => handleOpen()}
                    sx={{ width: { xs: '100%', sm: 'auto' }, borderRadius: 3, px: 3, py: 1.5, fontWeight: '900', boxShadow: '0 0 20px var(--primary-glow)' }}
                >
                    SCHEDULE BRIEFING
                </Button>
            </Box>

            <Grid container spacing={3} mb={6}>
                {meetings === undefined ? <Typography p={3}>Scanning timeline...</Typography> : meetings?.slice(0, 3).map((meeting: any) => (
                    <Grid item xs={12} md={4} key={meeting.id}>
                        <Card sx={{ borderRadius: 4, height: '100%', border: '1px solid', borderColor: 'divider', position: 'relative' }}>
                            <CardContent sx={{ p: 3 }}>
                                <Box display="flex" justifyContent="space-between" mb={3}>
                                    <div className={`p-2 rounded-xl bg-${getStatusColor(meeting.meetingStatus)}.main/10 text-${getStatusColor(meeting.meetingStatus)}.main`}>
                                        <Calendar size={20} />
                                    </div>
                                    <Chip
                                        label={meeting.meetingStatus}
                                        color={getStatusColor(meeting.meetingStatus) as any}
                                        size="small"
                                        sx={{ fontWeight: 'bold' }}
                                    />
                                </Box>
                                <Typography variant="h6" fontWeight="800" gutterBottom noWrap>{meeting.title}</Typography>
                                <Typography variant="caption" color="textSecondary" sx={{ mb: 3, display: 'block' }}>
                                    {meeting.department?.name} • {meeting.meetingType}
                                </Typography>

                                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, color: 'text.secondary' }}>
                                        <Clock size={16} />
                                        <Typography variant="body2">{new Date(meeting.date).toLocaleDateString()} at {meeting.time}</Typography>
                                    </Box>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, color: 'text.secondary' }}>
                                        <MapPin size={16} />
                                        <Typography variant="body2" noWrap>{meeting.venue}</Typography>
                                    </Box>
                                </Box>
                            </CardContent>
                        </Card>
                    </Grid>
                ))}
            </Grid>

            {/* Table View - Hidden on Mobile */}
            <TableContainer component={Paper} elevation={0} sx={{ display: { xs: 'none', md: 'block' }, borderRadius: 4, border: '1px solid', borderColor: 'divider' }}>
                <Table>
                    <TableHead sx={{ bgcolor: 'action.hover' }}>
                        <TableRow>
                            <TableCell sx={{ fontWeight: '800' }}>Engagement</TableCell>
                            <TableCell sx={{ fontWeight: '800' }}>Deployment</TableCell>
                            <TableCell sx={{ fontWeight: '800' }}>Status</TableCell>
                            <TableCell sx={{ fontWeight: '800' }} align="right">Command</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {meetings?.map((meeting: any) => (
                            <TableRow key={meeting.id} hover>
                                <TableCell>
                                    <Typography fontWeight="700">{meeting.title}</Typography>
                                    <Typography variant="caption" color="textSecondary">{meeting.meetingType}</Typography>
                                </TableCell>
                                <TableCell>
                                    <Typography variant="body2" fontWeight="500">{new Date(meeting.date).toDateString()}</Typography>
                                    <Typography variant="caption" color="textSecondary">{meeting.venue}</Typography>
                                </TableCell>
                                <TableCell>
                                    <Chip label={meeting.meetingStatus} color={getStatusColor(meeting.meetingStatus) as any} size="small" sx={{ fontWeight: 'bold' }} />
                                </TableCell>
                                <TableCell align="right">
                                    <IconButton onClick={() => handleOpen(meeting)} size="small" color="primary"><Edit size={18} /></IconButton>
                                    <IconButton onClick={() => handleAction({ id: meeting.id }, 'DELETE', meeting.id)} size="small" color="error"><Trash2 size={18} /></IconButton>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </TableContainer>

            {/* Mobile Cards - Shown only on small screens */}
            <Box sx={{ display: { xs: 'flex', md: 'none' }, flexDirection: 'column', gap: 2 }}>
                {meetings?.map((meeting: any) => (
                    <Card key={meeting.id} sx={{ borderRadius: 3, border: '1px solid var(--glass-border)' }}>
                        <CardContent sx={{ p: 2 }}>
                            <Box display="flex" justifyContent="space-between" mb={2}>
                                <Chip label={meeting.meetingStatus} color={getStatusColor(meeting.meetingStatus) as any} size="small" />
                                <Box>
                                    <IconButton onClick={() => handleOpen(meeting)} size="small" color="primary"><Edit size={18} /></IconButton>
                                    <IconButton onClick={() => handleAction({ id: meeting.id }, 'DELETE', meeting.id)} size="small" color="error"><Trash2 size={18} /></IconButton>
                                </Box>
                            </Box>
                            <Typography variant="subtitle1" fontWeight="800" sx={{ mb: 1 }}>{meeting.title}</Typography>
                            <Grid container spacing={1}>
                                <Grid item xs={12}>
                                    <Box display="flex" alignItems="center" gap={1} color="text.secondary">
                                        <Calendar size={14} />
                                        <Typography variant="caption">{new Date(meeting.date).toDateString()} at {meeting.time}</Typography>
                                    </Box>
                                </Grid>
                                <Grid item xs={12}>
                                    <Box display="flex" alignItems="center" gap={1} color="text.secondary">
                                        <MapPin size={14} />
                                        <Typography variant="caption" noWrap>{meeting.venue}</Typography>
                                    </Box>
                                </Grid>
                            </Grid>
                        </CardContent>
                    </Card>
                ))}
            </Box>

            {meta.totalPages > 1 && (
                <Box display="flex" justifyContent="center" mt={4} gap={1}>
                    <Button 
                        disabled={page === 1} 
                        onClick={() => setPage(p => p - 1)}
                        size="small"
                        sx={{ fontWeight: 800 }}
                    >
                        PREV
                    </Button>
                    <Typography variant="caption" sx={{ display: 'flex', alignItems: 'center', fontWeight: 900, opacity: 0.5 }}>
                        {page} / {meta.totalPages}
                    </Typography>
                    <Button 
                        disabled={page >= meta.totalPages}
                        onClick={() => setPage(p => p + 1)}
                        size="small"
                        sx={{ fontWeight: 800 }}
                    >
                        NEXT
                    </Button>
                </Box>
            )}

            <Dialog 
                open={open} 
                onClose={handleClose} 
                maxWidth="sm" 
                fullWidth 
                PaperProps={{ sx: { borderRadius: 4, width: '95%', m: 1 } }}
            >
                <form onSubmit={handleSubmit}>
                    <DialogTitle sx={{ fontWeight: '900', pt: 4, px: 4 }}>
                        {editMeeting ? 'Recalibrate Briefing' : 'Initiate Strategic Briefing'}
                    </DialogTitle>
                    <DialogContent sx={{ px: 4 }}>
                        <Box display="flex" flexDirection="column" gap={3} sx={{ pt: 2 }}>
                            <TextField
                                label="Agenda Title"
                                fullWidth
                                required
                                value={formData.title}
                                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                            />
                            <Box display="flex" gap={2}>
                                <TextField
                                    label="Date"
                                    type="date"
                                    fullWidth
                                    required
                                    InputLabelProps={{ shrink: true }}
                                    inputProps={!editMeeting ? { min: new Date().toISOString().split('T')[0] } : {}}
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
                                label="Venue / Virtual Node"
                                fullWidth
                                required
                                value={formData.venue}
                                onChange={(e) => setFormData({ ...formData, venue: e.target.value })}
                            />
                            <TextField
                                label="Meeting Type"
                                select
                                fullWidth
                                value={formData.meetingType}
                                onChange={(e) => setFormData({ ...formData, meetingType: e.target.value })}
                                SelectProps={{ inputProps: { tabIndex: -1 } }}
                            >
                                <MenuItem value="REVIEW">Executive Review</MenuItem>
                                <MenuItem value="SYNC">Department Sync</MenuItem>
                                <MenuItem value="PLANNING">Strategic Planning</MenuItem>
                                <MenuItem value="URGENT">Crisis Management</MenuItem>
                            </TextField>
                            <TextField
                                label="Agenda Objectives"
                                multiline
                                rows={3}
                                fullWidth
                                value={formData.agenda}
                                onChange={(e) => setFormData({ ...formData, agenda: e.target.value })}
                            />
                            {isSuperAdmin && (
                                <TextField
                                    label="Assigned Department"
                                    select
                                    fullWidth
                                    required
                                    value={formData.departmentId}
                                    onChange={(e) => setFormData({ ...formData, departmentId: e.target.value })}
                                    SelectProps={{ inputProps: { tabIndex: -1 } }}
                                >
                                    {departments?.map((dept: any) => (
                                        <MenuItem key={dept.id} value={dept.id}>{dept.name}</MenuItem>
                                    ))}
                                </TextField>
                            )}

                            {!editMeeting && (
                                <FormControl fullWidth required>
                                    <InputLabel id="pastors-label" sx={{ fontWeight: 700 }}>Choose 2 Authorizing Pastors</InputLabel>
                                    <Select
                                        labelId="pastors-label"
                                        id="pastors-select"
                                        multiple
                                        label="Choose 2 Authorizing Pastors"
                                        value={formData.pastorIds}
                                        onChange={(e) => {
                                            const values = e.target.value as string[];
                                            if (values.length <= 2) setFormData({ ...formData, pastorIds: values });
                                        }}
                                        renderValue={(sel: any) => (
                                            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                                                {pastors?.filter((p: any) => (sel as string[]).includes(p.id)).map((p: any) => (
                                                    <Chip key={p.id} label={p.name} size="small" />
                                                ))}
                                            </Box>
                                        )}
                                    >
                                        {pastors?.length === 0 && <MenuItem disabled>No Pastors found</MenuItem>}
                                        {pastors?.map((p: any) => (
                                            <MenuItem key={p.id} value={p.id}>
                                                <Checkbox checked={formData.pastorIds.includes(p.id)} />
                                                <ListItemText primary={p.name} secondary={p.role.replace('_', ' ')} />
                                            </MenuItem>
                                        ))}
                                    </Select>
                                </FormControl>
                            )}
                        </Box>
                    </DialogContent>
                    <DialogActions sx={{ p: 4 }}>
                        <Button onClick={handleClose} sx={{ fontWeight: 'bold' }}>Abort</Button>
                        <Button
                            type="submit"
                            variant="contained"
                            disabled={false}
                            sx={{ borderRadius: 2, px: 4, fontWeight: 'bold' }}
                        >
                            {editMeeting ? 'Confirm Adjustments' : 'Initialize Briefing'}
                        </Button>
                    </DialogActions>
                </form>
            </Dialog>
        </DashboardLayout>
    );
}
