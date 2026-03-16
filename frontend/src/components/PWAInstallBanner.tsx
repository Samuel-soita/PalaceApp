import React, { useState, useEffect } from 'react';
import { Box, Button, Snackbar, Alert, Typography, IconButton } from '@mui/material';
import { X, Download, RefreshCw, Wifi, WifiOff, Shield } from 'lucide-react';
import { usePWA } from '../hooks/usePWA';

export default function PWAInstallBanner() {
    const { needRefresh, offlineReady, canInstall, triggerInstall, updateSW, dismissUpdate, dismissInstall } = usePWA();
    const [isOnline, setIsOnline] = useState(navigator.onLine);
    const [showOfflineReady, setShowOfflineReady] = useState(false);

    useEffect(() => {
        const goOnline = () => setIsOnline(true);
        const goOffline = () => setIsOnline(false);
        window.addEventListener('online', goOnline);
        window.addEventListener('offline', goOffline);
        return () => {
            window.removeEventListener('online', goOnline);
            window.removeEventListener('offline', goOffline);
        };
    }, []);

    useEffect(() => {
        if (offlineReady) {
            setShowOfflineReady(true);
            const t = setTimeout(() => setShowOfflineReady(false), 4000);
            return () => clearTimeout(t);
        }
    }, [offlineReady]);

    return (
        <>
            {/* ── Install Banner ─────────────────────────────── */}
            {canInstall && (
                <Box
                    sx={{
                        position: 'fixed',
                        bottom: 24,
                        left: '50%',
                        transform: 'translateX(-50%)',
                        zIndex: 9999,
                        width: { xs: 'calc(100vw - 32px)', sm: 420 },
                        background: 'rgba(16, 20, 32, 0.92)',
                        border: '1px solid rgba(79, 139, 255, 0.35)',
                        backdropFilter: 'blur(20px)',
                        boxShadow: '0 8px 40px rgba(0,0,0,0.5), 0 0 0 1px rgba(79,139,255,0.1)',
                        p: 2.5,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 2,
                        animation: 'slideUp 0.35s cubic-bezier(0.34, 1.56, 0.64, 1)',
                        '@keyframes slideUp': {
                            from: { opacity: 0, transform: 'translateX(-50%) translateY(20px)' },
                            to: { opacity: 1, transform: 'translateX(-50%) translateY(0)' }
                        }
                    }}
                >
                    {/* App icon */}
                    <Box sx={{
                        width: 44, height: 44, flexShrink: 0,
                        background: 'rgba(79, 139, 255, 0.15)',
                        border: '1px solid rgba(79, 139, 255, 0.3)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: '#4f8bff'
                    }}>
                        <Shield size={22} />
                    </Box>

                    <Box flex={1} minWidth={0}>
                        <Typography variant="body2" fontWeight={900} sx={{ letterSpacing: 0.5 }}>
                            Install Prayer Palace
                        </Typography>
                        <Typography variant="caption" sx={{ opacity: 0.55, display: 'block', lineHeight: 1.3 }}>
                            Add to home screen for offline access
                        </Typography>
                    </Box>

                    <Button
                        size="small"
                        variant="contained"
                        startIcon={<Download size={14} />}
                        onClick={triggerInstall}
                        sx={{
                            flexShrink: 0,
                            fontWeight: 900,
                            fontSize: '0.7rem',
                            letterSpacing: 1,
                            px: 2, py: 1,
                            background: 'rgba(79,139,255,0.25)',
                            border: '1px solid rgba(79,139,255,0.5)',
                            '&:hover': { background: 'rgba(79,139,255,0.4)', boxShadow: '0 0 16px rgba(79,139,255,0.4)' }
                        }}
                    >
                        INSTALL
                    </Button>

                    <IconButton
                        size="small"
                        onClick={dismissInstall}
                        sx={{ flexShrink: 0, color: 'text.secondary', p: 0.5 }}
                    >
                        <X size={16} />
                    </IconButton>
                </Box>
            )}

            {/* ── SW Update Snackbar ─────────────────────────── */}
            <Snackbar
                open={needRefresh}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                sx={{ bottom: { xs: canInstall ? 110 : 24, sm: canInstall ? 90 : 24 } }}
            >
                <Alert
                    severity="info"
                    variant="filled"
                    icon={<RefreshCw size={16} />}
                    onClose={dismissUpdate}
                    sx={{
                        background: 'rgba(79, 139, 255, 0.9)',
                        backdropFilter: 'blur(10px)',
                        fontWeight: 700,
                        fontSize: '0.8rem',
                        border: '1px solid rgba(79,139,255,0.5)',
                        '& .MuiAlert-action': { alignItems: 'center' }
                    }}
                    action={
                        <Box display="flex" gap={1} alignItems="center">
                            <Button
                                size="small"
                                color="inherit"
                                onClick={updateSW}
                                sx={{ fontWeight: 900, fontSize: '0.7rem', letterSpacing: 1 }}
                            >
                                REFRESH
                            </Button>
                            <IconButton size="small" color="inherit" onClick={dismissUpdate} sx={{ p: 0.25 }}>
                                <X size={14} />
                            </IconButton>
                        </Box>
                    }
                >
                    New version available
                </Alert>
            </Snackbar>

            {/* ── Offline-ready Toast ────────────────────────── */}
            <Snackbar
                open={showOfflineReady}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                autoHideDuration={4000}
                onClose={() => setShowOfflineReady(false)}
            >
                <Alert
                    severity="success"
                    variant="filled"
                    icon={<Wifi size={16} />}
                    sx={{
                        background: 'rgba(34, 197, 94, 0.85)',
                        backdropFilter: 'blur(10px)',
                        fontWeight: 700,
                        fontSize: '0.8rem',
                        border: '1px solid rgba(34,197,94,0.4)'
                    }}
                >
                    App cached — ready for offline use
                </Alert>
            </Snackbar>

            {/* ── Offline indicator chip ─────────────────────── */}
            {!isOnline && (
                <Box
                    sx={{
                        position: 'fixed',
                        top: 12,
                        left: '50%',
                        transform: 'translateX(-50%)',
                        zIndex: 9999,
                        background: 'rgba(239, 68, 68, 0.92)',
                        border: '1px solid rgba(239,68,68,0.5)',
                        backdropFilter: 'blur(10px)',
                        px: 2, py: 0.75,
                        display: 'flex', alignItems: 'center', gap: 1,
                        animation: 'fadeIn 0.3s ease',
                        '@keyframes fadeIn': { from: { opacity: 0 }, to: { opacity: 1 } }
                    }}
                >
                    <WifiOff size={14} color="white" />
                    <Typography variant="caption" fontWeight={900} sx={{ color: 'white', letterSpacing: 1.5 }}>
                        NO CONNECTION
                    </Typography>
                </Box>
            )}
        </>
    );
}
