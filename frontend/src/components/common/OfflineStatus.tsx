import React, { useState, useEffect } from 'react';
import { Box, Typography, Slide, Paper, IconButton } from '@mui/material';
import { WifiOff, Wifi, Cloud, CheckCircle, RefreshCw, AlertCircle } from 'lucide-react';

/**
 * 🎨 HOLOGRAPHIC OFFLINE STATUS UI
 * Mission: Premium, Non-Intrusive, Real-Time Sync Telemetry
 */

const CHANNEL_NAME = 'palace-sync-telemetry';

export const OfflineStatus: React.FC = () => {
    const [isOnline, setIsOnline] = useState(navigator.onLine);
    const [syncState, setSyncState] = useState({ pendingCount: 0, failedCount: 0, totalCount: 0, lastUpdated: 0 });
    const [showStatus, setShowStatus] = useState(false);

    useEffect(() => {
        const syncChannel = new BroadcastChannel(CHANNEL_NAME);
        
        const handleSyncUpdate = (event: MessageEvent) => {
            if (event.data.type === 'SYNC_UPDATE') {
                setSyncState(event.data);
                if (event.data.pendingCount > 0 || event.data.failedCount > 0) {
                    setShowStatus(true);
                }
            }
        };

        syncChannel.onmessage = handleSyncUpdate;
        
        // ... rest of the logic remains same ...

        const handleOnline = () => {
            setIsOnline(true);
            setShowStatus(true);
            setTimeout(() => setShowStatus(false), 4000);
        };
        const handleOffline = () => {
            setIsOnline(false);
            setShowStatus(true);
        };

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        if (!navigator.onLine) setShowStatus(true);

        return () => {
            syncChannel.close();
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    const hasIssues = syncState.failedCount > 0;
    const isSyncing = syncState.pendingCount > 0 && isOnline;

    if (!showStatus && syncState.pendingCount === 0 && syncState.failedCount === 0) return null;

    return (
        <Slide direction="down" in={showStatus || syncState.pendingCount > 0 || syncState.failedCount > 0}>
            <Paper 
                elevation={0}
                sx={{
                    position: 'fixed', top: 20, left: '50%', transform: 'translateX(-50%) !important',
                    zIndex: 10000, px: 3, py: 1.5,
                    display: 'flex', alignItems: 'center', gap: 2,
                    borderRadius: 0, border: '1px solid',
                    // HOLOGRAPHIC GLASSMORPHISM
                    backdropFilter: 'blur(20px)',
                    bgcolor: isSyncing ? 'rgba(0, 229, 255, 0.1)' : 
                             hasIssues ? 'rgba(255, 68, 68, 0.1)' : 
                             !isOnline ? 'rgba(255, 165, 0, 0.1)' : 'rgba(34, 197, 94, 0.1)',
                    borderColor: isSyncing ? 'rgba(0, 229, 255, 0.4)' : 
                                 hasIssues ? 'rgba(255, 68, 68, 0.4)' : 
                                 !isOnline ? 'rgba(255, 165, 0, 0.4)' : 'rgba(34, 197, 94, 0.4)',
                    boxShadow: isSyncing ? '0 0 30px rgba(0, 229, 255, 0.2)' : 
                               hasIssues ? '0 0 30px rgba(255, 68, 68, 0.2)' : 'none',
                    transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                }}
            >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                    {isSyncing ? (
                        <RefreshCw size={18} color="#00e5ff" style={{ animation: 'spin 2s linear infinite' }} />
                    ) : hasIssues ? (
                        <AlertCircle size={18} color="#ff4444" />
                    ) : !isOnline ? (
                        <WifiOff size={18} color="orange" />
                    ) : (
                        <CheckCircle size={18} color="#22c55e" />
                    )}

                    <Box>
                        <Typography variant="caption" fontWeight="1000" sx={{ 
                            letterSpacing: 1.5, 
                            color: isSyncing ? '#00e5ff' : hasIssues ? '#ff4444' : !isOnline ? 'orange' : '#22c55e',
                            textShadow: '0 0 10px currentColor'
                        }}>
                            {isSyncing ? `DISPATCHING MISSIONS (${syncState.pendingCount})` : 
                             hasIssues ? `SYNC ALERT: ${syncState.failedCount} FAILED` :
                             !isOnline ? `OFFLINE MODE ${syncState.pendingCount > 0 ? `[${syncState.pendingCount} QUEUED]` : ''}` :
                             'PORTAL SYNCHRONIZED'}
                        </Typography>
                    </Box>
                </Box>

                <style>{`
                    @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
                `}</style>
            </Paper>
        </Slide>
    );
};
