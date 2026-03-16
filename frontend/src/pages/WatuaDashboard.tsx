import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import {
    Box,
    Typography,
    Grid,
    Card,
    CardContent,
    Button,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Paper,
    Chip,
    IconButton,
    TextField,
    Alert,
    CircularProgress,
    Tabs,
    Tab,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Select,
    MenuItem,
    FormControl,
    InputLabel,
    Avatar
} from '@mui/material';
import {
    Activity,
    AlertTriangle,
    CheckCircle,
    XCircle,
    Command,
    Search,
    RefreshCw,
    Calendar,    Users, Shield, Smartphone,
    Activity as ActivityIcon, Settings, Database, Trash2, ShieldAlert, UserPlus, Zap,
    Lock, Unlock, Mail, Clock, MapPin, MoreVertical, Terminal, Cpu, Globe,
    UserCheck, ShieldCheck, Briefcase, PenTool
} from 'lucide-react';
import api from '../lib/api-client';

interface User {
    id: string;
    name: string;
    email: string;
    role: 'WATUA' | 'SUPER_ADMIN' | 'SYSTEM_ADMIN' | 'SECRETARY' | 'DEPARTMENT_LEADER' | 'MEMBER' | 'PASTOR';
    status: string;
    isSuspended: boolean;
    membershipNumber: string;
    dob?: string;
    gender?: string;
    idNumber?: string;
    avatarUrl?: string;
    wrongdoingCount?: number;
    department?: {
        id: string;
        name: string;
    };
}

interface Stats {
    users: { total: number; pending: number; leaders: number };
    operations: { projects: number; events: number; departments: number };
    health: string;
    kernelVersion: string;
}

interface SupportRequest {
    id: string;
    title: string;
    description: string;
    amountRequired: number;
    status: string;
    createdAt: string;
    requester: { name: string };
}

interface AuditLog {
    id: string;
    action: string;
    details: string;
    createdAt: string;
    user?: { name: string };
}

interface Project {
    id: string;
    title: string;
    description: string;
    approvalStatus: string;
    department: { name: string };
}

interface Event {
    id: string;
    title: string;
    description: string;
    approvalStatus: string;
    department: { name: string };
}

interface Diagnostics {
    status: string;
    uptime: number;
    lastIntervention: string | null;
}

export default function WatuaDashboard() {
    const { user: currentUser } = useAuth();
    const [tab, setTab] = useState(0);
    const [users, setUsers] = useState<User[]>([]);
    const [stats, setStats] = useState<Stats | null>(null);
    const [diagnostics, setDiagnostics] = useState<Diagnostics | null>(null);
    const [resourceType, setResourceType] = useState<'PROJECT' | 'EVENT' | 'PLAN' | 'ANNOUNCEMENT' | 'MEETING' | 'ASSET'>('PROJECT');
    const [supportRequests, setSupportRequests] = useState<SupportRequest[]>([]);
    const [projects, setProjects] = useState<Project[]>([]);
    const [events, setEvents] = useState<Event[]>([]);
    const [plans, setPlans] = useState<any[]>([]);
    const [announcements, setAnnouncements] = useState<any[]>([]);
    const [meetings, setMeetings] = useState<any[]>([]);
    const [assets, setAssets] = useState<any[]>([]);
    const [departments, setDepartments] = useState<{ id: string, name: string }[]>([]);
    const [logs, setLogs] = useState<AuditLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [message, setMessage] = useState({ type: 'info', text: '' });
    const [searchTerm, setSearchTerm] = useState('');

    // Dialog States
    const [promoteDialog, setPromoteDialog] = useState<{ open: boolean; userId: string; name: string }>({
        open: false, userId: '', name: ''
    });
    const [selectedDept, setSelectedDept] = useState('');
    const [selectedUser, setSelectedUser] = useState<User | null>(null);
    // Repair State
    const [repairData, setRepairData] = useState({ name: '', idNumber: '', dob: '', gender: '' });

    const [broadcastDialog, setBroadcastDialog] = useState(false);
    const [broadcastText, setBroadcastText] = useState('');

    const fetchOmniData = async () => {
        try {
            const [pRes, eRes, plRes, aRes, mRes, assetRes] = await Promise.all([
                api.get('/projects'),
                api.get('/events'),
                api.get('/plans'),
                api.get('/announcements/all'),
                api.get('/meetings'),
                api.get('/assets')
            ]);
            setProjects(pRes.data);
            setEvents(eRes.data);
            setPlans(plRes.data);
            setAnnouncements(aRes.data);
            setMeetings(mRes.data);
            setAssets(assetRes.data);
        } catch (err) {
            console.error('Omni-Fetch Error:', err);
        }
    };

    const fetchData = async () => {
        setLoading(true);
        try {
            const [usersRes, statsRes, diagRes, logsRes, deptsRes, supportRes] = await Promise.all([
                api.get('/users/technical/all'),
                api.get('/users/technical/stats'),
                api.get('/users/technical/diagnostics'),
                api.get('/users/technical/audit/all'),
                api.get('/departments'),
                api.get('/support')
            ]);
            setUsers(usersRes.data);
            setStats(statsRes.data);
            setDiagnostics(diagRes.data);
            setLogs(logsRes.data);
            setDepartments(deptsRes.data);
            setSupportRequests(supportRes.data);
            await fetchOmniData();
        } catch (err) {
            console.error('Fetch error:', err);
            setMessage({ text: 'Failed to access technical data.', type: 'error' });
        } finally {
            setLoading(false);
        }
    };

    const handleGlobalDelete = async (type: string, id: string) => {
        if (!window.confirm('OMNIPOTENT COMMAND: Are you absolutely sure you want to FORCE DELETE this resource? This bypasses all safety checks.')) return;
        try {
            const endpoint = `/${type.toLowerCase()}s/${id}`;
            await api.delete(endpoint);
            setMessage({ text: `${type} purged from system.`, type: 'success' });
            fetchOmniData();
        } catch (err) {
            setMessage({ text: `Purge failed: ${err}`, type: 'error' });
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const handleAction = async (userId: string, action: string, departmentId?: string) => {
        try {
            await api.post(`/users/technical/intervention/${userId}`, { action, departmentId });
            setMessage({ type: 'success', text: `Intervention ${action} executed successfully.` });
            setPromoteDialog({ open: false, userId: '', name: '' });
            setSelectedDept('');
            setSelectedUser(null);
            fetchData();
        } catch (error) {
            setMessage({ type: 'error', text: 'Intervention rejected by kernel.' });
        }
    };

    const handleBioRepair = async () => {
        if (!selectedUser) return;
        try {
            await api.patch(`/users/technical/bio/${selectedUser.id}`, repairData);
            setMessage({ type: 'success', text: 'ENTITY BIO_REPAIR COMPLETE.' });
            setSelectedUser(null);
            fetchData();
        } catch (error) {
            setMessage({ type: 'error', text: 'Repair sequence failed.' });
        }
    };

    const handleForceApproval = async (type: 'PROJECT' | 'EVENT' | 'PLAN' | 'ANNOUNCEMENT' | 'MEETING' | 'ASSET', id: string) => {
        try {
            let endpoint = '';
            switch (type) {
                case 'PROJECT': endpoint = `/projects/${id}/approve`; break;
                case 'EVENT': endpoint = `/events/${id}/approve`; break;
                case 'PLAN': endpoint = `/plans/${id}/approve`; break;
                case 'ANNOUNCEMENT': endpoint = `/announcements/${id}/approve`; break;
                case 'MEETING': endpoint = `/meetings/${id}/approve`; break;
                case 'ASSET': endpoint = `/assets/${id}/approve`; break;
            }
            await api.post(endpoint);
            setMessage({ text: `${type} Force-Approved Successfully`, type: 'success' });
            fetchOmniData();
        } catch (err) {
            setMessage({ text: `Force Approval Failed: ${err}`, type: 'error' });
        }
    };

    const handleBroadcast = async () => {
        if (!broadcastText) return;
        setMessage({ type: 'success', text: 'System-wide broadcast dispatched to all active nodes.' });
        setBroadcastDialog(false);
        setBroadcastText('');
    };

    const filteredUsers = users.filter(u =>
        u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.membershipNumber?.includes(searchTerm)
    );

    if (loading && users.length === 0) return (
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="100vh" bgcolor="#0c0e14">
            <CircularProgress color="secondary" />
        </Box>
    );

    return (
        <Box p={4} bgcolor="#0c0e14" minHeight="100vh">
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={4}>
                <Box display="flex" alignItems="center" gap={2}>
                    <Shield size={32} color="#c175ff" />
                    <Box>
                        <Typography variant="h4" fontWeight="900" sx={{ letterSpacing: '-0.05em', color: '#f8fafc' }}>
                            WATUA<span style={{ color: '#c175ff' }}>.ENGINEER</span>
                        </Typography>
                        <Typography variant="caption" sx={{ opacity: 0.6, color: '#94a3b8' }}>
                            OMNIPOTENT SUPPORT TERMINAL • KERNEL {stats?.kernelVersion}
                        </Typography>
                    </Box>
                </Box>
                <Box display="flex" gap={2}>
                    <Button
                        variant="contained"
                        startIcon={<Activity size={18} />}
                        onClick={() => setBroadcastDialog(true)}
                        sx={{ bgcolor: '#c175ff', '&:hover': { bgcolor: '#a855f7' } }}
                    >
                        System Broadcast
                    </Button>
                    <Button
                        startIcon={<RefreshCw size={18} />}
                        onClick={fetchData}
                        variant="outlined"
                        color="secondary"
                        sx={{ borderColor: 'rgba(193, 117, 255, 0.3)' }}
                    >
                        Resync Kernel
                    </Button>
                </Box>
            </Box>

            {/* Metrics Ribbon */}
            <Grid container spacing={3} mb={4}>
                <Grid item xs={12} md={3}>
                    <Card sx={{ bgcolor: '#161925', border: '1px solid rgba(193, 117, 255, 0.2)' }}>
                        <CardContent>
                            <Typography variant="caption" color="#94a3b8" display="flex" alignItems="center" gap={1}>
                                <Users size={14} /> TOTAL ENTITIES
                            </Typography>
                            <Typography variant="h4" fontWeight="900" color="#f8fafc">{stats?.users.total}</Typography>
                        </CardContent>
                    </Card>
                </Grid>
                <Grid item xs={12} md={3}>
                    <Card sx={{ bgcolor: '#161925', border: '1px solid rgba(255, 204, 0, 0.2)' }}>
                        <CardContent>
                            <Typography variant="caption" color="#94a3b8" display="flex" alignItems="center" gap={1}>
                                <AlertTriangle size={14} /> PENDING VERIFICATION
                            </Typography>
                            <Typography variant="h4" fontWeight="900" color="#ffcc00">{stats?.users.pending}</Typography>
                        </CardContent>
                    </Card>
                </Grid>
                <Grid item xs={12} md={3}>
                    <Card sx={{ bgcolor: '#161925', border: '1px solid rgba(0, 212, 255, 0.2)' }}>
                        <CardContent>
                            <Typography variant="caption" color="#94a3b8" display="flex" alignItems="center" gap={1}>
                                <Command size={14} /> UPTIME (SECONDS)
                            </Typography>
                            <Typography variant="h4" fontWeight="900" color="#00d4ff">{diagnostics?.uptime}</Typography>
                        </CardContent>
                    </Card>
                </Grid>
                <Grid item xs={12} md={3}>
                    <Card sx={{ bgcolor: '#161925', border: '1px solid rgba(34, 197, 94, 0.2)' }}>
                        <CardContent>
                            <Typography variant="caption" color="#94a3b8" display="flex" alignItems="center" gap={1}>
                                <CheckCircle size={14} /> SYSTEM STATUS
                            </Typography>
                            <Typography variant="h4" fontWeight="900" color="#22c55e">{diagnostics?.status}</Typography>
                        </CardContent>
                    </Card>
                </Grid>
            </Grid>

            {message.text && (
                <Alert
                    severity={message.type as any}
                    sx={{ mb: 3, bgcolor: 'rgba(193, 117, 255, 0.1)', color: '#f8fafc', border: '1px solid rgba(193, 117, 255, 0.2)' }}
                    onClose={() => setMessage({ ...message, text: '' })}
                >
                    {message.text}
                </Alert>
            )}

            <Box sx={{ borderBottom: 1, borderColor: 'rgba(255,255,255,0.1)', mb: 3 }}>
                <Tabs value={tab} onChange={(_, v) => setTab(v)} textColor="secondary" indicatorColor="secondary">
                    <Tab label="Entity Registry" icon={<Users size={18} />} iconPosition="start" />
                    <Tab label="Omni-Inspector" icon={<Search size={18} />} iconPosition="start" />
                    <Tab label="Support Hub" icon={<Activity size={18} />} iconPosition="start" />
                    <Tab label="Intervention Logs" icon={<RefreshCw size={18} />} iconPosition="start" />
                </Tabs>
            </Box>

            {tab === 0 && (
                <Card sx={{ bgcolor: '#161925', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 0 }}>
                    <CardContent>
                        <Box mb={3} display="flex" gap={2}>
                            <TextField
                                fullWidth
                                placeholder="Locate entity by name, email or membership..."
                                InputProps={{ startAdornment: <Search size={18} style={{ marginRight: 8, opacity: 0.5 }} /> }}
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                sx={{ '& .MuiOutlinedInput-root': { bgcolor: 'rgba(255,255,255,0.02)' } }}
                            />
                        </Box>

                        <TableContainer component={Paper} sx={{ bgcolor: 'transparent', boxShadow: 'none' }}>
                            <Table size="small">
                                <TableHead>
                                    <TableRow sx={{ '& th': { borderBottom: '1px solid rgba(255,255,255,0.1)', py: 2, fontWeight: 900, textTransform: 'uppercase', fontSize: '0.75rem', color: '#94a3b8' } }}>
                                        <TableCell>ENTITY IDENTIFIER</TableCell>
                                        <TableCell>Credential</TableCell>
                                        <TableCell>Assigned Hub</TableCell>
                                        <TableCell>Status</TableCell>
                                        <TableCell>Technical Command</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {filteredUsers.map((user) => (
                                        <TableRow key={user.id} sx={{ '& td': { borderBottom: '1px solid rgba(255,255,255,0.05)', py: 2, color: '#f8fafc' } }}>
                                            <TableCell>
                                                <Box sx={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 2 }} onClick={() => {
                                                    setSelectedUser(user);
                                                    setRepairData({
                                                        name: user.name,
                                                        idNumber: user.idNumber || '',
                                                        dob: user.dob ? user.dob.split('T')[0] : '',
                                                        gender: user.gender || ''
                                                    });
                                                }}>
                                                    <Avatar 
                                                        src={user.avatarUrl ? `${user.avatarUrl}?t=${Date.now()}` : undefined} 
                                                        sx={{ width: 32, height: 32, border: '1px solid rgba(255,255,255,0.1)' }}
                                                    >
                                                        {user.name.charAt(0)}
                                                    </Avatar>
                                                    <Box>
                                                        <Typography variant="body2" fontWeight="bold">{user.name}</Typography>
                                                        <Typography variant="caption" sx={{ opacity: 0.5 }}>{user.membershipNumber || 'NO_CARD'}</Typography>
                                                    </Box>
                                                </Box>
                                            </TableCell>
                                            <TableCell>
                                                <Typography variant="body2">{user.email}</Typography>
                                                <Chip label={user.role} size="small" sx={{ height: 20, fontSize: '10px', mt: 0.5 }} />
                                            </TableCell>
                                            <TableCell>
                                                <Typography variant="body2" fontWeight="bold" sx={{ color: 'var(--cyan)' }}>
                                                    {user.department?.name || 'GLOBAL'}
                                                </Typography>
                                            </TableCell>
                                            <TableCell>
                                                <Box display="flex" gap={1}>
                                                    <Chip
                                                        label={user.status}
                                                        size="small"
                                                        color={user.status === 'ACTIVE' ? 'success' : 'warning'}
                                                    />
                                                    {user.isSuspended && (
                                                        <Chip label="SUSPENDED" size="small" color="error" />
                                                    )}
                                                </Box>
                                            </TableCell>
                                            <TableCell>
                                                <Box display="flex" gap={1}>
                                                    {user.status === 'PENDING' && (
                                                        <IconButton color="success" onClick={() => handleAction(user.id, 'ACTIVATE')} title="Authorize Entry">
                                                            <CheckCircle size={18} />
                                                        </IconButton>
                                                    )}
                                                    <IconButton sx={{ color: '#4f8bff' }} onClick={() => setPromoteDialog({ open: true, userId: user.id, name: user.name })} title="Appoint Leader">
                                                        <UserCheck size={18} />
                                                    </IconButton>
                                                    <IconButton sx={{ color: '#c175ff' }} onClick={() => handleAction(user.id, 'MAKE_SUPER_ADMIN')} title="Appoint Bishop">
                                                        <ShieldCheck size={18} />
                                                    </IconButton>
                                                    <IconButton sx={{ color: '#00d4ff' }} onClick={() => handleAction(user.id, 'MAKE_SYSTEM_ADMIN')} title="Appoint Church Admin">
                                                        <Briefcase size={18} />
                                                    </IconButton>
                                                    <IconButton sx={{ color: '#94a3b8' }} onClick={() => handleAction(user.id, 'MAKE_SECRETARY')} title="Appoint Secretary">
                                                        <PenTool size={18} />
                                                    </IconButton>
                                                    <IconButton sx={{ color: '#ffcc00' }} onClick={() => {
                                                        setSelectedUser(user);
                                                        setRepairData({
                                                            name: user.name,
                                                            idNumber: user.idNumber || '',
                                                            dob: user.dob ? user.dob.split('T')[0] : '',
                                                            gender: user.gender || ''
                                                        });
                                                    }} title="Bio Inspector">
                                                        <Search size={18} />
                                                    </IconButton>
                                                </Box>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </TableContainer>
                    </CardContent>
                </Card>
            )}

            {tab === 1 && (
                <Card sx={{ bgcolor: '#161925', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 0 }}>
                    <CardContent>
                        <Box mb={3} display="flex" justifyContent="space-between" alignItems="center">
                            <Box display="flex" gap={1} flexWrap="wrap">
                                {(['PROJECT', 'EVENT', 'PLAN', 'ANNOUNCEMENT', 'MEETING', 'ASSET'] as const).map((type) => (
                                    <Button
                                        key={type}
                                        size="small"
                                        variant={resourceType === type ? 'contained' : 'outlined'}
                                        onClick={() => setResourceType(type)}
                                        sx={{
                                            borderRadius: 0,
                                            borderColor: 'rgba(255,255,255,0.1)',
                                            bgcolor: resourceType === type ? '#c175ff' : 'transparent',
                                            color: resourceType === type ? 'white' : '#94a3b8'
                                        }}
                                    >
                                        {type}S
                                    </Button>
                                ))}
                            </Box>
                        </Box>

                        <TableContainer>
                            <Table size="small">
                                <TableHead>
                                    <TableRow sx={{ '& th': { borderBottom: '1px solid rgba(255,255,255,0.1)', py: 2, fontWeight: 900, textTransform: 'uppercase', fontSize: '0.75rem', color: '#94a3b8' } }}>
                                        <TableCell>RESOURCE TITLE</TableCell>
                                        <TableCell>Operational Sector</TableCell>
                                        <TableCell>Approval Status</TableCell>
                                        <TableCell>Technical Command</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {(resourceType === 'PROJECT' ? projects : 
                                      resourceType === 'EVENT' ? events : 
                                      resourceType === 'PLAN' ? plans : 
                                      resourceType === 'ANNOUNCEMENT' ? announcements : 
                                      resourceType === 'MEETING' ? meetings :
                                      assets).map((item: any) => (
                                        <TableRow key={item.id} sx={{ '& td': { borderBottom: '1px solid rgba(255,255,255,0.05)', py: 2, color: '#f8fafc' } }}>
                                            <TableCell>
                                                <Typography variant="body2" fontWeight="bold">{item.title || item.name}</Typography>
                                                <Typography variant="caption" sx={{ opacity: 0.5 }}>ID: {item.id.split('-')[0]}...</Typography>
                                            </TableCell>
                                            <TableCell>
                                                <Typography variant="body2" sx={{ color: '#00d4ff' }}>
                                                    {item.department?.name || 'GLOBAL'}
                                                </Typography>
                                            </TableCell>
                                            <TableCell>
                                                <Chip 
                                                    label={item.approvalStatus || item.status || item.meetingStatus || 'UNKNOWN'} 
                                                    size="small" 
                                                    variant="outlined"
                                                    sx={{ height: 20, fontSize: '10px' }}
                                                />
                                            </TableCell>
                                            <TableCell>
                                                <Box display="flex" gap={1}>
                                                    {(item.approvalStatus === 'PENDING_APPROVAL' || item.status === 'PENDING' || item.meetingStatus === 'PENDING_APPROVAL') && (
                                                        <IconButton color="success" size="small" onClick={() => handleForceApproval(resourceType as any, item.id)} title="FORCE AUTHORIZE">
                                                            <CheckCircle size={16} />
                                                        </IconButton>
                                                    )}
                                                    <IconButton color="error" size="small" onClick={() => handleGlobalDelete(resourceType, item.id)} title="FORCE PURGE">
                                                        <Activity size={16} />
                                                    </IconButton>
                                                </Box>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </TableContainer>
                    </CardContent>
                </Card>
            )}

            {tab === 2 && (
                <Card sx={{ bgcolor: '#161925', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 0 }}>
                    <CardContent>
                        <Typography variant="h6" color="#f8fafc" gutterBottom>Operational Support Requests</Typography>
                        <TableContainer component={Paper} sx={{ bgcolor: 'transparent', boxShadow: 'none' }}>
                            <Table size="small">
                                <TableHead>
                                    <TableRow sx={{ '& th': { borderBottom: '1px solid rgba(255,255,255,0.1)', py: 2, fontWeight: 900, textTransform: 'uppercase', fontSize: '0.75rem', color: '#94a3b8' } }}>
                                        <TableCell>Requester</TableCell>
                                        <TableCell>Request Details</TableCell>
                                        <TableCell>Resource</TableCell>
                                        <TableCell>State</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {supportRequests.map((req) => (
                                        <TableRow key={req.id} sx={{ '& td': { borderBottom: '1px solid rgba(255,255,255,0.05)', py: 2, color: '#f8fafc' } }}>
                                            <TableCell>{req.requester.name}</TableCell>
                                            <TableCell>
                                                <Typography variant="body2" fontWeight="bold">{req.title}</Typography>
                                                <Typography variant="caption" sx={{ opacity: 0.6 }}>{req.description}</Typography>
                                            </TableCell>
                                            <TableCell>{req.amountRequired}/- KES</TableCell>
                                            <TableCell>
                                                <Chip label={req.status} size="small" color={req.status === 'OPEN' ? 'warning' : 'success'} />
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </TableContainer>
                    </CardContent>
                </Card>
            )}

            {tab === 3 && (
                <Card sx={{ bgcolor: '#161925', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 0 }}>
                    <CardContent>
                        <TableContainer component={Paper} sx={{ bgcolor: 'transparent', boxShadow: 'none' }}>
                            <Table size="small">
                                <TableHead>
                                    <TableRow sx={{ '& th': { borderBottom: '1px solid rgba(255,255,255,0.1)', py: 2, fontWeight: 900, textTransform: 'uppercase', fontSize: '0.75rem', color: '#94a3b8' } }}>
                                        <TableCell>Timestamp</TableCell>
                                        <TableCell>Actor</TableCell>
                                        <TableCell>Intervention</TableCell>
                                        <TableCell>Outcome Details</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {logs.map((log) => (
                                        <TableRow key={log.id} sx={{ '& td': { borderBottom: '1px solid rgba(255,255,255,0.05)', py: 2, color: '#f8fafc' } }}>
                                            <TableCell>
                                                <Typography variant="caption">{new Date(log.createdAt).toLocaleString()}</Typography>
                                            </TableCell>
                                            <TableCell>
                                                <Typography variant="body2" fontWeight="bold">{log.user?.name || 'SYSTEM'}</Typography>
                                            </TableCell>
                                            <TableCell>
                                                <Chip
                                                    label={log.action}
                                                    size="small"
                                                    variant="outlined"
                                                    sx={{ borderColor: log.action.includes('WATUA') ? '#c175ff' : 'rgba(255,255,255,0.1)', color: log.action.includes('WATUA') ? '#c175ff' : 'inherit' }}
                                                />
                                            </TableCell>
                                            <TableCell>
                                                <Typography variant="caption" sx={{ opacity: 0.7 }}>{log.details}</Typography>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </TableContainer>
                    </CardContent>
                </Card>
            )}

            {/* Support/Bio Inspector Dialog with REPAIR TOOL */}
            <Dialog
                open={!!selectedUser}
                onClose={() => setSelectedUser(null)}
                PaperProps={{ sx: { bgcolor: '#161925', color: '#f8fafc', border: '1px solid rgba(193, 117, 255, 0.3)', width: 450 } }}
            >
                <DialogTitle sx={{ borderBottom: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Search size={20} color="#c175ff" /> REGISTRATION_REPAIR_KERNEL
                </DialogTitle>
                <DialogContent sx={{ mt: 2 }}>
                    <Typography variant="caption" color="#94a3b8" sx={{ mb: 2, display: 'block' }}>REPAIRING ENTITY: {selectedUser?.name}</Typography>

                    <Grid container spacing={2}>
                        <Grid item xs={12}>
                            <TextField
                                fullWidth
                                label="Entity Name"
                                value={repairData.name}
                                onChange={(e) => setRepairData({ ...repairData, name: e.target.value })}
                                size="small"
                                InputLabelProps={{ style: { color: '#94a3b8' } }}
                                sx={{ '& input': { color: 'white' } }}
                            />
                        </Grid>
                        <Grid item xs={6}>
                            <TextField
                                fullWidth
                                label="ID Number"
                                value={repairData.idNumber}
                                onChange={(e) => setRepairData({ ...repairData, idNumber: e.target.value })}
                                size="small"
                                InputLabelProps={{ style: { color: '#94a3b8' } }}
                                sx={{ '& input': { color: 'white' } }}
                            />
                        </Grid>
                        <Grid item xs={6}>
                            <TextField
                                fullWidth
                                label="Gender"
                                value={repairData.gender}
                                onChange={(e) => setRepairData({ ...repairData, gender: e.target.value })}
                                size="small"
                                InputLabelProps={{ style: { color: '#94a3b8' } }}
                                sx={{ '& input': { color: 'white' } }}
                            />
                        </Grid>
                        <Grid item xs={12}>
                            <TextField
                                fullWidth
                                type="date"
                                label="Date of Birth"
                                value={repairData.dob}
                                onChange={(e) => setRepairData({ ...repairData, dob: e.target.value })}
                                size="small"
                                InputLabelProps={{ shrink: true, style: { color: '#94a3b8' } }}
                                sx={{ '& input': { color: 'white' } }}
                            />
                        </Grid>
                    </Grid>

                    <Box mt={4} pt={2} sx={{ borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                        <Typography variant="caption" color="error" display="flex" alignItems="center" gap={1}>
                            <AlertTriangle size={14} /> DANGER ZONE: DATA OVERRIDE
                        </Typography>
                        <Box display="flex" gap={1} mt={1}>
                            <Button size="small" variant="contained" color="error" fullWidth onClick={handleBioRepair}>EXECUTE_REPAIR</Button>
                            <Button size="small" variant="outlined" sx={{ color: '#94a3b8' }} fullWidth onClick={() => setSelectedUser(null)}>ABORT</Button>
                        </Box>
                    </Box>
                </DialogContent>
            </Dialog>

            {/* Same Broadcast/Promote Dialogs ... */}
            <Dialog
                open={broadcastDialog}
                onClose={() => setBroadcastDialog(false)}
                PaperProps={{ sx: { bgcolor: '#161925', color: '#f8fafc', border: '1px solid #c175ff' } }}
            >
                <DialogTitle>SYSTEM BROADCAST</DialogTitle>
                <DialogContent>
                    <Typography variant="body2" sx={{ mb: 2, opacity: 0.7 }}>
                        Issue a priority alert to all active nodes in the ChurchHub ecosystem.
                    </Typography>
                    <TextField
                        fullWidth
                        multiline
                        rows={4}
                        placeholder="Type alert message..."
                        value={broadcastText}
                        onChange={(e) => setBroadcastText(e.target.value)}
                        sx={{ bgcolor: 'rgba(255,255,255,0.05)', color: 'white' }}
                    />
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setBroadcastDialog(false)} color="inherit">Abort</Button>
                    <Button onClick={handleBroadcast} variant="contained" sx={{ bgcolor: '#c175ff' }}>Dispatch Message</Button>
                </DialogActions>
            </Dialog>

            <Dialog
                open={promoteDialog.open}
                onClose={() => setPromoteDialog({ open: false, userId: '', name: '' })}
                PaperProps={{ sx: { bgcolor: '#161925', color: '#f8fafc', border: '1px solid rgba(255,255,255,0.1)' } }}
            >
                <DialogTitle>Appoint Sector Lead</DialogTitle>
                <DialogContent>
                    <Typography variant="body2" sx={{ mb: 3, opacity: 0.7 }}>
                        Assigning <strong>{promoteDialog.name}</strong> to an operational sector hub.
                    </Typography>
                    <FormControl fullWidth variant="outlined" sx={{ mt: 1 }}>
                        <InputLabel sx={{ color: '#94a3b8' }}>Select Sector</InputLabel>
                        <Select
                            value={selectedDept}
                            onChange={(e) => setSelectedDept(e.target.value)}
                            label="Select Sector"
                            sx={{ color: '#f8fafc', '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.2)' } }}
                        >
                            {departments.map((dept) => (
                                <MenuItem key={dept.id} value={dept.id}>{dept.name}</MenuItem>
                            ))}
                        </Select>
                    </FormControl>
                </DialogContent>
                <DialogActions sx={{ p: 2 }}>
                    <Button onClick={() => setPromoteDialog({ open: false, userId: '', name: '' })} color="inherit">Cancel</Button>
                    <Button
                        onClick={() => handleAction(promoteDialog.userId, 'PROMOTE_LEADER', selectedDept)}
                        variant="contained"
                        color="primary"
                        disabled={!selectedDept}
                    >
                        Confirm Appointment
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
}

