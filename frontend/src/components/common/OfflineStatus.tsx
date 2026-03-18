import React, { useState, useEffect } from 'react';
import { Box, Typography, Slide, Paper } from '@mui/material';
import { WifiOff, Wifi, Cloud, CheckCircle } from 'lucide-react';
import { getQueuedActions } from '../../lib/pwa-sync';

export const OfflineStatus: React.FC = () => {
    const [isOnline, setIsOnline] = useState(navigator.onLine);
    const [pendingCount, setPendingCount] = useState(0);
    const [isSyncing, setIsSyncing] = useState(false);
    const [showStatus, setShowStatus] = useState(false);

    useEffect(() => {
        const handleOnline = () => {
            setIsOnline(true);
            setShowStatus(true);
            checkPending();
            // Show "back online" for 3 seconds
            setTimeout(() => setShowStatus(false), 3000);
        };
        const handleOffline = () => {
            setIsOnline(false);
            setShowStatus(true);
            checkPending();
        };

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        checkPending();
        
        // Initial check: if offline, show status
        if (!navigator.onLine) setShowStatus(true);

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    const checkPending = async () => {
        const actions = await getQueuedActions();
        setPendingCount(actions.length);
        if (actions.length > 0) setShowStatus(true);
    };

    // Periodic check for pending actions if online
    useEffect(() => {
        if (!isOnline) return;
        const interval = setInterval(checkPending, 5000);
        return () => clearInterval(interval);
    }, [isOnline]);

    if (!showStatus && pendingCount === 0) return null;

    return (
        <Slide direction="down" in={showStatus || pendingCount > 0} mountOnEnter unmountOnExit>
            <Paper 
                elevation={6}
                sx={{
                    position: 'fixed',
                    top: 16,
                    left: '50%',
                    transform: 'translateX(-50%) !important',
                    zIndex: 2000,
                    px: 3,
                    py: 1,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 2,
                    borderRadius: 10,
                    bgcolor: isOnline ? (pendingCount > 0 ? 'warning.dark' : 'success.dark') : 'error.dark',
                    color: 'white',
                    minWidth: 200,
                }}
            >
                {isOnline ? (
                    pendingCount > 0 ? (
                        <>
                            <Cloud size={18} />
                            <Typography variant="body2" fontWeight="700">
                                SYNCING {pendingCount} PENDING ACTIONS...
                            </Typography>
                        </>
                    ) : (
                        <>
                            <Wifi size={18} />
                            <Typography variant="body2" fontWeight="700">
                                BACK ONLINE
                            </Typography>
                        </>
                    )
                ) : (
                    <>
                        <WifiOff size={18} />
                        <Typography variant="body2" fontWeight="700">
                            OFFLINE MODE {pendingCount > 0 ? `(${pendingCount} QUEUED)` : ''}
                        </Typography>
                    </>
                )}
            </Paper>
        </Slide>
    );
};
