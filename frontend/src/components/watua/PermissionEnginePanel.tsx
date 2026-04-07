import React, { useState, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../lib/db';
import { PermissionService } from '../../lib/PermissionService';
import {
    Box, Typography, Paper, Grid, Card, Table, TableBody,
    TableCell, TableContainer, TableHead, TableRow, Switch,
    Button, Chip, TextField, Dialog, DialogTitle, DialogContent,
    DialogActions, List, ListItem, ListItemText, Alert, IconButton,
    Tooltip, CircularProgress
} from '@mui/material';
import { 
    Shield, ShieldCheck, ShieldAlert, History, UserPlus, 
    RefreshCcw, Search, Zap, Filter
} from 'lucide-react';

export default function PermissionEnginePanel() {
    const [tab, setTab] = useState<'MATRIX' | 'AUDIT'>('MATRIX');
    const [searchTerm, setSearchTerm] = useState('');

    // 🏛️ LOCAL-FIRST REACTIVE MATRIX
    // fetch all permissions
    const allPermissions = useLiveQuery(() => db.permissions.toArray()) || [];
    // fetch all roles
    const rolesTable = useLiveQuery(() => db.roles.toArray()) || [];
    // fetch mapping
    const mappings = useLiveQuery(() => db.rolePermissions.toArray()) || [];
    // audit logs locally if implemented
    const auditLogs = useLiveQuery(() => db.syncQueue.where('type').equals('PERMISSION_UPDATE').toArray()) || []; 

    // ✅ Hydrate Roles with their permissions reactively
    const roles = useMemo(() => {
        return rolesTable.map(role => ({
            ...role,
            permissions: mappings
                .filter(m => m.roleId === role.id)
                .map(m => ({
                    permissionId: m.permissionId,
                    permission: allPermissions.find(p => p.id === m.permissionId)
                }))
        }));
    }, [rolesTable, allPermissions, mappings]);

    const isGlobalError = roles.length === 0 && allPermissions.length === 0;

    // ─── MUTATIONS (Cloud Actions) ────────────────────────────────────────────
    const [isSyncing, setIsSyncing] = useState(false);

    const handleSync = async () => {
        setIsSyncing(true);
        try {
            await PermissionService.syncWithCloud();
        } catch (err) {
            console.error('Cloud Sync failed:', err);
        } finally {
            setIsSyncing(false);
        }
    };

    // ─── HANDLERS ─────────────────────────────────────────────────────────────
    const handleToggle = async (role: any, perm: any, active: boolean) => {
        const currentPermIds = role.permissions.map((p: any) => p.permissionId);
        let newPermIds: string[];
        
        if (active) {
            newPermIds = [...currentPermIds, perm.id];
        } else {
            newPermIds = currentPermIds.filter((id: string) => id !== perm.id);
        }

        await PermissionService.updateRolePermissions(role.id, newPermIds);
    };

    if (isGlobalError) {
        return (
            <Box sx={{ p: 4 }}>
                <Alert severity="error" sx={{ mb: 2 }}>
                    Failed to load security matrix. Ensure you have WATUA orchestration clearance and a stable connection to the Cloud Kernel.
                </Alert>
                <Button variant="outlined" onClick={() => handleSync()}>
                    Sync with Cloud
                </Button>
            </Box>
        );
    }

    return (
        <Box sx={{ p: 4 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
                <Box>
                    <Typography variant="h4" fontWeight="900" sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <Zap color="var(--cyan)" size={32} />
                        PERMISSION ENGINE <Chip label="WATUA ONLY" color="error" size="small" sx={{ fontWeight: 900 }} />
                    </Typography>
                    <Typography variant="caption" sx={{ color: 'text.secondary', letterSpacing: 1 }}>
                        CENTRAL PERMISSION MANAGEMENT & ROLE-CAPABILITY MATRIX
                    </Typography>
                </Box>
                    <Button 
                        variant="outlined" 
                        color="inherit"
                        onClick={() => handleSync()}
                        disabled={isSyncing}
                        startIcon={isSyncing ? <CircularProgress size={18} /> : <RefreshCcw size={18} />}
                        sx={{ borderColor: 'var(--cyan)', color: 'var(--cyan)' }}
                    >
                        Sync with Cloud
                    </Button>
                    <Button 
                        variant={tab === 'MATRIX' ? 'contained' : 'outlined'} 
                        onClick={() => setTab('MATRIX')}
                        startIcon={<ShieldCheck size={18} />}
                    >
                        Matrix
                    </Button>
                    <Button 
                        variant={tab === 'AUDIT' ? 'contained' : 'outlined'} 
                        onClick={() => setTab('AUDIT')}
                        startIcon={<History size={18} />}
                    >
                        Audit Logs
                    </Button>
            </Box>

            {tab === 'MATRIX' ? (
                <TableContainer component={Paper} className="holographic-card" sx={{ background: 'hsla(230,25%,10%,0.8) !important' }}>
                    <Table size="small">
                        <TableHead>
                            <TableRow>
                                <TableCell sx={{ fontWeight: 900, color: 'var(--cyan)' }}>PERMISSIONS \ ROLES</TableCell>
                                {roles?.map((role: any) => (
                                    <TableCell key={role.id} align="center" sx={{ fontWeight: 900 }}>
                                        {role.name?.replace(/_/g, ' ')}
                                    </TableCell>
                                ))}
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {allPermissions?.map((perm: any) => (
                                <TableRow key={perm.id} hover>
                                    <TableCell>
                                        <Typography variant="subtitle2" fontWeight="700">
                                            {perm.code?.replace(/_/g, ' ')}
                                        </Typography>
                                        <Typography variant="caption" color="text.secondary">
                                            {perm.description}
                                        </Typography>
                                    </TableCell>
                                    {roles?.map((role: any) => {
                                        const hasPerm = role.permissions?.some((p: any) => p.permissionId === perm.id);
                                        return (
                                            <TableCell key={role.id} align="center">
                                                <Switch 
                                                    size="small"
                                                    checked={hasPerm}
                                                    onChange={(e) => handleToggle(role, perm, e.target.checked)}
                                                    sx={{ 
                                                        '& .MuiSwitch-switchBase.Mui-checked': { color: 'var(--cyan)' },
                                                        '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { backgroundColor: 'var(--cyan)' }
                                                    }}
                                                />
                                            </TableCell>
                                        );
                                    })}
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </TableContainer>
            ) : (
                <TableContainer component={Paper} className="holographic-card">
                    <Table size="small">
                        <TableHead>
                            <TableRow>
                                <TableCell sx={{ fontWeight: 900 }}>Timestamp</TableCell>
                                <TableCell sx={{ fontWeight: 900 }}>Engineer</TableCell>
                                <TableCell sx={{ fontWeight: 900 }}>Action</TableCell>
                                <TableCell sx={{ fontWeight: 900 }}>Details</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {auditLogs?.map((log: any) => (
                                <TableRow key={log.id}>
                                    <TableCell>{new Date(log.createdAt).toLocaleString()}</TableCell>
                                    <TableCell>
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                            <Shield size={14} color="var(--cyan)" />
                                            {log.actor?.name || 'SYSTEM_KERNEL'}
                                        </Box>
                                    </TableCell>
                                    <TableCell>
                                        <Chip 
                                            label={log.actionType} 
                                            size="small" 
                                            color={log.actionType?.includes('UPDATE') ? 'primary' : 'secondary'}
                                            sx={{ fontWeight: 900, borderRadius: 0, fontSize: '0.6rem' }}
                                        />
                                    </TableCell>
                                    <TableCell sx={{ color: 'text.secondary', fontSize: '0.8rem' }}>
                                        {log.metadata?.details || log.details || 'Operational state change recorded.'}
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </TableContainer>
            )}
        </Box>
    );
}
