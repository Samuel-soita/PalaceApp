import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../lib/api-client';
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
    const queryClient = useQueryClient();

    // ─── DATA FETCHING ────────────────────────────────────────────────────────
    const { data: roles, isLoading: rolesLoading } = useQuery(['permissions-roles'], async () => {
        const res = await api.get('/permissions/roles');
        return res.data;
    });

    const { data: allPermissions, isLoading: permsLoading } = useQuery(['permissions-all'], async () => {
        const res = await api.get('/permissions');
        return res.data;
    });

    const { data: auditLogs, isLoading: logsLoading, isError: logsError } = useQuery(['permissions-audit'], async () => {
        const res = await api.get('/permissions/audit-log');
        return res.data;
    });

    const isGlobalError = roles === undefined || allPermissions === undefined;

    // ─── MUTATIONS ────────────────────────────────────────────────────────────
    const toggleMutation = useMutation(async ({ roleId, permissionIds }: { roleId: string, permissionIds: string[] }) => {
        return await api.put(`/permissions/roles/${roleId}/permissions`, { permissionIds });
    }, {
        onSuccess: () => {
            queryClient.invalidateQueries(['permissions-roles']);
            queryClient.invalidateQueries(['permissions-audit']);
        }
    });

    // ─── HANDLERS ─────────────────────────────────────────────────────────────
    const handleToggle = (role: any, perm: any, active: boolean) => {
        const currentPermIds = role.permissions.map((p: any) => p.permissionId);
        let newPermIds: string[];
        
        if (active) {
            newPermIds = [...currentPermIds, perm.id];
        } else {
            newPermIds = currentPermIds.filter((id: string) => id !== perm.id);
        }

        toggleMutation.mutate({ roleId: role.id, permissionIds: newPermIds });
    };

    if (rolesLoading || permsLoading) return <CircularProgress sx={{ display: 'block', m: 'auto', mt: 10 }} />;

    if (isGlobalError) {
        return (
            <Box sx={{ p: 4 }}>
                <Alert severity="error" sx={{ mb: 2 }}>
                    Failed to load security matrix. Ensure you have WATUA orchestration clearance.
                </Alert>
                <Button variant="outlined" onClick={() => queryClient.invalidateQueries()}>
                    Retry Connection
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
                <Box sx={{ display: 'flex', gap: 2 }}>
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
                                            {log.user.name}
                                        </Box>
                                    </TableCell>
                                    <TableCell>
                                        <Chip 
                                            label={log.action} 
                                            size="small" 
                                            color={log.action.includes('UPDATE') ? 'primary' : 'secondary'}
                                            sx={{ fontWeight: 900, borderRadius: 0, fontSize: '0.6rem' }}
                                        />
                                    </TableCell>
                                    <TableCell sx={{ color: 'text.secondary', fontSize: '0.8rem' }}>
                                        {log.details}
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
