import React, { useState, useEffect } from 'react';
import { Box, Typography, Chip, Tooltip, IconButton, CircularProgress } from '@mui/material';
import { CloudOff, RefreshCw, AlertCircle, CheckCircle2, WifiOff } from 'lucide-react';

/**
 * 🛰️ SYNC INDICATOR - v2.4.0
 * Real-time telemetry for the Palace Dispatch Engine.
 */
export default function SyncIndicator() {
    const [syncState, setSyncState] = useState({
        pendingCount: 0,
        failedCount: 0,
        totalCount: 0,
        online: navigator.onLine
    });

    useEffect(() => {
        const channel = new BroadcastChannel('palace-sync-telemetry');
        
        const handleMessage = (event: MessageEvent) => {
            if (event.data.type === 'SYNC_UPDATE') {
                setSyncState(prev => ({ 
                    ...prev, 
                    ...event.data 
                }));
            }
        };

        const handleOnline = () => setSyncState(prev => ({ ...prev, online: true }));
        const handleOffline = () => setSyncState(prev => ({ ...prev, online: false }));

        channel.onmessage = handleMessage;
        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        return () => {
            channel.close();
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    if (!syncState.online) {
        return (
            <Chip 
                icon={<WifiOff size={14} />}
                label="OFFLINE MODE" 
                size="small"
                sx={{ 
                    bgcolor: 'rgba(255, 0, 0, 0.1)', 
                    color: '#ff4d4d', 
                    fontWeight: 900, 
                    borderRadius: 0,
                    border: '1px solid #ff4d4d',
                    animation: 'pulse 2s infinite'
                }} 
            />
        );
    }

    if (syncState.pendingCount === 0 && syncState.failedCount === 0) {
        return (
            <Tooltip title="All missions synchronized">
                <Box display="flex" alignItems="center" gap={0.5} sx={{ opacity: 0.5 }}>
                    <CheckCircle2 size={14} color="#4caf50" />
                    <Typography variant="caption" fontWeight="900" sx={{ fontSize: '0.6rem' }}>SYNCED</Typography>
                </Box>
            </Tooltip>
        );
    }

    return (
        <Box display="flex" alignItems="center" gap={1}>
            {syncState.pendingCount > 0 && (
                <Chip 
                    icon={<RefreshCw size={12} className="spin" />}
                    label={`${syncState.pendingCount} PENDING`} 
                    size="small"
                    sx={{ 
                        bgcolor: 'rgba(0, 255, 255, 0.1)', 
                        color: 'var(--cyan)', 
                        fontWeight: 900, 
                        borderRadius: 0,
                        border: '1px solid var(--cyan)',
                        '.MuiChip-icon': { animation: 'spin 2s linear infinite' }
                    }} 
                />
            )}
            {syncState.failedCount > 0 && (
                <Chip 
                    icon={<AlertCircle size={12} />}
                    label={`${syncState.failedCount} FAILED`} 
                    size="small"
                    sx={{ 
                        bgcolor: 'rgba(255, 0, 0, 0.1)', 
                        color: '#ff4d4d', 
                        fontWeight: 900, 
                        borderRadius: 0,
                        border: '1px solid #ff4d4d'
                    }} 
                />
            )}
        </Box>
    );
}
