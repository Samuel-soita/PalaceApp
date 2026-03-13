import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../lib/api-client';
import {
    Card, CardContent, Typography, Grid, Button, Box, Chip,
    Dialog, DialogTitle, DialogContent, DialogActions, TextField, MenuItem,
    IconButton, Tooltip, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow
} from '@mui/material';
import { Plus, Calendar, Clock, MapPin, Edit, Trash2, Users, FileText, ChevronRight } from 'lucide-react';
import DashboardLayout from '../components/layout/DashboardLayout';
import { useAuth } from '../contexts/AuthContext';

export default function Meetings() {
    const { user } = useAuth();
    const queryClient = useQueryClient();
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
        meetingStatus: 'SCHEDULED'
    });

    const isSuperAdmin = user?.role === 'SUPER_ADMIN';

    const { data: meetings, isLoading } = useQuery(['meetings'], async () => {
        const url = isSuperAdmin ? '/meetings' : `/meetings?departmentId=${user?.departmentId}`;
        const res = await api.get(url);
        return res.data;
    });

    const { data: departments } = useQuery(['departments'], async () => {
        const res = await api.get('/departments');
        return res.data;
    }, { enabled: isSuperAdmin });

    const createMutation = useMutation((data: any) => api.post('/meetings', data), {
        onSuccess: () => {
            queryClient.invalidateQueries(['meetings']);
            handleClose();
        }
    });

    const updateMutation = useMutation((data: any) => api.put(`/meetings/${editMeeting.id}`, data), {
        onSuccess: () => {
            queryClient.invalidateQueries(['meetings']);
            handleClose();
        }
    });

    const deleteMutation = useMutation((id: string) => api.delete(`/meetings/${id}`), {
        onSuccess: () => queryClient.invalidateQueries(['meetings'])
    });

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
                meetingStatus: meeting.meetingStatus
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
                meetingStatus: 'SCHEDULED'
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
            updateMutation.mutate(formData);
        } else {
            createMutation.mutate(formData);
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
            <Box sx={{ mb: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <Typography variant="h4" fontWeight="900" sx={{ letterSpacing: -1, mb: 1 }}>
                        Strategic Briefings
                    </Typography>
                    <Typography color="textSecondary" variant="body1">
                        Coordinating departmental syncs and executive reviews.
                    </Typography>
                </div>
                <Button
                    variant="contained"
                    startIcon={<Plus size={20} />}
                    onClick={() => handleOpen()}
                    sx={{ borderRadius: 2, px: 3, py: 1.5, fontWeight: 'bold' }}
                >
                    Schedule Briefing
                </Button>
            </Box>

            <Grid container spacing={3} mb={6}>
                {isLoading ? <Typography p={3}>Scanning timeline...</Typography> : meetings?.slice(0, 3).map((meeting: any) => (
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

            <TableContainer component={Paper} elevation={0} sx={{ borderRadius: 4, border: '1px solid', borderColor: 'divider' }}>
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
                                    <IconButton onClick={() => deleteMutation.mutate(meeting.id)} size="small" color="error"><Trash2 size={18} /></IconButton>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </TableContainer>

            <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 4 } }}>
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
                        </Box>
                    </DialogContent>
                    <DialogActions sx={{ p: 4 }}>
                        <Button onClick={handleClose} sx={{ fontWeight: 'bold' }}>Abort</Button>
                        <Button
                            type="submit"
                            variant="contained"
                            disabled={createMutation.isLoading || updateMutation.isLoading}
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
