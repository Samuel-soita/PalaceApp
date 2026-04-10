import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../lib/db';
import { InterventionService, InterventionAction } from '../lib/InterventionService';
import { BackupService } from '../lib/BackupService';
import { AuditLogService } from '../lib/AuditLogService';
import { DeviceService } from '../lib/DeviceService';
import api from '../lib/api-client';
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
    Menu,
    InputLabel,
    Avatar,
    Switch,
    Snackbar
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
    FileText,
    Target,
    PenTool,
    Key,
    ToggleLeft,
    TrendingUp,
    DownloadCloud,
    UploadCloud,
    UserCheck as UserCheckIcon,
    UserMinus,
    RotateCcw,
    Droplets,
    Baby,
    Wrench,
    LogOut
} from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell } from 'recharts';
import DashboardLayout from '../components/layout/DashboardLayout';
import EventFormModal from '../components/modals/EventFormModal';
import ProjectFormModal from '../components/modals/ProjectFormModal';
import PlanFormModal from '../components/modals/PlanFormModal';
import AnnouncementFormModal from '../components/modals/AnnouncementFormModal';
import DepartmentReportModal from '../components/modals/DepartmentReportModal';
import PermissionEnginePanel from '../components/watua/PermissionEnginePanel';
import SyncIndicator from '../components/SyncIndicator';
import { PermissionService } from '../lib/PermissionService';

interface User {
    id: string;
    name: string;
    role: string;
    status: string;
    isSuspended: boolean;
    membershipNumber: string;
    dob?: string | Date | null;
    gender?: string | null;
    idNumber?: string | null;
    avatarUrl?: string | null;
    isCardPaid: boolean;
    wrongdoingCount?: number | null;
    departmentId?: string | null;
    department?: {
        id: string;
        name: string;
    } | null;
}

interface Stats {
    users: { total: number; pending: number; leaders: number };
    operations: { projects: number; events: number; departments: number };
    health: string;
    kernelVersion: string;
}

interface SupportRequest {
    id: string;
    description: string;
    amount: number;
    category: string;
    status: string;
    createdAt?: string | Date;
    requestedById: string;
}

interface AuditLogRecord {
    id: string;
    action: string;
    entityType: string;
    targetId?: string;
    timestamp: number;
    deviceId: string;
    metadata?: any;
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
    const { user: currentUser, logout } = useAuth();
    const [tab, setTab] = useState(0);
    
    // 🏛️ LOCAL-FIRST REACTIVE DATA KERNEL (Dexie — Tactical Mirror)
    const users = useLiveQuery(() => db.users.toArray()) || [];
    const projects = useLiveQuery(() => db.projects.toArray()) || [];
    const events = useLiveQuery(() => db.events.toArray()) || [];
    const plans = useLiveQuery(() => db.plans.toArray()) || [];
    const announcements = useLiveQuery(() => db.announcements.toArray()) || [];
    const meetings = useLiveQuery(() => db.meetings.toArray()) || [];
    const baptisms = useLiveQuery(() => db.baptisms.toArray()) || [];
    const dedications = useLiveQuery(() => db.children.toArray()) || [];
    const repairs = useLiveQuery(() => db.repairs.toArray()) || [];
    const supportRequests = useLiveQuery(() => db.supportRequests.toArray()) || []; // ✅ Uses dedicated offline store
    const departments = useLiveQuery(() => db.departments.toArray()) || [];
    const trash = useLiveQuery(() => db.syncQueue.where('status').equals('FAILED').toArray()) || [];
    const auditLogs = useLiveQuery(() => db.auditLogs.orderBy('timestamp').reverse().toArray()) || [];
    const deviceSettings = useLiveQuery(() => db.deviceSettings.get('current_device'));
    const flags = [] as any[];

    // 📡 Network state — drives the offline mission banner
    const [isOffline, setIsOffline] = useState(!navigator.onLine);
    useEffect(() => {
        const goOnline = () => setIsOffline(false);
        const goOffline = () => setIsOffline(true);
        window.addEventListener('online', goOnline);
        window.addEventListener('offline', goOffline);
        return () => {
            window.removeEventListener('online', goOnline);
            window.removeEventListener('offline', goOffline);
        };
    }, []);

    // 📊 REAL-TIME TELEMETRY (Calculated from Local Device DB)
    const stats = useMemo(() => ({
        users: { 
            total: users.length, 
            pending: users.filter(u => u.status === 'PENDING').length, 
            leaders: users.filter(u => u.role === 'DEPARTMENT_LEADER').length 
        },
        operations: { 
            projects: projects.length, 
            events: events.length, 
            departments: departments.length 
        },
        health: 'KERNEL_ACTIVE_LOCAL',
        kernelVersion: '2.5.0-OFFLINE-SYSTEM',
        deviceId: deviceSettings?.deviceId || 'GENERATING...'
    }), [users, projects, events, departments, deviceSettings]);

    const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
    const [menuUserId, setMenuUserId] = useState<string | null>(null);
    const [diagnostics, setDiagnostics] = useState<Diagnostics | null>({ status: 'HEALTHY', uptime: 0, lastIntervention: null });
    const [resourceType, setResourceType] = useState<'PROJECT' | 'EVENT' | 'PLAN' | 'ANNOUNCEMENT' | 'MEETING' | 'ASSET' | 'REPAIR' | 'C_DEDICATION' | 'BAPTISM'>('PROJECT');
    const [governanceData, setGovernanceData] = useState<any>(null);
    const [loading, setLoading] = useState(false);
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

    // Pastor Module Management
    const [moduleDialog, setModuleDialog] = useState<{ open: boolean; userId: string; name: string }>({
        open: false, userId: '', name: ''
    });
    const [pastorModules, setPastorModules] = useState<any[]>([]);
    const [moduleLoading, setModuleLoading] = useState(false);
    
    // Mission Control States
    const [projectModalOpen, setProjectModalOpen] = useState(false);
    const [eventModalOpen, setEventModalOpen] = useState(false);
    const [planModalOpen, setPlanModalOpen] = useState(false);
    const [announcementModalOpen, setAnnouncementModalOpen] = useState(false);
    const [reportModalOpen, setReportModalOpen] = useState(false);

    // ─── Edit States ────────────────────────────────────────────────────────
    const [editingProject, setEditingProject] = useState<any>(null);
    const [editingEvent, setEditingEvent] = useState<any>(null);
    const [editingPlan, setEditingPlan] = useState<any>(null);
    const [editingAnnouncement, setEditingAnnouncement] = useState<any>(null);

    const fetchPastorModules = async (userId: string) => {
        setModuleLoading(true);
        try {
            const res = await api.get(`/users/pastor/assigned-modules?userId=${userId}`);
            if (res.data.success) {
                setPastorModules(res.data.data);
            }
        } catch (err) {
            console.error('Failed to fetch pastor modules', err);
            // Fallback to local data if needed, but modules are primarily cloud-managed for security
            setPastorModules([]);
        } finally {
            setModuleLoading(false);
        }
    };

    const handleToggleModule = async (userId: string, moduleKey: string, active: boolean) => {
        const timestamp = Date.now();
        const existing = pastorModules.find(m => m.moduleKey === moduleKey);

        try {
            // 🚀 Optimistic Update
            if (active) {
                const tempId = crypto.randomUUID();
                const newModule = { id: tempId, pastorId: userId, moduleKey, permissions: ['READ', 'WRITE', 'EXECUTE'], syncStatus: 'PENDING' };
                setPastorModules(prev => [...prev, newModule]);

                // 📡 Physical Dispatch
                await api.post('/users/pastor/modules/assign', { pastorId: userId, moduleKey, permissions: ['READ', 'WRITE', 'EXECUTE'] });
            } else {
                if (!existing) return;
                setPastorModules(prev => prev.filter(m => m.id !== existing.id));

                // 📡 Physical Dispatch
                await api.delete(`/users/pastor/modules/revoke/${existing.id}`);
            }

            setMessage({ type: 'success', text: `Policy ${moduleKey} ${active ? 'applied' : 'decommissioned'} successfully.` });
        } catch (err: any) {
            console.error('Module update failed', err);
            
            // 🛡️ Failed? Queue for Sync Daemon
            await db.syncQueue.put({
                id: crypto.randomUUID(),
                timestamp,
                entity: 'PASTOR_MODULE',
                method: active ? 'POST' : 'DELETE',
                url: active ? '/users/pastor/modules/assign' : `/users/pastor/modules/revoke/${existing?.id}`,
                payload: active ? { pastorId: userId, moduleKey, permissions: ['READ', 'WRITE', 'EXECUTE'] } : {},
                status: 'PENDING',
                retryCount: 0,
                errorLog: []
            });

            setMessage({ type: 'info', text: 'Cloud sync interrupted. Command queued for background deployment.' });
        }
    };

    // ─── LOCAL ACTION HANDLERS ──────────────────────────────────────────────
    const handleGlobalDelete = async (type: string, id: string) => {
        if (!window.confirm('OMNIPOTENT COMMAND: Are you absolutely sure you want to FORCE DELETE this resource? This bypasses all safety checks.')) return;
        try {
            const tableMap: Record<string, any> = {
                'PROJECT': db.projects,
                'EVENT': db.events,
                'PLAN': db.plans,
                'ANNOUNCEMENT': db.announcements,
                'MEETING': db.meetings,
                'REPAIR': db.repairs,
                'BAPTISM': db.baptisms,
                'C_DEDICATION': db.children
            };
            const table = tableMap[type];
            if (table) {
                await table.delete(id);
                setMessage({ text: `${type} purged from local kernel.`, type: 'success' });
            }
        } catch (err) {
            setMessage({ text: `Purge failed: ${err}`, type: 'error' });
        }
    };


    useEffect(() => {
        // 🛡️ INITIALIZE & SYNC SECURITY KERNEL
        // Synchronizes roles and permissions from the backend source of truth.
        // Works offline by falling back to indexedDB cache if the cloud is unreachable.
        PermissionService.syncWithCloud();
        
        setLoading(false);
    }, []);

    const handleOpenMenu = (event: React.MouseEvent<HTMLElement>, userId: string) => {
        setAnchorEl(event.currentTarget);
        setMenuUserId(userId);
    };

    const handleCloseMenu = () => {
        setAnchorEl(null);
        setMenuUserId(null);
    };

    const handleAction = async (userId: string, action: string, departmentId?: string) => {
        try {
            await InterventionService.execute(userId, action as InterventionAction, currentUser?.role || 'MEMBER', departmentId);
            setMessage({ type: 'success', text: `Intervention ${action} applied to local record.` });
            setPromoteDialog({ open: false, userId: '', name: '' });
            setSelectedDept('');
            setSelectedUser(null);
            handleCloseMenu();
        } catch (error: any) {
            setMessage({ type: 'error', text: error.message || 'Intervention rejected by kernel.' });
        }
    };

    const handleMarkPaid = async (userId: string, isPaid: boolean) => {
        try {
            await db.users.update(userId, { isCardPaid: isPaid, syncStatus: 'PENDING' });
            setMessage({ type: 'success', text: 'Payment status updated locally.' });
        } catch (error) {
            setMessage({ type: 'error', text: 'Failed to update payment status.' });
        }
    };

    const handleBioRepair = async () => {
        if (!selectedUser) return;
        try {
            await db.users.update(selectedUser.id, { 
                ...repairData, 
                dob: new Date(repairData.dob).toISOString(),
                syncStatus: 'PENDING' 
            });
            setMessage({ type: 'success', text: 'ENTITY BIO_REPAIR COMPLETE.' });
            setSelectedUser(null);
        } catch (error) {
            setMessage({ type: 'error', text: 'Repair sequence failed.' });
        }
    };

    const handleForceApproval = async (type: 'PROJECT' | 'EVENT' | 'PLAN' | 'ANNOUNCEMENT' | 'MEETING' | 'ASSET' | 'REPAIR' | 'BAPTISM' | 'DEDICATION', id: string) => {
        try {
            await InterventionService.forceApproval(type, id);
            setMessage({ text: `${type} Force-Approved Locally`, type: 'success' });
        } catch (error: any) {
            setMessage({ text: error.message || `Failed to approve ${type}`, type: 'error' });
        }
    };

    const handleBroadcast = async () => {
        if (!broadcastText) return;
        setMessage({ type: 'success', text: 'System-wide broadcast dispatched to all active nodes.' });
        setBroadcastDialog(false);
        setBroadcastText('');
    };

    const handleBackupExport = async () => {
        setLoading(true);
        try {
            await BackupService.exportToJSON();
            setMessage({ type: 'success', text: 'System-wide backup archive generated and downloaded.' });
        } catch (err) {
            setMessage({ type: 'error', text: 'Backup generation failed.' });
        } finally {
            setLoading(false);
        }
    };

    const handleBackupImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        if (!window.confirm('🚧 CRITICAL WARNING: This will OVERWRITE all local kernel data with the backup contents. Are you absolutely sure?')) return;

        setLoading(true);
        try {
            const result = await BackupService.importFromJSON(file);
            if (result.success) {
                setMessage({ type: 'success', text: 'System Restoration Successful. Kernel reloaded.' });
                setTimeout(() => window.location.reload(), 2000);
            } else {
                setMessage({ type: 'error', text: `Restoration Failed: ${result.message}` });
            }
        } catch (err) {
            setMessage({ type: 'error', text: 'Fatal error during restoration sequence.' });
        } finally {
            setLoading(false);
        }
    };

    const handleRestore = async (id: string, type: string) => {
        try {
            // Local Restoration: Move from failed sync/trash back to active state
            await db.syncQueue.delete(id);
            setMessage({ type: 'success', text: `Resource ${type}:${id} successfully restored to local kernel.` });
        } catch (err: any) {
            setMessage({ type: 'error', text: 'Restoration failed.' });
        }
    };

    const handleToggleFlag = async (name: string, enabled: boolean, scope: string) => {
        try {
            // Local Feature Flags: Managed via localStorage or a dedicated table
            localStorage.setItem(`flag_${name}`, JSON.stringify({ enabled, scope }));
            setMessage({ type: 'success', text: `Local feature flag ${name} updated.` });
        } catch (err: any) {
            setMessage({ type: 'error', text: 'Failed to update local feature flag.' });
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
                        onClick={() => window.location.reload()}
                        variant="outlined"
                        color="secondary"
                        sx={{ borderColor: 'rgba(193, 117, 255, 0.3)' }}
                    >
                        Reboot Terminal
                    </Button>
                    <Button
                        startIcon={<LogOut size={18} />}
                        onClick={() => {
                            if (window.confirm('OMNIPOTENT EXIT: Secure terminal session and decommissioning active node?')) {
                                logout();
                            }
                        }}
                        variant="contained"
                        sx={{ 
                            bgcolor: 'rgba(239, 68, 68, 0.2)', 
                            border: '1px solid #ef4444',
                            color: '#ef4444',
                            '&:hover': { bgcolor: 'rgba(239, 68, 68, 0.4)' }
                        }}
                    >
                        Exit Terminal
                    </Button>
                </Box>
            </Box>

            {/* 🛰️ OFFLINE MISSION MODE BANNER */}
            {isOffline && (
                <Alert
                    severity="warning"
                    variant="filled"
                    icon={<Shield size={20} />}
                    sx={{
                        mb: 3,
                        bgcolor: 'rgba(234, 88, 12, 0.15)',
                        border: '1px solid rgba(234, 88, 12, 0.4)',
                        color: '#fb923c',
                        fontWeight: 900,
                        letterSpacing: '0.08em',
                        borderRadius: 0,
                    }}
                    action={<SyncIndicator />}
                >
                    ⚡ WATUA TERMINAL IN OFFLINE MISSION MODE — ALL DATA FROM TACTICAL LOCAL KERNEL. ADMIN ACTIONS WILL BE QUEUED FOR DISPATCH UPON RECONNECT.
                </Alert>
            )}

            {/* More Actions Menu */}
            <Menu
                anchorEl={anchorEl}
                open={Boolean(anchorEl)}
                onClose={handleCloseMenu}
                PaperProps={{
                    sx: {
                        bgcolor: '#161925',
                        border: '1px solid rgba(255,255,255,0.1)',
                        color: 'white',
                        minWidth: 180
                    }
                }}
            >
                <MenuItem 
                    onClick={() => menuUserId && handleAction(menuUserId, users.find(u => u.id === menuUserId)?.isSuspended ? 'UNSUSPEND' : 'SUSPEND')}
                    sx={{ gap: 1.5, fontSize: '0.875rem' }}
                >
                    {users.find(u => u.id === menuUserId)?.isSuspended ? <Unlock size={16} /> : <Lock size={16} />}
                    {users.find(u => u.id === menuUserId)?.isSuspended ? 'Lift Suspension' : 'Suspend Account'}
                </MenuItem>
                <MenuItem 
                    onClick={() => menuUserId && handleAction(menuUserId, 'RESET_STRIKES')}
                    sx={{ gap: 1.5, fontSize: '0.875rem', color: '#22c55e' }}
                >
                    <RotateCcw size={16} /> Reset Strikes
                </MenuItem>
                <MenuItem 
                    onClick={() => {
                        if (menuUserId && window.confirm('DANGER: This will demote the leader to a regular member. Continue?')) {
                            handleAction(menuUserId, 'DEMOTE_MEMBER');
                        }
                    }}
                    sx={{ gap: 1.5, fontSize: '0.875rem', color: '#ef4444' }}
                >
                    <UserMinus size={16} /> Demote to Member
                </MenuItem>
            </Menu>

            {/* Broadcast Dialog */}
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
                                <Smartphone size={12} /> DEVICE IDENTITY
                            </Typography>
                            <Typography variant="h5" fontWeight="900" color="#00d4ff" sx={{ fontSize: { xs: '1.25rem', md: '1.1rem' }, textTransform: 'uppercase' }}>
                                {stats.deviceId.split('-')[0]}...
                            </Typography>
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
                    <Tab label="Mission Control" icon={<Zap size={18} />} iconPosition="start" />
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
                                                        dob: user.dob ? (typeof user.dob === 'string' ? user.dob.split('T')[0] : user.dob.toISOString().split('T')[0]) : '',
                                                        gender: user.gender || ''
                                                    });
                                                }}>
                                                    <Avatar 
                                                        src={user.avatarUrl || undefined} 
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
                                                    {user.departmentId || 'GLOBAL'}
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
                                                    <IconButton sx={{ color: '#c175ff' }} onClick={() => handleAction(user.id, 'MAKE_WATUA')} title="Verify as Watua (SYSTEM_ENGINEER)">
                                                        <Settings size={18} />
                                                    </IconButton>
                                                    <IconButton sx={{ color: '#94a3b8' }} onClick={() => handleAction(user.id, 'MAKE_SECRETARY')} title="Appoint Secretary">
                                                        <PenTool size={18} />
                                                    </IconButton>
                                                    <IconButton sx={{ color: '#22c55e' }} onClick={() => handleAction(user.id, 'MAKE_PASTOR')} title="Appoint Pastor">
                                                        <Shield size={18} />
                                                    </IconButton>
                                                    <IconButton sx={{ color: '#0ea5e9' }} onClick={() => handleAction(user.id, 'MAKE_ASSOCIATE_PASTOR')} title="Appoint Associate Pastor">
                                                        <UserCheckIcon size={18} />
                                                    </IconButton>
                                                    {(user.role === 'PASTOR' || user.role === 'ASSOCIATE_PASTOR') && (
                                                        <IconButton 
                                                           sx={{ color: 'var(--cyan)' }} 
                                                           onClick={() => {
                                                               setModuleDialog({ open: true, userId: user.id, name: user.name });
                                                               fetchPastorModules(user.id);
                                                           }} 
                                                           title="Manage Pastor Modules"
                                                        >
                                                            <Zap size={18} />
                                                        </IconButton>
                                                    )}
                                                    <IconButton sx={{ color: '#ffcc00' }} onClick={() => {
                                                        setSelectedUser(user);
                                                        setRepairData({
                                                            name: user.name,
                                                            idNumber: user.idNumber || '',
                                                            dob: user.dob ? (typeof user.dob === 'string' ? user.dob.split('T')[0] : user.dob.toISOString().split('T')[0]) : '',
                                                            gender: user.gender || ''
                                                        });
                                                    }} title="Bio Inspector">
                                                        <Search size={18} />
                                                    </IconButton>
                                                    <IconButton 
                                                        sx={{ color: '#94a3b8' }} 
                                                        onClick={(e) => handleOpenMenu(e, user.id)}
                                                        title="More Interventions"
                                                    >
                                                        <MoreVertical size={18} />
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
                                                <Avatar src={user.avatarUrl || undefined} sx={{ width: 40, height: 40 }}>{user.name.charAt(0)}</Avatar>
                                                <Box>
                                                    <Typography variant="subtitle2" fontWeight="900">{user.name}</Typography>
                                                    <Typography variant="caption" sx={{ opacity: 0.6 }}>{user.role}</Typography>
                                                </Box>
                                            </Box>
                                            <Chip label={user.status} size="small" color={user.status === 'ACTIVE' ? 'success' : 'warning'} />
                                        </Box>
                                        <Box display="flex" justifyContent="space-between" alignItems="center">
                                            <Typography variant="caption" sx={{ color: 'var(--cyan)' }}>{user.departmentId || 'GLOBAL HUB'}</Typography>
                                            <Box display="flex" gap={0.5}>
                                                <IconButton size="small" sx={{ color: '#ffcc00' }} onClick={() => {
                                                    setSelectedUser(user);
                                                    setRepairData({
                                                        name: user.name,
                                                        idNumber: user.idNumber || '',
                                                        dob: user.dob ? (typeof user.dob === 'string' ? user.dob.split('T')[0] : user.dob.toISOString().split('T')[0]) : '',
                                                        gender: user.gender || ''
                                                    });
                                                }}><Search size={16} /></IconButton>
                                                {user.status === 'PENDING' && (
                                                    <IconButton size="small" color="success" onClick={() => handleAction(user.id, 'ACTIVATE')}><CheckCircle size={16} /></IconButton>
                                                )}
                                                <IconButton size="small" sx={{ color: '#c175ff' }} onClick={() => handleAction(user.id, 'MAKE_SUPER_ADMIN')}><ShieldCheck size={16} /></IconButton>
                                                {(user.role === 'PASTOR' || user.role === 'ASSOCIATE_PASTOR') && (
                                                    <IconButton 
                                                       size="small" 
                                                       sx={{ color: 'var(--cyan)' }} 
                                                       onClick={() => {
                                                           setModuleDialog({ open: true, userId: user.id, name: user.name });
                                                           fetchPastorModules(user.id);
                                                       }}
                                                    >
                                                        <Zap size={16} />
                                                    </IconButton>
                                                )}
                                                <IconButton 
                                                   size="small" 
                                                   sx={{ color: '#94a3b8' }} 
                                                   onClick={(e) => handleOpenMenu(e, user.id)}
                                                >
                                                    <MoreVertical size={16} />
                                                </IconButton>
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
                                {(['PROJECT', 'EVENT', 'PLAN', 'ANNOUNCEMENT', 'MEETING', 'REPAIR', 'BAPTISM', 'C_DEDICATION'] as const).map((type) => (
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
                                        {type === 'C_DEDICATION' ? 'DEDICATIONS' : type + 'S'}
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
                                      resourceType === 'MEETING' ? meetings :
                                      resourceType === 'REPAIR' ? repairs :
                                      resourceType === 'BAPTISM' ? baptisms :
                                      dedications).map((item: any) => (
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
                                                    <IconButton color="primary" size="small" onClick={() => {
                                                        const type = resourceType;
                                                        if (type === 'PROJECT') { setEditingProject(item); setProjectModalOpen(true); }
                                                        if (type === 'EVENT') { setEditingEvent(item); setEventModalOpen(true); }
                                                        if (type === 'PLAN') { setEditingPlan(item); setPlanModalOpen(true); }
                                                        if (type === 'ANNOUNCEMENT') { setEditingAnnouncement(item); setAnnouncementModalOpen(true); }
                                                    }} title="TECHNICAL OVERRIDE EDIT">
                                                        <PenTool size={16} />
                                                    </IconButton>
                                                    {(item.approvalStatus === 'PENDING_APPROVAL' || item.status === 'PENDING' || item.meetingStatus === 'PENDING_APPROVAL' || item.workflowStatus === 'PENDING_DEDICATION' || item.status === 'PENDING_PASTOR_APPROVAL') && (
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
                              resourceType === 'MEETING' ? meetings :
                              resourceType === 'REPAIR' ? repairs :
                              resourceType === 'BAPTISM' ? baptisms :
                              dedications).map((item: any) => (
                                <Card key={item.id} sx={{ bgcolor: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.1)' }}>
                                    <CardContent sx={{ p: 2 }}>
                                        <Box display="flex" justifyContent="space-between" mb={1}>
                                            <Typography variant="subtitle2" fontWeight="900" noWrap sx={{ maxWidth: '70%' }}>{item.title || item.name || item.instrumentName}</Typography>
                                            <Chip label={item.approvalStatus || item.status || item.workflowStatus || item.meetingStatus || 'STATUS'} size="small" variant="outlined" sx={{ height: 18, fontSize: '0.6rem' }} />
                                        </Box>
                                        <Typography variant="caption" sx={{ color: '#00d4ff', display: 'block', mb: 2 }}>{item.department?.name || 'GLOBAL SECTOR'}</Typography>
                                        <Box display="flex" gap={1}>
                                            {(item.approvalStatus === 'PENDING_APPROVAL' || item.status === 'PENDING' || item.meetingStatus === 'PENDING_APPROVAL' || item.workflowStatus === 'PENDING_DEDICATION' || item.status === 'PENDING_PASTOR_APPROVAL') && (
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
                                            <TableCell>{req.requestedById?.split('-')[0] || 'Unknown'}</TableCell>
                                            <TableCell>
                                                <Typography variant="body2" fontWeight="bold">{req.description}</Typography>
                                                <Typography variant="caption" sx={{ opacity: 0.6 }}>{req.category}</Typography>
                                            </TableCell>
                                            <TableCell>{req.amount || 0}/- KES</TableCell>
                                            <TableCell>
                                                <Chip label={req.status} size="small" color={req.status === 'PENDING' ? 'warning' : 'success'} />
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
                                            <Typography variant="subtitle2" fontWeight="900">{req.requestedById?.split('-')[0] || 'Unknown'}</Typography>
                                            <Chip label={req.status} size="small" color={req.status === 'PENDING' ? 'warning' : 'success'} />
                                        </Box>
                                        <Typography variant="body2" sx={{ opacity: 0.8, mb: 1 }}>{req.description}</Typography>
                                        <Typography variant="h6" fontWeight="900" sx={{ color: '#22c55e' }}>{req.amount || 0}/- <span style={{ fontSize: '0.7rem' }}>KES</span></Typography>
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
                        <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
                            <Typography variant="h6" color="#f8fafc">Immutable Intervention Logs</Typography>
                            <Chip label={`${auditLogs.length} Records`} size="small" variant="outlined" sx={{ color: '#00d4ff' }} />
                        </Box>
                        <TableContainer component={Paper} sx={{ display: { xs: 'none', md: 'block' }, bgcolor: 'transparent', boxShadow: 'none' }}>
                            <Table size="small">
                                <TableHead>
                                    <TableRow sx={{ '& th': { borderBottom: '1px solid rgba(255,255,255,0.1)', py: 2, fontWeight: 900, textTransform: 'uppercase', fontSize: '0.75rem', color: '#94a3b8' } }}>
                                        <TableCell>Timestamp</TableCell>
                                        <TableCell>Device ID</TableCell>
                                        <TableCell>Action</TableCell>
                                        <TableCell>Outcome Details</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {auditLogs.map((log) => (
                                        <TableRow key={log.id} sx={{ '& td': { borderBottom: '1px solid rgba(255,255,255,0.05)', py: 2, color: '#f8fafc' } }}>
                                            <TableCell>
                                                <Typography variant="caption">{new Date(log.timestamp).toLocaleString()}</Typography>
                                            </TableCell>
                                            <TableCell>
                                                <Chip label={log.deviceId.split('-')[0]} size="small" variant="outlined" sx={{ height: 18, fontSize: '9px' }} />
                                            </TableCell>
                                            <TableCell>
                                                <Chip
                                                    label={log.action}
                                                    size="small"
                                                    variant="outlined"
                                                    sx={{ borderColor: '#c175ff', color: '#c175ff', fontWeight: 900 }}
                                                />
                                            </TableCell>
                                            <TableCell>
                                                <Typography variant="caption" sx={{ opacity: 0.7 }}>
                                                    {log.entityType}: {log.targetId?.split('-')[0] || 'N/A'}... 
                                                    {log.metadata ? ` | Meta: ${JSON.stringify(log.metadata).slice(0, 50)}` : ''}
                                                </Typography>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </TableContainer>

                        {/* Mobile Log Cards */}
                        <Box sx={{ display: { xs: 'flex', md: 'none' }, flexDirection: 'column', gap: 2 }}>
                            {auditLogs.map((log) => (
                                <Card key={log.id} sx={{ bgcolor: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.1)' }}>
                                    <CardContent sx={{ p: 2 }}>
                                        <Box display="flex" justifyContent="space-between" mb={1}>
                                            <Typography variant="caption" sx={{ opacity: 0.6 }}>{new Date(log.timestamp).toLocaleTimeString()}</Typography>
                                            <Chip label={log.action} size="small" variant="outlined" sx={{ height: 18, fontSize: '0.6rem', color: '#c175ff' }} />
                                        </Box>
                                        <Typography variant="subtitle2" fontWeight="900" mb={0.5}>Entity: {log.entityType}</Typography>
                                        <Typography variant="caption" sx={{ opacity: 0.8, display: 'block' }}>Ref: {log.targetId}</Typography>
                                    </CardContent>
                                </Card>
                            ))}
                        </Box>
                    </CardContent>
                </Card>
            )}

            {tab === 4 && (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                    <Card sx={{ bgcolor: '#161925', border: '1px solid #00d4ff33', borderRadius: 0 }}>
                        <CardContent>
                            <Box display="flex" alignItems="center" gap={2} mb={3}>
                                <Database size={24} color="#00d4ff" />
                                <Box>
                                    <Typography variant="h6" color="#f8fafc">Production System Resilience</Typography>
                                    <Typography variant="caption" sx={{ color: '#94a3b8' }}>
                                        Execute local kernel backups and restoration sequences for disaster recovery.
                                    </Typography>
                                </Box>
                            </Box>
                            
                            <Grid container spacing={4}>
                                <Grid item xs={12} md={6}>
                                    <Paper sx={{ p: 3, bgcolor: 'rgba(0, 212, 255, 0.02)', border: '1px solid rgba(0, 212, 255, 0.1)', borderRadius: 0 }}>
                                        <Typography variant="subtitle2" color="#f8fafc" gutterBottom>KERNEL EXPORT (BACKUP)</Typography>
                                        <Typography variant="caption" sx={{ display: 'block', mb: 3, color: '#94a3b8' }}>
                                            Creates a master JSON archive of all local database tables including audit logs, user records, and operational tasks.
                                        </Typography>
                                        <Button 
                                            variant="contained" 
                                            fullWidth 
                                            startIcon={<DownloadCloud size={18} />} 
                                            onClick={handleBackupExport}
                                            sx={{ bgcolor: '#00d4ff', color: '#0c0e14', fontWeight: 900 }}
                                        >
                                            EXPORT MASTER JSON
                                        </Button>
                                    </Paper>
                                </Grid>
                                <Grid item xs={12} md={6}>
                                    <Paper sx={{ p: 3, bgcolor: 'rgba(255, 77, 77, 0.02)', border: '1px solid rgba(255, 77, 77, 0.1)', borderRadius: 0 }}>
                                        <Typography variant="subtitle2" color="#f8fafc" gutterBottom>KERNEL IMPORT (RESTORE)</Typography>
                                        <Typography variant="caption" sx={{ display: 'block', mb: 3, color: '#94a3b8' }}>
                                            RESTORES the system from a master JSON archive. WARNING: This operation is destructive and replaces existing local data.
                                        </Typography>
                                        <label htmlFor="restore-upload">
                                            <input
                                                style={{ display: 'none' }}
                                                id="restore-upload"
                                                type="file"
                                                accept=".json"
                                                onChange={handleBackupImport}
                                            />
                                            <Button 
                                                component="span"
                                                variant="outlined" 
                                                fullWidth 
                                                startIcon={<UploadCloud size={18} />} 
                                                sx={{ borderColor: '#ff4d4d', color: '#ff4d4d', fontWeight: 900 }}
                                            >
                                                IMPORT & RESTORE
                                            </Button>
                                        </label>
                                    </Paper>
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
                                            <TableCell><Chip label={item.entity} size="small" variant="outlined" sx={{ height: 20, fontSize: '0.6rem' }} /></TableCell>
                                            <TableCell>{item.url}</TableCell>
                                            <TableCell>{new Date(item.timestamp).toLocaleString()}</TableCell>
                                            <TableCell sx={{ opacity: 0.7 }}>{item.lastError || 'No error details'}</TableCell>
                                            <TableCell>
                                                <Button 
                                                    size="small" 
                                                    startIcon={<RefreshCw size={14} />}
                                                    onClick={() => handleRestore(item.id, item.entity.toLowerCase())}
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
                {/* Pastor Module Management Dialog */}
            <Dialog open={moduleDialog.open} onClose={() => setModuleDialog({ ...moduleDialog, open: false })} maxWidth="xs" fullWidth>
                <DialogTitle sx={{ bgcolor: '#161925', color: '#f8fafc', fontWeight: 900 }}>
                    <Box display="flex" alignItems="center" gap={1}>
                        <Zap size={20} color="var(--cyan)" />
                        PASTORAL MODULES: {moduleDialog.name.toUpperCase()}
                    </Box>
                </DialogTitle>
                <DialogContent sx={{ bgcolor: '#161925', color: '#f8fafc', pt: 2 }}>
                    <Typography variant="caption" sx={{ opacity: 0.6, mb: 2, display: 'block' }}>
                        ENABLE OR DISABLE DYNAMIC CAPABILITIES FOR THIS ENTITY.
                    </Typography>
                    {moduleLoading ? <CircularProgress size={24} sx={{ m: 'auto', display: 'block' }} /> : (
                        <Stack spacing={2}>
                            {[
                                'DevotionPublishing',
                                'EventOversight',
                                'IntelligencePublishing',
                                'PartnershipManagement',
                                'ChildDedicationRegistry'
                            ].map((moduleKey) => {
                                const isActive = pastorModules.some(m => m.moduleKey === moduleKey);
                                return (
                                    <Box key={moduleKey} display="flex" justifyContent="space-between" alignItems="center" p={1.5} sx={{ bgcolor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}>
                                        <Typography variant="body2" fontWeight="700">{moduleKey}</Typography>
                                        <Switch 
                                            size="small" 
                                            checked={isActive} 
                                            onChange={(e) => handleToggleModule(moduleDialog.userId, moduleKey, e.target.checked)} 
                                        />
                                    </Box>
                                );
                            })}
                        </Stack>
                    )}
                </DialogContent>
                <DialogActions sx={{ bgcolor: '#161925', p: 2 }}>
                    <Button onClick={() => setModuleDialog({ ...moduleDialog, open: false })} variant="outlined" color="secondary" fullWidth sx={{ borderRadius: 0 }}>
                        DISMISS
                    </Button>
                </DialogActions>
            </Dialog>

            <Snackbar open={message.text !== ''} autoHideDuration={6000} onClose={() => setMessage({ ...message, text: '' })}>
                <Alert severity={message.type as any} sx={{ width: '100%', fontWeight: 800 }}>{message.text}</Alert>
            </Snackbar>

            {tab === 8 && (
                <Card sx={{ mt: 2, bgcolor: '#161925', border: '1px solid rgba(193, 117, 255, 0.2)', borderRadius: 0 }}>
                    <CardContent>
                        <Box sx={{ mb: 4 }}>
                            <Typography variant="h5" fontWeight="900" sx={{ color: '#f8fafc', letterSpacing: '-0.02em', mb: 1 }}>
                                MISSION CONTROL TERMINAL
                            </Typography>
                            <Typography variant="caption" sx={{ color: '#94a3b8', fontWeight: 600 }}>
                                EXECUTE KERNEL-LEVEL OPERATIONAL COMMANDS
                            </Typography>
                        </Box>

                        <Grid container spacing={3}>
                            {[
                                { label: 'NEW PROJECT', icon: Briefcase, color: '#00d4ff', onClick: () => setProjectModalOpen(true) },
                                { label: 'HOST EVENT', icon: Calendar, color: '#c175ff', onClick: () => setEventModalOpen(true) },
                                { label: 'STRATEGIC PLAN', icon: Target, color: '#ffcc00', onClick: () => setPlanModalOpen(true) },
                                { label: 'SUBMIT REPORT', icon: FileText, color: '#22c55e', onClick: () => setReportModalOpen(true) },
                                { label: 'SYSTEM ALERT', icon: AlertTriangle, color: '#ff4d4d', onClick: () => setAnnouncementModalOpen(true) },
                                { 
                                    label: 'NUCLEAR FLUSH', 
                                    icon: Trash2, 
                                    color: '#ef4444', 
                                    onClick: async () => {
                                        if (window.confirm('🚧 OMNIPOTENT WIPE: Delete all local tactical cache and mirrored data? This will force a full resync.')) {
                                            await db.delete();
                                            localStorage.clear();
                                            sessionStorage.clear();
                                            window.location.reload();
                                        }
                                    } 
                                },
                            ].map((action, i) => (
                                <Grid item xs={12} sm={6} md={4} key={i}>
                                    <Button
                                        fullWidth
                                        variant="outlined"
                                        onClick={action.onClick}
                                        sx={{
                                            py: 4, display: 'flex', flexDirection: 'column', gap: 2,
                                            border: `1px solid ${action.color}44`,
                                            bgcolor: 'rgba(255,255,255,0.01)',
                                            borderRadius: 0,
                                            color: '#f8fafc',
                                            '&:hover': {
                                                bgcolor: `${action.color}11`,
                                                borderColor: action.color,
                                                transform: 'translateY(-4px)',
                                                boxShadow: `0 8px 16px -4px ${action.color}33`
                                            }
                                        }}
                                    >
                                        <action.icon size={28} color={action.color} />
                                        <Typography variant="subtitle2" fontWeight="900" sx={{ letterSpacing: 1 }}>{action.label}</Typography>
                                    </Button>
                                </Grid>
                            ))}
                        </Grid>
                    </CardContent>
                </Card>
            )}

            <EventFormModal open={eventModalOpen} onClose={() => { setEventModalOpen(false); setEditingEvent(null); }} event={editingEvent} onSuccess={() => {}} />
            <ProjectFormModal open={projectModalOpen} onClose={() => { setProjectModalOpen(false); setEditingProject(null); }} project={editingProject} onSuccess={() => {}} />
            <PlanFormModal open={planModalOpen} onClose={() => { setPlanModalOpen(false); setEditingPlan(null); }} plan={editingPlan} onSuccess={() => {}} />
            <AnnouncementFormModal open={announcementModalOpen} onClose={() => { setAnnouncementModalOpen(false); setEditingAnnouncement(null); }} announcement={editingAnnouncement} onSuccess={() => {}} />
            <DepartmentReportModal open={reportModalOpen} onClose={() => setReportModalOpen(false)} onSuccess={() => {}} />
        </Box>
    );
}

const Stack = ({ children, spacing }: { children: React.ReactNode, spacing: number }) => (
    <Box display="flex" flexDirection="column" gap={spacing}>{children}</Box>
);

