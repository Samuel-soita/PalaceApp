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
    Avatar,
    Switch
} from '@mui/material';
import {
    Activity,
    AlertTriangle,
    CheckCircle,
    XCircle,
    Command,
    Search,
    RefreshCw,
    Calendar,
    Users,
    Shield,
    Smartphone,
    Activity as ActivityIcon,
    Settings,
    Database,
    Trash2,
    ShieldAlert,
    UserPlus,
    Zap,
    Lock,
    Unlock,
    Mail,
    Clock,
    MapPin,
    MoreVertical,
    Terminal,
    Cpu,
    Globe,
    UserCheck,
    ShieldCheck,
    Briefcase,
    PenTool,
    Key,
    ToggleLeft,
    TrendingUp,
    DownloadCloud,
    UploadCloud,
    UserMinus
} from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell } from 'recharts';
import api from '../lib/api-client';
import { exportQueue, importQueue } from '../lib/pwa-sync';
import PermissionEnginePanel from '../components/watua/PermissionEnginePanel.js';

interface User {
    id: string;
    name: string;
    role: 'WATUA' | 'SUPER_ADMIN' | 'SYSTEM_ADMIN' | 'SECRETARY' | 'DEPARTMENT_LEADER' | 'MEMBER' | 'PASTOR' | 'ASSOCIATE_PASTOR';
    status: string;
    isSuspended: boolean;
    membershipNumber: string;
    dob?: string;
    gender?: string;
    idNumber?: string;
    avatarUrl?: string;
    isCardPaid: boolean;
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
    actionType: string;
    entityType: string;
    details: string;
    createdAt: string;
    actor?: { name: string };
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
    const [departments, setDepartments] = useState<{ id: string, name: string }[]>([]);
    const [logs, setLogs] = useState<AuditLog[]>([]);
    const [trash, setTrash] = useState<any[]>([]);
    const [flags, setFlags] = useState<any[]>([]);
    const [governanceData, setGovernanceData] = useState<any>(null);
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
            const [pRes, eRes, plRes, aRes, mRes] = await Promise.all([
                api.get('/projects', { params: { limit: 100 } }),
                api.get('/events', { params: { limit: 100 } }),
                api.get('/plans', { params: { limit: 100 } }),
                api.get('/announcements/all'),
                api.get('/meetings', { params: { limit: 100 } }),
            ]);
            setProjects(Array.isArray(pRes.data.data) ? pRes.data.data : (Array.isArray(pRes.data) ? pRes.data : []));
            setEvents(Array.isArray(eRes.data.data) ? eRes.data.data : (Array.isArray(eRes.data) ? eRes.data : []));
            setPlans(Array.isArray(plRes.data.data) ? plRes.data.data : (Array.isArray(plRes.data) ? plRes.data : []));
            setAnnouncements(Array.isArray(aRes.data) ? aRes.data : (Array.isArray(aRes.data.data) ? aRes.data.data : []));
            setMeetings(Array.isArray(mRes.data.data) ? mRes.data.data : (Array.isArray(mRes.data) ? mRes.data : []));
        } catch (err) {
            console.error('Omni-Fetch Error:', err);
        }
    };

    const fetchData = async () => {
        setLoading(true);
        try {
            const [usersRes, statsRes, diagRes, logsRes, deptsRes, supportRes, trashRes, flagsRes, govRes] = await Promise.all([
                api.get('/users/technical/all', { params: { limit: 1000 } }),
                api.get('/users/technical/stats'),
                api.get('/users/technical/diagnostics'),
                api.get('/users/technical/audit/all'),
                api.get('/departments'),
                api.get('/support'),
                api.get('/users/technical/trash'),
                api.get('/users/technical/flags'),
                api.get('/dashboard/governance')
            ]);
            setUsers(Array.isArray(usersRes.data.data) ? usersRes.data.data : (Array.isArray(usersRes.data) ? usersRes.data : []));
            setStats(statsRes.data);
            setDiagnostics(diagRes.data);
            setLogs(Array.isArray(logsRes.data) ? logsRes.data : (Array.isArray(logsRes.data.data) ? logsRes.data.data : []));
            setDepartments(Array.isArray(deptsRes.data) ? deptsRes.data : (Array.isArray(deptsRes.data.data) ? deptsRes.data.data : []));
            setSupportRequests(Array.isArray(supportRes.data) ? supportRes.data : (Array.isArray(supportRes.data.data) ? supportRes.data.data : []));
            setTrash(trashRes.data);
            setFlags(flagsRes.data);
            setGovernanceData(govRes.data);
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
        } catch (error: any) {
            setMessage({ type: 'error', text: error.response?.data?.error || 'Intervention rejected by kernel.' });
        }
    };

    const handleMarkPaid = async (userId: string, isPaid: boolean) => {
        try {
            await api.patch(`/users/${userId}/mark-paid`, { isPaid });
            setMessage({ type: 'success', text: 'Payment status updated in kernel.' });
            fetchData();
        } catch (error) {
            setMessage({ type: 'error', text: 'Failed to update payment status.' });
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

    const handleRestore = async (id: string, type: string) => {
        try {
            await api.post(`/users/technical/restore/${id}`, { type });
            setMessage({ type: 'success', text: `Resource ${type}:${id} successfully restored to kernel.` });
            fetchData();
        } catch (err: any) {
            setMessage({ type: 'error', text: err.response?.data?.error || 'Restoration failed.' });
        }
    };

    const handleToggleFlag = async (name: string, enabled: boolean, scope: string) => {
        try {
            await api.patch('/users/technical/flags', { name, enabled, scope });
            setMessage({ type: 'success', text: `Feature flag ${name} updated.` });
            fetchData();
        } catch (err: any) {
            setMessage({ type: 'error', text: 'Failed to update feature flag.' });
        }
    };

    const safeUsers = Array.isArray(users) ? users : [];
    const filteredUsers = safeUsers.filter(u =>
        u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.membershipNumber?.includes(searchTerm)
    );

    if (loading && users.length === 0) return (
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="100vh" bgcolor="#0c0e14">
            <CircularProgress color="secondary" />
        </Box>
    );

    return (
        <Box p={{ xs: 2, md: 4 }} bgcolor="#0c0e14" minHeight="100vh">
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
            <Grid container spacing={2} mb={4}>
                <Grid item xs={6} md={3}>
                    <Card sx={{ bgcolor: '#161925', border: '1px solid rgba(193, 117, 255, 0.2)' }}>
                        <CardContent sx={{ p: { xs: 1.5, md: 2 } }}>
                            <Typography variant="caption" color="#94a3b8" display="flex" alignItems="center" gap={1} sx={{ fontSize: { xs: '0.6rem', md: '0.75rem' } }}>
                                <Users size={12} /> TOTAL ENTITIES
                            </Typography>
                            <Typography variant="h5" fontWeight="900" color="#f8fafc" sx={{ fontSize: { xs: '1.25rem', md: '1.5rem' } }}>{stats?.users.total}</Typography>
                        </CardContent>
                    </Card>
                </Grid>
                <Grid item xs={6} md={3}>
                    <Card sx={{ bgcolor: '#161925', border: '1px solid rgba(255, 204, 0, 0.2)' }}>
                        <CardContent sx={{ p: { xs: 1.5, md: 2 } }}>
                            <Typography variant="caption" color="#94a3b8" display="flex" alignItems="center" gap={1} sx={{ fontSize: { xs: '0.6rem', md: '0.75rem' } }}>
                                <AlertTriangle size={12} /> PENDING
                            </Typography>
                            <Typography variant="h5" fontWeight="900" color="#ffcc00" sx={{ fontSize: { xs: '1.25rem', md: '1.5rem' } }}>{stats?.users.pending}</Typography>
                        </CardContent>
                    </Card>
                </Grid>
                <Grid item xs={6} md={3}>
                    <Card sx={{ bgcolor: '#161925', border: '1px solid rgba(0, 212, 255, 0.2)' }}>
                        <CardContent sx={{ p: { xs: 1.5, md: 2 } }}>
                            <Typography variant="caption" color="#94a3b8" display="flex" alignItems="center" gap={1} sx={{ fontSize: { xs: '0.6rem', md: '0.75rem' } }}>
                                <Command size={12} /> UPTIME
                            </Typography>
                            <Typography variant="h5" fontWeight="900" color="#00d4ff" sx={{ fontSize: { xs: '1.25rem', md: '1.5rem' } }}>{diagnostics?.uptime}</Typography>
                        </CardContent>
                    </Card>
                </Grid>
                <Grid item xs={6} md={3}>
                    <Card sx={{ bgcolor: '#161925', border: '1px solid rgba(34, 197, 94, 0.2)' }}>
                        <CardContent sx={{ p: { xs: 1.5, md: 2 } }}>
                            <Typography variant="caption" color="#94a3b8" display="flex" alignItems="center" gap={1} sx={{ fontSize: { xs: '0.6rem', md: '0.75rem' } }}>
                                <CheckCircle size={12} /> KERNEL
                            </Typography>
                            <Typography variant="h5" fontWeight="900" color="#22c55e" sx={{ fontSize: { xs: '1.25rem', md: '1.5rem' } }}>{diagnostics?.status}</Typography>
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
                    <Tab label="Permission Engine" icon={<Key size={18} />} iconPosition="start" />
                    <Tab label="Recovery Hub" icon={<Trash2 size={18} />} iconPosition="start" />
                    <Tab label="Feature Flags" icon={<ToggleLeft size={18} />} iconPosition="start" />
                    <Tab label="Mission Analytics" icon={<TrendingUp size={18} />} iconPosition="start" />
                </Tabs>
            </Box>

            {tab === 0 && (
                <Card sx={{ bgcolor: '#161925', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 0 }}>
                    <CardContent>
                        <Box mb={3} display="flex" gap={2}>
                            <TextField
                                fullWidth
                                placeholder="Locate entity by name or membership..."
                                InputProps={{ startAdornment: <Search size={18} style={{ marginRight: 8, opacity: 0.5 }} /> }}
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                sx={{ '& .MuiOutlinedInput-root': { bgcolor: 'rgba(255,255,255,0.02)' } }}
                            />
                        </Box>

                        <TableContainer component={Paper} sx={{ display: { xs: 'none', md: 'block' }, bgcolor: 'transparent', boxShadow: 'none' }}>
                            <Table size="small">
                                <TableHead>
                                    <TableRow sx={{ '& th': { borderBottom: '1px solid rgba(255,255,255,0.1)', py: 2, fontWeight: 900, textTransform: 'uppercase', fontSize: '0.75rem', color: '#94a3b8' } }}>
                                        <TableCell>ENTITY IDENTIFIER</TableCell>
                                        <TableCell>Role & Hub</TableCell>
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
                                                <Typography variant="body2" fontWeight="bold" sx={{ color: 'var(--cyan)' }}>
                                                    {user.department?.name || 'GLOBAL'}
                                                </Typography>
                                                <Chip label={user.role} size="small" sx={{ height: 20, fontSize: '10px', mt: 0.5 }} />
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
                                                        <IconButton 
                                                            color="success" 
                                                            disabled={!user.isCardPaid}
                                                            onClick={() => handleAction(user.id, 'ACTIVATE')} 
                                                            title={user.isCardPaid ? "Authorize Entry" : "Payment Required"}
                                                        >
                                                            <CheckCircle size={18} />
                                                        </IconButton>
                                                    )}
                                                    <IconButton 
                                                        onClick={() => handleMarkPaid(user.id, !user.isCardPaid)}
                                                        title={user.isCardPaid ? "Revoke Payment" : "Verify Payment"}
                                                        sx={{ color: user.isCardPaid ? '#22c55e' : 'rgba(255,255,255,0.2)' }}
                                                    >
                                                        <Smartphone size={18} />
                                                    </IconButton>
                                                    <IconButton sx={{ color: '#4f8bff' }} onClick={() => setPromoteDialog({ open: true, userId: user.id, name: user.name })} title="Appoint Leader">
                                                        <UserCheck size={18} />
                                                    </IconButton>
                                                    <IconButton sx={{ color: '#c175ff' }} onClick={() => handleAction(user.id, 'MAKE_SUPER_ADMIN')} title="Appoint Bishop (SUPER_ADMIN)">
                                                        <ShieldCheck size={18} />
                                                    </IconButton>
                                                    <IconButton sx={{ color: '#00d4ff' }} onClick={() => handleAction(user.id, 'MAKE_SYSTEM_ADMIN')} title="Appoint Church Admin (SYSTEM_ADMIN)">
                                                        <Briefcase size={18} />
                                                    </IconButton>
                                                    <IconButton sx={{ color: '#94a3b8' }} onClick={() => handleAction(user.id, 'MAKE_SECRETARY')} title="Appoint Secretary">
                                                        <PenTool size={18} />
                                                    </IconButton>
                                                    <IconButton sx={{ color: '#22c55e' }} onClick={() => handleAction(user.id, 'MAKE_PASTOR')} title="Appoint Pastor">
                                                        <Shield size={18} />
                                                    </IconButton>
                                                    <IconButton sx={{ color: '#0ea5e9' }} onClick={() => handleAction(user.id, 'MAKE_ASSOCIATE_PASTOR')} title="Appoint Associate Pastor">
                                                        <UserMinus size={18} />
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

                        {/* Mobile Entity Cards */}
                        <Box sx={{ display: { xs: 'flex', md: 'none' }, flexDirection: 'column', gap: 2 }}>
                            {filteredUsers.map((user) => (
                                <Card key={user.id} sx={{ bgcolor: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.1)' }}>
                                    <CardContent sx={{ p: 2 }}>
                                        <Box display="flex" justifyContent="space-between" alignItems="start" mb={2}>
                                            <Box display="flex" gap={1.5} alignItems="center">
                                                <Avatar src={user.avatarUrl} sx={{ width: 40, height: 40 }}>{user.name.charAt(0)}</Avatar>
                                                <Box>
                                                    <Typography variant="subtitle2" fontWeight="900">{user.name}</Typography>
                                                    <Typography variant="caption" sx={{ opacity: 0.6 }}>{user.role}</Typography>
                                                </Box>
                                            </Box>
                                            <Chip label={user.status} size="small" color={user.status === 'ACTIVE' ? 'success' : 'warning'} />
                                        </Box>
                                        <Box display="flex" justifyContent="space-between" alignItems="center">
                                            <Typography variant="caption" sx={{ color: 'var(--cyan)' }}>{user.department?.name || 'GLOBAL HUB'}</Typography>
                                            <Box display="flex" gap={0.5}>
                                                <IconButton size="small" sx={{ color: '#ffcc00' }} onClick={() => {
                                                    setSelectedUser(user);
                                                    setRepairData({
                                                        name: user.name,
                                                        idNumber: user.idNumber || '',
                                                        dob: user.dob ? user.dob.split('T')[0] : '',
                                                        gender: user.gender || ''
                                                    });
                                                }}><Search size={16} /></IconButton>
                                                {user.status === 'PENDING' && (
                                                    <IconButton size="small" color="success" onClick={() => handleAction(user.id, 'ACTIVATE')}><CheckCircle size={16} /></IconButton>
                                                )}
                                                <IconButton size="small" sx={{ color: '#c175ff' }} onClick={() => handleAction(user.id, 'MAKE_SUPER_ADMIN')}><ShieldCheck size={16} /></IconButton>
                                            </Box>
                                        </Box>
                                    </CardContent>
                                </Card>
                            ))}
                        </Box>
                    </CardContent>
                </Card>
            )}            {tab === 1 && (
                <Card sx={{ bgcolor: '#161925', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 0 }}>
                    <CardContent>
                        <Box mb={3} display="flex" justifyContent="space-between" alignItems="center">
                            <Box display="flex" gap={1} flexWrap="wrap">
                                {(['PROJECT', 'EVENT', 'PLAN', 'ANNOUNCEMENT', 'MEETING'] as const).map((type) => (
                                    <Button
                                        key={type}
                                        size="small"
                                        variant={resourceType === type ? 'contained' : 'outlined'}
                                        onClick={() => setResourceType(type as any)}
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

                        <TableContainer sx={{ display: { xs: 'none', md: 'block' } }}>
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
                                      meetings).map((item: any) => (
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

                        {/* Mobile Resource Cards */}
                        <Box sx={{ display: { xs: 'flex', md: 'none' }, flexDirection: 'column', gap: 2 }}>
                            {(resourceType === 'PROJECT' ? projects : 
                              resourceType === 'EVENT' ? events : 
                              resourceType === 'PLAN' ? plans : 
                              resourceType === 'ANNOUNCEMENT' ? announcements : 
                              meetings).map((item: any) => (
                                <Card key={item.id} sx={{ bgcolor: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.1)' }}>
                                    <CardContent sx={{ p: 2 }}>
                                        <Box display="flex" justifyContent="space-between" mb={1}>
                                            <Typography variant="subtitle2" fontWeight="900" noWrap sx={{ maxWidth: '70%' }}>{item.title || item.name}</Typography>
                                            <Chip label={item.approvalStatus || item.status || 'STATUS'} size="small" variant="outlined" sx={{ height: 18, fontSize: '0.6rem' }} />
                                        </Box>
                                        <Typography variant="caption" sx={{ color: '#00d4ff', display: 'block', mb: 2 }}>{item.department?.name || 'GLOBAL SECTOR'}</Typography>
                                        <Box display="flex" gap={1}>
                                            {(item.approvalStatus === 'PENDING_APPROVAL' || item.status === 'PENDING') && (
                                                <Button size="small" variant="contained" color="success" fullWidth onClick={() => handleForceApproval(resourceType as any, item.id)}>FORCE_AUTH</Button>
                                            )}
                                            <Button size="small" variant="outlined" color="error" fullWidth onClick={() => handleGlobalDelete(resourceType, item.id)}>PURGE</Button>
                                        </Box>
                                    </CardContent>
                                </Card>
                            ))}
                        </Box>
                    </CardContent>
                </Card>
            )}


            {tab === 2 && (
                <Card sx={{ bgcolor: '#161925', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 0 }}>
                    <CardContent>
                        <Typography variant="h6" color="#f8fafc" gutterBottom>Operational Support Requests</Typography>
                        <TableContainer component={Paper} sx={{ display: { xs: 'none', md: 'block' }, bgcolor: 'transparent', boxShadow: 'none' }}>
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

                        {/* Mobile Support Cards */}
                        <Box sx={{ display: { xs: 'flex', md: 'none' }, flexDirection: 'column', gap: 2 }}>
                            {supportRequests.map((req) => (
                                <Card key={req.id} sx={{ bgcolor: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.1)' }}>
                                    <CardContent sx={{ p: 2 }}>
                                        <Box display="flex" justifyContent="space-between" mb={1}>
                                            <Typography variant="subtitle2" fontWeight="900">{req.requester.name}</Typography>
                                            <Chip label={req.status} size="small" color={req.status === 'OPEN' ? 'warning' : 'success'} />
                                        </Box>
                                        <Typography variant="body2" sx={{ opacity: 0.8, mb: 1 }}>{req.title}</Typography>
                                        <Typography variant="h6" fontWeight="900" sx={{ color: '#22c55e' }}>{req.amountRequired}/- <span style={{ fontSize: '0.7rem' }}>KES</span></Typography>
                                    </CardContent>
                                </Card>
                            ))}
                        </Box>
                    </CardContent>
                </Card>
            )}

            {tab === 3 && (
                <Card sx={{ bgcolor: '#161925', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 0 }}>
                    <CardContent>
                        <TableContainer component={Paper} sx={{ display: { xs: 'none', md: 'block' }, bgcolor: 'transparent', boxShadow: 'none' }}>
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
                                                <Typography variant="body2" fontWeight="bold">{log.actor?.name || 'SYSTEM'}</Typography>
                                            </TableCell>
                                            <TableCell>
                                                <Chip
                                                    label={log.actionType}
                                                    size="small"
                                                    variant="outlined"
                                                    sx={{ borderColor: log.actionType?.includes('WATUA') ? '#c175ff' : 'rgba(255,255,255,0.1)', color: log.actionType?.includes('WATUA') ? '#c175ff' : 'inherit' }}
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

                        {/* Mobile Log Cards */}
                        <Box sx={{ display: { xs: 'flex', md: 'none' }, flexDirection: 'column', gap: 2 }}>
                            {logs.map((log) => (
                                <Card key={log.id} sx={{ bgcolor: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.1)' }}>
                                    <CardContent sx={{ p: 2 }}>
                                        <Box display="flex" justifyContent="space-between" mb={1}>
                                            <Typography variant="caption" sx={{ opacity: 0.6 }}>{new Date(log.createdAt).toLocaleTimeString()}</Typography>
                                            <Chip label={log.actionType} size="small" variant="outlined" sx={{ height: 18, fontSize: '0.6rem' }} />
                                        </Box>
                                        <Typography variant="subtitle2" fontWeight="900" mb={0.5}>{log.actor?.name || 'SYSTEM_KERNEL'}</Typography>
                                        <Typography variant="caption" sx={{ opacity: 0.8 }}>{log.details}</Typography>
                                    </CardContent>
                                </Card>
                            ))}
                        </Box>
                    </CardContent>
                </Card>
            )}

            {tab === 4 && (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                    <PermissionEnginePanel />
                    <Card sx={{ bgcolor: '#161925', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 2 }}>
                        <CardContent>
                            <Box display="flex" alignItems="center" gap={2} mb={3}>
                                <Database size={24} color="#00d4ff" />
                                <Box>
                                    <Typography variant="h6" color="#f8fafc">Offline Recovery Hub</Typography>
                                    <Typography variant="caption" sx={{ color: '#94a3b8' }}>
                                        Manage local device synchronization queue and mission integrity.
                                    </Typography>
                                </Box>
                            </Box>
                            
                            <Grid container spacing={3}>
                                <Grid item xs={12} md={6}>
                                    <Box p={3} sx={{ bgcolor: 'rgba(0,212,255,0.03)', border: '1px dashed rgba(0,212,255,0.2)', borderRadius: 2 }}>
                                        <Typography variant="subtitle2" fontWeight="bold" gutterBottom>Export Mission Queue</Typography>
                                        <Typography variant="caption" display="block" sx={{ mb: 2, opacity: 0.7 }}>
                                            Download all currently queued offline actions as a JSON backup for manual recovery.
                                        </Typography>
                                        <Button 
                                            variant="outlined" 
                                            startIcon={<DownloadCloud size={16} />}
                                            onClick={exportQueue}
                                            sx={{ color: '#00d4ff', borderColor: '#00d4ff' }}
                                        >
                                            Export JSON Backup
                                        </Button>
                                    </Box>
                                </Grid>
                                
                                <Grid item xs={12} md={6}>
                                    <Box p={3} sx={{ bgcolor: 'rgba(193,117,255,0.03)', border: '1px dashed rgba(193,117,255,0.2)', borderRadius: 2 }}>
                                        <Typography variant="subtitle2" fontWeight="bold" gutterBottom>Import & Restore Hub</Typography>
                                        <Typography variant="caption" display="block" sx={{ mb: 2, opacity: 0.7 }}>
                                            Restore a mission queue from a JSON file. Warning: This will overwrite local pending actions.
                                        </Typography>
                                        <Button 
                                            variant="outlined" 
                                            component="label"
                                            startIcon={<UploadCloud size={16} />}
                                            sx={{ color: '#c175ff', borderColor: '#c175ff' }}
                                        >
                                            Upload & Restore
                                            <input
                                                type="file"
                                                hidden
                                                accept=".json"
                                                onChange={async (e) => {
                                                    const file = e.target.files?.[0];
                                                    if (file) {
                                                        const reader = new FileReader();
                                                        reader.onload = async (event) => {
                                                            const success = await importQueue(event.target?.result as string);
                                                            if (success) {
                                                                alert('Mission queue restored successfully. Dispatching pending actions...');
                                                            } else {
                                                                alert('Failed to import recovery file. Ensure the format is a valid Palace Dispatch JSON.');
                                                            }
                                                        };
                                                        reader.readAsText(file);
                                                    }
                                                }}
                                            />
                                        </Button>
                                    </Box>
                                </Grid>
                            </Grid>
                        </CardContent>
                    </Card>
                </Box>
            )}

            {tab === 5 && (
                <Card sx={{ bgcolor: '#161925', border: '1px solid rgba(255,,255,255,0.05)', borderRadius: 0 }}>
                    <CardContent>
                        <Typography variant="h6" color="#f8fafc" sx={{ mb: 3 }}>Recovery Center (Trash Bin)</Typography>
                        <TableContainer component={Paper} sx={{ bgcolor: 'transparent', boxShadow: 'none' }}>
                            <Table size="small">
                                <TableHead>
                                    <TableRow sx={{ '& th': { borderBottom: '1px solid rgba(255,255,255,0.1)', py: 2, fontWeight: 900, textTransform: 'uppercase', fontSize: '0.75rem', color: '#94a3b8' } }}>
                                        <TableCell>Entity Type</TableCell>
                                        <TableCell>Name/Identifier</TableCell>
                                        <TableCell>Deleted On</TableCell>
                                        <TableCell>Reason</TableCell>
                                        <TableCell>Action</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {trash.length === 0 && (
                                        <TableRow>
                                            <TableCell colSpan={5} align="center" sx={{ py: 4, color: '#94a3b8' }}>
                                                Trash bin is empty. No recoverable items found.
                                            </TableCell>
                                        </TableRow>
                                    )}
                                    {trash.map((item) => (
                                        <TableRow key={item.id} sx={{ '& td': { borderBottom: '1px solid rgba(255,255,255,0.05)', py: 2, color: '#f8fafc' } }}>
                                            <TableCell><Chip label={item.type} size="small" variant="outlined" sx={{ height: 20, fontSize: '0.6rem' }} /></TableCell>
                                            <TableCell>{item.displayName}</TableCell>
                                            <TableCell>{new Date(item.deletedAt).toLocaleString()}</TableCell>
                                            <TableCell sx={{ opacity: 0.7 }}>{item.deletedReason}</TableCell>
                                            <TableCell>
                                                <Button 
                                                    size="small" 
                                                    startIcon={<RefreshCw size={14} />}
                                                    onClick={() => handleRestore(item.id, item.type.toLowerCase())}
                                                    sx={{ color: '#00d4ff' }}
                                                >
                                                    Restore
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </TableContainer>
                    </CardContent>
                </Card>
            )}

            {tab === 6 && (
                <Card sx={{ bgcolor: '#161925', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 0 }}>
                    <CardContent>
                        <Typography variant="h6" color="#f8fafc" sx={{ mb: 3 }}>System Feature Control Console</Typography>
                        <Grid container spacing={2}>
                            {flags.map((flag) => (
                                <Grid item xs={12} md={6} key={flag.id}>
                                    <Box p={2} sx={{ bgcolor: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <Box>
                                            <Typography variant="body1" fontWeight="bold">{flag.name}</Typography>
                                            <Typography variant="caption" sx={{ color: '#94a3b8' }}>Scope: {flag.scope}</Typography>
                                        </Box>
                                        <Box display="flex" alignItems="center" gap={2}>
                                            <Typography variant="caption" color={flag.enabled ? '#22c55e' : '#ef4444'}>
                                                {flag.enabled ? 'ENABLED' : 'DISABLED'}
                                            </Typography>
                                            <Switch 
                                                checked={flag.enabled} 
                                                onChange={(e) => handleToggleFlag(flag.name, e.target.checked, flag.scope)}
                                                color="secondary"
                                            />
                                        </Box>
                                    </Box>
                                </Grid>
                            ))}
                        </Grid>
                    </CardContent>
                </Card>
            )}            {tab === 7 && (
                <Box>
                    {loading ? (
                        <Box display="flex" justifyContent="center" alignItems="center" height="50vh">
                            <CircularProgress sx={{ color: '#00d4ff' }} />
                        </Box>
                    ) : !governanceData ? (
                         <Box sx={{ p: 4 }}>
                            <Alert severity="info" sx={{ bgcolor: '#0f172a', color: '#00d4ff', border: '1px solid rgba(0, 212, 255, 0.2)' }}>
                                KERNEL_GOVERNANCE_DATA_NOT_SYNCED: Please wait for system telemetry.
                            </Alert>
                         </Box>
                    ) : (
                        <Box sx={{ p: 4, height: '100%', overflowY: 'auto' }}>
                            <Grid container spacing={3}>
                                <Grid item xs={12} md={3}>
                                    <Card sx={{ bgcolor: 'rgba(0, 212, 255, 0.05)', border: '1px solid rgba(0, 212, 255, 0.2)' }}>
                                        <CardContent>
                                            <Typography variant="caption" color="#00d4ff" sx={{ fontWeight: 900 }}>TOTAL MISSION REVENUE</Typography>
                                            <Typography variant="h4" sx={{ color: 'white', mt: 1, fontWeight: 950 }}>
                                                Ksh {governanceData.finance?.totalInflow?.toLocaleString() || 0}
                                            </Typography>
                                        </CardContent>
                                    </Card>
                                </Grid>
                                <Grid item xs={12} md={3}>
                                    <Card sx={{ bgcolor: 'rgba(193, 117, 255, 0.05)', border: '1px solid rgba(193, 117, 255, 0.2)' }}>
                                        <CardContent>
                                            <Typography variant="caption" color="#c175ff" sx={{ fontWeight: 900 }}>COVENANT PARTNERS</Typography>
                                            <Typography variant="h4" sx={{ color: 'white', mt: 1, fontWeight: 950 }}>{governanceData.demographics?.activePartners || 0}</Typography>
                                        </CardContent>
                                    </Card>
                                </Grid>
                                <Grid item xs={12} md={3}>
                                    <Card sx={{ bgcolor: 'rgba(34, 197, 94, 0.05)', border: '1px solid rgba(34, 197, 94, 0.2)' }}>
                                        <CardContent>
                                            <Typography variant="caption" color="#22c55e" sx={{ fontWeight: 900 }}>KERNEL STABILITY</Typography>
                                            <Typography variant="h4" sx={{ color: 'white', mt: 1, fontWeight: 950 }}>{governanceData.health || 'STABLE'}</Typography>
                                        </CardContent>
                                    </Card>
                                </Grid>
                                <Grid item xs={12} md={3}>
                                    <Card sx={{ bgcolor: 'rgba(255, 152, 0, 0.05)', border: '1px solid rgba(255, 152, 0, 0.2)' }}>
                                        <CardContent>
                                            <Typography variant="caption" color="#ff9800" sx={{ fontWeight: 900 }}>PENDING SPIRITUAL REQS</Typography>
                                            <Typography variant="h4" sx={{ color: 'white', mt: 1, fontWeight: 950 }}>{governanceData.operations?.pendingApprovals || 0}</Typography>
                                        </CardContent>
                                    </Card>
                                </Grid>

                                {/* Activity Trend Chart */}
                                <Grid item xs={12}>
                                    <Card sx={{ bgcolor: '#161925', border: '1px solid rgba(255,255,255,0.05)', p: 3 }}>
                                        <Typography variant="h6" color="white" sx={{ mb: 4, fontWeight: 900 }}>Kernel Activity Trend (Last 7 Days)</Typography>
                                        <Box sx={{ height: 300, width: '100%' }}>
                                            <ResponsiveContainer width="100%" height="100%">
                                                <AreaChart data={governanceData.trends || []}>
                                                    <defs>
                                                        <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                                                            <stop offset="5%" stopColor="#00d4ff" stopOpacity={0.3}/>
                                                            <stop offset="95%" stopColor="#00d4ff" stopOpacity={0}/>
                                                        </linearGradient>
                                                    </defs>
                                                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                                                    <XAxis 
                                                        dataKey="date" 
                                                        stroke="rgba(255,255,255,0.3)" 
                                                        fontSize={10} 
                                                        tickFormatter={(str) => str.split('-').slice(1).join('/')}
                                                    />
                                                    <YAxis stroke="rgba(255,255,255,0.3)" fontSize={10} />
                                                    <Tooltip 
                                                        contentStyle={{ backgroundColor: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', color: 'white' }}
                                                        itemStyle={{ color: '#00d4ff' }}
                                                    />
                                                    <Area 
                                                        type="monotone" 
                                                        dataKey="count" 
                                                        stroke="#00d4ff" 
                                                        fillOpacity={1} 
                                                        fill="url(#colorCount)" 
                                                        strokeWidth={3}
                                                    />
                                                </AreaChart>
                                            </ResponsiveContainer>
                                        </Box>
                                    </Card>
                                </Grid>
                            </Grid>
                        </Box>
                    )}
                </Box>
            )}

            {/* Support/Bio Inspector Dialog with REPAIR TOOL */}
            <Dialog
                open={!!selectedUser}
                onClose={() => setSelectedUser(null)}
                PaperProps={{ sx: { bgcolor: '#161925', color: '#f8fafc', border: '1px solid rgba(193, 117, 255, 0.3)', width: '95%', maxWidth: 450, m: 1 } }}
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

